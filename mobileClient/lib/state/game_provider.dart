import 'dart:async';
import 'package:flutter/foundation.dart';
import '../models/models.dart';
import '../services/audio_service.dart';
import '../services/haptics.dart';
import '../services/socket_service.dart';

/// One in-app notice (snackbar). `kind` steers color/icon.
class AppNotice {
  final String text;
  final String kind; // info | error | success | achievement | invite
  final GameInvite? invite;
  const AppNotice(this.text, this.kind, {this.invite});
}

class TeamVoteRevealData {
  final List<TeamVote> votes;
  final List<Player> players;
  final bool wasApproved;
  const TeamVoteRevealData(this.votes, this.players, this.wasApproved);
}

enum SuspicionMark { trusted, suspect, evil }

class ActiveEmote {
  final String emote;
  final int key;
  const ActiveEmote(this.emote, this.key);
}

/// Port of the web GameContext: owns the socket, the authoritative
/// GameState mirror, and all client-side presentation state.
class GameProvider extends ChangeNotifier {
  final SocketService socketService;
  final AudioService audio;

  GameState gameState = const GameState();
  String? playerId;
  bool isConnected = false;
  List<ChatMessage> messages = [];

  // Presentation state (per web GameContext)
  bool hasViewedRole = false;
  final Set<String> _viewedKeys = {}; // viewedQuest-<room>-<q>, viewedEndGame-<room>
  TeamVoteRevealData? teamVoteReveal;
  final Map<String, ActiveEmote> activeEmotes = {};
  final Map<String, Timer> _emoteTimers = {};
  final Map<int, SuspicionMark> suspicionMarks = {};
  final List<GameInvite> pendingInvites = [];

  final _notices = StreamController<AppNotice>.broadcast();
  Stream<AppNotice> get notices => _notices.stream;

  GamePhase _prevPhase = GamePhase.home;

  GameProvider({required this.socketService, required this.audio}) {
    _bindSocket();
  }

  // ---------------- Socket lifecycle ----------------

  void connect(String token) {
    socketService.connect(token);
  }

  void disconnectSocket() {
    socketService.disconnect();
    isConnected = false;
    notifyListeners();
  }

  void _bindSocket() {
    socketService.on('connect', (_) {
      playerId = socketService.id;
      isConnected = true;
      notifyListeners();
    });
    socketService.on('disconnect', (_) {
      isConnected = false;
      notifyListeners();
    });
    socketService.on('updateGameState', (data) {
      _handleUpdate(GameState.fromJson(
          Map<String, dynamic>.from(data as Map)));
    });
    socketService.on('chatMessage', (data) {
      messages = [
        ...messages,
        ChatMessage.fromJson(Map<String, dynamic>.from(data as Map))
      ];
      notifyListeners();
    });
    socketService.on('emote', (data) {
      final m = Map<String, dynamic>.from(data as Map);
      _showEmote(m['playerId'] as String, m['emote'] as String);
    });
    socketService.on('error', (data) {
      audio.play(Sfx.error);
      _notices.add(AppNotice(data.toString(), 'error'));
    });
    socketService.on('achievementUnlocked', (data) {
      final m = Map<String, dynamic>.from(data as Map);
      audio.play(Sfx.success);
      _notices.add(AppNotice(
          'Achievement Unlocked: ${m['name']}', 'achievement'));
    });
    socketService.on('kicked', (data) {
      final reason = data.toString();
      _notices.add(AppNotice(
          reason, reason.startsWith('You have left') ? 'info' : 'error'));
      _resetToHome();
    });
    socketService.on('social:invite_received', (data) {
      final invite =
          GameInvite.fromJson(Map<String, dynamic>.from(data as Map));
      pendingInvites.add(invite);
      audio.play(Sfx.transition);
      _notices.add(AppNotice(
          'Game invite from ${invite.fromUsername}', 'invite',
          invite: invite));
      notifyListeners();
    });
  }

  void _resetToHome() {
    gameState = const GameState();
    messages = [];
    hasViewedRole = false;
    teamVoteReveal = null;
    suspicionMarks.clear();
    notifyListeners();
  }

  // ---------------- State update (port of handleUpdate) ----------------

  void _handleUpdate(GameState next) {
    final prev = gameState;

    final isNewGameStarting =
        (prev.phase == GamePhase.endGame && next.phase == GamePhase.lobby) ||
            (prev.phase == GamePhase.lobby && next.phase == GamePhase.roleReveal);
    if (isNewGameStarting) {
      hasViewedRole = false;
      _viewedKeys.removeWhere((k) => k.contains(prev.roomCode ?? '@'));
    }

    if (next.phase == GamePhase.roleReveal && prev.phase != GamePhase.roleReveal) {
      suspicionMarks.clear();
    }
    if (next.roomCode != prev.roomCode) {
      suspicionMarks.clear();
    }

    // Team-vote reveal: built from the server's post-vote records on the
    // transition away from TEAM_VOTE (votes are redacted mid-phase).
    if (_prevPhase == GamePhase.teamVote &&
        (next.phase == GamePhase.questVote ||
            next.phase == GamePhase.teamSelection)) {
      final quest = next.activeQuest;
      final wasApproved = next.phase == GamePhase.questVote;
      final List<TeamVote> votes = wasApproved
          ? (quest?.approvedVote?.votes ?? const [])
          : (quest != null && quest.pastVotes.isNotEmpty
              ? quest.pastVotes.last.votes
              : const []);
      if (votes.isNotEmpty) {
        teamVoteReveal = TeamVoteRevealData(votes, next.players, wasApproved);
      }
    }
    // Quest-result / end-game presentations own the screen: drop the reveal.
    if (next.phase == GamePhase.questResult ||
        next.phase == GamePhase.endGame ||
        next.phase == GamePhase.lobby ||
        next.phase == GamePhase.roleReveal) {
      teamVoteReveal = null;
    }
    _prevPhase = next.phase;

    gameState = next;
    messages = next.chat;
    _updateMusic(next.phase);
    notifyListeners();
  }

  void _updateMusic(GamePhase phase) {
    switch (phase) {
      case GamePhase.roleReveal:
      case GamePhase.teamSelection:
      case GamePhase.teamVote:
      case GamePhase.questVote:
      case GamePhase.questResult:
      case GamePhase.assassination:
      case GamePhase.dragonsBreath:
        audio.playInGameMusic();
      case GamePhase.home:
      case GamePhase.lobby:
        audio.playLobbyMusic();
      case GamePhase.endGame:
        break; // end-game screen sequences its own audio
    }
  }

  // ---------------- Derived flags ----------------

  Player? get me =>
      gameState.players.where((p) => p.id == playerId).firstOrNull;

  bool get hasViewedCurrentQuestResult => _viewedKeys
      .contains('viewedQuest-${gameState.roomCode}-${gameState.currentQuest}');

  bool get hasViewedEndGameResult =>
      _viewedKeys.contains('viewedEndGame-${gameState.roomCode}');

  void markQuestResultAsViewed() {
    if (gameState.roomCode != null &&
        gameState.phase == GamePhase.questResult) {
      _viewedKeys
          .add('viewedQuest-${gameState.roomCode}-${gameState.currentQuest}');
      notifyListeners();
    }
  }

  void markEndGameAsViewed() {
    if (gameState.roomCode != null && gameState.phase == GamePhase.endGame) {
      _viewedKeys.add('viewedEndGame-${gameState.roomCode}');
      notifyListeners();
    }
  }

  void setHasViewedRole() {
    hasViewedRole = true;
    notifyListeners();
  }

  void clearTeamVoteReveal() {
    teamVoteReveal = null;
    notifyListeners();
  }

  // ---------------- Emotes & deduction notes ----------------

  void _showEmote(String senderId, String emote) {
    activeEmotes[senderId] =
        ActiveEmote(emote, DateTime.now().millisecondsSinceEpoch);
    _emoteTimers[senderId]?.cancel();
    _emoteTimers[senderId] = Timer(const Duration(seconds: 3), () {
      activeEmotes.remove(senderId);
      _emoteTimers.remove(senderId);
      notifyListeners();
    });
    notifyListeners();
  }

  void cycleSuspicionMark(int userId) {
    const order = [null, SuspicionMark.trusted, SuspicionMark.suspect, SuspicionMark.evil];
    final current = suspicionMarks[userId];
    final next = order[(order.indexOf(current) + 1) % order.length];
    if (next == null) {
      suspicionMarks.remove(userId);
    } else {
      suspicionMarks[userId] = next;
    }
    Haptics.tap();
    notifyListeners();
  }

  // ---------------- Emits (1:1 with ClientToServerEvents) ----------------

  void joinRoom([String? roomCode]) {
    socketService.emit('joinRoom', {'roomCode': roomCode});
    pendingInvites.clear();
  }

  void leaveRoom() => socketService.emit('leaveRoom');
  void startGame(List<Role> selectedRoles) => socketService.emit(
      'startGame', {'selectedRoles': selectedRoles.map((r) => r.wire).toList()});
  void updateSelectedRoles(List<Role> roles) => socketService.emit(
      'updateSelectedRoles', roles.map((r) => r.wire).toList());
  void kickPlayer(String playerIdToKick) =>
      socketService.emit('kickPlayer', playerIdToKick);
  void addBot(String difficulty) => socketService.emit('addBot', difficulty);
  void startCpuGame(String difficulty, int playerCount) => socketService.emit(
      'startCPUGame', {'difficulty': difficulty, 'playerCount': playerCount});
  void selectTeam(List<String> ids) => socketService.emit('selectTeam', ids);
  void updatePendingTeam(List<String> ids) =>
      socketService.emit('updatePendingTeam', ids);
  void voteOnTeam(String vote) => socketService.emit('voteOnTeam', vote);
  void voteOnQuest(String vote) => socketService.emit('voteOnQuest', vote);
  void updateAssassinationTarget(String? targetId) =>
      socketService.emit('updateAssassinationTarget', targetId);
  void assassinate(String targetId) =>
      socketService.emit('assassinate', targetId);
  void playerReady() => socketService.emit('playerReady');
  void playerReadyForNextGame() =>
      socketService.emit('playerReadyForNextGame');
  void initiateRestart() => socketService.emit('initiateRestart');
  void voteOnRestart(String vote) => socketService.emit('voteOnRestart', vote);
  void sendMessage(String text) => socketService.emit('sendMessage', text);
  void sendEmote(String emote) => socketService.emit('sendEmote', emote);
  void advanceTutorial() => socketService.emit('advanceTutorial');
  void inviteFriendToGame(int friendId) =>
      socketService.emit('social:invite_to_game', {'friendId': friendId});

  // Dragon's Breath
  void startDragonsBreath() => socketService.emit('startDragonsBreath');
  void drawCard() => socketService.emit('drawCard');
  void playCard(String cardId) => socketService.emit('playCard', cardId);
  void placeDragonCard(int index) =>
      socketService.emit('placeDragonCard', index);
  void endFutureView() => socketService.emit('endFutureView');
  void returnToLobby() => socketService.emit('returnToLobby');

  void acceptInvite(String roomCode) {
    const nonSwitchable = [
      GamePhase.roleReveal,
      GamePhase.teamSelection,
      GamePhase.teamVote,
      GamePhase.questVote,
      GamePhase.questResult,
      GamePhase.assassination,
    ];
    if (gameState.roomCode != null && nonSwitchable.contains(gameState.phase)) {
      _notices.add(const AppNotice(
          'You cannot accept an invite while in an active game.', 'error'));
      return;
    }
    joinRoom(roomCode);
  }

  void declineInvite(String roomCode) {
    pendingInvites.removeWhere((i) => i.roomCode == roomCode);
    notifyListeners();
  }

  void notify(String text, {String kind = 'info'}) =>
      _notices.add(AppNotice(text, kind));

  @override
  void dispose() {
    _notices.close();
    for (final t in _emoteTimers.values) {
      t.cancel();
    }
    super.dispose();
  }
}

extension FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
