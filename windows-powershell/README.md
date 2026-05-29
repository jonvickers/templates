# Windows PowerShell — Roaming & Self-Healing Setup

Example files for a PowerShell setup that **roams across multiple machines via OneDrive** and
**self-heals** (auto-installs its own dependencies) on a fresh or newly-roamed machine.

These complement the **[Node.js Dev Tools — PC (Windows)](../nodejs-dev-tools-PC.md)** guide,
which covers installing PowerShell 7, the 5.1→7 shim, fonts, and the base profile. Use these
files once that base setup is in place.

## The problem they solve

When your Documents folder is OneDrive-redirected, your PowerShell `$PROFILE` syncs across all
your machines automatically. But the **tools the profile depends on** — Terminal-Icons, Starship,
fnm, a Nerd Font — install **per-machine** and don't roam. So on a new (or freshly re-imaged)
machine the synced profile loads *before* those tools exist and throws at startup, e.g.:

```
Import-Module : The specified module 'Terminal-Icons' was not loaded because no valid
module file was found in any module directory.
```

Windows Terminal's own `settings.json` has the opposite problem: it lives in `%LOCALAPPDATA%`
and **never roams**, so your default shell, font, and colors stay stuck per-machine.

## Files

| File | What it is | Where it goes |
|------|------------|---------------|
| `Microsoft.PowerShell_profile.ps1` | Canonical self-healing profile (bootstrap + guarded init) | PowerShell 7's `$PROFILE`: `…\Documents\PowerShell\Microsoft.PowerShell_profile.ps1` (under OneDrive so it roams) |
| `WindowsPowerShell_5.1_shim_profile.ps1` | One-liner that makes 5.1 dot-source the pwsh 7 profile | Windows PowerShell 5.1's `$PROFILE`: `…\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1` |
| `Link-WindowsTerminalSettings.ps1` | Symlinks WT `settings.json` into OneDrive so it roams | Run from an **elevated** shell on each machine |
| `windows-terminal-settings.example.json` | Clean WT settings with PowerShell 7 as default + Nerd Font | The shared OneDrive copy (or as a starting point) |

## How it works

### Self-healing profile

`Microsoft.PowerShell_profile.ps1` defines **`Invoke-ProfileBootstrap`**, which installs anything
missing — Terminal-Icons, Starship + fnm (via winget), and a Nerd Font (per-user, no admin). It:

- **runs once per machine**, gated by a sentinel file in `%LOCALAPPDATA%` (which doesn't roam, so
  every machine provisions itself exactly once);
- **only runs in interactive sessions** (skipped for `pwsh -Command …` and scripts);
- can be **re-run on demand** with **`Repair-Profile`**.

Every external tool init below the bootstrap is also **guarded** (`Get-Command` / `Get-Module
-ListAvailable`), so even if a tool is still missing the profile loads cleanly instead of erroring.

> Set your Nerd Font at the top of the file via `$script:NerdFontAsset` / `$script:NerdFontGlob`.
> Defaults match the guide's recommendation (CaskaydiaCove / CascadiaCode).

### Roaming Windows Terminal settings

`Link-WindowsTerminalSettings.ps1` replaces the per-machine `settings.json` with a symlink to a
single shared copy in `OneDrive\Documents\WindowsTerminal\settings.json`.

```powershell
# On your FIRST machine — seed the shared copy from this machine, then link (elevated):
.\Link-WindowsTerminalSettings.ps1 -Seed

# On every OTHER machine — just link to the already-synced copy (elevated):
.\Link-WindowsTerminalSettings.ps1
```

The symlink itself can't roam (it's a local filesystem object), so run the script once per
machine. Creating it needs admin rights or Windows Developer Mode.

## Per-machine setup checklist

On each new machine, after installing PowerShell 7 (see the main guide):

1. Confirm the pwsh 7 `$PROFILE` and 5.1 shim are in place (they roam via OneDrive, so usually
   only the 5.1 shim needs creating — it points at the OneDrive copy).
2. Open a new PowerShell 7 terminal. The bootstrap runs once and installs missing tools (this
   first launch may take a minute). Restart the terminal afterward.
3. Run `Link-WindowsTerminalSettings.ps1` from an **elevated** terminal to roam WT settings.
