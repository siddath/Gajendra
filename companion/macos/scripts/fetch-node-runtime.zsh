#!/bin/zsh
set -euo pipefail

script_dir=${0:A:h}
repo_root=${script_dir:h:h:h}
node_version="24.19.0"

case "$(/usr/bin/uname -m)" in
  arm64) node_arch="arm64"; node_sha256="8294b7aa9b03997481c06babf1e8b270c859358f27da57a11509afe537ac381d" ;;
  x86_64) node_arch="x64"; node_sha256="d1b5e999db158c62fe8f7267a4476b035d8bd93b1a605bac24a3f0dd166e3316" ;;
  *) print -u2 -- "Unsupported macOS architecture for the bundled Node runtime."; exit 64 ;;
esac

archive_name="node-v${node_version}-darwin-${node_arch}.tar.gz"
runtime_name="node-v${node_version}-darwin-${node_arch}"
cache_root="${GAJENDRA_NODE_RUNTIME_CACHE:-$repo_root/build/node-runtime-cache}"
archive_path="$cache_root/$archive_name"
runtime_dir="$cache_root/$runtime_name"
runtime_binary="$runtime_dir/bin/node"
source_url="https://nodejs.org/dist/v${node_version}/${archive_name}"

/bin/mkdir -p "$cache_root"

if [[ ! -f "$archive_path" ]]; then
  /usr/bin/curl --fail --location --proto '=https' --tlsv1.2 --retry 2 --output "$archive_path" "$source_url"
fi

actual_sha256=$(/usr/bin/shasum -a 256 "$archive_path" | /usr/bin/awk '{print $1}')
if [[ "$actual_sha256" != "$node_sha256" ]]; then
  print -u2 -- "Node runtime checksum verification failed; the cached archive was not used."
  exit 65
fi

staging_dir="$cache_root/.${runtime_name}.extract-$$"
cleanup_staging() {
  /bin/rm -rf "$staging_dir"
}
trap cleanup_staging EXIT

# Re-extract every time from the checksum-verified archive. An existing cache directory is not a
# trust boundary: it may have been modified after a previous successful extraction.
/bin/rm -rf "$staging_dir"
/bin/mkdir -p "$staging_dir"
/usr/bin/tar -xzf "$archive_path" -C "$staging_dir"
if [[ ! -x "$staging_dir/$runtime_name/bin/node" || ! -f "$staging_dir/$runtime_name/LICENSE" ]]; then
  print -u2 -- "Verified Node archive has an unexpected runtime layout."
  exit 66
fi
/bin/rm -rf "$runtime_dir"
/bin/mv "$staging_dir/$runtime_name" "$runtime_dir"
cleanup_staging
trap - EXIT

if [[ ! -x "$runtime_binary" || ! -f "$runtime_dir/LICENSE" ]]; then
  print -u2 -- "Verified Node archive did not produce a usable runtime."
  exit 66
fi

if [[ "${1:-}" == "--path" ]]; then
  print -r -- "$runtime_dir"
  exit 0
fi

print -- "Verified Node.js v${node_version} (${node_arch}) runtime cache: $runtime_dir"
print -- "Archive SHA-256: $node_sha256"
print -- "Bundle target: Contents/Resources/Runtime/node/bin/node"
