#!/bin/bash
# Narrow wrapper around the lights daemon. Exists so the sudoers rule in
# /etc/sudoers.d/nodeventure can grant NOPASSWD for *this exact path* only,
# rather than `node` (which would let any script run as root).
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# sudo scrubs PATH and resets HOME, so `env node` won't find a node managed
# by mise/nvm. Search the original user's install dirs first, then system.
if [ -n "$SUDO_USER" ]; then
    USER_HOME=$(/usr/bin/dscl . -read "/Users/$SUDO_USER" NFSHomeDirectory 2>/dev/null | awk '{print $2}')
fi
[ -z "$USER_HOME" ] && USER_HOME="$HOME"

NODE_BIN=""
for p in \
    "$USER_HOME"/.local/share/mise/installs/node/*/bin/node \
    "$USER_HOME"/.nvm/versions/node/*/bin/node \
    /opt/homebrew/bin/node \
    /usr/local/bin/node \
    /usr/bin/node; do
    if [ -x "$p" ]; then NODE_BIN="$p"; break; fi
done

if [ -z "$NODE_BIN" ]; then
    echo "lights-sudo.sh: could not find a node binary" >&2
    exit 1
fi

exec "$NODE_BIN" lights-client.js
