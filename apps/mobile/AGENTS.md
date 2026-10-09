# apps/mobile

React Native app built with Expo (SDK in `package.json`). Project-wide rules are in the
repository's `CLAUDE.md` and `docs/ROADMAP.md`.

- Expo changes between SDK releases: before using an Expo or React Native API, read the docs
  for this SDK version (`https://docs.expo.dev/versions/v<major>.0.0/`,
  index at `https://docs.expo.dev/llms.txt`) instead of relying on memory.
- Add native libraries with `pnpm exec expo install <package>` so versions match the SDK.
- `ios/` and `android/` are generated (`expo prebuild`) and not committed: configure native
  behaviour in `app.json` and config plugins. Our own native code lives in `modules/`.
- This is a development build, not Expo Go: `pnpm --filter @cvp/mobile ios` builds and runs it.
- Routes live in `src/app/` (Expo Router). Everything else lives outside it.
- Commits that touch only the mobile app carry `[skip-cd]`: they must not rebuild the website.
