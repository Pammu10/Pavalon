import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../core/theme.dart';
import '../models/models.dart';

/// Five quest medallions + vote track, with a tap-for-details sheet
/// (port of QuestProgressWithPopover).
class QuestProgress extends StatelessWidget {
  final GameState gameState;
  const QuestProgress({super.key, required this.gameState});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (final quest in gameState.questHistory) ...[
              _QuestMedallion(
                quest: quest,
                isCurrent: quest.questNumber == gameState.currentQuest,
                // During assassination the deciding quest already passed.
                displayStatus: gameState.phase == GamePhase.assassination &&
                        quest.status == 'ACTIVE'
                    ? 'PASSED'
                    : quest.status,
                onTap: () => _showDetails(context, quest),
              ),
              if (quest.questNumber != gameState.questHistory.length)
                const SizedBox(width: 8),
            ]
          ],
        ),
        const SizedBox(height: 8),
        // Vote track
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('Vote Track ',
                style: TextStyle(fontSize: 11, color: PavalonColors.slate400)),
            for (var i = 1; i <= 5; i++)
              Container(
                width: 14,
                height: 14,
                margin: const EdgeInsets.symmetric(horizontal: 2),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: i <= gameState.voteTrack
                      ? (gameState.voteTrack >= 4
                          ? PavalonColors.evilDeep
                          : PavalonColors.amber)
                      : PavalonColors.slate700,
                  border: Border.all(color: PavalonColors.slate600),
                ),
              ),
          ],
        ),
      ],
    );
  }

  void _showDetails(BuildContext context, Quest quest) {
    showModalBottomSheet(
      context: context,
      backgroundColor: PavalonColors.slate800,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Quest ${quest.questNumber}', style: eagle(22)),
                const SizedBox(height: 4),
                Text(
                    'Team of ${quest.teamSize} · ${quest.failsRequired} fail'
                    '${quest.failsRequired > 1 ? 's' : ''} needed to fail',
                    style: const TextStyle(color: PavalonColors.slate400)),
                const SizedBox(height: 12),
                if (quest.status == 'PASSED' || quest.status == 'FAILED') ...[
                  Row(children: [
                    Icon(
                        quest.status == 'PASSED'
                            ? LucideIcons.shieldCheck
                            : LucideIcons.shieldClose,
                        color: quest.status == 'PASSED'
                            ? PavalonColors.good
                            : PavalonColors.evil),
                    const SizedBox(width: 8),
                    Text('${quest.status} — ${quest.successVotes} success, '
                        '${quest.failVotes} fail'),
                  ]),
                  if (quest.approvedVote != null) ...[
                    const SizedBox(height: 10),
                    Text(
                        'Team: ${quest.approvedVote!.team.map((p) => p.name).join(', ')}',
                        style:
                            const TextStyle(color: PavalonColors.slate300)),
                  ],
                ] else
                  Text(
                      quest.status == 'ACTIVE'
                          ? 'This quest is underway.'
                          : 'Not yet begun.',
                      style: const TextStyle(color: PavalonColors.slate400)),
                if (quest.pastVotes.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text('${quest.pastVotes.length} rejected proposal'
                      '${quest.pastVotes.length > 1 ? 's' : ''} this quest',
                      style: const TextStyle(
                          color: PavalonColors.evil, fontSize: 13)),
                ],
                const SizedBox(height: 8),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _QuestMedallion extends StatelessWidget {
  final Quest quest;
  final bool isCurrent;
  final String displayStatus;
  final VoidCallback onTap;
  const _QuestMedallion({
    required this.quest,
    required this.isCurrent,
    required this.displayStatus,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final (color, icon) = switch (displayStatus) {
      'PASSED' => (PavalonColors.goodDeep, LucideIcons.shieldCheck),
      'FAILED' => (PavalonColors.evilDeep, LucideIcons.shieldClose),
      _ => (PavalonColors.slate700, null),
    };
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 400),
        width: isCurrent ? 52 : 44,
        height: isCurrent ? 52 : 44,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: color,
          border: Border.all(
              color: isCurrent ? PavalonColors.gold : PavalonColors.slate600,
              width: isCurrent ? 2.5 : 1.5),
          boxShadow: isCurrent
              ? [
                  BoxShadow(
                      color: PavalonColors.gold.withValues(alpha: 0.5),
                      blurRadius: 10)
                ]
              : null,
        ),
        child: Center(
          child: icon != null
              ? Icon(icon, color: Colors.white, size: 22)
              : Text('${quest.teamSize}',
                  style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                      color: PavalonColors.slate300)),
        ),
      ),
    );
  }
}
