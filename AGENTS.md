# Repository agent instructions

## Lights On Admiral website

The custom public show website lives in `apps/lights-on-admiral-site` and is
served at `https://lightsonadmiral.com/`.

Before changing or deploying that website, read
`ops/self-host/LIGHTS-ON-ADMIRAL-DEPLOY.md` and follow it exactly. The runbook
is the source of truth for the host, paths, validation, snapshot transfer,
container rebuild, and live verification.

### Deployment rules

- A request to make the site live, publish it, deploy it, or put changes on the
  site authorizes the deployment procedure in the runbook. A local edit alone
  does not; keep deployment as an explicit delivery gate.
- Validate the local site with `npm test` and `npm run build` from
  `apps/lights-on-admiral-site` before packaging it.
- Re-check `git status --short`, `git rev-parse HEAD`, and
  `git rev-parse origin/main` immediately before packaging and again after
  validation. If another chat or process changes the worktree or advances HEAD,
  discard the pending package and repeat validation and packaging. Never deploy
  a mixture of two snapshots.
- The current server checkout does not reliably contain this custom site in its
  Git history. Do not use `git pull` or the generic `upgrade.sh` as the Lights On
  Admiral site deployment mechanism until that checkout is deliberately
  migrated. Transfer a checksum-verified source snapshot as described in the
  runbook.
- Rebuild only the Compose service `show-site` with `--no-deps`. Do not restart
  MongoDB, the Remote Falcon services, or the Cloudflare tunnel for an ordinary
  website update.
- Do not edit `.env`, delete Docker volumes, run `docker compose down -v`, or
  alter Cloudflare routes during a normal website deployment.
- Never store or print an SSH password, tunnel token, certificate, or other
  secret in this repository, a command, a log, or a chat response. Authenticate
  interactively or use an approved SSH key.
- Do not report a deployment as complete until the `show-site` container is
  healthy, its host-local health endpoint succeeds, and the public site has
  been checked with a cache-busting URL.
