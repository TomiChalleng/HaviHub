// Unit test for the title rewriting of havihub-windows.c (runs under Wine or Windows)
#define WinMain hh_real_WinMain
#include "../havihub-windows.c"
#undef WinMain
#include <stdio.h>

static int fails;

static void check(const wchar_t *in, const wchar_t *expect) {
  wchar_t out[768];
  BOOL changed = hh_rewriteTitle(in, L"Havi Hub", out, 768);
  const wchar_t *got = changed ? out : in;
  BOOL ok = expect ? (changed && wcscmp(got, expect) == 0) : !changed;
  if (!ok) fails++;
  wprintf(L"%ls  \"%ls\" -> \"%ls\"\n", ok ? L"ok  " : L"FAIL", in, got);
}

int main(void) {
  check(L"Prism Launcher 11.1.1", L"Havi Hub");
  check(L"Prism Launcher", L"Havi Hub");
  check(L"Consola - Prism Launcher 11.1.1", L"Consola - Havi Hub");
  check(L"Prism Launcher 9.4-rc1 - Agregar cuenta", L"Havi Hub - Agregar cuenta");
  check(L"Prism Launcher 10.0.0+abc", L"Havi Hub");
  check(L"Prism Launcher - Prism Launcher 11.1.1", L"Havi Hub");
  check(L"[26.2] Vanilla - Prism Launcher 11.1.1", L"[26.2] Vanilla - Havi Hub");
  check(L"Prism Launcher Quick Setup - Prism Launcher 11.1.1", L"Havi Hub Quick Setup");
  check(L"Configuración rápida de Prism Launcher - Prism Launcher 11.1.1", L"Configuración rápida de Havi Hub");
  check(L"Agregar cuenta - Prism Launcher 11.1.1", L"Agregar cuenta - Havi Hub");
  // an engine already renamed by Havi Hub: only its version goes
  check(L"Havi Hub 11.1.1", L"Havi Hub");
  check(L"Add Microsoft Account - Havi Hub 11.1.1", L"Add Microsoft Account - Havi Hub");
  check(L"Havi Hub Quick Setup - Havi Hub 11.1.1", L"Havi Hub Quick Setup");
  check(L"Havi Hub - Agregar cuenta", NULL);
  check(L"Minecraft* 1.21.1", NULL);
  check(L"Havi Hub", NULL);
  check(L"", NULL);
  wprintf(L"%d failed\n", fails);
  return fails ? 1 : 0;
}
