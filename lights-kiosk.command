#!/bin/bash
# Login command for the user that owns the LED hardware. Runs the
# Blinkstick daemon, which connects to the Nodeventure server over
# socket.io and drives the strip in response to `lights` events.
#
# Set NODEVENTURE_URL if the server isn't on the same machine, e.g.
#   export NODEVENTURE_URL=http://nodeventure.local:8989
# (otherwise it defaults to http://127.0.0.1:8989).
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

while true; do
    node lights-client.js
    # Daemon shouldn't normally exit; if it does, pause briefly and respawn.
    sleep 2
done
