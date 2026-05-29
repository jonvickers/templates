# === Windows PowerShell 5.1 shim profile ===
# This is the ENTIRE contents of the Windows PowerShell 5.1 profile.
#
# Goal: maintain ONE real profile (in the PowerShell 7 location) and have 5.1 just load
# it, so both shells behave identically and you never edit two files.
#
# Install:
#   1. From powershell.exe (5.1):  notepad $PROFILE
#      (if it doesn't exist:        New-Item -ItemType File -Path $PROFILE -Force)
#   2. Replace its contents with the two lines below and save.
#
# `[Environment]::GetFolderPath('MyDocuments')` resolves the correct Documents base for
# either shell, including when Documents is OneDrive-redirected - never hard-code the path.

$pwsh7Profile = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'PowerShell\Microsoft.PowerShell_profile.ps1'
if (Test-Path $pwsh7Profile) { . $pwsh7Profile }
