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
            const Icon(LucideIcons.swords,
                size: 16, color: PavalonColors.gold),
            const SizedBox(width: 8),
            Text(
                'Quest Progress ${gameState.currentQuest} of '
                '${gameState.questHistory.length}',
                style: eagle(18, color: Colors.white)),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            for (final quest in gameState.questHistory) ...[
              Expanded(
                child: _QuestChip(
                  quest: quest,
                  isCurrent: quest.questNumber == gameState.currentQuest,
                  // During assassination the deciding quest already passed.
                  displayStatus: gameState.phase == GamePhase.assassination &&
                          quest.status == 'ACTIVE'
                      ? 'PASSED'
                      : quest.status,
                  onTap: () => _showDetails(context, quest),
                ),
              ),
              if (quest.questNumber != gameState.questHistory.length)
                const SizedBox(width: 6),
            ]
          ],
        ),
        const SizedBox(height: 10),
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

/// Web-style quest chip: rounded tile with status icon, "Quest N" and
/// "M Knights"; the active quest is gold-tinted with a gold ring.
class _QuestChip extends StatelessWidget {
  final Quest quest;
  final bool isCurrent;
  final String displayStatus;
  final VoidCallback onTap;
  const _QuestChip({
    required this.quest,
    required this.isCurrent,
    required this.displayStatus,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final (bg, icon, iconColor) = switch (displayStatus) {
      'PASSED' => (
          PavalonColors.goodDeep.withValues(alpha: 0.45),
          LucideIcons.shieldCheck,
          Colors.white
        ),
      'FAILED' => (
          PavalonColors.evilDeep.withValues(alpha: 0.45),
          LucideIcons.shieldClose,
          Colors.white
        ),
      _ => isCurrent
          ? (
              const Color(0xFF854D0E).withValues(alpha: 0.7),
              LucideIcons.swords,
              Colors.white
            )
          : (
              PavalonColors.slate800.withValues(alpha: 0.6),
              LucideIcons.circleQuestionMark,
              PavalonColors.slate500
            ),
    };
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 400),
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
              color: isCurrent ? PavalonColors.gold : PavalonColors.slate700,
              width: isCurrent ? 2 : 1),
          boxShadow: isCurrent
              ? [
                  BoxShadow(
                      color: PavalonColors.gold.withValues(alpha: 0.35),
                      blurRadius: 10)
                ]
              : null,
        ),
        child: Column(
          children: [
            Icon(icon, color: iconColor, size: 16),
            const SizedBox(height: 4),
            Text('Quest ${quest.questNumber}',
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: isCurrent ? Colors.white : PavalonColors.slate300)),
            Text('${quest.teamSize} Knights',
                style: const TextStyle(
                    fontSize: 9, color: PavalonColors.slate400)),
          ],
        ),
      ),
    );
  }
}
