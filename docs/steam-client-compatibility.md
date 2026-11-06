# Steam client compatibility

Enable the per-game compatibility option under **Game settings → Wine** for an installed sideloaded Windows game. It reuses the selected Wine/Proton and prefix.

For Proton games, the compatibility launch path resolves the required Valve runtime from the selected Proton's `toolmanifest.vdf`, finds that runtime in the existing Steam libraries, and starts Proton through its `run` wrapper. The real `STEAM_COMPAT_CLIENT_INSTALL_PATH` is retained so Proton can install and update Steam's Windows client DLLs in the prefix. This avoids UMU's clearing of that variable. Ordinary Proton games retain their existing UMU behavior. A missing matching runtime produces an actionable error instead of silently using another runtime.

**Game settings → Other → Runtimes** shows the effective runtime and its location. UMU control for ordinary Proton games lives there too. Steam overlay is under **Performance & Overlays**. Native Linux games retain the runtime selector. Wine/Proton selection and compatibility options remain under Wine.

DLL overrides use filenames only. Files whose names start with `Online` (case-insensitive) are never opened by the scanner. Only `SteamFix.ini`, `winmm.txt`, and `dlllist.txt` may supply optional metadata. Symlinks and prefix directories are skipped. Explicit user overrides take priority; generated settings apply only to a launch. Game files are not patched or replaced.

The error “Failed to load original steamclient” with code 126 can have other causes, including missing DLL dependencies. The runtime/client fix addresses the observed UMU path issue and missing client DLLs; a local Forza Horizon 4 check reached the rendered startup/loading screen without the original dialog. Gameplay and multiplayer have not been verified.
