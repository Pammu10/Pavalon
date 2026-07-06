/// Dart mirror of the server/client shared types (types.ts).
/// All wire formats match the socket.io/REST payloads exactly.
library;

enum Role {
  merlin('Merlin'),
  percival('Percival'),
  loyalServant('Loyal Servant of Arthur'),
  morgana('Morgana'),
  assassin('Assassin'),
  mordred('Mordred'),
  oberon('Oberon'),
  minion('Minion of Mordred');

  final String wire;
  const Role(this.wire);

  static Role? from(String? v) {
    if (v == null) return null;
    for (final r in Role.values) {
      if (r.wire == v) return r;
    }
    return null;
  }

  String get shortName => switch (this) {
        Role.loyalServant => 'Loyal Servant',
        Role.minion => 'Minion',
        _ => wire,
      };
}

/// 'Alignment2' avoids clashing with Flutter's layout Alignment.
enum Alignment2 {
  good('Good'),
  evil('Evil');

  final String wire;
  const Alignment2(this.wire);

  static Alignment2? from(String? v) {
    if (v == null) return null;
    for (final a in Alignment2.values) {
      if (a.wire == v) return a;
    }
    return null;
  }
}

enum GamePhase {
  home('HOME'),
  lobby('LOBBY'),
  roleReveal('ROLE_REVEAL'),
  teamSelection('TEAM_SELECTION'),
  teamVote('TEAM_VOTE'),
  questVote('QUEST_VOTE'),
  questResult('QUEST_RESULT'),
  assassination('ASSASSINATION'),
  endGame('END_GAME'),
  dragonsBreath('DRAGONS_BREATH');

  final String wire;
  const GamePhase(this.wire);

  static GamePhase from(String? v) =>
      GamePhase.values.firstWhere((p) => p.wire == v,
          orElse: () => GamePhase.home);
}

class Player {
  final String id;
  final int userId;
  final String name;
  final Role? role;
  final Alignment2? alignment;
  final bool isHost;
  final bool hasVoted;
  final String status; // CONNECTED | DISCONNECTED
  final String? selectedTitle;
  final String? selectedBorder;
  final String? selectedIcon;
  final String? selectedBackground;
  final String? visibleAs; // 'Evil' | 'Mystic' (server-computed, per viewer)

  const Player({
    required this.id,
    required this.userId,
    required this.name,
    this.role,
    this.alignment,
    this.isHost = false,
    this.hasVoted = false,
    this.status = 'CONNECTED',
    this.selectedTitle,
    this.selectedBorder,
    this.selectedIcon,
    this.selectedBackground,
    this.visibleAs,
  });

  bool get isBot => userId < 0;
  bool get isDisconnected => status == 'DISCONNECTED';

  factory Player.fromJson(Map<String, dynamic> j) => Player(
        id: j['id'] as String,
        userId: (j['userId'] as num).toInt(),
        name: j['name'] as String,
        role: Role.from(j['role'] as String?),
        alignment: Alignment2.from(j['alignment'] as String?),
        isHost: j['isHost'] == true,
        hasVoted: j['hasVoted'] == true,
        status: (j['status'] as String?) ?? 'CONNECTED',
        selectedTitle: j['selectedTitle'] as String?,
        selectedBorder: j['selectedBorder'] as String?,
        selectedIcon: j['selectedIcon'] as String?,
        selectedBackground: j['selectedBackground'] as String?,
        visibleAs: j['visibleAs'] as String?,
      );
}

class TeamVote {
  final String playerId;
  final String vote; // APPROVE | REJECT
  const TeamVote(this.playerId, this.vote);
  factory TeamVote.fromJson(Map<String, dynamic> j) =>
      TeamVote(j['playerId'] as String? ?? '', j['vote'] as String);
}

class QuestResultVote {
  final String playerId; // anonymized ('') by the server once cast
  final String vote; // SUCCESS | FAIL
  const QuestResultVote(this.playerId, this.vote);
  factory QuestResultVote.fromJson(Map<String, dynamic> j) =>
      QuestResultVote(j['playerId'] as String? ?? '', j['vote'] as String);
}

class PastVote {
  final Player? leader;
  final List<Player> team;
  final List<TeamVote> votes;
  const PastVote(this.leader, this.team, this.votes);
  factory PastVote.fromJson(Map<String, dynamic> j) => PastVote(
        j['leader'] == null
            ? null
            : Player.fromJson(j['leader'] as Map<String, dynamic>),
        ((j['team'] as List?) ?? [])
            .map((e) => Player.fromJson(e as Map<String, dynamic>))
            .toList(),
        ((j['votes'] as List?) ?? [])
            .map((e) => TeamVote.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class ApprovedVote {
  final List<Player> team;
  final List<TeamVote> votes;
  const ApprovedVote(this.team, this.votes);
  factory ApprovedVote.fromJson(Map<String, dynamic> j) => ApprovedVote(
        ((j['team'] as List?) ?? [])
            .map((e) => Player.fromJson(e as Map<String, dynamic>))
            .toList(),
        ((j['votes'] as List?) ?? [])
            .map((e) => TeamVote.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class Quest {
  final int questNumber;
  final int teamSize;
  final String status; // PENDING | ACTIVE | PASSED | FAILED
  final List<Player> team;
  final List<TeamVote> votes;
  final List<QuestResultVote> results;
  final int failsRequired;
  final Player? questLeader;
  final List<PastVote> pastVotes;
  final ApprovedVote? approvedVote;

  const Quest({
    required this.questNumber,
    required this.teamSize,
    required this.status,
    required this.team,
    required this.votes,
    required this.results,
    required this.failsRequired,
    this.questLeader,
    required this.pastVotes,
    this.approvedVote,
  });

  factory Quest.fromJson(Map<String, dynamic> j) => Quest(
        questNumber: (j['questNumber'] as num).toInt(),
        teamSize: (j['teamSize'] as num).toInt(),
        status: j['status'] as String,
        team: ((j['team'] as List?) ?? [])
            .map((e) => Player.fromJson(e as Map<String, dynamic>))
            .toList(),
        votes: ((j['votes'] as List?) ?? [])
            .map((e) => TeamVote.fromJson(e as Map<String, dynamic>))
            .toList(),
        results: ((j['results'] as List?) ?? [])
            .map((e) => QuestResultVote.fromJson(e as Map<String, dynamic>))
            .toList(),
        failsRequired: (j['failsRequired'] as num).toInt(),
        questLeader: j['questLeader'] == null
            ? null
            : Player.fromJson(j['questLeader'] as Map<String, dynamic>),
        pastVotes: ((j['pastVotes'] as List?) ?? [])
            .map((e) => PastVote.fromJson(e as Map<String, dynamic>))
            .toList(),
        approvedVote: j['approvedVote'] == null
            ? null
            : ApprovedVote.fromJson(j['approvedVote'] as Map<String, dynamic>),
      );

  int get successVotes => results.where((r) => r.vote == 'SUCCESS').length;
  int get failVotes => results.where((r) => r.vote == 'FAIL').length;
}

class ChatMessage {
  final String senderId;
  final int senderUserId;
  final String senderName;
  final String text;
  const ChatMessage(this.senderId, this.senderUserId, this.senderName, this.text);
  factory ChatMessage.fromJson(Map<String, dynamic> j) => ChatMessage(
        j['senderId'] as String,
        ((j['senderUserId'] as num?) ?? 0).toInt(),
        j['senderName'] as String,
        j['text'] as String,
      );
  bool get isSystem => senderId == 'system';
}

class LogEntry {
  final String id;
  final int timestamp;
  final String text;
  final String type;
  const LogEntry(this.id, this.timestamp, this.text, this.type);
  factory LogEntry.fromJson(Map<String, dynamic> j) => LogEntry(
        j['id'] as String,
        ((j['timestamp'] as num?) ?? 0).toInt(),
        j['text'] as String,
        j['type'] as String,
      );
}

class ReconnectingPlayer {
  final int userId;
  final String name;
  final int endsAt;
  const ReconnectingPlayer(this.userId, this.name, this.endsAt);
  factory ReconnectingPlayer.fromJson(Map<String, dynamic> j) =>
      ReconnectingPlayer(
        (j['userId'] as num).toInt(),
        j['name'] as String,
        ((j['endsAt'] as num?) ?? 0).toInt(),
      );
}

class RestartVote {
  final String initiatorId;
  final String initiatorName;
  final Map<String, String> votes;
  final int endsAt;
  const RestartVote(this.initiatorId, this.initiatorName, this.votes, this.endsAt);
  factory RestartVote.fromJson(Map<String, dynamic> j) => RestartVote(
        j['initiatorId'] as String,
        j['initiatorName'] as String,
        ((j['votes'] as Map?) ?? {})
            .map((k, v) => MapEntry(k as String, v as String)),
        ((j['endsAt'] as num?) ?? 0).toInt(),
      );
}

class TutorialStep {
  final int step;
  final String title;
  final String text;
  final List<String> highlight;
  final String? actionRequired;
  final String? actionText;
  final bool isFinalStep;
  const TutorialStep({
    required this.step,
    required this.title,
    required this.text,
    required this.highlight,
    this.actionRequired,
    this.actionText,
    this.isFinalStep = false,
  });
  factory TutorialStep.fromJson(Map<String, dynamic> j) => TutorialStep(
        step: (j['step'] as num).toInt(),
        title: j['title'] as String,
        text: j['text'] as String,
        highlight:
            ((j['highlight'] as List?) ?? []).map((e) => e as String).toList(),
        actionRequired: j['actionRequired'] as String?,
        actionText: j['actionText'] as String?,
        isFinalStep: j['isFinalStep'] == true,
      );
}

// --- Dragon's Breath ---

enum DragonCardType {
  dragonBreath("Dragon Breath"),
  defuse('Defuse'),
  attack('Attack'),
  skip('Skip'),
  seeTheFuture('See the Future'),
  shuffle('Shuffle'),
  emberdrakeHatchling('Emberdrake Hatchling'),
  glimmeringWhelp('Glimmering Whelp'),
  sunstoneDrake('Sunstone Drake'),
  hidden('Hidden');

  final String wire;
  const DragonCardType(this.wire);
  static DragonCardType from(String v) => DragonCardType.values
      .firstWhere((t) => t.wire == v, orElse: () => DragonCardType.hidden);
}

class DragonCard {
  final String id;
  final DragonCardType type;
  const DragonCard(this.id, this.type);
  factory DragonCard.fromJson(Map<String, dynamic> j) =>
      DragonCard(j['id'] as String, DragonCardType.from(j['type'] as String));
}

class DragonsBreathState {
  final List<DragonCard> deck;
  final Map<String, List<DragonCard>> hands;
  final List<DragonCard> discardPile;
  final String currentPlayerId;
  final int turnsToTake;
  final String? isViewingFuture;
  final List<DragonCard> futureCards;
  final String? isPlacingDragon;
  final String? winner;
  final String? loser;

  const DragonsBreathState({
    required this.deck,
    required this.hands,
    required this.discardPile,
    required this.currentPlayerId,
    required this.turnsToTake,
    this.isViewingFuture,
    required this.futureCards,
    this.isPlacingDragon,
    this.winner,
    this.loser,
  });

  factory DragonsBreathState.fromJson(Map<String, dynamic> j) =>
      DragonsBreathState(
        deck: ((j['deck'] as List?) ?? [])
            .map((e) => DragonCard.fromJson(e as Map<String, dynamic>))
            .toList(),
        hands: ((j['hands'] as Map?) ?? {}).map((k, v) => MapEntry(
            k as String,
            (v as List)
                .map((e) => DragonCard.fromJson(e as Map<String, dynamic>))
                .toList())),
        discardPile: ((j['discardPile'] as List?) ?? [])
            .map((e) => DragonCard.fromJson(e as Map<String, dynamic>))
            .toList(),
        currentPlayerId: j['currentPlayerId'] as String,
        turnsToTake: ((j['turnsToTake'] as num?) ?? 1).toInt(),
        isViewingFuture: j['isViewingFuture'] as String?,
        futureCards: ((j['futureCards'] as List?) ?? [])
            .map((e) => DragonCard.fromJson(e as Map<String, dynamic>))
            .toList(),
        isPlacingDragon: j['isPlacingDragon'] as String?,
        winner: j['winner'] as String?,
        loser: j['loser'] as String?,
      );
}

class CpuPersonaRef {
  final String name;
  final String? difficulty;
  const CpuPersonaRef(this.name, this.difficulty);
  factory CpuPersonaRef.fromJson(Map<String, dynamic> j) =>
      CpuPersonaRef(j['name'] as String, j['difficulty'] as String?);
}

class CpuGameConfig {
  final String difficulty;
  final List<CpuPersonaRef> personas;
  const CpuGameConfig(this.difficulty, this.personas);
  factory CpuGameConfig.fromJson(Map<String, dynamic> j) => CpuGameConfig(
        (j['difficulty'] as String?) ?? 'easy',
        ((j['personas'] as List?) ?? [])
            .map((e) => CpuPersonaRef.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class GameState {
  final String? roomCode;
  final List<Player> players;
  final GamePhase phase;
  final int currentQuest;
  final List<Quest> questHistory;
  final Player? leader;
  final int voteTrack;
  final Alignment2? winner;
  final String endGameReason;
  final List<ChatMessage> chat;
  final List<LogEntry> gameLog;
  final List<String> readyPlayers;
  final List<String> endGameReadyPlayers;
  final ReconnectingPlayer? reconnectingPlayer;
  final RestartVote? restartVote;
  final List<String>? pendingTeam;
  final DragonsBreathState? dragonsBreathState;
  final String? assassinationTargetId;
  final List<Role> selectedRoles;
  final TutorialStep? tutorial;
  final CpuGameConfig? cpuConfig;

  const GameState({
    this.roomCode,
    this.players = const [],
    this.phase = GamePhase.home,
    this.currentQuest = 1,
    this.questHistory = const [],
    this.leader,
    this.voteTrack = 0,
    this.winner,
    this.endGameReason = '',
    this.chat = const [],
    this.gameLog = const [],
    this.readyPlayers = const [],
    this.endGameReadyPlayers = const [],
    this.reconnectingPlayer,
    this.restartVote,
    this.pendingTeam,
    this.dragonsBreathState,
    this.assassinationTargetId,
    this.selectedRoles = const [],
    this.tutorial,
    this.cpuConfig,
  });

  factory GameState.fromJson(Map<String, dynamic> j) => GameState(
        roomCode: j['roomCode'] as String?,
        players: ((j['players'] as List?) ?? [])
            .map((e) => Player.fromJson(e as Map<String, dynamic>))
            .toList(),
        phase: GamePhase.from(j['phase'] as String?),
        currentQuest: ((j['currentQuest'] as num?) ?? 1).toInt(),
        questHistory: ((j['questHistory'] as List?) ?? [])
            .map((e) => Quest.fromJson(e as Map<String, dynamic>))
            .toList(),
        leader: j['leader'] == null
            ? null
            : Player.fromJson(j['leader'] as Map<String, dynamic>),
        voteTrack: ((j['voteTrack'] as num?) ?? 0).toInt(),
        winner: Alignment2.from(j['winner'] as String?),
        endGameReason: (j['endGameReason'] as String?) ?? '',
        chat: ((j['chat'] as List?) ?? [])
            .map((e) => ChatMessage.fromJson(e as Map<String, dynamic>))
            .toList(),
        gameLog: ((j['gameLog'] as List?) ?? [])
            .map((e) => LogEntry.fromJson(e as Map<String, dynamic>))
            .toList(),
        readyPlayers: ((j['readyPlayers'] as List?) ?? [])
            .map((e) => e as String)
            .toList(),
        endGameReadyPlayers: ((j['endGameReadyPlayers'] as List?) ?? [])
            .map((e) => e as String)
            .toList(),
        reconnectingPlayer: j['reconnectingPlayer'] == null
            ? null
            : ReconnectingPlayer.fromJson(
                j['reconnectingPlayer'] as Map<String, dynamic>),
        restartVote: j['restartVote'] == null
            ? null
            : RestartVote.fromJson(j['restartVote'] as Map<String, dynamic>),
        pendingTeam: (j['pendingTeam'] as List?)?.map((e) => e as String).toList(),
        dragonsBreathState: j['dragonsBreathState'] == null
            ? null
            : DragonsBreathState.fromJson(
                j['dragonsBreathState'] as Map<String, dynamic>),
        assassinationTargetId: j['assassinationTargetId'] as String?,
        selectedRoles: ((j['selectedRoles'] as List?) ?? [])
            .map((e) => Role.from(e as String))
            .whereType<Role>()
            .toList(),
        tutorial: j['tutorial'] == null
            ? null
            : TutorialStep.fromJson(j['tutorial'] as Map<String, dynamic>),
        cpuConfig: j['cpuConfig'] == null
            ? null
            : CpuGameConfig.fromJson(j['cpuConfig'] as Map<String, dynamic>),
      );

  Quest? get activeQuest =>
      currentQuest >= 1 && currentQuest <= questHistory.length
          ? questHistory[currentQuest - 1]
          : null;
}

// --- Auth & profile ---

class User {
  final int id;
  final String username;
  final bool isAdmin;
  final String? selectedTitle;
  final String? selectedBorder;
  final String? selectedIcon;
  final String? selectedBackground;
  final bool isGoogleLinked;

  const User({
    required this.id,
    required this.username,
    this.isAdmin = false,
    this.selectedTitle,
    this.selectedBorder,
    this.selectedIcon,
    this.selectedBackground,
    this.isGoogleLinked = false,
  });

  factory User.fromJson(Map<String, dynamic> j) => User(
        id: (j['id'] as num).toInt(),
        username: j['username'] as String,
        isAdmin: j['is_admin'] == true,
        selectedTitle: j['selectedTitle'] as String?,
        selectedBorder: j['selectedBorder'] as String?,
        selectedIcon: j['selectedIcon'] as String?,
        selectedBackground: j['selectedBackground'] as String?,
        isGoogleLinked: j['isGoogleLinked'] == true,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'username': username,
        'is_admin': isAdmin,
        'selectedTitle': selectedTitle,
        'selectedBorder': selectedBorder,
        'selectedIcon': selectedIcon,
        'selectedBackground': selectedBackground,
        'isGoogleLinked': isGoogleLinked,
      };

  User copyWith({
    String? username,
    String? selectedTitle,
    String? selectedBorder,
    String? selectedIcon,
    String? selectedBackground,
  }) =>
      User(
        id: id,
        username: username ?? this.username,
        isAdmin: isAdmin,
        selectedTitle: selectedTitle ?? this.selectedTitle,
        selectedBorder: selectedBorder ?? this.selectedBorder,
        selectedIcon: selectedIcon ?? this.selectedIcon,
        selectedBackground: selectedBackground ?? this.selectedBackground,
        isGoogleLinked: isGoogleLinked,
      );
}

class MatchRecord {
  final int id;
  final String winner;
  final String role;
  final bool won;
  final String playedAt;
  const MatchRecord(this.id, this.winner, this.role, this.won, this.playedAt);
  factory MatchRecord.fromJson(Map<String, dynamic> j) => MatchRecord(
        (j['id'] as num).toInt(),
        j['winner'] as String,
        j['role'] as String,
        j['won'] == true,
        (j['playedAt'] as String?) ?? '',
      );
}

class PlayerStats {
  final int totalGames, totalWins, goodGames, goodWins, evilGames, evilWins;
  final int winRate, goodWinRate, evilWinRate;
  final List<MatchRecord> recentMatches;
  const PlayerStats({
    required this.totalGames,
    required this.totalWins,
    required this.goodGames,
    required this.goodWins,
    required this.evilGames,
    required this.evilWins,
    required this.winRate,
    required this.goodWinRate,
    required this.evilWinRate,
    required this.recentMatches,
  });
  factory PlayerStats.fromJson(Map<String, dynamic> j) => PlayerStats(
        totalGames: ((j['totalGames'] as num?) ?? 0).toInt(),
        totalWins: ((j['totalWins'] as num?) ?? 0).toInt(),
        goodGames: ((j['goodGames'] as num?) ?? 0).toInt(),
        goodWins: ((j['goodWins'] as num?) ?? 0).toInt(),
        evilGames: ((j['evilGames'] as num?) ?? 0).toInt(),
        evilWins: ((j['evilWins'] as num?) ?? 0).toInt(),
        winRate: ((j['winRate'] as num?) ?? 0).toInt(),
        goodWinRate: ((j['goodWinRate'] as num?) ?? 0).toInt(),
        evilWinRate: ((j['evilWinRate'] as num?) ?? 0).toInt(),
        recentMatches: ((j['recentMatches'] as List?) ?? [])
            .map((e) => MatchRecord.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class AchievementReward {
  final String type; // TITLE | BORDER | ICON | BACKGROUND
  final String value;
  final String name;
  const AchievementReward(this.type, this.value, this.name);
  factory AchievementReward.fromJson(Map<String, dynamic> j) =>
      AchievementReward(
          j['type'] as String, j['value'] as String, j['name'] as String);
}

class Achievement {
  final String id;
  final String name;
  final String description;
  final String icon;
  final List<AchievementReward> rewards;
  final bool unlocked;
  final bool hidden;
  const Achievement({
    required this.id,
    required this.name,
    required this.description,
    required this.icon,
    required this.rewards,
    required this.unlocked,
    required this.hidden,
  });
  factory Achievement.fromJson(Map<String, dynamic> j) => Achievement(
        id: j['id'] as String,
        name: j['name'] as String,
        description: j['description'] as String,
        icon: (j['icon'] as String?) ?? '',
        rewards: ((j['rewards'] as List?) ?? [])
            .map((e) => AchievementReward.fromJson(e as Map<String, dynamic>))
            .toList(),
        unlocked: j['unlocked'] == true,
        hidden: j['hidden'] == true,
      );
}

class Friend {
  final int id;
  final String username;
  final String? selectedTitle;
  final String? selectedBorder;
  final String? selectedIcon;
  final bool isOnline;
  final bool isInGame;
  final String? gamePhase;
  const Friend({
    required this.id,
    required this.username,
    this.selectedTitle,
    this.selectedBorder,
    this.selectedIcon,
    this.isOnline = false,
    this.isInGame = false,
    this.gamePhase,
  });
  factory Friend.fromJson(Map<String, dynamic> j) => Friend(
        id: (j['id'] as num).toInt(),
        username: j['username'] as String,
        selectedTitle: j['selectedTitle'] as String?,
        selectedBorder: j['selectedBorder'] as String?,
        selectedIcon: j['selectedIcon'] as String?,
        isOnline: j['isOnline'] == true,
        isInGame: j['isInGame'] == true,
        gamePhase: j['gamePhase'] as String?,
      );
  Friend copyWith({bool? isOnline, bool? isInGame, String? gamePhase}) =>
      Friend(
        id: id,
        username: username,
        selectedTitle: selectedTitle,
        selectedBorder: selectedBorder,
        selectedIcon: selectedIcon,
        isOnline: isOnline ?? this.isOnline,
        isInGame: isInGame ?? this.isInGame,
        gamePhase: gamePhase,
      );
}

class FriendRequest {
  final int id;
  final String username;
  const FriendRequest(this.id, this.username);
  factory FriendRequest.fromJson(Map<String, dynamic> j) =>
      FriendRequest((j['id'] as num).toInt(), j['username'] as String);
}

class GameInvite {
  final String fromUsername;
  final String roomCode;
  const GameInvite(this.fromUsername, this.roomCode);
  factory GameInvite.fromJson(Map<String, dynamic> j) => GameInvite(
        ((j['from'] as Map<String, dynamic>?) ?? {})['username'] as String? ??
            'Someone',
        j['roomCode'] as String,
      );
}

class LeaderboardEntry {
  final String username;
  final dynamic value;
  const LeaderboardEntry(this.username, this.value);
  factory LeaderboardEntry.fromJson(Map<String, dynamic> j) =>
      LeaderboardEntry(j['username'] as String, j['value']);
}
