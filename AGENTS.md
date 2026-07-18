# Global Agent Configuration Templates

This repo stores platform-specific global instruction templates:

- `CLAUDE-windows.md` - Windows 11, fnm, pnpm, and PowerShell
- `CLAUDE-macos.md` - macOS, nvm, Homebrew, and zsh

Keep reusable cross-agent guidance vendor-neutral where practical. Do not add
machine-specific credentials, absolute personal paths, or secrets to templates.
Copy the appropriate template to the tool's global instruction location on each
machine and customize only machine-local details there.
