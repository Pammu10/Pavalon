/// Build-time configuration.
///
/// Override the server at build/run time:
///   flutter run --dart-define=SERVER_URL=http://192.168.1.10:3001
/// The default targets the Android emulator's host loopback.
class AppConfig {
  static const serverUrl = String.fromEnvironment(
    'SERVER_URL',
    defaultValue: 'http://10.0.2.2:3001',
  );

  static const apiBase = '$serverUrl/api';
}
