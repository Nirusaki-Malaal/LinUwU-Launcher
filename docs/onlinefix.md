# OnlineFix in Heroic

This custom Heroic build adds opt-in OnlineFix launch support for sideloaded Windows games on Linux. It uses Heroic's selected Wine/Proton, existing prefix, library, artwork, playtime, stop controls and shortcuts. It does not install another compatibility runtime.

## Use it

1. Open **Heroic with OnlineFix**. Quit another running Heroic instance first.
2. Use **Add Game** to select your installed game's executable. For games with a dedicated OnlineFix/EOS launcher, select that launcher as the executable.
3. Open **Game settings → Wine → OnlineFix** and enable **OnlineFix support**.
4. Choose your existing Wine/Proton and prefix in Heroic as usual.
5. Sign in to the native Steam client. Press **Play** in Heroic. Heroic starts Steam if necessary; signing in remains your responsibility.
6. Enable the optional Steam overlay in the OnlineFix section if wanted.

## Behavior

Before each enabled game's launch, an asynchronous bounded scan reads matching DLL filenames and `OnlineFix.ini`, `SteamFix.ini`, `winmm.txt`, and `dlllist.txt`. Generated `WINEDLLOVERRIDES` apply only to that launch. Explicit manual overrides in Heroic take priority. Existing environment variables and preloads are retained. Symlinks and common prefix directories are skipped.

Turning OnlineFix off restores the ordinary Heroic launch flow. Games without this setting, native Linux games, browser games and store-managed games do not use it. OnlineFix settings use Heroic's existing per-game persistence; no migration is required.

This integration launches already installed/prepared fixes. It does not download games, modify game INI/DLL files, install payloads, or reproduce the original launcher's binary-replacement patches. Game-specific online services and real multiplayer compatibility require testing with the particular game. On Flatpak, start the native Steam client manually and ensure its files are accessible to Heroic.

## Development and verification

```sh
pnpm install
pnpm exec jest --runInBand --runTestsByPath src/backend/onlinefix/__tests__/onlinefix.test.ts
pnpm run codecheck
pnpm run build
HEROIC_TEST_ELECTRON=/usr/bin/electron42 pnpm exec playwright test e2e/onlinefix.spec.ts
./scripts/run-onlinefix.sh
```

The UI test uses a temporary game and isolated Electron profile. Existing Steam/Heroic runtime directories are never downloaded, replaced or copied by the OnlineFix feature.

The local launcher uses a system Electron installation, or `HEROIC_ELECTRON_BINARY`. Helper binaries in the local build were reused from the installed Heroic package. For a distributable build, use Heroic's upstream helper-binary download and packaging instructions. Source changes remain on `feat/onlinefix-support`.
