# Xbox through Xodus Nexus

Heroic's Linux sidebar includes **Xbox**. Select **Connect Xodus Nexus** to connect to the installed compatibility fork at https://github.com/Nirusaki-Malaal/xodus-nexus (branch `feat/sideloaded-game-compatibility`). The fork must include Heroic bridge support.

The Xbox page shows the fork's installed library, account status, selected runtime and active game. **Add Windows EXE** opens the fork's existing executable importer; imported games appear on this page. **Play**, **Stop game**, and per-game **OnlineFix compatibility** invoke the fork's existing handlers. **Account, Store & Downloads** opens Nexus for Microsoft sign-in, store installation and runtime management. Store-identified games still use Nexus's account and entitlement checks.

This is an integration with Nexus's account and launch stack. Xbox launches use its existing managed Xbox runtime and account service, including sideloading compatibility. They do not use Heroic's ordinary Wine settings or install another runtime. Heroic's Epic/GOG/Amazon and ordinary sideloaded games keep their usual launch flow and their existing OnlineFix option.

The bridge uses `~/.config/xodus-nexus/heroic-bridge.sock`, an owner-only Unix socket. It starts only on explicit connection, accepts a small validated command set, and returns a limited snapshot without authentication tokens. Heroic does not read the Nexus keyring or copy account credentials. No TCP service is opened. Test/development profiles may override `HEROIC_NEXUS_PROFILE` and `HEROIC_NEXUS_LAUNCHER`; a custom launcher must already select that profile and accept `--heroic-bridge`.

The collapse button above the navigation toggles a 68-pixel icons-only sidebar. Its state persists across restarts, links retain accessible labels and hover titles, and the resize handle remains available. The previous expanded width is restored.

## Verification

Backend tests cover bridge request validation, private socket permissions, environment preservation, library projection and errors. The UI test covers collapse/expand and persistence, Xbox connection, installed/sideloaded listings, compatibility changes, launch/stop requests and EXE import through an isolated bridge fixture. The real installed fork was also checked for account, runtime and library connectivity. Real Xbox multiplayer requires a game-specific test.
