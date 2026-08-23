#!/bin/zsh
set -euo pipefail

script_dir=${0:A:h}
repo_root=${script_dir:h:h:h}
package_root=${script_dir:h}
app_path=${GAJENDRA_UI_TEST_APP:-"$repo_root/build/Gajendra.app"}
app_binary="$app_path/Contents/MacOS/Gajendra"
store_fixture="$repo_root/plugins/gajendra/tests/fixtures/ui-interactions-store.json"
sources_fixture="$repo_root/plugins/gajendra/tests/fixtures/ui-interactions-sources.json"
threads_fixture="$repo_root/plugins/gajendra/tests/fixtures/ui-interactions-threads.json"
test_root=$(/usr/bin/mktemp -d "${TMPDIR:-/tmp}/gajendra-ui-test.XXXXXX")
app_pid=""

cleanup() {
  if [[ -n "$app_pid" ]] && /bin/kill -0 "$app_pid" 2>/dev/null; then
    /bin/kill -TERM "$app_pid" 2>/dev/null || true
    for _ in {1..30}; do
      /bin/kill -0 "$app_pid" 2>/dev/null || break
      /bin/sleep 0.1
    done
    if /bin/kill -0 "$app_pid" 2>/dev/null; then
      /bin/kill -KILL "$app_pid" 2>/dev/null || true
    fi
    wait "$app_pid" 2>/dev/null || true
  fi
  if [[ -n "$test_root" && "${test_root:t}" == gajendra-ui-test.* ]]; then
    /bin/rm -rf -- "$test_root"
  fi
}
trap cleanup EXIT INT TERM

cd -- "$repo_root"

if [[ ! -x "$app_binary" ]]; then
  print -u2 -- "Gajendra UI test requires a built app at $app_path"
  exit 66
fi
if [[ ! -f "$store_fixture" || ! -f "$sources_fixture" || ! -f "$threads_fixture" ]]; then
  print -u2 -- "Gajendra UI test fixtures are missing."
  exit 66
fi

refresh_source="$package_root/Sources/GajendraKit/DeckWidgetView.swift"
app_source="$package_root/Sources/GajendraApp/main.swift"
if ! rg -q "GajendraSurfaceRefreshPolicy" "$refresh_source" \
    || ! rg -q "surfaceIsVisible" "$refresh_source" \
    || ! rg -q "startSurfaceRefresh|stopSurfaceRefresh|refreshPresentedSurfaceIfIdle" "$app_source" \
    || ! rg -q "popoverDidClose" "$app_source"; then
  print -u2 -- "Gajendra visible-surface refresh lifecycle contract is missing."
  exit 66
fi
print -- "Gajendra UI structural proof: visible-only refresh lifecycle contract present"

existing_gajendra_pids=$(/usr/bin/pgrep -x Gajendra 2>/dev/null || true)
if [[ -n "$existing_gajendra_pids" ]]; then
  print -u2 -- "Gajendra UI test requires an exclusive app instance; live Gajendra PID(s): $existing_gajendra_pids"
  exit 75
fi

/bin/mkdir -p "$test_root/home" "$test_root/state"
/bin/cp "$store_fixture" "$test_root/state/gajendra.v2.json"
/bin/chmod 0700 "$test_root/state"
/bin/chmod 0600 "$test_root/state/gajendra.v2.json"

env \
  CFFIXED_USER_HOME="$test_root/home" \
  GAJENDRA_DATA_DIR="$test_root/state" \
  GAJENDRA_SOURCES_CONFIG="$sources_fixture" \
  GAJENDRA_UI_TEST_PROBE=1 \
  "$app_binary" \
  -ApplePersistenceIgnoreState YES \
  -gajendra.onboarding.sources.completed.v1 YES \
  -gajendra.onboarding.sources.seen.v1 YES \
  -gajendra.pill.hidden NO \
  -gajendra.visual.hover-card-size compact \
  -gajendra.visual.pill-anchor "${GAJENDRA_UI_TEST_PILL_ANCHOR:-top-left}" \
  >"$test_root/app.log" 2>&1 &
app_pid=$!

/usr/bin/swift build --package-path "$package_root" -c release --product GajendraUITest
test_binary_dir=$(/usr/bin/swift build --package-path "$package_root" -c release --show-bin-path)

if ! "$test_binary_dir/GajendraUITest" "$app_pid" "$test_root/state/gajendra.v2.json" "$app_path"; then
  /usr/bin/tail -n 80 "$test_root/app.log" >&2 || true
  exit 1
fi

if [[ "${GAJENDRA_UI_TEST_ASSERT_NO_ATTRIBUTE_CYCLES:-0}" == "1" ]] \
    && /usr/bin/grep -qF "AttributeGraph: cycle detected" "$test_root/app.log"; then
  print -u2 -- "Gajendra emitted an AttributeGraph cycle during the UI journey."
  /usr/bin/tail -n 80 "$test_root/app.log" >&2 || true
  exit 1
fi

if ! /bin/kill -0 "$app_pid" 2>/dev/null; then
  print -u2 -- "Gajendra exited before the UI journey completed."
  /usr/bin/tail -n 80 "$test_root/app.log" >&2 || true
  exit 1
fi
