# Droplet deployment spec. Next.js frontend on DigitalOcean

Status: deploy automation implemented (`.github/workflows/deploy.yml` +
`scripts/deploy-droplet.sh`). Server provisioning and DNS cutover are
still pending. This supersedes the Vercel hosting step in
`OPERATIONS.md` if adopted.

Scope: `EvonaireAI/frontend` only. The `apps/web` scaffold inside
`evonaire-launch-monorepo` is a separate minimal demo and falls outside
this spec.

## Why this works where Vercel-free static hosting did not

- Auth is a JWT bearer token in `localStorage` (`lib/auth.ts`). The only
  cookie is a non-HttpOnly `session` UX marker, so the API can live on a
  different origin with no credential/CORS-cookie complications.
- Django already lists `evonaire.ai` and `www.evonaire.ai` in
  `CORS_ALLOWED_ORIGINS` for the browser origins.
- The dynamic routes and `middleware.ts` work unchanged under
  `next start`. `next.config.mjs` security headers are emitted by Next
  itself, so the reverse proxy only needs TLS and pass-through.

## Target architecture

```
browser ──TLS──▶ nginx :443 ──▶ next start 127.0.0.1:3000   (evonaire.ai, www)
                  │
                  └──TLS──▶ gunicorn 127.0.0.1:8000         (api.evonaire.ai)
```

One droplet, same host as Postgres/Redis/Django/Celery. Frontend and API
stay on separate hostnames. The frontend calls
`https://api.evonaire.ai/api/...` directly.

## Node runtime

- Node 22 LTS. The desktop runs v26, the server should not. Install via
  NodeSource or the distro package.
- `packageManager` is `npm@11.20.0`. Use `npm ci` for installs, never
  `npm i`.
- There is no `.nvmrc`. `deploy.yml` pins `node-version: 22`, and the
  droplet must match.

## Environment variables

There is no env file on the droplet. Every `process.env` read in the app
is a `NEXT_PUBLIC_*` value, inlined into the client bundle at
`next build`. `next start` does not re-read them. Server-side code
reads no runtime env today. A future non-public variable belongs in the
systemd unit's `Environment=` lines.

Store the values as GitHub Actions repository variables. Each one is
embedded in the client bundle that browsers download, so `secrets`
would protect nothing. The Stripe price IDs already have public
fallbacks in `lib/payments.ts`.

- `vars.NEXT_PUBLIC_API_BASE_URL=https://api.evonaire.ai/api`
- `vars.NEXT_PUBLIC_STRIPE_PRICE_EVOCORE=price_...`
- `vars.NEXT_PUBLIC_STRIPE_PRICE_EVOBLOOM=price_...`
- `vars.NEXT_PUBLIC_STRIPE_PRICE_EVOLUXE=price_...`

The API base must be an absolute URL ending in `/api`. Django mounts the
API endpoints under that prefix, and `lib/v1.ts` derives `/admin-api/v1`
by stripping the same suffix. `https://api.evonaire.ai` without `/api`
builds cleanly and then 404s every request.

Two build-time traps:

1. `NEXT_PUBLIC_*` values must be present in the CI build environment.
   A missing var does not fail the build. The bundle ships the fallback
   or an empty value instead.
2. `next.config.mjs` derives the CSP `connect-src`, `img-src`, and
   `media-src` API origin from `NEXT_PUBLIC_API_BASE_URL` at build time.
   Setting it to `https://api.evonaire.ai/api` whitelists the
   `https://api.evonaire.ai` origin in the policy. If the value is wrong
   at build time the CSP will be wrong for the life of that build.

## Build and run

The droplet never builds. CI produces a self-contained release tarball.
Deploys on the droplet extract it into `releases/<sha>` and restart
`evonaire-web` after flipping `current`.

Layout on the droplet:

```
/opt/evonaire-web/
  current -> releases/<git-sha>   (symlink)
  releases/<git-sha>/             (repo tree: source, .next, prod node_modules)
  incoming/                       (tarball drop from CI)
```

`ReadWritePaths` lists `/opt/evonaire-web`. The wider path keeps the
bind mount independent of symlink resolution. The deploy script
precreates `.next/cache` in each release so a future page that enables
ISR or fetch caching can write inside whichever release `current`
points at, and marks `.next` itself group-writable so the service can
create entries beside `cache/`.

## One-time server setup

The workflow assumes this provisioning exists.
`scripts/provision-droplet.sh` performs the setup below idempotently.
Run it as root on the droplet:

```
./scripts/provision-droplet.sh --domain evonaire.ai \
    --deploy-pubkey-file /path/to/ci-deploy.pub
```

The script leaves four things to the operator. Node 22 comes from
NodeSource so `node`/`npm` land in `/usr/bin`, matching `ExecStart`. The
CI pubkey is only installed when the flag is passed. TLS certificates
come from `certbot --nginx` after DNS cutover. The GitHub secrets and
variables are set in the repo settings.

- Group `evonaire-web` owns `/opt/evonaire-web`. Service account
  `evonaire-web` (nologin, primary group `evonaire-web`) runs the unit.
  SSH account `deploy` (member of `evonaire-web`) receives CI deploys.
  `deploy` needs a real login shell such as `/bin/bash`: `ssh host "cmd"`
  and `scp` both fail against `nologin`. Key-only auth and `evonaire-web`
  membership bound file access. Sudo adds only the unit restart.
- `/opt/evonaire-web` owned `root:evonaire-web`, mode `2775` so new
  entries inherit the service group. `releases/` and `incoming/` inside
  it follow the same ownership.
- Sudoers grants `deploy` one passwordless command:

  ```
  deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart evonaire-web
  ```

  The deploy script calls `sudo -n`, so a missing rule fails the deploy
  on the spot.
- `deploy`'s `authorized_keys` should pin the CI deploy key and can add
  `no-pty,no-agent-forwarding,no-X11-forwarding`. File access stays under
  `/opt/evonaire-web`. The sudoers restart is the only privilege beyond
  file access.
- Install the unit above at `/etc/systemd/system/evonaire-web.service`,
  then run `systemctl daemon-reload && systemctl enable evonaire-web`.
  Leave it stopped until the first deploy creates `current`. The deploy
  script starts it through `systemctl restart`. Node 22 via NodeSource
  puts `node`/`npm` in `/usr/bin`, matching `ExecStart`.
- nginx vhosts and DNS per the sections below.

## Deploy automation

`.github/workflows/deploy.yml` runs on every push to `main` and on
`workflow_dispatch`. The droplet runs no build tooling. A guard step
fails any run that is not the `main` branch, which blocks
`workflow_dispatch` from deploying a branch or tag to production.

1. Check out the repo and set up Node 22, matching the droplet runtime.
   `.nvmrc` does not exist, so the workflow pins `node-version: 22`. The
   check workflows use Node 24. Bump both together if the server moves.
2. `npm ci --legacy-peer-deps`, the same flag `typecheck.yml` already
   uses.
3. Fail fast unless `vars.NEXT_PUBLIC_API_BASE_URL` is an absolute
   `http(s)://<host>/api` URL, then export the `NEXT_PUBLIC_*` values
   from `vars.*` into the step env and run `npm run build`.
   `next.config.mjs` derives the CSP API origins from that value at
   build time. A bad value ships requests that hit the frontend vhost
   or miss Django's `/api` mount.
4. `npm prune --omit=dev --legacy-peer-deps`. `next`, `react`, and
   `react-dom` live in `dependencies`, so `next start` still works after
   devDependencies leave the tree.
5. Tar the release tree while excluding `.git`, `.next/cache`,
   `node_modules/.cache`, and dotenv files.
6. `scp` the tarball to `droplet:/opt/evonaire-web/incoming/<sha>.tar.gz`
   over a dedicated deploy key loaded through `~/.ssh/config` on the
   runner. The runner trusts whatever host key `ssh-keyscan` returns on
   that run, so verification is per-run TOFU. Pinning the droplet's host
   public key in a secret and writing it to `known_hosts` instead is the
   upgrade path if that matters.
7. Pipe `scripts/deploy-droplet.sh` to `ssh droplet` with `SHA` in the
   environment. The script requires a full commit SHA. When `current`
   already points at `releases/<sha>` it skips extraction and does not
   need the tarball, so a same-SHA redeploy becomes a restart plus smoke
   check. Otherwise it extracts the tarball and flips `current`. The
   unit restarts, then the
   script smoke-checks the loopback listener with up to 15 attempts.
   Each attempt requires `systemctl is-active` on the unit AND an HTTP
   200 from `127.0.0.1:3000`, so a foreign process holding the port or
   a crash-looping release cannot pass. Is-active is a read call and
   needs no sudo.
   <!-- deslop-disable-line --> A failed check restores the previous
   release and fails the job. On success the script prunes old release
   directories. The live release stays even when it falls outside the
   five newest. The script then deletes the uploaded tarball.
8. A `concurrency` group serializes deploys with `cancel-in-progress`
   false, so a queued run is never killed mid-extract.

The workflow needs `DROPLET_SSH_KEY` (the raw private key for the
deploy account), `DROPLET_HOST`, and `DROPLET_USER` as secrets. The
`NEXT_PUBLIC_*` values come from `vars`, not `secrets`, because they are
public.

To deploy by hand, reproduce steps 1-5 locally on Node 22, upload the
tarball to `incoming/` with `scp`, and finish over SSH with
`ssh droplet "SHA=<full-40-char-sha> bash -s" < scripts/deploy-droplet.sh`.

systemd unit `/etc/systemd/system/evonaire-web.service`:

```ini
[Unit]
Description=EVONAIRE Next.js frontend
After=network.target

[Service]
Type=simple
User=evonaire-web
WorkingDirectory=/opt/evonaire-web/current
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm run start -- -H 127.0.0.1
Restart=on-failure
RestartSec=5
UMask=0002
# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/evonaire-web
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

`next start` does not honor a `HOSTNAME` env var, so the `-H` flag is
what binds `127.0.0.1:3000`. Nginx is the sole ingress. `UMask` keeps
service-written cache files group-writable so the deploy account can
still prune old releases.

## nginx

Two server blocks. TLS via certbot or the existing droplet certificate
setup.

`evonaire.ai` / `www.evonaire.ai`:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

`api.evonaire.ai`: same shape, `proxy_pass` to the gunicorn port with no
URI rewrite so `/api/...` reaches Django intact, plus
`proxy_read_timeout` sized for long-lived requests if any exist.
<!-- deslop-disable-line -->

Header rules:

- Do NOT set security response headers at nginx. `next.config.mjs`
  already emits the full set per path, including the `/creator/upload`
  Permissions-Policy split. Duplicates at the proxy create merge
  ambiguity.
- HSTS belongs on the HTTPS vhost only. Next already sends it, so nginx
  adds nothing.
- Enable gzip for `text/*` and `application/javascript` at nginx, or
  rely on Next's built-in compression, which is already on. Pick one.

## Resource budget

Postgres and Redis hold state on this droplet. Django runs under
gunicorn with Celery workers beside it, and nginx terminates TLS. With
CI-only builds the droplet never runs `next build`, so the ~1.5-2 GB
build RSS spike lands on the GitHub runner and no swapfile is needed
for deploys.

The droplet budget is runtime only. `next start` settles near 300-500 MB
RSS steady state, and `images.unoptimized` in `next.config.mjs` means no
image-optimization worker memory on top. Budget ~500 MB for the frontend
plus disk for five retained releases.

If disk or RAM later gets tight, `output: "standalone"` in
`next.config.mjs` produces a self-contained `.next/standalone` server
with only traced dependencies. The start command becomes
`node server.js`. `public/` and `.next/static` also need a manual copy
into the standalone tree. Treat it as a later optimization.

## Rollback

`ln -sfn` back to the previous release dir and restart the unit. Releases
are immutable directories, so rollback is seconds. Database migrations
are unaffected, and frontend rollback never requires a backend rollback.

## Verification checklist before DNS cutover

- `curl -sI https://<staging-host>/` shows `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, and a
  `Content-Security-Policy` whose `connect-src`/`img-src`/`media-src`
  include `https://api.evonaire.ai`.
- `curl -sI https://<staging-host>/creator/upload` shows
  `microphone=(self)` in Permissions-Policy. Any other path shows
  `microphone=()`.
- On the droplet, `ss -ltn | grep ':3000'` lists only the loopback
  listener `127.0.0.1:3000`.
- Login flow end-to-end: `/auth/login` → JWT stored → authed fetch
  against `https://api.evonaire.ai/api/...` succeeds (CORS preflight
  passes).
- Stripe checkout redirect and webhook delivery unaffected (webhooks
  hit `api.evonaire.ai/api/...` directly).
- Avatar/listing images load (CSP `img-src` covers the API origin).
- Protected route (`/member/...`) with no `session` cookie redirects to
  `/auth/login?from=...` via middleware.
- `Cache-Control: no-store` present on protected routes.

## DNS cutover

1. Deploy and verify on a staging hostname or hosts entry first.
2. Point `evonaire.ai` and `www.evonaire.ai` A/AAAA records at the
   droplet. Keep the Vercel project intact as fallback for 48 hours.
3. Lower DNS TTL to 300 s a day before cutover.
4. After burn-in, disconnect the Vercel project. `dev.evonaire.ai` can
   stay on Vercel previews or move to a staging vhost later.

## Open questions

- Deploy credentials: generate the SSH deploy keypair and pick
  `DROPLET_HOST`/`DROPLET_USER` for the workflow secrets.
- GitHub Actions variables: set the four `NEXT_PUBLIC_*` values as repo
  variables before the first deploy run, with the API base ending in
  `/api`.
- Whether `api.evonaire.ai` already resolves to this droplet or needs
  its own DNS record and nginx vhost.
- Staging environment: same droplet with a `staging.evonaire.ai` vhost,
  or a second droplet.
- Whether `deploy.yml` should wait for the check workflows before
  shipping to the droplet.
