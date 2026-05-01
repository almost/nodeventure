#!/usr/bin/env bash
set -e

SESSION="nodeventure"

if tmux has-session -t "$SESSION" 2>/dev/null; then
    tmux attach -t "$SESSION"
    exit 0
fi

# Wrap commands so the pane stays open even if the command exits/errors.
LEFT='tailscale funnel 8989; echo; echo "[exited — press enter to close]"; read'
RIGHT='npm run dev; echo; echo "[exited — press enter to close]"; read'

tmux new-session -d -s "$SESSION" -c "$PWD" -x "$(tput cols)" -y "$(tput lines)" "bash -c '$LEFT'"
tmux split-window -h -t "$SESSION:0.0" -c "$PWD" "bash -c '$RIGHT'"
tmux select-layout -t "$SESSION:0" even-horizontal
tmux select-pane -t "$SESSION:0.1"
tmux attach -t "$SESSION"
