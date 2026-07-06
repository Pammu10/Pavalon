import 'package:flutter/foundation.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../services/session_store.dart';

enum AuthStatus { loading, signedOut, signedIn }

/// Session lifecycle: token persistence, startup verification (with the
/// web's offline-grace behaviour), login/register/logout.
class AuthProvider extends ChangeNotifier {
  final ApiService api;
  final SessionStore store;

  AuthStatus status = AuthStatus.loading;
  User? user;
  String? get token => store.token;

  AuthProvider({required this.api, required this.store});

  Future<void> init() async {
    final saved = store.token;
    if (saved == null) {
      status = AuthStatus.signedOut;
      notifyListeners();
      return;
    }
    api.setToken(saved);
    try {
      user = await api.verifyToken();
      await store.saveSession(saved, user!);
      status = AuthStatus.signedIn;
    } on ApiException {
      // Server rejected the token — hard sign-out.
      await store.clearSession();
      api.setToken(null);
      status = AuthStatus.signedOut;
    } catch (_) {
      // Network error: keep the cached session (web parity).
      user = store.user;
      status = user != null ? AuthStatus.signedIn : AuthStatus.signedOut;
    }
    notifyListeners();
  }

  Future<void> login(String username, String password) async {
    final r = await api.login(username, password);
    await _applySession(r.token, r.user);
  }

  Future<void> register(String username, String password) async {
    final r = await api.register(username, password);
    await _applySession(r.token, r.user);
  }

  Future<void> _applySession(String token, User u) async {
    api.setToken(token);
    await store.saveSession(token, u);
    user = u;
    status = AuthStatus.signedIn;
    notifyListeners();
  }

  Future<void> changeUsername(String username) async {
    final r = await api.changeUsername(username);
    await _applySession(r.token, r.user);
  }

  void updateUserLocal(User u) {
    user = u;
    final t = store.token;
    if (t != null) store.saveSession(t, u);
    notifyListeners();
  }

  Future<void> logout() async {
    await store.clearSession();
    api.setToken(null);
    user = null;
    status = AuthStatus.signedOut;
    notifyListeners();
  }
}
