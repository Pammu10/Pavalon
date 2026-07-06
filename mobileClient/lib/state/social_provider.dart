import 'package:flutter/foundation.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';

/// Friends, requests, suggestions + live status via social:* socket events.
class SocialProvider extends ChangeNotifier {
  final ApiService api;
  final SocketService socketService;

  List<Friend> friends = [];
  List<FriendRequest> requests = [];
  List<FriendRequest> sentRequests = [];
  List<Friend> suggestions = [];
  bool loading = false;

  SocialProvider({required this.api, required this.socketService}) {
    socketService.on('social:status', (data) {
      final m = Map<String, dynamic>.from(data as Map);
      final userId = (m['userId'] as num).toInt();
      friends = friends
          .map((f) => f.id == userId
              ? f.copyWith(
                  isOnline: m['isOnline'] == true,
                  isInGame: m['isInGame'] == true,
                  gamePhase: m['gamePhase'] as String?)
              : f)
          .toList();
      notifyListeners();
    });
    socketService.on('social:request_received', (_) => refresh());
    socketService.on('social:request_accepted', (_) => refresh());
    socketService.on('social:friend_removed', (_) => refresh());
    socketService.on('social:request_cancelled', (_) => refresh());
  }

  Future<void> refresh() async {
    loading = true;
    notifyListeners();
    try {
      final results = await Future.wait([
        api.getFriends(),
        api.getFriendRequests(),
        api.getSentRequests(),
        api.getSuggestions(),
      ]);
      friends = results[0] as List<Friend>;
      requests = results[1] as List<FriendRequest>;
      sentRequests = results[2] as List<FriendRequest>;
      suggestions = results[3] as List<Friend>;
    } catch (_) {
      // Surfaced by callers when triggered from user actions.
    }
    loading = false;
    notifyListeners();
  }

  Future<String> addFriend(String username) async {
    final msg = await api.addFriend(username);
    await refresh();
    return msg;
  }

  Future<void> respond(int requesterId, String action) async {
    await api.respondToRequest(requesterId, action);
    await refresh();
  }

  Future<void> remove(int friendId) async {
    await api.removeFriend(friendId);
    await refresh();
  }

  Future<void> cancel(int recipientId) async {
    await api.cancelRequest(recipientId);
    await refresh();
  }
}
