// Plays an engine for the helper test: two top-level windows named like
// Prism Launcher's (one appears later, one gets its name set again), then
// reports their titles and whether they got an icon.
//   prismlauncher.exe <report file>
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdio.h>

static HWND a, b, c;

static LRESULT CALLBACK proc(HWND h, UINT m, WPARAM w, LPARAM l) { return DefWindowProcW(h, m, w, l); }

static HWND make(const wchar_t *title, BOOL visible) {
  HWND h = CreateWindowExW(0, L"FakeQtWindow", title, WS_OVERLAPPEDWINDOW, 40, 40, 400, 200, NULL, NULL, GetModuleHandleW(NULL), NULL);
  if (visible) ShowWindow(h, SW_SHOWNORMAL);
  return h;
}

static void pump(DWORD ms) {
  DWORD end = GetTickCount() + ms;
  MSG msg;
  while ((LONG)(end - GetTickCount()) > 0) {
    while (PeekMessageW(&msg, NULL, 0, 0, PM_REMOVE)) {
      TranslateMessage(&msg);
      DispatchMessageW(&msg);
    }
    Sleep(15);
  }
}

static void report(FILE *f, const char *name, HWND h) {
  wchar_t t[256];
  GetWindowTextW(h, t, 256);
  LRESULT big = SendMessageW(h, WM_GETICON, ICON_BIG, 0);
  LRESULT small = SendMessageW(h, WM_GETICON, ICON_SMALL, 0);
  fprintf(f, "%s|%ls|%s|%s\n", name, t, big ? "icon" : "noicon", small ? "small" : "nosmall");
}

int main(int argc, char **argv) {
  if (argc > 1) {
    char pidFile[1024];
    snprintf(pidFile, sizeof(pidFile), "%s.pid", argv[1]);
    FILE *pf = fopen(pidFile, "w");
    if (pf) {
      fprintf(pf, "%lu", GetCurrentProcessId());
      fclose(pf);
    }
  }
  WNDCLASSW wc = {0};
  wc.lpfnWndProc = proc;
  wc.hInstance = GetModuleHandleW(NULL);
  wc.lpszClassName = L"FakeQtWindow";
  RegisterClassW(&wc);
  a = make(L"Prism Launcher 11.1.1", TRUE);
  pump(1500);
  b = make(L"Consola - Prism Launcher 11.1.1", TRUE);
  c = make(L"Prism Launcher 11.1.1", FALSE);  // hidden helper-like window: shown later
  pump(1500);
  SetWindowTextW(a, L"Prism Launcher 11.1.1");  // the app sets its name again
  ShowWindow(c, SW_SHOWNORMAL);
  pump(3000);
  FILE *f = argc > 1 ? fopen(argv[1], "w") : stdout;
  if (!f) return 3;
  report(f, "main", a);
  report(f, "console", b);
  report(f, "later", c);
  if (f != stdout) fclose(f);
  return 0;
}
