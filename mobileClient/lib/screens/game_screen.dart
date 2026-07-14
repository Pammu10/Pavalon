import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../models/models.dart';
import '../services/audio_service.dart';
import '../services/haptics.dart';
import '../state/game_provider.dart';
import '../widgets/common.dart';
import '../widgets/overlays/quest_result_overlay.dart';
import '../widgets/overlays/team_vote_reveal_overlay.dart';
import '../widgets/player_tile.dart';
import '../widgets/quest_progress.dart';
import '../widgets/swipe_vote_card.dart';

/// Mid-game phases: team selection, team vote, quest vote, quest result,
/// assassination — plus the reveal overlays, phase-transition sounds and
/// the "your turn" alert (port of GameScreen.tsx + TurnAlert).
class GameScreen extends StatefulWidget {
  const GameScreen({super.key});
  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen> {
  GamePhase? _prevPhase;
  bool _prevNeedsAction = false;
  String? _turnMessage;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final game = context.watch<GameProvider>();
    final state = game.gameState;

    // Phase-transition sound (web parity: selection/vote phases only).
    if (_prevPhase != state.phase) {
      const soundPhases = [
        GamePhase.teamSelection,
        GamePhase.teamVote,
        GamePhase.questVote,
      ];
      if (_prevPhase != null && soundPhases.contains(state.phase)) {
        context.read<AudioService>().play(Sfx.transition, overlay: true);
      }
      _prevPhase = state.phase;
    }

    // Turn alert on the rising edge of "the game waits on me".
    final needs = _needsAction(game);
    if (needs.$1 && !_prevNeedsAction) {
      Haptics.confirm();
      setState(() => _turnMessage = needs.$2);
      Future.delayed(const Duration(milliseconds: 4500), () {
        if (mounted) setState(() => _turnMessage = null);
      });
    } else if (!needs.$1 && _prevNeedsAction) {
      _turnMessage = null;
    }
    _prevNeedsAction = needs.$1;
  }

  (bool, String) _needsAction(GameProvider game) {
    final state = game.gameState;
    final me = game.me;
    if (me == null || state.reconnectingPlayer != null) return (false, '');
    final quest = state.activeQuest;
    switch (state.phase) {
      case GamePhase.teamSelection:
        if (state.leader?.id == me.id) {
          return (true, "You're the Quest Leader — pick your team!");
        }
      case GamePhase.teamVote:
        if (!me.hasVoted) return (true, 'Vote on the proposed team!');
      case GamePhase.questVote:
        final onTeam = quest?.team.any((p) => p.id == me.id) ?? false;
        if (onTeam && !me.hasVoted) {
          return (true, "You're on the quest — cast your vote!");
        }
      case GamePhase.assassination:
        if (me.role == Role.assassin) {
          return (true, 'Choose your target, Assassin.');
        }
      default:
        break;
    }
    return (false, '');
  }

  @override
  Widget build(BuildContext context) {
    final game = context.watch<GameProvider>();
    final state = game.gameState;

    final phaseBody = switch (state.phase) {
      GamePhase.teamSelection => _TeamSelection(game: game),
      GamePhase.teamVote => _TeamVote(game: game),
      GamePhase.questVote => _QuestVote(game: game),
      GamePhase.questResult => const SizedBox.shrink(),
      GamePhase.assassination => _Assassination(game: game),
      _ => const SizedBox.shrink(),
    };

    final quest = state.activeQuest;
    final showQuestResult = state.phase == GamePhase.questResult &&
        quest != null &&
        !game.hasViewedCurrentQuestResult &&
        game.teamVoteReveal == null;

    return Stack(
      children: [
        SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              PavalonCard(
                padding: const EdgeInsets.all(12),
                child: QuestProgress(gameState: state),
              ),
              const SizedBox(height: 16),
              _phaseHeader(game, state),
              const SizedBox(height: 12),
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 300),
                child:
                    KeyedSubtree(key: ValueKey(state.phase), child: phaseBody),
              ),
            ],
          ),
        ),
        // Turn alert banner
        if (_turnMessage != null)
          Positioned(
            top: 8,
            left: 20,
            right: 20,
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: 1),
              duration: const Duration(milliseconds: 400),
              curve: Curves.easeOutBack,
              builder: (context, v, child) => Opacity(
                opacity: v.clamp(0.0, 1.0),
                child: Transform.translate(
                    offset: Offset(0, -30 * (1 - v)), child: child),
              ),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [
                    Color(0xFF92400E),
                    Color(0xFFA16207),
                    Color(0xFF92400E)
                  ]),
                  borderRadius: BorderRadius.circular(14),
                  border:
                      Border.all(color: PavalonColors.gold, width: 2),
                  boxShadow: const [
                    BoxShadow(color: Colors.black54, blurRadius: 12)
                  ],
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(LucideIcons.swords,
                        size: 18, color: PavalonColors.goldBright),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(_turnMessage!,
                          style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              color: Color(0xFFFEF3C7))),
                    ),
                  ],
                ),
              ),
            ),
          ),
        // Team-vote reveal overlay
        if (game.teamVoteReveal != null)
          Positioned.fill(
            child: TeamVoteRevealOverlay(
              key: ValueKey(game.teamVoteReveal),
              data: game.teamVoteReveal!,
              onClose: game.clearTeamVoteReveal,
            ),
          ),
        // Quest result overlay
        if (showQuestResult)
          Positioned.fill(
            child: QuestResultOverlay(
              key: ValueKey('qr-${state.roomCode}-${state.currentQuest}'),
              isSuccess: quest.status == 'PASSED',
              successVotes: quest.successVotes,
              failVotes: quest.failVotes,
              failsRequired: quest.failsRequired,
              onClose: game.markQuestResultAsViewed,
            ),
          ),
      ],
    );
  }

  Widget _phaseHeader(GameProvider game, GameState state) {
    // Copy mirrors the web GamePhaseHeader exactly.
    final isLeader = state.leader?.id == game.playerId;
    final quest = state.activeQuest;
    final onTeam =
        quest?.approvedVote?.team.any((p) => p.id == game.playerId) ?? false;
    final isAssassin = game.me?.role == Role.assassin;

    final (title, subtitle) = switch (state.phase) {
      GamePhase.teamSelection => isLeader
          ? (
              'Your Turn, Leader',
              'Select ${quest?.teamSize ?? '...'} knights for the quest.'
            )
          : (
              'Awaiting a New Team',
              'Waiting for ${state.leader?.name ?? 'the leader'} to propose a team.'
            ),
      GamePhase.teamVote => (
          'All Knights, Cast Your Vote!',
          'Does this proposed team inspire your trust?'
        ),
      GamePhase.questVote => onTeam
          ? ('Your Sacred Mission', 'Vote to determine the fate of the quest.')
          : (
              'Awaiting Mission Results',
              'The chosen knights are on their quest.'
            ),
      GamePhase.questResult => ('Quest Result', 'The outcome is revealed...'),
      GamePhase.assassination => isAssassin
          ? (
              'The Assassin Strikes!',
              'Identify and eliminate Merlin to claim victory.'
            )
          : (
              'A Fateful Choice',
              'The Assassin is making their move... Pray for Merlin.'
            ),
      _ => ('', ''),
    };

    final legend = <(IconData, Color, Color, String)>[
      if (state.players.any((p) => p.isHost))
        (LucideIcons.crown, Color(0xCC854D0E), PavalonColors.goldBright, 'Host'),
      if (state.leader != null)
        (LucideIcons.crown, Color(0xCC1E40AF), PavalonColors.good,
            'Quest Leader'),
      if (state.players.any((p) => p.visibleAs == 'Evil'))
        (LucideIcons.eye, Color(0xCC7F1D1D), PavalonColors.evil, 'Known Evil'),
      if (state.players.any((p) => p.visibleAs == 'Mystic'))
        (LucideIcons.eye, Color(0xCC581C87), Color(0xFFC084FC),
            'Mystic Vision'),
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Column(
        children: [
          Text(title,
              textAlign: TextAlign.center,
              style: eagle(24, shadows: [
                const Shadow(color: Color(0x66EAB308), blurRadius: 15)
              ])),
          const SizedBox(height: 4),
          Text(subtitle,
              textAlign: TextAlign.center,
              style: const TextStyle(
                  fontSize: 15, color: PavalonColors.slate300)),
          if (legend.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.only(top: 12),
              decoration: BoxDecoration(
                  border: Border(
                      top: BorderSide(
                          color:
                              PavalonColors.slate700.withValues(alpha: 0.5)))),
              child: Wrap(
                alignment: WrapAlignment.center,
                spacing: 16,
                runSpacing: 6,
                children: [
                  for (final (icon, bg, fg, label) in legend)
                    Row(mainAxisSize: MainAxisSize.min, children: [
                      Container(
                        width: 20,
                        height: 20,
                        decoration:
                            BoxDecoration(color: bg, shape: BoxShape.circle),
                        child: Icon(icon, size: 12, color: fg),
                      ),
                      const SizedBox(width: 6),
                      Text(label,
                          style: const TextStyle(
                              fontSize: 12, color: PavalonColors.slate300)),
                    ]),
                ],
              ),
            ),
          ],
          if (state.voteTrack >= 3 && state.phase == GamePhase.teamVote) ...[
            const SizedBox(height: 8),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: (state.voteTrack >= 4
                        ? PavalonColors.evilDeep
                        : const Color(0xFF92400E))
                    .withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                    color: state.voteTrack >= 4
                        ? PavalonColors.evilDeep
                        : const Color(0xFFD97706)),
              ),
              child: Text(
                state.voteTrack >= 4
                    ? 'FINAL VOTE — if this team is rejected, Evil wins!'
                    : 'Careful — ${5 - state.voteTrack} more rejections and Evil wins.',
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: state.voteTrack >= 4
                        ? PavalonColors.evil
                        : const Color(0xFFFBBF24)),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ---------------- Phase widgets ----------------

class _TeamSelection extends StatelessWidget {
  final GameProvider game;
  const _TeamSelection({required this.game});

  @override
  Widget build(BuildContext context) {
    final state = game.gameState;
    final quest = state.activeQuest;
    final isLeader = state.leader?.id == game.playerId;
    final pending = state.pendingTeam ?? const <String>[];
    final isPaused = state.reconnectingPlayer != null;
    if (quest == null) return const SizedBox.shrink();

    void toggle(String id) {
      if (!isLeader || isPaused) return;
      Haptics.tap();
      final next = [...pending];
      if (next.contains(id)) {
        next.remove(id);
      } else if (next.length < quest.teamSize) {
        next.add(id);
      } else {
        game.notify('Team is full! Pick ${quest.teamSize} knights.',
            kind: 'error');
        return;
      }
      game.updatePendingTeam(next);
    }

    return Column(
      children: [
        if (quest.pastVotes.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Text(
              '${quest.pastVotes.length} team proposal'
              '${quest.pastVotes.length > 1 ? 's' : ''} rejected this quest',
              style:
                  const TextStyle(color: PavalonColors.evil, fontSize: 13),
            ),
          ),
        Wrap(
          spacing: 10,
          runSpacing: 12,
          alignment: WrapAlignment.center,
          children: [
            for (final p in state.players)
              PlayerTile(
                player: p,
                isLeader: p.id == state.leader?.id,
                isSelected: pending.contains(p.id),
                onTap: isLeader ? () => toggle(p.id) : null,
              ),
          ],
        ),
        const SizedBox(height: 16),
        if (isLeader)
          PavalonButton(
            label: 'Propose Team (${pending.length}/${quest.teamSize})',
            expand: true,
            onPressed: pending.length == quest.teamSize && !isPaused
                ? () {
                    Haptics.confirm();
                    game.selectTeam(pending);
                  }
                : null,
          )
        else
          const Text('Tiles light up as the leader picks the team.',
              style: TextStyle(color: PavalonColors.slate400, fontSize: 13)),
      ],
    );
  }
}

class _TeamVote extends StatelessWidget {
  final GameProvider game;
  const _TeamVote({required this.game});

  @override
  Widget build(BuildContext context) {
    final state = game.gameState;
    final quest = state.activeQuest;
    final me = game.me;
    if (quest == null) return const SizedBox.shrink();
    final voted = state.players.where((p) => p.hasVoted).length;

    return Column(
      children: [
        Text('Proposed Team', style: eagle(15, color: Colors.white)),
        const SizedBox(height: 10),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          alignment: WrapAlignment.center,
          children: [
            for (final p in quest.team)
              PlayerTile(player: p, width: 92),
          ],
        ),
        const SizedBox(height: 14),
        Text('$voted / ${state.players.length} votes cast',
            style:
                const TextStyle(color: PavalonColors.slate400, fontSize: 13)),
        const SizedBox(height: 14),
        if (me != null && !me.hasVoted)
          SwipeVoteCard(
            title: 'Vote on Team',
            rightLabel: 'Approve',
            leftLabel: 'Reject',
            disabled: state.reconnectingPlayer != null,
            onSwipeRight: () => game.voteOnTeam('APPROVE'),
            onSwipeLeft: () => game.voteOnTeam('REJECT'),
          )
        else
          const Padding(
            padding: EdgeInsets.all(12),
            child: Text('Waiting for the remaining votes...',
                style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: PavalonColors.slate400)),
          ),
      ],
    );
  }
}

class _QuestVote extends StatelessWidget {
  final GameProvider game;
  const _QuestVote({required this.game});

  @override
  Widget build(BuildContext context) {
    final state = game.gameState;
    final quest = state.activeQuest;
    final me = game.me;
    if (quest == null) return const SizedBox.shrink();
    final onTeam = quest.team.any((p) => p.id == game.playerId);
    final voted = quest.team.where((p) => p.hasVoted).length;
    final canFail = me?.alignment == Alignment2.evil;

    return Column(
      children: [
        if (quest.approvedVote != null) ...[
          Text(
            'Team approved '
            '(${quest.approvedVote!.votes.where((v) => v.vote == 'APPROVE').length}'
            '–${quest.approvedVote!.votes.where((v) => v.vote == 'REJECT').length})',
            style: const TextStyle(
                color: PavalonColors.good, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 10),
        ],
        Wrap(
          spacing: 10,
          runSpacing: 10,
          alignment: WrapAlignment.center,
          children: [
            for (final p in quest.team)
              PlayerTile(player: p, width: 92),
          ],
        ),
        const SizedBox(height: 14),
        Text('$voted / ${quest.team.length} knights have acted',
            style:
                const TextStyle(color: PavalonColors.slate400, fontSize: 13)),
        const SizedBox(height: 14),
        if (onTeam && me != null && !me.hasVoted)
          SwipeVoteCard(
            title: 'Vote on Quest',
            rightLabel: 'Success',
            leftLabel: 'Fail',
            disabled: state.reconnectingPlayer != null,
            leftSwipeDisabled: !canFail,
            onSwipeRight: () => game.voteOnQuest('SUCCESS'),
            onSwipeLeft: () => game.voteOnQuest('FAIL'),
          )
        else
          Padding(
            padding: const EdgeInsets.all(12),
            child: Text(
                onTeam
                    ? 'Waiting for your fellow knights...'
                    : 'Waiting for the quest team to complete their mission...',
                textAlign: TextAlign.center,
                style: const TextStyle(color: PavalonColors.slate400)),
          ),
      ],
    );
  }
}

class _Assassination extends StatefulWidget {
  final GameProvider game;
  const _Assassination({required this.game});
  @override
  State<_Assassination> createState() => _AssassinationState();
}

class _AssassinationState extends State<_Assassination> {
  bool _confirming = false;

  @override
  Widget build(BuildContext context) {
    final game = widget.game;
    final state = game.gameState;
    final me = game.me;
    final isAssassin = me?.role == Role.assassin;
    final isEvilTeam =
        me?.alignment == Alignment2.evil && me?.role != Role.oberon;
    final targetId = state.assassinationTargetId;
    final isPaused = state.reconnectingPlayer != null;

    if (!isEvilTeam) {
      return PavalonCard(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Container(
              width: 150,
              height: 150,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0xFF991B1B), width: 4),
                boxShadow: const [
                  BoxShadow(color: Color(0x88DC2626), blurRadius: 40)
                ],
                image: const DecorationImage(
                    image: AssetImage('assets/characters/assassin.jpg'),
                    fit: BoxFit.cover),
              ),
            ),
            const SizedBox(height: 16),
            Text('A Fateful Choice', style: eagle(24, color: PavalonColors.evil)),
            const SizedBox(height: 8),
            const Text('The Assassin is making their move... Pray for Merlin.',
                textAlign: TextAlign.center,
                style: TextStyle(color: PavalonColors.slate300)),
          ],
        ),
      );
    }

    final targets = state.players
        .where((p) => p.id != game.playerId && p.visibleAs != 'Evil')
        .toList();

    return Column(
      children: [
        Text(isAssassin ? 'Your Target' : 'The Target',
            style: eagle(20, color: PavalonColors.goldBright)),
        const SizedBox(height: 6),
        Text(
          isAssassin
              ? 'You have one chance. Find and eliminate Merlin. Your allies can see your choice.'
              : 'The Assassin is choosing their target. Discuss and guide them to victory.',
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 13, color: PavalonColors.slate300),
        ),
        const SizedBox(height: 14),
        Wrap(
          spacing: 10,
          runSpacing: 12,
          alignment: WrapAlignment.center,
          children: [
            for (final p in targets)
              PlayerTile(
                player: p,
                isSelected: p.id == targetId,
                onTap: isAssassin && !isPaused
                    ? () => game.updateAssassinationTarget(
                        targetId == p.id ? null : p.id)
                    : null,
              ),
          ],
        ),
        if (isAssassin) ...[
          const SizedBox(height: 18),
          PavalonButton(
            label: _confirming ? 'Going for the kill...' : 'Confirm Assassination',
            variant: PavalonButtonVariant.danger,
            expand: true,
            busy: _confirming,
            onPressed: targetId != null && !isPaused
                ? () {
                    setState(() => _confirming = true);
                    Haptics.dramatic();
                    game.assassinate(targetId);
                  }
                : null,
          ),
        ],
      ],
    );
  }
}
