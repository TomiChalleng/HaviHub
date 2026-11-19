!include "FileFunc.nsh"
; Havi Hub - additions to electron-builder's one-click installer (build/installer.nsh).
; The installer's ID (nsis.guid in package.json) is the one earlier versions
; were installed with, so an update finds and replaces them.

; Installed and portable copies share one data folder and only one can run at a
; time. Close any open copy before installing (the default check only looks
; inside the install folder, so it misses a portable copy); otherwise the newly
; installed app would just bring the old window to the front.
!macro havihubCloseRunning EXE
  nsExec::Exec `"$SYSDIR\cmd.exe" /C tasklist /FI "USERNAME eq %USERNAME%" /FI "IMAGENAME eq ${EXE}" /FO CSV /NH | "$SYSDIR\findstr.exe" /B /I /C:"\"${EXE}\""`
  Pop $0
  ${if} $0 == 0
    nsExec::Exec `"$SYSDIR\cmd.exe" /C taskkill /IM "${EXE}" /FI "USERNAME eq %USERNAME%"`
    Pop $0
  ${endIf}
!macroend

; The engine window helper (resources\havihub-windows.exe) may be running while
; a game is open: stop it so its file can be replaced or removed. It holds no
; data and Havi Hub starts it again with the next game.
!macro havihubStopHelper
  nsExec::Exec `"$SYSDIR\cmd.exe" /C taskkill /F /IM "havihub-windows.exe" /FI "USERNAME eq %USERNAME%"`
  Pop $0
!macroend

!macro customInit
  !insertmacro havihubStopHelper
  nsExec::Exec `"$SYSDIR\cmd.exe" /C tasklist /FI "USERNAME eq %USERNAME%" /FO CSV /NH | "$SYSDIR\findstr.exe" /I /C:"\"${APP_EXECUTABLE_FILENAME}\""`
  Pop $0
  ${if} $0 == 0
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "$(appRunning)" /SD IDOK IDOK havihub_close_running
    Quit
    havihub_close_running:
    !insertmacro havihubCloseRunning "${APP_EXECUTABLE_FILENAME}"
    Sleep 2000
    nsExec::Exec `"$SYSDIR\cmd.exe" /C taskkill /F /IM "${APP_EXECUTABLE_FILENAME}" /FI "USERNAME eq %USERNAME%"`
    Pop $0
    Sleep 500
  ${endIf}
  ; An update goes where the last one went, so a copy installed under the old
  ; name is still being installed into Programs\havi-hub. The folder is
  ; Programs\havihub. The old copy is removed from the old folder as in any
  ; update; what is left of that folder is deleted once the new files are in
  ; place (customInstall).
  Var /GLOBAL havihubOldDir
  StrCpy $havihubOldDir ""
  ${GetFileName} "$INSTDIR" $R1
  ${if} $R1 == "havi-hub"
    StrCpy $havihubOldDir "$INSTDIR"
    ${GetParent} "$INSTDIR" $R2
    StrCpy $INSTDIR "$R2\havihub"
  ${endIf}
!macroend

; Havi Hub pinned to the taskbar is a copy of its shortcut that keeps the
; program's full path. When the program moves to a new folder, the pin is
; pointed to it so it keeps working (the Start menu and desktop shortcuts are
; made again by the installer itself).
!macro havihubRepinTaskbar
  ${if} $installMode == "all"
    SetShellVarContext current
  ${endif}
  Var /GLOBAL havihubPin
  StrCpy $havihubPin "$APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\${PRODUCT_NAME}.lnk"
  ${if} ${FileExists} "$havihubPin"
    CreateShortCut "$havihubPin" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 "" "" "${APP_DESCRIPTION}"
    ClearErrors
    WinShell::SetLnkAUMI "$havihubPin" "${APP_ID}"
  ${endIf}
  ${if} $installMode == "all"
    SetShellVarContext all
  ${endif}
!macroend

!macro customInstall
  ${if} $havihubOldDir != ""
  ${andIf} $havihubOldDir != $INSTDIR
    RMDir /r "$havihubOldDir"
    !insertmacro havihubRepinTaskbar
  ${endIf}
  ; electron-builder leaves a copy of this installer (about 100 MB) in
  ; %LOCALAPPDATA%\havihub-updater (havi-hub-updater under the old name), for an
  ; automatic updater to build smaller updates from. Havi Hub does not update
  ; itself yet, so the copy only takes space.
  ${if} $installMode == "all"
    SetShellVarContext current
  ${endif}
  Delete "$LOCALAPPDATA\havihub-updater\installer.exe"
  RMDir "$LOCALAPPDATA\havihub-updater"
  Delete "$LOCALAPPDATA\havi-hub-updater\installer.exe"
  RMDir "$LOCALAPPDATA\havi-hub-updater"
  ${if} $installMode == "all"
    SetShellVarContext all
  ${endif}
!macroend

; A real uninstall (not the one that runs during an update) also removes the copy
; of Prism Launcher that Havi Hub downloaded as its engine; it is downloaded
; again if Havi Hub is reinstalled. Profiles, worlds, accounts and settings stay
; in %APPDATA%\havihub. The engine folder is renamed first so that, if a game is
; still running from it, it is left untouched instead of half deleted.
!macro havihubRemoveEngine BASE
  RMDir /r "${BASE}\engine-removing"
  ClearErrors
  Rename "${BASE}\engine" "${BASE}\engine-removing"
  ${ifNot} ${Errors}
    RMDir /r "${BASE}\engine-removing"
  ${endIf}
  RMDir "${BASE}"
!macroend

!macro customUnInstall
  !insertmacro havihubStopHelper
  ${ifNot} ${isUpdated}
    !insertmacro havihubRemoveEngine "$LOCALAPPDATA\havihub"
    !insertmacro havihubRemoveEngine "$LOCALAPPDATA\havi-hub"
    !insertmacro havihubRemoveEngine "$LOCALAPPDATA\Havi Hub"
  ${endIf}
!macroend
