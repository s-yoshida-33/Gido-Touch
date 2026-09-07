; Gido Touch - NSIS Installer Hooks for Tauri v2

!macro NSIS_HOOK_POSTINSTALL
  ; --- Windows auto-start on logon (5 minute delay, so Gido Touch starts
  ;     after Bridge-Ground/WonderFlow/other co-resident processes) ---
  ExecWait 'schtasks /create /tn "Gido Touch Auto Start" /tr "\"$INSTDIR\gido-touch.exe\"" /sc onlogon /delay 0005:00 /f'

  ; --- Scheduled task for daily reboot at 03:00 ---
  ExecWait 'schtasks /create /tn "Gido Touch Daily Reboot" /tr "shutdown /r /f /t 0" /sc daily /st 03:00 /f'

  ; --- Force-kill the app 10 minutes before the daily reboot. Without this,
  ;     the OS shutdown can race with the app's own watchdog/event-loop
  ;     teardown and trigger a tao panic ("cannot move state from
  ;     Destroyed"). /F is required because the app's window-close handler
  ;     intentionally ignores close requests (kiosk lockdown), so this ends
  ;     up no more abrupt than the termination the OS already performs at
  ;     03:00 today. ---
  ExecWait 'schtasks /create /tn "Gido Touch Pre-Reboot Shutdown" /tr "taskkill /F /IM gido-touch.exe" /sc daily /st 02:50 /f'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; --- Remove auto-start task on uninstall ---
  ExecWait 'schtasks /delete /tn "Gido Touch Auto Start" /f'
  ExecWait 'schtasks /delete /tn "Gido Touch Daily Reboot" /f'
  ExecWait 'schtasks /delete /tn "Gido Touch Pre-Reboot Shutdown" /f'
!macroend
