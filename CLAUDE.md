# CLAUDE.md — casrose-site

Public marketing site for Casrose Ltd, **www.casrose.co.uk**. This repository is **PUBLIC**:
nothing confidential, no client names beyond what the site already shows, no vault paths.

## Layout

- `index.html` at the repo root is the deployable, single self-contained file (JS, CSS, fonts
  and favicon inlined). `privacy.html`, `terms.html`, `data-deletion.html` are the legal pages.
- `app/` is the Vite + React source. Rebuild everything with `cd app && npm run site`.
- `.htaccess` blocks `/app` from being served.

## Deploy model (read before merging)

- **Push to `main` deploys.** `.github/workflows/deploy.yml` builds from source, uploads
  `index.html` + `.htaccess` + legal pages over FTP to Hostinger, then **fetches the live site and
  fails if the expected content is not served** (hero present, legal pages return 200).
- **Claude merges its own PRs in attended sessions** (agreed 2026-08-21). Flag the deploy in the
  reply, then merge. Caren can still merge herself when she wants.
- After merging, check the Actions run went green. A green build with a failed live-fetch step
  means the FTP upload landed in the wrong place.
- Secrets (`FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`) are GitHub repository secrets set by
  Caren in the GitHub UI. Never through chat, never in the repo.

## Hosting gotchas (each cost hours on 2026-08-20)

- casrose.co.uk is an **add-on domain**. Its real path is
  `/home/<account>/domains/casrose.co.uk/public_html`, not the account-root `public_html`. The
  scoped FTP account is rooted there, so the CI `server-dir` is `./`.
- The Hostinger account hosts several sites; use the scoped `casrosedeploy` FTP account, not the
  main one (which is labelled with a different domain).
- Hostinger's Extract dialog nests into a subfolder by default; a stray
  `public_html/public_html/` has 403'd the live site before.
- PowerShell `Compress-Archive` writes backslash separators and silently drops long paths.
  Prefer the single-file build.

## This machine

- Claude Code's Bash tool PATH lacks node/npm/gh — prefix with
  `export PATH="$PATH:/c/Program Files/nodejs:/c/Users/Caren/AppData/Roaming/npm:/c/Program Files/GitHub CLI"`.
- Multiline commits: `git commit -F <file>`. No Python on this machine.

Working-style rules (plan first, writing style, Codex) live in the user-level
`~/.claude/CLAUDE.md` and apply here too.
