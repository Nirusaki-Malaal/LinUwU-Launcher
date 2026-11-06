# Xbox integration in Heroic

Xbox services are migrated from the user's xodus-nexus fork into Heroic's main process. The original MIT license, source commit and attribution are preserved in `src/integrations/xbox/`. Heroic owns application startup, navigation, tray, updates, styling and dialogs. There is no separate Nexus launcher process, bridge connection or Connect toggle.

| Feature                                                                       | Heroic location                                    |
| ----------------------------------------------------------------------------- | -------------------------------------------------- |
| Installed, owned and Game Pass games, folder/EXE import                       | Library → Xbox & Microsoft Store                   |
| Catalog, search, entitlement checks, package selection                        | Stores → Xbox & Microsoft Store                    |
| Microsoft sign-in, system wallet and offline-PC permissions                   | Stores Login → Xbox / Microsoft account            |
| Xbox-compatible Wine install, update, upstream snapshot and selection         | Wine Manager → Xbox-compatible Wine                |
| Xbox service backend, runtime status and location                             | Settings → Runtimes                                |
| Installations, updates, additional content, pause/resume/cancel and bandwidth | Downloads → Xbox downloads                         |
| Guide shortcut and overlay settings                                           | Settings → Game Defaults → Other → Xbox Game Bar   |
| Game folder, market                                                           | Settings → General → Xbox library folders          |
| Backend source builds, cache limit and diagnostics                            | Settings → Advanced                                |
| Friends, chat, profiles, parties, voice and invitations                       | Xbox friends & parties; Xbox account notifications |
| Launch options, language, controller compatibility, Gamescope, MangoHud       | Xbox game → Details & settings → Settings          |
| Achievements, activity, screenshots, DLC, Visual C++, updates and shortcuts   | Xbox game → Details & settings                     |

The existing Nexus metadata is imported once into Heroic's private Xbox profile. Subsequent Heroic changes are not overwritten. Installed games, Wine/runtime directories and validated backend binaries are reused at their existing locations. Credentials continue to use the existing system wallet; no tokens are copied into renderer data. New installations default to Heroic's Xbox tools directory. Heroic's Wine selector discovers the selected Xbox Wine executable without downloading another Proton copy.

IPC channels are namespaced. Native chat and party-media windows retain sender/frame validation and dedicated preloads. Sign-in uses its isolated session and authentication preload. Heroic shortcuts launch the integrated Xbox service directly. Nexus self-updating, its second application window, sidebar, tray and single-instance lock are not imported into Heroic's lifecycle.

Verification covers metadata migration, private permissions, existing Wine discovery, TypeScript/build checks, and UI navigation across Heroic Library, Runtime settings, Wine Manager, Login, Downloads and Xbox social. Live game downloads, multiplayer, cloud-save synchronization and voice require account/game-specific end-to-end verification.
