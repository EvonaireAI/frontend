#!/usr/bin/env bash
# Runs on the droplet, fed over SSH by .github/workflows/deploy.yml:
#   ssh droplet "SHA=<full-git-sha> bash -s" < scripts/deploy-droplet.sh
# Extracts a CI-built release into releases/<sha> and flips `current`.
# Restarts evonaire-web and smoke-checks the result. A failed check
# restores the previous release, and success prunes old releases while
# keeping the live release.
set -euo pipefail

: "${SHA:?SHA must be set to the release commit sha}"
if [[ ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "SHA must be a full lowercase git commit sha" >&2
  exit 1
fi

BASE=/opt/evonaire-web
REL="$BASE/releases/$SHA"
TARBALL="$BASE/incoming/$SHA.tar.gz"

install -d "$BASE/releases" "$BASE/incoming"

CURRENT_TARGET=""
if [ -e "$BASE/current" ] || [ -L "$BASE/current" ]; then
  CURRENT_TARGET="$(readlink -f "$BASE/current" 2>/dev/null || true)"
fi
REUSE_LIVE=0
if [ "$CURRENT_TARGET" = "$REL" ] && [ -f "$REL/.next/BUILD_ID" ]; then
  REUSE_LIVE=1
fi

if [ "$REUSE_LIVE" -eq 0 ] && [ ! -f "$TARBALL" ]; then
  echo "missing tarball: $TARBALL" >&2
  exit 1
fi

if [ "$REUSE_LIVE" -eq 0 ]; then
  if [ -e "$REL" ]; then
    rm -rf "$REL"
  fi
  install -d "$REL"
  if ! tar -xzf "$TARBALL" -C "$REL"; then
    rm -rf "$REL"
    echo "failed to extract $TARBALL" >&2
    exit 1
  fi
  touch "$REL"
fi

# CI excludes .next/cache. Keep the cache dir under the service group
# before the restart so ISR or fetch caching can write there. Service-
# written children inherit the group through setgid and UMask=0002.
# .next itself also needs group write so the service can create
# entries beside cache/ (trace files, a future cacheHandler path).
# The extracted mode is 755.
install -d "$REL/.next/cache"
chgrp evonaire-web "$REL/.next"
chmod g+w "$REL/.next"
chgrp evonaire-web "$REL/.next/cache"
chmod g+rwX "$REL/.next/cache"
chmod g+s "$REL/.next/cache"

PREV="$CURRENT_TARGET"
ln -sfn "$REL" "$BASE/current"

smoke_ok() {
  local _
  for _ in $(seq 1 15); do
    # The unit must report active alongside the HTTP 200. A foreign
    # process holding :3000, or a release crash-looping after one good
    # response, can satisfy curl while evonaire-web is dead. is-active
    # is a read call and needs no sudo.
    if systemctl is-active --quiet evonaire-web \
      && curl -fsS --max-time 5 -o /dev/null http://127.0.0.1:3000/; then
      return 0
    fi
    sleep 1
  done
  return 1
}

fail_deploy() {
  echo "$1" >&2
  if [ -n "${PREV:-}" ] && [ "$PREV" != "$REL" ]; then
    ln -sfn "$PREV" "$BASE/current"
    sudo -n /usr/bin/systemctl restart evonaire-web || true
    if [ "$(readlink -f "$BASE/current" 2>/dev/null || true)" = "$PREV" ]; then
      rm -rf "$REL"
    fi
    echo "restored previous release $PREV" >&2
  else
    echo "no previous release to restore" >&2
  fi
  exit 1
}

if ! sudo -n /usr/bin/systemctl restart evonaire-web; then
  fail_deploy "service restart failed for $SHA"
fi

if ! smoke_ok; then
  fail_deploy "smoke check failed for $SHA"
fi

LIVE="$(readlink -f "$BASE/current" 2>/dev/null || true)"
if [ -n "$LIVE" ]; then
  cd "$BASE/releases"
  ls -1dt */ 2>/dev/null | tail -n +6 | while IFS= read -r d; do
    dir="${d%/}"
    if [ "$(readlink -f "$dir")" != "$LIVE" ]; then
      rm -rf "$dir"
    fi
  done
fi

rm -f "$TARBALL"
find "$BASE/incoming" -name '*.tar.gz' -mtime +7 -delete 2>/dev/null || true
echo "deployed $SHA"
