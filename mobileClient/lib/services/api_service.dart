import 'dart:convert';
import 'package:http/http.dart' as http;
import '../core/config.dart';
import '../models/models.dart';

class ApiException implements Exception {
  final int status;
  final String message;
  ApiException(this.status, this.message);
  @override
  String toString() => message;
}

/// REST client for the game server (mirrors client/services/api.ts usage).
class ApiService {
  String? _token;
  void setToken(String? token) => _token = token;

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };

  Future<dynamic> _send(String method, String path, [Object? body]) async {
    final uri = Uri.parse('${AppConfig.apiBase}$path');
    late http.Response res;
    final encoded = body == null ? null : jsonEncode(body);
    switch (method) {
      case 'GET':
        res = await http.get(uri, headers: _headers);
      case 'POST':
        res = await http.post(uri, headers: _headers, body: encoded);
      case 'PUT':
        res = await http.put(uri, headers: _headers, body: encoded);
      case 'DELETE':
        res = await http.delete(uri, headers: _headers);
      default:
        throw ArgumentError(method);
    }
    final decoded = res.body.isEmpty ? null : jsonDecode(res.body);
    if (res.statusCode >= 400) {
      final msg = decoded is Map && decoded['message'] is String
          ? decoded['message'] as String
          : 'Request failed (${res.statusCode})';
      throw ApiException(res.statusCode, msg);
    }
    return decoded;
  }

  // --- Auth ---
  Future<({String token, User user})> login(
      String username, String password) async {
    final d = await _send('POST', '/login',
        {'username': username, 'password': password}) as Map<String, dynamic>;
    return (
      token: d['token'] as String,
      user: User.fromJson(d['user'] as Map<String, dynamic>)
    );
  }

  Future<({String token, User user})> register(
      String username, String password) async {
    final d = await _send('POST', '/register',
        {'username': username, 'password': password}) as Map<String, dynamic>;
    return (
      token: d['token'] as String,
      user: User.fromJson(d['user'] as Map<String, dynamic>)
    );
  }

  Future<({String token, User user, bool isNewUser})> googleAuth(
      String accessToken) async {
    final d = await _send('POST', '/auth/google', {'accessToken': accessToken})
        as Map<String, dynamic>;
    return (
      token: d['token'] as String,
      user: User.fromJson(d['user'] as Map<String, dynamic>),
      isNewUser: d['isNewUser'] == true,
    );
  }

  Future<void> linkGoogle(String accessToken) =>
      _send('POST', '/user/link-google', {'accessToken': accessToken});

  Future<User> verifyToken() async {
    final d = await _send('GET', '/verify-token') as Map<String, dynamic>;
    return User.fromJson(d['user'] as Map<String, dynamic>);
  }

  Future<({String token, User user})> changeUsername(String username) async {
    final d = await _send('POST', '/user/username', {'username': username})
        as Map<String, dynamic>;
    return (
      token: d['token'] as String,
      user: User.fromJson(d['user'] as Map<String, dynamic>)
    );
  }

  // --- Profile / stats ---
  Future<PlayerStats> getStats() async =>
      PlayerStats.fromJson(await _send('GET', '/stats') as Map<String, dynamic>);

  Future<Map<String, dynamic>> getDragonsBreathStats() async =>
      (await _send('GET', '/stats/dragons-breath')) as Map<String, dynamic>;

  Future<List<Achievement>> getAchievements() async =>
      ((await _send('GET', '/achievements')) as List)
          .map((e) => Achievement.fromJson(e as Map<String, dynamic>))
          .toList();

  Future<void> customize({
    String? title,
    String? border,
    String? icon,
    String? background,
  }) =>
      _send('POST', '/user/customize', {
        'title': title,
        'border': border,
        'icon': icon,
        'background': background,
      });

  // --- Leaderboards ---
  Future<Map<String, List<LeaderboardEntry>>> getLeaderboard() async {
    final d = await _send('GET', '/leaderboard') as Map<String, dynamic>;
    return d.map((k, v) => MapEntry(
        k,
        (v as List)
            .map((e) => LeaderboardEntry.fromJson(e as Map<String, dynamic>))
            .toList()));
  }

  Future<Map<String, List<LeaderboardEntry>>> getDragonsBreathLeaderboard() async {
    final d =
        await _send('GET', '/leaderboard/dragons-breath') as Map<String, dynamic>;
    return d.map((k, v) => MapEntry(
        k,
        (v as List)
            .map((e) => LeaderboardEntry.fromJson(e as Map<String, dynamic>))
            .toList()));
  }

  // --- Social ---
  Future<List<Friend>> getFriends() async =>
      ((await _send('GET', '/social/friends')) as List)
          .map((e) => Friend.fromJson(e as Map<String, dynamic>))
          .toList();

  Future<List<FriendRequest>> getFriendRequests() async =>
      ((await _send('GET', '/social/requests')) as List)
          .map((e) => FriendRequest.fromJson(e as Map<String, dynamic>))
          .toList();

  Future<List<FriendRequest>> getSentRequests() async =>
      ((await _send('GET', '/social/requests/sent')) as List)
          .map((e) => FriendRequest.fromJson(e as Map<String, dynamic>))
          .toList();

  Future<List<Friend>> getSuggestions() async =>
      ((await _send('GET', '/social/suggestions')) as List)
          .map((e) => Friend.fromJson(e as Map<String, dynamic>))
          .toList();

  Future<String> addFriend(String username) async {
    final d = await _send('POST', '/social/add', {'username': username})
        as Map<String, dynamic>;
    return (d['message'] as String?) ?? 'Friend request sent.';
  }

  Future<void> respondToRequest(int requesterId, String action) =>
      _send('POST', '/social/respond',
          {'requesterId': requesterId, 'action': action});

  Future<void> removeFriend(int friendId) =>
      _send('DELETE', '/social/remove/$friendId');

  Future<void> cancelRequest(int recipientId) =>
      _send('DELETE', '/social/request/cancel/$recipientId');

  // --- Voice ---
  Future<({String url, String token})> voiceToken(String roomCode) async {
    final d = await _send('GET', '/voice/token?roomCode=${Uri.encodeQueryComponent(roomCode)}')
        as Map<String, dynamic>;
    return (url: d['url'] as String, token: d['token'] as String);
  }

  // --- Admin ---
  Future<List<Map<String, dynamic>>> adminRooms() async =>
      ((await _send('GET', '/admin/rooms')) as List)
          .map((e) => e as Map<String, dynamic>)
          .toList();

  Future<void> adminCloseRoom(String roomCode) =>
      _send('DELETE', '/admin/rooms/$roomCode');

  Future<List<Map<String, dynamic>>> adminUsers() async =>
      ((await _send('GET', '/admin/users')) as List)
          .map((e) => e as Map<String, dynamic>)
          .toList();

  Future<void> adminDeleteUser(int id) => _send('DELETE', '/admin/users/$id');
}
