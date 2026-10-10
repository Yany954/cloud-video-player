#!/bin/sh
# Runs one Maestro flow in the booted iPhone simulator with the fixture's temporary account.
#   e2e/run.sh watch        (after: python3 e2e/fixture.py up)
#   e2e/run.sh sign-in      (after: python3 e2e/fixture.py user)
# Needs the development build installed in the simulator and the dev server running.
set -eu
cd "$(dirname "$0")/.."
eval "$(python3 e2e/fixture.py env)"
# Maestro waits for Android's adb at start, which hangs on this Mac: keep it off the PATH
# while testing iOS.
CLEAN_PATH=$(printf '%s' "$PATH" | tr ':' '\n' | grep -vi android | paste -sd: -)
DEVICE=$(xcrun simctl list devices booted | sed -n 's/.*(\([0-9A-F-]\{36\}\)) (Booted).*/\1/p' | head -1)
[ -n "$DEVICE" ] || { echo "No booted simulator. Start one first."; exit 1; }
flow="$1"; shift
env -u ANDROID_HOME -u ANDROID_SDK_ROOT PATH="$CLEAN_PATH:$HOME/.maestro/bin" MAESTRO_CLI_NO_ANALYTICS=1 \
  maestro --device "$DEVICE" test ".maestro/$flow.yaml" -e EMAIL="$EMAIL" -e PASSWORD="$PASSWORD" "$@" </dev/null
