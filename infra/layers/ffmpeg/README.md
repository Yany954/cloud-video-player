# ffmpeg Lambda layer

`bin/ffmpeg` and `bin/ffprobe` (static Linux arm64 builds, ffmpeg 7.0.2, GPLv3) are downloaded
by `pnpm --filter @cvp/infra fetch:ffmpeg` and are not committed. Inside Lambda the layer is
mounted at `/opt`, so the binaries are at `/opt/bin/ffmpeg` and `/opt/bin/ffprobe`.

They run only on our own backend and are not redistributed.
