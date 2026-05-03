#!/bin/bash
# Kiosk launcher: starts (or reuses) a detached tmux session running the
# server, the tailscale funnel, and the lights daemon — each wrapped in a
# restart loop so a crash just respawns the pane. Then runs Chrome in
# kiosk mode in the foreground.
#
# The lights daemon is started with `sudo -n` (non-interactive). To allow
# that without a password prompt, add this line to /etc/sudoers.d/nodeventure
# (run `sudo visudo -f /etc/sudoers.d/nodeventure`):
#
#   tom ALL=(root) NOPASSWD: /Users/tom/stuff/fun/nodeventure/lights-sudo.sh
#
# Replace `tom` with your username if different. The lights-sudo.sh wrapper
# is intentionally narrow so the sudoers rule grants the minimum needed.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

SESSION="nodeventure-kiosk"
URL="http://127.0.0.1:8989/kiosk"

if ! tmux has-session -t "$SESSION" 2>/dev/null; then
    # Each pane runs in a `while true` so an exit/crash restarts it.
    # `nodemon --exitcrash` makes nodemon bubble crashes up to the loop
    # rather than hanging on "waiting for file changes".
    SERVER='while true; do npx nodemon --exitcrash src/server.js; echo "[server exited — restarting in 2s]"; sleep 2; done'
    FUNNEL='while true; do tailscale funnel 8989; echo "[funnel exited — restarting in 5s]"; sleep 5; done'
    LIGHTS='while true; do sudo -n ./lights-sudo.sh; echo "[lights exited — restarting in 2s]"; sleep 2; done'

    tmux new-session  -d -s "$SESSION"   -c "$SCRIPT_DIR" "bash -c '$SERVER'"
    tmux split-window -h -t "$SESSION:0" -c "$SCRIPT_DIR" "bash -c '$FUNNEL'"
    tmux split-window -v -t "$SESSION:0" -c "$SCRIPT_DIR" "bash -c '$LIGHTS'"
    tmux select-layout -t "$SESSION:0" tiled
fi

while true; do
    killall Dock 2>/dev/null
    killall Finder 2>/dev/null

    # Clear any "Chrome didn't shut down correctly" prompt
    defaults write com.google.Chrome ExitTypeCrashed -string "Normal"
    defaults write com.google.Chrome ExitedCleanly -bool true

    /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
        --kiosk \
        --incognito \
        --noerrdialogs \
        --disable-pinch \
        --disable-session-crashed-bubble \
        --disable-infobars \
        --overscroll-history-navigation=0 \
        --disable-features=TranslateUI \
        "$URL"

    sleep 1
done
