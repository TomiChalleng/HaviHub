// havihub-windows.exe: keeps the windows of Havi Hub's engine (an official
// Prism Launcher build) titled "Havi Hub", with Havi Hub's icon, and grouped
// with Havi Hub on the taskbar. Prism Launcher has its name and icon compiled
// in, so they are changed from outside: whenever an engine window is created,
// shown or renamed (WinEvents), plus a scan every second as a safety net.
//
//   havihub-windows.exe --dir <engine folder> [--exe <engine.exe>]... --icon <file.ico>
//                       [--title "Havi Hub"] [--aumid <AppUserModelID>] [--parent <pid>] [--log <file>]
//
// Only windows of processes whose executable is <engine folder>\...\prismlauncher.exe
// (or one of the --exe files) are touched; the game's own window never is.
// One helper runs at a time. It ends when Havi Hub has closed and no engine is
// running, or after 45 seconds without engines.
//
// Build (from Linux or Windows): python -m ziglang cc -target x86_64-windows-gnu -Os -s
//   havihub-windows.c havihub-windows.rc -o havihub-windows.exe -luser32 -lshell32 -lole32
//   -Wl,--subsystem,windows        (see scripts/build-helper.mjs)
#define WIN32_LEAN_AND_MEAN
#ifndef _WIN32_WINNT
#define _WIN32_WINNT 0x0601
#endif
#define COBJMACROS
#include <windows.h>
#include <shellapi.h>
#include <tlhelp32.h>
#include <propsys.h>
#include <wchar.h>
#include <wctype.h>
#include <stdarg.h>
#include <stdio.h>

#define PATHCAP 1024
#define MAX_EXES 8
#define CACHE_MAX 128

static wchar_t g_dir[PATHCAP];  // lowercase, back slashes, ends with '\'
static wchar_t g_exes[MAX_EXES][PATHCAP];
static int g_exeCount;
static wchar_t g_title[256] = L"Havi Hub";
static wchar_t g_aumid[256];
static HICON g_iconBig;
static HICON g_iconSmall;
static HANDLE g_parent;
static BOOL g_parentMissing;  // --parent given but that process is already gone
static DWORD g_noEngineSince;
static BOOL g_comReady;

typedef struct {
  DWORD pid;
  BOOL engine;
} PidEntry;
static PidEntry g_cache[CACHE_MAX];
static int g_cacheCount;
static HANDLE g_log = INVALID_HANDLE_VALUE;  // --log <file>: what the helper does
static BOOL g_verbose;                       // --verbose 1: every engine window

static void logf(const wchar_t *fmt, ...) {
  if (g_log == INVALID_HANDLE_VALUE) return;
  wchar_t w[1200];
  va_list ap;
  va_start(ap, fmt);
  _vsnwprintf(w, 1199, fmt, ap);
  va_end(ap);
  w[1199] = 0;
  char u[3600];
  int n = WideCharToMultiByte(CP_UTF8, 0, w, -1, u, sizeof(u) - 2, NULL, NULL);
  if (n <= 0) return;
  u[n - 1] = '\n';
  DWORD wrote;
  WriteFile(g_log, u, (DWORD)n, &wrote, NULL);
}

// PKEY_AppUserModel_ID and IID_IPropertyStore (defined here: no extra libraries)
static const PROPERTYKEY HH_PKEY_AUMID = {{0x9F4C2855, 0x9F79, 0x4B39, {0xA8, 0xD0, 0xE1, 0xD4, 0x2D, 0xE1, 0xD5, 0xF3}}, 5};
static const IID HH_IID_IPropertyStore = {0x886d8eeb, 0x8cf2, 0x4446, {0x8d, 0x02, 0xcd, 0xba, 0x1d, 0xbd, 0xcf, 0x99}};

// back slashes and lowercase (Unicode-aware: profile folders may have accents)
static void normalizePath(wchar_t *s) {
  for (wchar_t *p = s; *p; p++)
    if (*p == L'/') *p = L'\\';
  CharLowerBuffW(s, (DWORD)wcslen(s));
}

static BOOL processImage(DWORD pid, wchar_t *out, DWORD cap) {
  HANDLE h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
  if (!h) return FALSE;
  DWORD n = cap;
  BOOL ok = QueryFullProcessImageNameW(h, 0, out, &n);
  CloseHandle(h);
  if (ok) normalizePath(out);
  return ok;
}

static BOOL isEngineImage(const wchar_t *img) {
  if (g_dir[0]) {
    size_t n = wcslen(g_dir);
    if (wcsncmp(img, g_dir, n) == 0) {
      const wchar_t *base = wcsrchr(img, L'\\');
      if (base && wcscmp(base + 1, L"prismlauncher.exe") == 0) return TRUE;
    }
  }
  for (int i = 0; i < g_exeCount; i++)
    if (wcscmp(img, g_exes[i]) == 0) return TRUE;
  return FALSE;
}

static BOOL isEnginePid(DWORD pid) {
  if (!pid || pid == GetCurrentProcessId()) return FALSE;
  for (int i = 0; i < g_cacheCount; i++)
    if (g_cache[i].pid == pid) return g_cache[i].engine;
  wchar_t img[PATHCAP];
  img[0] = 0;
  BOOL engine = processImage(pid, img, PATHCAP) && isEngineImage(img);
  if (engine || wcsstr(img, L"prismlauncher")) logf(L"pid %lu %ls: %ls", pid, img, engine ? L"engine" : L"not the engine");
  if (g_cacheCount < CACHE_MAX) {
    g_cache[g_cacheCount].pid = pid;
    g_cache[g_cacheCount].engine = engine;
    g_cacheCount++;
  }
  return engine;
}

// "Prism Launcher 11.1.1" -> "Havi Hub", "Consola - Prism Launcher 11.1.1" ->
// "Consola - Havi Hub". An engine already renamed by Havi Hub (engine-brand.js)
// says "Havi Hub 11.1.1": the engine's version is dropped the same way.
// Returns TRUE when something changed.
static const wchar_t *skipVersion(const wchar_t *p) {
  // the version that follows the name: " 11.1.1", " 9.4-rc1", " 10.0.0+abc"
  if (p[0] == L' ' && iswdigit(p[1])) {
    const wchar_t *q = p + 1;
    while (*q && (iswalnum(*q) || *q == L'.' || *q == L'-' || *q == L'+' || *q == L'_')) q++;
    return q;
  }
  return p;
}

BOOL hh_rewriteTitle(const wchar_t *in, const wchar_t *title, wchar_t *out, size_t cap) {
  static const wchar_t KEY[] = L"Prism Launcher";
  const size_t klen = (sizeof(KEY) / sizeof(KEY[0])) - 1;
  const size_t tlen = wcslen(title);
  size_t o = 0;
  BOOL changed = FALSE;
  const wchar_t *p = in;
  while (*p) {
    if (wcsncmp(p, KEY, klen) == 0) {
      for (const wchar_t *t = title; *t && o + 1 < cap; t++) out[o++] = *t;
      p = skipVersion(p + klen);
      changed = TRUE;
      continue;
    }
    if (tlen && wcsncmp(p, title, tlen) == 0) {
      const wchar_t *after = skipVersion(p + tlen);
      for (const wchar_t *t = title; *t && o + 1 < cap; t++) out[o++] = *t;
      if (after != p + tlen) changed = TRUE;
      p = after;
      continue;
    }
    if (o + 1 < cap) out[o++] = *p;
    p++;
  }
  out[o] = 0;
  if (!changed) return FALSE;
  // "Havi Hub - Havi Hub" -> "Havi Hub"
  wchar_t dup[600];
  size_t tl = wcslen(title);
  if (tl * 2 + 4 < 600) {
    wcscpy(dup, title);
    wcscat(dup, L" - ");
    wcscat(dup, title);
    size_t dl = wcslen(dup);
    wchar_t *f;
    while ((f = wcsstr(out, dup)) != NULL) memmove(f + tl, f + dl, (wcslen(f + dl) + 1) * sizeof(wchar_t));
    // "Havi Hub Quick Setup - Havi Hub" -> "Havi Hub Quick Setup" (the name is already there)
    size_t ol = wcslen(out);
    size_t sl = tl + 3;
    if (ol > sl && wcscmp(out + ol - sl, dup + tl) == 0) {
      out[ol - sl] = 0;
      if (!wcsstr(out, title)) out[ol - sl] = L' ';
    }
  }
  return wcscmp(in, out) != 0;
}

static void setAumid(HWND hwnd) {
  if (!g_aumid[0] || !g_comReady) return;
  IPropertyStore *ps = NULL;
  if (FAILED(SHGetPropertyStoreForWindow(hwnd, &HH_IID_IPropertyStore, (void **)&ps)) || !ps) return;
  PROPVARIANT cur;
  PropVariantInit(&cur);
  BOOL same = FALSE;
  if (SUCCEEDED(IPropertyStore_GetValue(ps, &HH_PKEY_AUMID, &cur))) {
    if (cur.vt == VT_LPWSTR && cur.pwszVal && wcscmp(cur.pwszVal, g_aumid) == 0) same = TRUE;
    PropVariantClear(&cur);
  }
  if (!same) {
    PROPVARIANT v;
    PropVariantInit(&v);
    v.vt = VT_LPWSTR;
    v.pwszVal = g_aumid;
    if (SUCCEEDED(IPropertyStore_SetValue(ps, &HH_PKEY_AUMID, &v))) IPropertyStore_Commit(ps);
  }
  IPropertyStore_Release(ps);
}

static void setIcon(HWND hwnd, WPARAM which, HICON icon) {
  if (!icon) return;
  DWORD_PTR cur = 0;
  if (SendMessageTimeoutW(hwnd, WM_GETICON, which, 0, SMTO_ABORTIFHUNG, 150, &cur) && (HICON)cur == icon) return;
  DWORD_PTR r;
  BOOL ok = SendMessageTimeoutW(hwnd, WM_SETICON, which, (LPARAM)icon, SMTO_ABORTIFHUNG, 300, &r) != 0;
  logf(L"window %p: %ls icon set%ls", (void *)hwnd, which == ICON_BIG ? L"big" : L"small", ok ? L"" : L" (no answer)");
}

// anyState: also windows that are not visible yet (just created)
// The engine's progress window while it prepares a game ("Please wait...",
// in English or Spanish): Havi Hub shows that state on its own Play button.
static BOOL isProgressTitle(const wchar_t *t) {
  static const wchar_t *starts[] = {L"Please wait", L"Por favor", L"Espera", L"Espere"};
  for (size_t i = 0; i < sizeof(starts) / sizeof(starts[0]); i++)
    if (_wcsnicmp(t, starts[i], wcslen(starts[i])) == 0) return TRUE;
  return FALSE;
}

static BOOL fixWindow(HWND hwnd, BOOL anyState) {
  if (!hwnd || !IsWindow(hwnd)) return FALSE;
  if (GetAncestor(hwnd, GA_ROOT) != hwnd) return FALSE;
  DWORD pid = 0;
  GetWindowThreadProcessId(hwnd, &pid);
  if (!isEnginePid(pid)) return FALSE;
  LONG style = GetWindowLongW(hwnd, GWL_STYLE);
  LONG exstyle = GetWindowLongW(hwnd, GWL_EXSTYLE);
  wchar_t text[512];
  wchar_t fixed[768];
  int n = GetWindowTextW(hwnd, text, 512);
  if (g_verbose) logf(L"engine window %p style %08lx ex %08lx %ls \"%ls\"", (void *)hwnd, (unsigned long)style, (unsigned long)exstyle, IsWindowVisible(hwnd) ? L"visible" : L"hidden", n > 0 ? text : L"");
  if (!(style & WS_CAPTION) && !(exstyle & WS_EX_APPWINDOW)) return TRUE;
  if (n > 0 && isProgressTitle(text)) {
    // fully transparent and off the taskbar from the moment it exists (no
    // flash when it is shown), then hidden
    if (!(exstyle & WS_EX_LAYERED) || !(exstyle & WS_EX_TOOLWINDOW)) {
      SetWindowLongW(hwnd, GWL_EXSTYLE, (exstyle | WS_EX_LAYERED | WS_EX_TOOLWINDOW) & ~WS_EX_APPWINDOW);
      SetLayeredWindowAttributes(hwnd, 0, 0, LWA_ALPHA);
    }
    if (IsWindowVisible(hwnd)) {
      ShowWindow(hwnd, SW_HIDE);
      logf(L"window %p \"%ls\" hidden", (void *)hwnd, text);
    }
    return TRUE;
  }
  if (!anyState && !IsWindowVisible(hwnd)) return TRUE;
  if (n > 0 && hh_rewriteTitle(text, g_title, fixed, 768)) {
    DWORD_PTR r;
    BOOL ok = SendMessageTimeoutW(hwnd, WM_SETTEXT, 0, (LPARAM)fixed, SMTO_ABORTIFHUNG, 300, &r) != 0;
    logf(L"window %p \"%ls\" -> \"%ls\"%ls", (void *)hwnd, text, fixed, ok ? L"" : L" (no answer)");
  }
  setIcon(hwnd, ICON_BIG, g_iconBig);
  setIcon(hwnd, ICON_SMALL, g_iconSmall);
  setAumid(hwnd);
  return TRUE;
}

static void CALLBACK onWinEvent(HWINEVENTHOOK hook, DWORD event, HWND hwnd, LONG idObject, LONG idChild, DWORD thread, DWORD time) {
  (void)hook;
  (void)thread;
  (void)time;
  if (!hwnd || idObject != OBJID_WINDOW || idChild != CHILDID_SELF) return;
  fixWindow(hwnd, event == EVENT_OBJECT_CREATE);
}

static BOOL CALLBACK enumProc(HWND hwnd, LPARAM lp) {
  (void)lp;
  fixWindow(hwnd, FALSE);
  return TRUE;
}

static BOOL anyEngineRunning(void) {
  HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
  if (snap == INVALID_HANDLE_VALUE) return TRUE;  // cannot tell: keep going
  PROCESSENTRY32W pe;
  pe.dwSize = sizeof(pe);
  BOOL found = FALSE;
  if (Process32FirstW(snap, &pe)) {
    do {
      if (_wcsicmp(pe.szExeFile, L"prismlauncher.exe") == 0 && isEnginePid(pe.th32ProcessID)) {
        found = TRUE;
        break;
      }
    } while (Process32NextW(snap, &pe));
  }
  CloseHandle(snap);
  return found;
}

static int g_ticks;

static void tick(void) {
  g_cacheCount = 0;  // processes come and go (and PIDs are reused)
  if (g_ticks < 3) logf(L"scan %d", g_ticks);
  EnumWindows(enumProc, 0);
  BOOL engines = anyEngineRunning();
  if (g_ticks < 3) logf(L"scan %d done: engine %ls", g_ticks, engines ? L"running" : L"not running");
  g_ticks++;
  DWORD now = GetTickCount();
  if (engines) {
    g_noEngineSince = 0;
    return;
  }
  if (!g_noEngineSince) g_noEngineSince = now;
  BOOL parentGone = g_parentMissing || (g_parent && WaitForSingleObject(g_parent, 0) == WAIT_OBJECT_0);
  if (parentGone || now - g_noEngineSince > 45000) {
    logf(L"no engine running%ls: exit", parentGone ? L" and Havi Hub closed" : L"");
    PostQuitMessage(0);
  }
}

static void copyArg(wchar_t *dst, size_t cap, const wchar_t *src) {
  wcsncpy(dst, src, cap - 1);
  dst[cap - 1] = 0;
}

int WINAPI WinMain(HINSTANCE inst, HINSTANCE prev, LPSTR cmd, int show) {
  (void)inst;
  (void)prev;
  (void)cmd;
  (void)show;
  int argc = 0;
  LPWSTR *argv = CommandLineToArgvW(GetCommandLineW(), &argc);
  if (!argv) return 1;
  wchar_t icon[PATHCAP] = L"";
  DWORD parent = 0;
  for (int i = 1; i + 1 < argc; i += 2) {
    const wchar_t *k = argv[i];
    const wchar_t *v = argv[i + 1];
    if (wcscmp(k, L"--dir") == 0) {
      copyArg(g_dir, PATHCAP - 2, v);
      normalizePath(g_dir);
      size_t n = wcslen(g_dir);
      if (n && g_dir[n - 1] != L'\\') wcscat(g_dir, L"\\");
    } else if (wcscmp(k, L"--exe") == 0 && g_exeCount < MAX_EXES) {
      copyArg(g_exes[g_exeCount], PATHCAP, v);
      normalizePath(g_exes[g_exeCount]);
      g_exeCount++;
    } else if (wcscmp(k, L"--icon") == 0) {
      copyArg(icon, PATHCAP, v);
    } else if (wcscmp(k, L"--title") == 0 && v[0]) {
      copyArg(g_title, 256, v);
    } else if (wcscmp(k, L"--aumid") == 0) {
      copyArg(g_aumid, 256, v);
    } else if (wcscmp(k, L"--parent") == 0) {
      parent = (DWORD)wcstoul(v, NULL, 10);
    } else if (wcscmp(k, L"--verbose") == 0) {
      g_verbose = v[0] == L'1';
    } else if (wcscmp(k, L"--log") == 0 && v[0]) {
      g_log = CreateFileW(v, FILE_APPEND_DATA, FILE_SHARE_READ | FILE_SHARE_WRITE, NULL, OPEN_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    }
  }
  LocalFree(argv);
  if (!g_dir[0] && !g_exeCount) return 2;

  // one helper at a time (a new one waits a moment in case the old one is ending)
  HANDLE mutex = CreateMutexW(NULL, FALSE, L"Local\\HaviHubWindowHelper");
  if (mutex) {
    DWORD w = WaitForSingleObject(mutex, 5000);
    if (w != WAIT_OBJECT_0 && w != WAIT_ABANDONED) {
      logf(L"another helper is running");
      return 0;
    }
  }
  logf(L"started: dir \"%ls\", %d exe, title \"%ls\", parent %lu", g_dir, g_exeCount, g_title, parent);

  SetProcessDPIAware();
  g_comReady = SUCCEEDED(CoInitializeEx(NULL, COINIT_APARTMENTTHREADED));
  if (parent) {
    g_parent = OpenProcess(SYNCHRONIZE, FALSE, parent);
    g_parentMissing = g_parent == NULL;
  }
  if (icon[0]) {
    int big = GetSystemMetrics(SM_CXICON);
    int small = GetSystemMetrics(SM_CXSMICON);
    g_iconBig = (HICON)LoadImageW(NULL, icon, IMAGE_ICON, big > 0 ? big : 32, big > 0 ? big : 32, LR_LOADFROMFILE);
    g_iconSmall = (HICON)LoadImageW(NULL, icon, IMAGE_ICON, small > 0 ? small : 16, small > 0 ? small : 16, LR_LOADFROMFILE);
    logf(L"icon %ls: big %d px %ls, small %d px %ls", icon, big, g_iconBig ? L"ok" : L"failed", small, g_iconSmall ? L"ok" : L"failed");
  }

  const DWORD flags = WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS;
  HWINEVENTHOOK h1 = SetWinEventHook(EVENT_OBJECT_CREATE, EVENT_OBJECT_CREATE, NULL, onWinEvent, 0, 0, flags);
  HWINEVENTHOOK h2 = SetWinEventHook(EVENT_OBJECT_SHOW, EVENT_OBJECT_SHOW, NULL, onWinEvent, 0, 0, flags);
  HWINEVENTHOOK h3 = SetWinEventHook(EVENT_OBJECT_NAMECHANGE, EVENT_OBJECT_NAMECHANGE, NULL, onWinEvent, 0, 0, flags);
  logf(L"hooks %ls", h1 && h2 && h3 ? L"ready" : L"missing");
  SetTimer(NULL, 0, 1000, NULL);
  tick();

  MSG msg;
  while (GetMessageW(&msg, NULL, 0, 0) > 0) {
    if (msg.message == WM_TIMER && msg.hwnd == NULL) {
      tick();
      continue;
    }
    TranslateMessage(&msg);
    DispatchMessageW(&msg);
  }

  if (h1) UnhookWinEvent(h1);
  if (h2) UnhookWinEvent(h2);
  if (h3) UnhookWinEvent(h3);
  if (g_parent) CloseHandle(g_parent);
  if (g_comReady) CoUninitialize();
  if (mutex) ReleaseMutex(mutex);
  return 0;
}
