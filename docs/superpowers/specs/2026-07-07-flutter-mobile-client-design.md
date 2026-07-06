# Design: Pavalon Flutter mobile client (`mobileClient/`)

Date: 2026-07-07
Mode: autonomous run — decisions recorded with rationale.

## Goal

A production-grade Flutter app mirroring the web client feature-for-feature against the existing server (no server changes): auth, home (host/join/CPU/tutorial), lobby (players, kick, add-CPU, role customization, invite share, Dragon's Breath entry), full Pavalon game flow with the web's dramatic overlays, interactive tutorial, Dragon's Breath card game, social, achievements + profile customization, leaderboards, settings, admin panel, audio/haptics/sensors. Android is the verified build target (release APK built here); iOS ships as buildable config + code (no Xcode on this machine — see Verification).

## Stack (decisions)

- **Flutter stable (3.44) / Dart 3**, package id `com.pavalon.app`.
- **State: `provider`** with a `GameProvider` that is a 1:1 port of the web `GameContext` (same socket handlers, same derived flags like `hasViewedCurrentQuestResult`, reveal construction from `approvedVote`/`pastVotes`). Rationale: the web context is the proven reference; a direct port minimizes behavioral drift.
- **Navigation: phase-driven root switcher**, not a router. The web app renders screens off `gameState.phase`; the mobile shell does the same (`Auth → Home → GameShell[phase]`). Deep links are out of scope for v1 (invites navigate in-app).
- **Networking:** `socket_io_client` (server is socket.io v4; native clients send no Origin so CORS passes), `http` for REST, JWT in `shared_preferences`.
- **Audio:** `audioplayers` — looping BGM (lobby/game) with ducking during stings, SFX pool for the same mp3 set as web.
- **Haptics:** Flutter `HapticFeedback` mapped to the web's `haptics.ts` vocabulary (tap/confirm/success/failure/dramatic), user-toggleable.
- **Sensors (`sensors_plus`):** gyroscope parallax on the role-reveal card and menu background; accelerometer shake opens the emote wheel mid-game. Tasteful, off the critical path.
- **Fonts:** bundle Eagle Lake (OFL) to match the web's display font; system fallback if download fails at build-prep time.
- **Assets:** copied from `client/public` (characters, backgrounds, cards, audio) and downscaled with Pillow (max 1024px, PNG→ JPEG where alpha-free) to keep the APK reasonable.
- **Icons:** `lucide_icons` package mirrors the web's lucide icon names for profile icons; falls back to Material glyphs if a name is missing.

## Feature parity map (web → mobile)

| Web | Mobile |
|---|---|
| AuthScreen (login/register) | AuthScreen; Google Sign-In **deferred** (needs the owner's SHA-1/OAuth client config — documented; server endpoint already exists) |
| Home: host/join/CPU modal/How to Play | HomeScreen + CpuSetupSheet + tutorial prompt dialog (new/60-day returning, same storage keys semantics) |
| Lobby: players, kick, add-CPU, role toggles, validation, share invite, Dragon's Breath (2p) | LobbyScreen (share via `share_plus`), identical validation logic ported |
| RoleReveal + vision | RoleRevealScreen with gyro parallax + reveal audio |
| Team selection / team vote / quest vote (swipe) / reveal overlays / assassination | GameScreen phase widgets; swipe-orb vote control; card-flip reveal overlays; assassination grid |
| Quest progress + details, vote-track warnings, leader/host badges | QuestProgressBar + details sheet; same thresholds |
| Deduction notes (private marks) | long-press a player tile cycles trusted/suspect/evil |
| Emotes + quick chat + chat + game log | EmoteWheel (also shake-to-open), ChatPanel with log tab, floating bubbles |
| Turn alerts (banner/haptic/title) | In-app banner + haptic on rising edge |
| Restart vote, reconnection banner, kicked handling | Same overlays/banners; socket auto-reconnect + server session resume |
| End game: overlay, final roles, report, play-again | EndGameScreen (particles, sting, timeline report) |
| Tutorial (server-driven 7 steps) | TutorialOverlay: dim + highlight of target widgets via GlobalKeys, bottom-sheet steps |
| Dragon's Breath (2p card game) | Full screen: fanned hand, deck/discard, draw/play, defuse placement, see-the-future, win/lose overlay |
| Social hub (friends/requests/invites/status) | SocialScreen + invite snackbars that join rooms |
| Achievements + customization (title/border/icon/background) | AchievementsScreen with live PlayerTile preview; REST save |
| Leaderboards (Pavalon + DB) | LeaderboardScreen with board tabs |
| Settings (BGM, replay tutorial, username change, link account) | SettingsScreen (+ haptics toggle; Google link deferred with auth) |
| Admin panel | AdminScreen (rooms list, force close, remove user) for `is_admin` |
| Voice chat (WebRTC) | **Deferred for v1** — native WebRTC needs device-level testing this environment can't do; the socket relay is untouched so `flutter_webrtc` can slot in behind the existing signaling events later. Documented in README. |

## Architecture

```
mobileClient/
  lib/
    core/        config (server URL), theme, constants (ports of client/constants.ts)
    models/      game_state.dart, player.dart, quest.dart, dragons_breath.dart, social.dart, achievements.dart ...
    services/    api_service.dart (REST), socket_service.dart, audio_service.dart,
                 haptics.dart, sensors_service.dart, session_store.dart
    state/       auth_provider.dart, game_provider.dart, social_provider.dart
    screens/     auth, home, lobby, role_reveal, game, end_game, dragons_breath,
                 social, achievements, leaderboard, settings, admin
    widgets/     player_tile, swipe_vote_card, overlays (team_vote_reveal, quest_result,
                 game_end, restart_vote, tutorial), quest_progress, chat_panel, emote_wheel ...
  assets/       audio/, characters/, background/, cards/, fonts/
  test/         model + logic tests (role validation, reveal construction, difficulty maps)
```

Data flow: `SocketService` (typed emit/on) → `GameProvider` mutates → `Consumer` widgets rebuild; overlays are driven by provider flags exactly like the web (`teamVoteReveal`, viewed-markers per room/quest kept in memory per session). REST goes through `ApiService` with the JWT header; 401s log out.

Server URL is a build-time `--dart-define=SERVER_URL` (default `http://10.0.2.2:3001` for the Android emulator; Android cleartext HTTP enabled for dev, HTTPS domains work as-is in prod).

## Error handling

Socket `error` events → snackbars (same copy as web toasts). Connection loss → status banner + auto-reconnect (socket.io backoff); app resume forces a reconnect check. REST failures surface message text from the server payload.

## Testing / verification

- `flutter analyze` clean; `flutter test` for ported pure logic (lobby role validation, quest configs, reveal building, emote allow-list sync).
- `flutter build apk --release` is the Android production gate (built and reported here).
- iOS: code kept platform-clean (no Android-only plugins without iOS support); `flutter build ipa` must run on macOS — exact steps in `mobileClient/README.md`.
- Live smoke: `flutter run -d web-server` build driven against the local game server to exercise socket flows end-to-end (join, lobby, add bot, start, vote) where feasible in this environment.
