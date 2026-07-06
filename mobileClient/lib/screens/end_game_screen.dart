import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../core/constants.dart';
import '../core/theme.dart';
import '../models/models.dart';
import '../services/audio_service.dart';
import '../state/game_provider.dart';
import '../widgets/common.dart';
import '../widgets/overlays/game_end_overlay.dart';

/// End of game: dramatic overlay first (sole audio owner sequences
/// sting → lobby music), then final roles, the after-action report and
/// the play-again roster (port of EndGameScreen.tsx).
class EndGameScreen extends StatefulWidget {
  const EndGameScreen({super.key});
  @override
  State<EndGameScreen> createState() => _EndGameScreenState();
}

class _EndGameScreenState extends State<EndGameScreen> {
  bool _stingPlayed = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final game = context.watch<GameProvider>();
    final winner = game.gameState.winner;
    if (!_stingPlayed && winner != null && !game.hasViewedEndGameResult) {
      _stingPlayed = true;
      final audio = context.read<AudioService>();
      audio.stopBgm();
      audio
          .play(winner == Alignment2.good ? Sfx.victory : Sfx.defeat)
          .then((_) => Future.delayed(const Duration(seconds: 6),
              () => audio.playLobbyMusic()));
    }
  }

  @override
  Widget build(BuildContext context) {
    final game = context.watch<GameProvider>();
    final state = game.gameState;
    final winner = state.winner;

    if (winner != null && !game.hasViewedEndGameResult) {
      return GameEndOverlay(
          winner: winner, onClose: game.markEndGameAsViewed);
    }

    final isGoodWin = winner == Alignment2.good;
    final ready = state.endGameReadyPlayers.toSet();
    final iAmReady = game.playerId != null && ready.contains(game.playerId);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            winner != null ? '${winner.wire} Wins!' : 'Game Over',
            textAlign: TextAlign.center,
            style: eagle(34,
                color: winner == null
                    ? PavalonColors.slate400
                    : isGoodWin
                        ? PavalonColors.good
                        : PavalonColors.evil),
          ),
          const SizedBox(height: 6),
          Text(state.endGameReason,
              textAlign: TextAlign.center,
              style: const TextStyle(
                  fontStyle: FontStyle.italic,
                  color: PavalonColors.slate300)),
          const SizedBox(height: 18),

          // Final roles
          SectionTitle('Final Roles'),
          for (final p in state.players) _roleRow(p),

          const SizedBox(height: 18),
          // After-action report (collapsible timeline)
          _report(state),

          const SizedBox(height: 18),
          SectionTitle('Next Game'),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            alignment: WrapAlignment.center,
            children: [
              for (final p
                  in state.players.where((p) => p.status == 'CONNECTED'))
                Chip(
                  backgroundColor: ready.contains(p.id)
                      ? const Color(0xFF14532D)
                      : PavalonColors.slate800,
                  label: Text(p.name,
                      style: TextStyle(
                          fontSize: 12,
                          color: ready.contains(p.id)
                              ? PavalonColors.success
                              : PavalonColors.slate300)),
                ),
            ],
          ),
          const SizedBox(height: 10),
          PavalonButton(
            label: iAmReady ? 'Waiting for other players...' : 'Play Again',
            expand: true,
            onPressed: iAmReady ? null : () => game.playerReadyForNextGame(),
          ),
          const SizedBox(height: 8),
          PavalonButton(
            label: 'Leave Room',
            variant: PavalonButtonVariant.danger,
            expand: true,
            onPressed: () => game.leaveRoom(),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _roleRow(Player p) {
    final role = p.role;
    if (role == null) return const SizedBox.shrink();
    final info = kRoles[role]!;
    final isGood = info.alignment == Alignment2.good;
    final color = isGood ? PavalonColors.good : PavalonColors.evil;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          CircleAvatar(
              radius: 24, backgroundImage: AssetImage(info.img)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(p.name,
                    style: const TextStyle(
                        fontWeight: FontWeight.bold, fontSize: 15)),
                Text(role.shortName,
                    style: const TextStyle(
                        fontSize: 12, color: PavalonColors.goldBright)),
              ],
            ),
          ),
          Text(info.alignment.wire.toUpperCase(),
              style: TextStyle(
                  fontFamily: 'EagleLake',
                  fontWeight: FontWeight.w900,
                  color: color)),
          if (p.isDisconnected)
            const Padding(
              padding: EdgeInsets.only(left: 6),
              child: Icon(LucideIcons.ghost,
                  size: 16, color: PavalonColors.slate500),
            ),
        ],
      ),
    );
  }

  Widget _report(GameState state) {
    final finished = state.questHistory
        .where((q) => q.status == 'PASSED' || q.status == 'FAILED')
        .toList();
    if (finished.isEmpty) return const SizedBox.shrink();
    final byId = {for (final p in state.players) p.id: p};

    return ExpansionTile(
      title: Text('End of Game Report', style: eagle(18)),
      collapsedIconColor: PavalonColors.gold,
      iconColor: PavalonColors.gold,
      children: [
        for (final q in finished)
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text('Quest ${q.questNumber}',
                        style: eagle(16, color: Colors.white)),
                    const SizedBox(width: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 2),
                      decoration: BoxDecoration(
                        color: (q.status == 'PASSED'
                                ? PavalonColors.goodDeep
                                : PavalonColors.evilDeep)
                            .withValues(alpha: 0.35),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(q.status,
                          style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: q.status == 'PASSED'
                                  ? PavalonColors.good
                                  : PavalonColors.evil)),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                    'Team of ${q.teamSize} · ${q.failsRequired} fail'
                    '${q.failsRequired > 1 ? 's' : ''} needed · '
                    '${q.successVotes} success / ${q.failVotes} fail votes',
                    style: const TextStyle(
                        fontSize: 12, color: PavalonColors.slate400)),
                for (final pv in q.pastVotes)
                  _voteLine('Rejected', pv.leader?.name, pv.team, pv.votes,
                      byId, PavalonColors.evil),
                if (q.approvedVote != null)
                  _voteLine('Approved', q.questLeader?.name,
                      q.approvedVote!.team, q.approvedVote!.votes, byId,
                      PavalonColors.good),
              ],
            ),
          ),
      ],
    );
  }

  Widget _voteLine(String verdict, String? leader, List<Player> team,
      List<TeamVote> votes, Map<String, Player> byId, Color color) {
    final approvals = votes.where((v) => v.vote == 'APPROVE').length;
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: PavalonColors.slate800.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(10),
          border: Border(left: BorderSide(color: color, width: 3)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('$verdict ($approvals–${votes.length - approvals})'
                '${leader != null ? ' · proposed by $leader' : ''}',
                style: TextStyle(
                    fontSize: 12, fontWeight: FontWeight.bold, color: color)),
            Text('Team: ${team.map((p) => p.name).join(', ')}',
                style: const TextStyle(
                    fontSize: 12, color: PavalonColors.slate300)),
            Text(
              'Approved by: ${votes.where((v) => v.vote == 'APPROVE').map((v) => byId[v.playerId]?.name ?? '?').join(', ')}'
              '\nRejected by: ${votes.where((v) => v.vote == 'REJECT').map((v) => byId[v.playerId]?.name ?? '?').join(', ')}',
              style: const TextStyle(
                  fontSize: 11, color: PavalonColors.slate400),
            ),
          ],
        ),
      ),
    );
  }
}
