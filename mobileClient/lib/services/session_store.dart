import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/models.dart';

/// Persistence for token, cached user, settings, and tutorial markers —
/// the mobile equivalent of the web's localStorage keys.
class SessionStore {
  static const _kToken = 'authToken';
  static const _kUser = 'user';
  static const _kBgmMuted = 'bgmMuted';
  static const _kHaptics = 'hapticsEnabled';
  static const _kTutorialSeenAt = 'pavalon_tutorial_seen_at';

  final SharedPreferences _prefs;
  SessionStore(this._prefs);

  static Future<SessionStore> load() async =>
      SessionStore(await SharedPreferences.getInstance());

  String? get token => _prefs.getString(_kToken);
  User? get user {
    final raw = _prefs.getString(_kUser);
    if (raw == null) return null;
    try {
      return User.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<void> saveSession(String token, User user) async {
    await _prefs.setString(_kToken, token);
    await _prefs.setString(_kUser, jsonEncode(user.toJson()));
  }

  Future<void> clearSession() async {
    await _prefs.remove(_kToken);
    await _prefs.remove(_kUser);
  }

  bool get bgmMuted => _prefs.getBool(_kBgmMuted) ?? false;
  Future<void> setBgmMuted(bool v) => _prefs.setBool(_kBgmMuted, v);

  bool get hapticsEnabled => _prefs.getBool(_kHaptics) ?? true;
  Future<void> setHapticsEnabled(bool v) => _prefs.setBool(_kHaptics, v);

  int? get tutorialSeenAt => _prefs.getInt(_kTutorialSeenAt);
  Future<void> markTutorialSeen() =>
      _prefs.setInt(_kTutorialSeenAt, DateTime.now().millisecondsSinceEpoch);
  Future<void> clearTutorialSeen() => _prefs.remove(_kTutorialSeenAt);
}
