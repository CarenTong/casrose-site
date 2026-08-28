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

## /reliable-roofing — the one page a robot may deploy

A weekly scheduled agent refreshes `reliable-roofing.html` and **merges its own PR**,
unattended (Caren, 2026-08-28). That is a deliberate exception to the attended-merge rule
above, and it is scoped to this one file. Nothing else in this repo may be merged
unattended.

- **The mechanical edits are a script, not a prompt**: `tools/refresh-status-page.mjs`.
  It rescales the timeline, updates the two counted figures and the date stamps, and
  refuses to write if anything looks wrong. A model hand-editing thirty SVG coordinates
  and then approving its own work is the failure the deploy cannot see: the live check
  proves the page returns 200, not that the graph still makes sense.
- **Run it, do not reproduce it.** `node tools/refresh-status-page.mjs --check` reports
  without writing. It is idempotent: a second run must say "no change needed".
- **The agent may merge only when the diff touches `reliable-roofing.html` alone.** Any
  other file in the diff means something unexpected happened, and it stops.
- The page is **unlisted, not secret**: `X-Robots-Tag` plus a meta tag keep it out of
  search results, and `robots.txt` deliberately still ALLOWS the path. A disallowed page
  is never fetched, so its noindex is never read, and the bare URL can still be indexed
  from an inbound link.
- The figures come from the whatsapp-site-report-agent repo, read-only over git. That
  repo is never committed to from here: committing there redeploys the live bot.

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
