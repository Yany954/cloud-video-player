#!/usr/bin/env bash
# Downloads the static ffmpeg + ffprobe binaries (Linux arm64) used by the processing Lambda
# into infra/layers/ffmpeg/bin. They are ~100 MB, so they are not committed.
# The checksum is pinned: if the upstream file ever changes, this fails instead of
# silently shipping a different binary.
set -euo pipefail

URL="https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz"
SHA256="f4149bb2b0784e30e99bdda85471c9b5930d3402014e934a5098b41d0f7201b1" # ffmpeg 7.0.2
BIN_DIR="$(cd "$(dirname "$0")/.." && pwd)/layers/ffmpeg/bin"

if [[ -x "$BIN_DIR/ffmpeg" && -x "$BIN_DIR/ffprobe" ]]; then
  echo "ffmpeg layer already present in $BIN_DIR"
  exit 0
fi

WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

echo "Downloading ffmpeg (about 19 MB)..."
curl -fsSL "$URL" -o "$WORK_DIR/ffmpeg.tar.xz"

ACTUAL=$(shasum -a 256 "$WORK_DIR/ffmpeg.tar.xz" | cut -d' ' -f1)
if [[ "$ACTUAL" != "$SHA256" ]]; then
  echo "Checksum mismatch: expected $SHA256, got $ACTUAL" >&2
  echo "The upstream build changed. Review it, then update SHA256 in this script." >&2
  exit 1
fi

tar -xJf "$WORK_DIR/ffmpeg.tar.xz" -C "$WORK_DIR"
mkdir -p "$BIN_DIR"
cp "$WORK_DIR"/ffmpeg-*-arm64-static/{ffmpeg,ffprobe} "$BIN_DIR/"
chmod +x "$BIN_DIR/ffmpeg" "$BIN_DIR/ffprobe"
echo "ffmpeg layer ready in $BIN_DIR"
