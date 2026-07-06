# Pavalon Mobile (Flutter)

Native mobile client for Pavalon — feature parity with the web client
against the same game server (no server changes needed): auth, lobbies
(including host-added CPU players), the full Pavalon game flow with the
web's dramatic reveal overlays, the interactive tutorial, Dragon's Breath,
social hub, achievements + profile customization, leaderboards, settings
and the admin panel.

Mobile-specific touches:

- **Haptics** on every meaningful action (toggle in Settings).
- **Swipe-orb voting** (same gesture as the web's swipeable card).
- **Gyroscope parallax** on the home crest and your role portrait.
- **Shake to emote** mid-game.
- **Share sheet** for room invites.

## Running against a server

The server URL is a compile-time define. Defaults to `http://10.0.2.2:3001`
(Android emulator → host machine).

```bash
# Emulator against a locally running server
flutter run

# Physical device on your LAN
flutter run --dart-define=SERVER_URL=http://192.168.1.23:3001

# Production
flutter build apk --release --dart-define=SERVER_URL=https://your-server.example
```

`usesCleartextTraffic` is enabled so plain-HTTP dev servers work; HTTPS
production servers work unchanged. Consider disabling cleartext for a
store release.

## Android release

```bash
flutter build apk --release --dart-define=SERVER_URL=https://your-server.example
# → build/app/outputs/flutter-apk/app-release.apk
```

The APK is signed with the debug key by default. For Play Store uploads,
create an upload keystore and a `android/key.properties` per the standard
Flutter docs, then `flutter build appbundle`.

## iOS

The codebase is platform-clean (all plugins support iOS). Building
requires macOS + Xcode:

```bash
cd mobileClient
flutter build ipa --dart-define=SERVER_URL=https://your-server.example
```

First run on a Mac: open `ios/Runner.xcworkspace`, set your signing team,
and accept the generated bundle id (`com.pavalon.pavalonMobile`) or change
it. No additional native setup is needed (audio, sensors, share and
haptics are all standard plugins).

## Not in v1 (deliberate)

- **Voice chat** — the server's WebRTC signaling relay is untouched, so a
  `flutter_webrtc` integration can slot straight in, but shipping native
  voice untested on real devices would not be production-quality.
- **Google Sign-In** — requires the project owner's OAuth client IDs +
  SHA-1 fingerprints. The server endpoint (`POST /api/auth/google`)
  already exists; add the `google_sign_in` plugin and post its access
  token there when configured. Username/password auth is fully wired.

## Tests

`flutter test` covers the ported game math (lobby role validation, quest
tables, wire-format parsing) so drift against the server gets caught.
