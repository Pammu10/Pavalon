import 'package:flutter_test/flutter_test.dart';
import 'package:pavalon_mobile/core/constants.dart';
import 'package:pavalon_mobile/models/models.dart';
import 'package:pavalon_mobile/screens/lobby_screen.dart';

void main() {
  group('wire enums', () {
    test('roles round-trip their server strings', () {
      for (final r in Role.values) {
        expect(Role.from(r.wire), r);
      }
      expect(Role.from('Loyal Servant of Arthur'), Role.loyalServant);
      expect(Role.from('nonsense'), isNull);
    });

    test('phases parse with safe fallback', () {
      expect(GamePhase.from('TEAM_VOTE'), GamePhase.teamVote);
      expect(GamePhase.from('???'), GamePhase.home);
    });
  });

  group('computeRoleSetup (lobby validation, ported from web)', () {
    test('rejects fewer than 5 players', () {
      final s = computeRoleSetup({}, 4);
      expect(s.isValid, false);
    });

    test('5 players with no specials fills servants and minions', () {
      final s = computeRoleSetup({}, 5);
      expect(s.isValid, true);
      expect(s.finalRoles.length, 5);
      expect(s.finalRoles.contains(Role.merlin), true);
      expect(s.finalRoles.contains(Role.assassin), true);
      expect(
          s.finalRoles
              .where((r) => kRoles[r]!.alignment == Alignment2.evil)
              .length,
          kEvilPlayerCount[5]);
    });

    test('Percival requires Morgana', () {
      final s = computeRoleSetup({Role.percival}, 7);
      expect(s.isValid, false);
      expect(s.message.contains('Morgana and Percival'), true);
    });

    test('Percival + Morgana together are valid for 7 players', () {
      final s = computeRoleSetup({Role.percival, Role.morgana}, 7);
      expect(s.isValid, true);
      expect(s.finalRoles.length, 7);
    });

    test('evil count always matches the server table', () {
      for (var n = 5; n <= 10; n++) {
        final s = computeRoleSetup({Role.percival, Role.morgana}, n);
        expect(
            s.finalRoles
                .where((r) => kRoles[r]!.alignment == Alignment2.evil)
                .length,
            kEvilPlayerCount[n],
            reason: 'player count $n');
      }
    });
  });

  group('quest tables stay in sync with the server', () {
    test('every player count has 5 quests', () {
      for (final entry in kQuestConfigurations.entries) {
        expect(entry.value.length, 5, reason: '${entry.key} players');
      }
    });

    test('quest 4 needs two fails at 7+ players', () {
      for (var n = 7; n <= 10; n++) {
        expect(kQuestConfigurations[n]![3].failsRequired, 2);
      }
    });
  });

  group('GameState.fromJson', () {
    test('parses a representative payload', () {
      final gs = GameState.fromJson({
        'roomCode': 'ABC123',
        'phase': 'TEAM_VOTE',
        'currentQuest': 2,
        'voteTrack': 1,
        'winner': null,
        'endGameReason': '',
        'players': [
          {
            'id': 's1',
            'userId': 7,
            'name': 'Alice',
            'role': 'Merlin',
            'alignment': 'Good',
            'isHost': true,
            'hasVoted': false,
            'status': 'CONNECTED',
          },
          {
            'id': 'cpu-1',
            'userId': -101,
            'name': 'Elara',
            'role': null,
            'alignment': null,
            'isHost': false,
            'hasVoted': true,
            'status': 'CONNECTED',
            'visibleAs': 'Evil',
          },
        ],
        'questHistory': [
          {
            'questNumber': 1,
            'teamSize': 2,
            'status': 'PASSED',
            'team': [],
            'votes': [],
            'results': [
              {'playerId': '', 'vote': 'SUCCESS'},
              {'playerId': '', 'vote': 'SUCCESS'},
            ],
            'failsRequired': 1,
            'questLeader': null,
            'pastVotes': [],
            'approvedVote': null,
          }
        ],
        'chat': [
          {'senderId': 's1', 'senderUserId': 7, 'senderName': 'Alice', 'text': 'hi'}
        ],
        'gameLog': [],
        'readyPlayers': [],
        'endGameReadyPlayers': [],
        'selectedRoles': ['Merlin', 'Assassin'],
      });

      expect(gs.roomCode, 'ABC123');
      expect(gs.phase, GamePhase.teamVote);
      expect(gs.players.length, 2);
      expect(gs.players[0].role, Role.merlin);
      expect(gs.players[1].isBot, true);
      expect(gs.players[1].visibleAs, 'Evil');
      expect(gs.questHistory.first.successVotes, 2);
      expect(gs.selectedRoles, [Role.merlin, Role.assassin]);
    });
  });

  test('emote lists match the server allow-list', () {
    expect(kEmoteEmojis.length + kEmotePhrases.length, 22);
    expect(kEmotePhrases.contains('GG!'), true);
  });
}
