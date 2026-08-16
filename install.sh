#!/usr/bin/env bash
# dsh-plugin-master installer (POSIX).
#
# Default behavior: link the current checkout directly into the profile's
# node_modules. This script does NOT publish anywhere — running it from
# inside a clone is the expected workflow. To pin a published source,
# pass -Source <url> explicitly.
#
# What it does:
#   1. resolve a plugin source directory (current dir by default, or git
#      clone / zip / local path when -Source is supplied)
#   2. create a junction-like symlink in the profile's node_modules
#   3. register plugin-master in cordis.patch.yml (idempotent)
#
# Usage:
#   ./install.sh                                # link current directory
#   ./install.sh -Source /path/to/checkout     # link a different checkout
#   ./install.sh -Source https://github.com/... # clone + link a remote
#   ./install.sh -Profile tui -DshHome ~/.dsh   # different profile / home
#
# When -Source is omitted, the script links the directory it lives in
# ($(dirname "$0")) instead of fetching anything from the network. This
# keeps the install reproducible on a developer machine that only has
# the local checkout.

set -euo pipefail

GITHUB_REPO="${GITHUB_REPO:-helloydh007/dsh-plugin-master}"
PLUGIN_NAME="dsh-plugin-master"
PROFILE="web"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
VERSION="latest"
SOURCE=""

usage() {
  cat <<EOF
usage: $0 [-Source <url|path>] [-Version <ref>] [-DshHome <dir>] [-Profile <name>]

  -Source      repo URL, tarball URL, or local path. Defaults to the
               directory this script lives in (a local link).
  -Version     'latest' (default), tag (v0.1.0), or branch (main). Only
               used when -Source is a GitHub URL.
  -DshHome     DSH home directory (default: \$DSH_HOME or ~/.dsh)
  -Profile     profile name (default: web)
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    -Version) VERSION="$2"; shift 2;;
    -Source) SOURCE="$2"; shift 2;;
    -DshHome) DSH_HOME="$2"; shift 2;;
    -Profile) PROFILE="$2"; shift 2;;
    -h|-help|--help) usage; exit 0;;
    *) echo "unknown argument: $1" >&2; usage; exit 2;;
  esac
done

if [ -z "$DSH_HOME" ] || [ ! -d "$DSH_HOME" ]; then
  echo "DSH home not found: $DSH_HOME (override with -DshHome)" >&2
  exit 1
fi

NODE_MODULES="$DSH_HOME/profiles/$PROFILE/node_modules"
LINK_PATH="$NODE_MODULES/$PLUGIN_NAME"
PATCH_FILE="$DSH_HOME/profiles/$PROFILE/cordis.patch.yml"
PLUGINS_DIR="$DSH_HOME/plugins"
CLONE_DIR="$PLUGINS_DIR/$PLUGIN_NAME"

step() { printf '\033[36m%s\033[0m\n' "$*"; }
ok() { printf '\033[32m%s\033[0m\n' "$*"; }

# ----- 1. source -----
if [ -z "$SOURCE" ]; then
  # Default to the directory this script lives in. The script is meant
  # to run from inside a clone, so this is the natural choice.
  SOURCE="$(cd "$(dirname "$0")" && pwd)"
  step "[1/3] Using local source $SOURCE"
else
  case "$SOURCE" in
    https://github.com/*)
      step "[1/3] Resolving $SOURCE @ $VERSION ..."
      if [ "$VERSION" = "latest" ]; then
        REPO="${SOURCE#https://github.com/}"
        REPO="${REPO%.git}"
        REF="$(curl -fsSL -H 'Accept: application/vnd.github+json' \
          "https://api.github.com/repos/$REPO/releases/latest" \
          | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -n1)"
        if [ -z "$REF" ]; then REF="main"; fi
      else
        REF="$VERSION"
      fi
      if echo "$REF" | grep -q '^v[0-9]'; then
        REF_KIND="tags"; REF_PATH="tags/$REF"
      else
        REF_KIND="heads"; REF_PATH="heads/$REF"
      fi
      ZIP_URL="https://github.com/${REPO}/archive/refs/$REF_PATH.zip"
      TMP_DIR="$(mktemp -d)"
      step "  downloading $ZIP_URL"
      curl -fsSL -o "$TMP_DIR/source.zip" "$ZIP_URL"
      unzip -q "$TMP_DIR/source.zip" -d "$TMP_DIR"
      INNER="$(find "$TMP_DIR" -mindepth 1 -maxdepth 1 -type d | head -n1)"
      rm -rf "$CLONE_DIR"
      mkdir -p "$(dirname "$CLONE_DIR")"
      mv "$INNER" "$CLONE_DIR"
      rm -rf "$TMP_DIR"
      SOURCE="$CLONE_DIR"
      ;;
    *.tar.gz|*.tgz)
      step "[1/3] Extracting tarball $SOURCE ..."
      TMP_DIR="$(mktemp -d)"
      tar -xzf "$SOURCE" -C "$TMP_DIR"
      INNER="$(find "$TMP_DIR" -mindepth 1 -maxdepth 1 -type d | head -n1)"
      rm -rf "$CLONE_DIR"
      mkdir -p "$(dirname "$CLONE_DIR")"
      mv "$INNER" "$CLONE_DIR"
      rm -rf "$TMP_DIR"
      SOURCE="$CLONE_DIR"
      ;;
    *)
      step "[1/3] Using local source $SOURCE ..."
      SOURCE="$(cd "$SOURCE" && pwd)"
      ;;
  esac
fi

# Verify the expected build outputs exist. The host emits .mjs (ESM
# for Node), the client emits .cjs (wrapped in window.__ModuleLoader__
# for the browser). Both must be present before the plugin can mount.
if [ ! -f "$SOURCE/lib/client.cjs" ] || [ ! -f "$SOURCE/lib/index.mjs" ]; then
  echo "" >&2
  echo "lib/client.cjs or lib/index.mjs not found in $SOURCE." >&2
  echo "Build the plugin first:  pnpm install && pnpm build" >&2
  exit 1
fi

# ----- 2. link -----
step "[2/3] Linking -> $LINK_PATH"
mkdir -p "$NODE_MODULES" "$(dirname "$LINK_PATH")"
if [ -L "$LINK_PATH" ] || [ -e "$LINK_PATH" ]; then
  rm -rf "$LINK_PATH"
fi
ln -s "$SOURCE" "$LINK_PATH"
ok "linked"

# ----- 3. register -----
step "[3/3] Registering in $PATCH_FILE"
ENTRY=$(cat <<'YAML'
- id: ui-settings-plugin-inventory
  disabled: true

- insert:
    - id: plugin-master
      name: dsh-plugin-master
YAML
)
if [ ! -f "$PATCH_FILE" ]; then
  printf '%s\n' "$ENTRY" > "$PATCH_FILE"
else
  if grep -Eq '^\s*-\s+id:\s*plugin-master\s*$' "$PATCH_FILE"; then
    ok "already registered, skip"
  else
    TMP="$(mktemp)"
    {
      cat "$PATCH_FILE"
      printf '\n%s\n' "$ENTRY"
    } > "$TMP"
    mv "$TMP" "$PATCH_FILE"
  fi
fi

ok ""
ok "Done. Reload the Web UI; Settings -> Plugins -> Plugin Manager."
ok "If the tab does not appear after reload, restart the dsh web process."