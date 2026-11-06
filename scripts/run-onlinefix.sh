#!/bin/sh
set -eu
script_path=$(readlink -f -- "$0")
project_root=$(CDPATH= cd -- "$(dirname -- "$script_path")/.." && pwd)
if [ ! -f "$project_root/build/main/main.js" ]; then
  echo "Build Heroic first: pnpm install && pnpm run build" >&2
  exit 1
fi
if [ -n "${HEROIC_ELECTRON_BINARY:-}" ]; then
  electron_binary=$HEROIC_ELECTRON_BINARY
else
  electron_binary=''
  for candidate in electron42 electron44 electron; do
    if command -v "$candidate" >/dev/null 2>&1; then
      electron_binary=$(command -v "$candidate")
      break
    fi
  done
  if [ -z "$electron_binary" ]; then
    echo "Install Electron or set HEROIC_ELECTRON_BINARY to its executable." >&2
    exit 1
  fi
fi
cd "$project_root"
if [ -n "${WAYLAND_DISPLAY:-}" ]; then
  exec "$electron_binary" "$project_root" --ozone-platform=wayland "$@"
fi
exec "$electron_binary" "$project_root" "$@"
