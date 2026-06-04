#!/usr/bin/env bash
# Serve ~/pr-review/ on port 8080 in the background.
# Idempotent: if a server is already running on 8080, exit cleanly.
#
# After this script reports a URL, the user reaches their PR explainer at
# http://localhost:8080/<pr-number>/ — but ONLY after setting up an SSH
# tunnel from their laptop to the devbox. See the banner at the bottom.

set -u

PORT=8080
ROOT="${HOME}/pr-review"

mkdir -p "$ROOT"

existing_pid="$(pgrep -fa "http.server ${PORT}" | awk 'NR==1{print $1}')"

if [[ -n "${existing_pid:-}" ]]; then
  echo "✓ Server already running on port ${PORT} (PID ${existing_pid})"
  echo "  Serving: ${ROOT}"
else
  cd "$ROOT"
  nohup python3 -m http.server "$PORT" --bind 0.0.0.0 \
    >/tmp/pr-review-server.log 2>&1 &
  new_pid=$!
  disown
  sleep 0.5
  if kill -0 "$new_pid" 2>/dev/null; then
    echo "✓ Started server on port ${PORT} (PID ${new_pid})"
    echo "  Serving: ${ROOT}"
    echo "  Log:     /tmp/pr-review-server.log"
  else
    echo "✗ Server failed to start. Check /tmp/pr-review-server.log"
    tail -20 /tmp/pr-review-server.log
    exit 1
  fi
fi

cat <<'BANNER'

────────────────────────────────────────────────────────────────────
To view from your laptop, open an SSH tunnel:

    gcloud compute ssh <devbox-name> \
        --project=<gcp-project> \
        --tunnel-through-iap \
        -- -L 8080:localhost:8080

Then browse to:

    http://127.0.0.1:8080/<pr-number>/

(Use 127.0.0.1 — localhost can be HSTS-upgraded to https by some browsers,
 and this server is plain HTTP.)
────────────────────────────────────────────────────────────────────
BANNER
