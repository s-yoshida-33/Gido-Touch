; Gido Touch - NSIS Installer Hooks for Tauri v2

!macro NSIS_HOOK_POSTINSTALL
  ; --- Windows auto-start on logon (10 second delay) ---
  ExecWait 'schtasks /create /tn "Gido Touch Auto Start" /tr "\"$INSTDIR\Gido Touch.exe\"" /sc onlogon /delay 0000:10 /f'

  ; --- Scheduled task for daily reboot at 03:00 ---
  ExecWait 'schtasks /create /tn "Gido Touch Daily Reboot" /tr "shutdown /r /t 0" /sc daily /st 03:00 /f'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; --- Remove auto-start task on uninstall ---
  ExecWait 'schtasks /delete /tn "Gido Touch Auto Start" /f'
  ExecWait 'schtasks /delete /tn "Gido Touch Daily Reboot" /f'
!macroend
