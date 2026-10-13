# Lights On Admiral website deployment

This runbook deploys only the custom Lights On Admiral public website. It does
not upgrade or restart the rest of the self-hosted Remote Falcon stack.

## Deployment target

| Item | Value |
| --- | --- |
| Public URL | `https://lightsonadmiral.com/` |
| SSH host | `192.168.50.211` |
| SSH user | `loaadmin` |
| Approved local SSH key | `C:\Users\aaron\.ssh\lights_on_admiral_deploy` |
| Server repository | `/home/loaadmin/remote-falcon-platform` |
| Site source | `apps/lights-on-admiral-site` |
| Compose file | `ops/self-host/docker-compose.yaml` |
| Compose service | `show-site` |
| Expected container | `self-host-show-site-1` |
| Host-local health URL | `http://127.0.0.1:3001/health.json` |

The public hostnames are already routed through the `LightsOnAdmiral`
Cloudflare tunnel. A normal site deployment requires no Cloudflare change.

## Why this uses a source snapshot

The current server checkout predates the custom site and has not consistently
tracked `apps/lights-on-admiral-site`. A plain `git pull` can therefore leave
the deployed site unchanged or conflict with server-local files. Until the
server checkout is deliberately migrated, deploy an immutable, checksum-
verified archive of the local site source.

Do not place credentials in this file or in shell history. The server already
trusts the dedicated key at
`C:\Users\aaron\.ssh\lights_on_admiral_deploy`; use it for SSH and SCP. Only
request interactive authentication if a batch-mode key check fails.

## 1. Establish a stable local snapshot

From the repository root in PowerShell, record the state before validation:

```powershell
git status --short
git rev-parse HEAD
git rev-parse origin/main
git diff --check
```

Changes from other chats may appear while a deployment is being prepared. Note
the intended files and commit. Do not overwrite or discard unrelated work.

Validate the site:

```powershell
Set-Location apps/lights-on-admiral-site
npm test
npm run build
Set-Location ../..
```

Immediately repeat the state checks:

```powershell
git status --short
git rev-parse HEAD
git rev-parse origin/main
git diff --check
```

If HEAD or the worktree changed unexpectedly, stop and repeat validation. The
archive must represent one stable snapshot, not files collected while another
process is editing them.

## 2. Package and checksum the site

Create the archive outside the repository. The source set intentionally omits
`node_modules` and generated local preview output.

```powershell
$DeploySha = (git rev-parse --short HEAD).Trim()
$DeployStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$DeployArchive = Join-Path $env:TEMP "lights-on-admiral-$DeploySha-$DeployStamp.tgz"
tar -czf $DeployArchive -C apps/lights-on-admiral-site public scripts test Dockerfile nginx.conf package.json
$DeployHash = (Get-FileHash -Algorithm SHA256 $DeployArchive).Hash.ToLowerInvariant()
Write-Host "Archive: $DeployArchive"
Write-Host "SHA256: $DeployHash"
```

Run the state checks one more time after packaging. If the repository changed
during packaging, delete only that archive and build a new one after validation.

## 3. Create an isolated server staging directory

First verify passwordless key access:

```powershell
ssh -i C:\Users\aaron\.ssh\lights_on_admiral_deploy -o BatchMode=yes loaadmin@192.168.50.211 "printf key-ready"
```

The command must print `key-ready`. Then create a unique staging directory and
retain the exact printed path:

```powershell
ssh -i C:\Users\aaron\.ssh\lights_on_admiral_deploy -o BatchMode=yes loaadmin@192.168.50.211 "mktemp -d /home/loaadmin/loa-site-deploy.XXXXXX"
```

Copy the archive to that exact directory from the local PowerShell session:

```powershell
scp -i C:\Users\aaron\.ssh\lights_on_admiral_deploy -o BatchMode=yes $DeployArchive loaadmin@192.168.50.211:/home/loaadmin/loa-site-deploy.REPLACE_WITH_PRINTED_SUFFIX/
```

Never put the password on the command line.

## 4. Verify and install the snapshot

Reconnect and set `STAGE_DIR` to the exact directory printed in the previous
step:

```sh
STAGE_DIR=/home/loaadmin/loa-site-deploy.REPLACE_WITH_PRINTED_SUFFIX
ARCHIVE=$(find "$STAGE_DIR" -maxdepth 1 -type f -name 'lights-on-admiral-*.tgz' -print -quit)
sha256sum "$ARCHIVE"
```

Compare the displayed server checksum with `$DeployHash`. Do not continue if
they differ.

Extract the verified archive and install its files:

```sh
mkdir -p "$STAGE_DIR/source"
tar -xzf "$ARCHIVE" -C "$STAGE_DIR/source"
TARGET=/home/loaadmin/remote-falcon-platform/apps/lights-on-admiral-site
sudo install -d -o loaadmin -g loaadmin "$TARGET"
sudo cp -a "$STAGE_DIR/source/." "$TARGET/"
sudo chown -R loaadmin:loaadmin "$TARGET"
```

The ownership correction is intentional. Older deployments left some site
files owned by `root`, which caused later uploads to fail with permission
errors.

## 5. Rebuild only the public website

On the server:

```sh
cd /home/loaadmin/remote-falcon-platform
docker compose -f ops/self-host/docker-compose.yaml up -d --build --no-deps show-site
docker compose -f ops/self-host/docker-compose.yaml ps show-site
```

If Docker requires elevation for this account, repeat only the Docker commands
with `sudo`. Do not use `down`, and never add `-v`.

Wait for `self-host-show-site-1` to report `healthy`, then verify the origin:

```sh
curl -fsS http://127.0.0.1:3001/health.json
curl -fsSI http://127.0.0.1:3001/ | tr -d '\r' | grep -i '^x-lights-on-admiral-season:'
```

The seasonal response header confirms that the site server selected the HTML
metadata for the current `America/Denver` date. October returns `halloween`,
the Sunday-through-Saturday week containing November 11 returns `veterans`,
December returns `christmas`, and other dates return `lights`.

If it does not become healthy, inspect only this service before changing
anything else:

```sh
docker compose -f ops/self-host/docker-compose.yaml logs --tail=100 show-site
```

## 6. Verify the public site

Open a cache-busting URL such as:

```text
https://lightsonadmiral.com/?verify=DEPLOY_SHA_AND_TIMESTAMP
```

Confirm that the page loads over HTTPS and that the intended visible change is
present. Also confirm the response includes the expected
`X-Lights-On-Admiral-Season` header and that the returned HTML contains the
matching title, description, and social image. If the change is not visible,
compare the served HTML/assets with the packaged snapshot before rebuilding
again; do not assume the tunnel needs to be reconfigured.

Only after the container health check, origin check, and public check all pass
may the deployment be reported as complete.

## 7. Clean up the exact staging artifacts

After successful verification, remove only the exact staging directory and
local archive created for this deployment. First print and inspect the paths:

```sh
printf '%s\n' "$STAGE_DIR"
```

The server path must begin with `/home/loaadmin/loa-site-deploy.` and must not
be empty. Then remove that exact directory:

```sh
rm -rf -- "$STAGE_DIR"
```

Back in PowerShell, verify the local archive path is under `$env:TEMP`, then:

```powershell
Remove-Item -LiteralPath $DeployArchive
```

## Boundaries

- Preserve `/home/loaadmin/remote-falcon-platform/ops/self-host/.env`.
- Preserve all MongoDB data and Docker volumes.
- Preserve the Cloudflare tunnel service and its credentials.
- Do not restart unrelated Remote Falcon services for a static-site change.
- Do not use the generic `ops/self-host/upgrade.sh` for this custom-site-only
  deployment until the server checkout migration is explicitly completed and
  verified.
