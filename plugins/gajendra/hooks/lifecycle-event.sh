#!/bin/sh
# Fixed local entrypoint. Hook stdin is data and is never evaluated by this shell.
plugin_root=${PLUGIN_ROOT:-}
if [ -z "$plugin_root" ] || [ ! -f "$plugin_root/dist/server.mjs" ]; then
  printf '{}\n'
  exit 0
fi
runtime=${GAJENDRA_NODE_BIN:-}
if [ ! -x "$runtime" ]; then
  runtime="$HOME/Applications/Gajendra.app/Contents/Resources/Runtime/node/bin/node"
fi
if [ ! -x "$runtime" ]; then
  runtime="/Applications/Gajendra.app/Contents/Resources/Runtime/node/bin/node"
fi
if [ ! -x "$runtime" ]; then
  runtime=$(command -v node 2>/dev/null || true)
fi
if [ ! -x "$runtime" ]; then
  printf '{}\n'
  exit 0
fi
"$runtime" "$plugin_root/dist/server.mjs" --lifecycle-event 2>/dev/null || printf '{}\n'
exit 0
