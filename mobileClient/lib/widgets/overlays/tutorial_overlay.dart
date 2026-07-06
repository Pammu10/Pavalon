import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../services/session_store.dart';
import '../../state/game_provider.dart';
import '../common.dart';

/// Server-driven tutorial companion. Mobile treatment: a non-blocking
/// bottom card with step dots, instructions and the required action —
/// the game UI stays fully interactive (the server ignores off-script
/// actions), matching the web fix.
class TutorialOverlay extends StatelessWidget {
  final TutorialStep step;
  const TutorialOverlay({super.key, required this.step});

  @override
  Widget build(BuildContext context) {
    final game = context.read<GameProvider>();

    void finish() {
      context.read<SessionStore>().markTutorialSeen();
      game.leaveRoom();
    }

    return IgnorePointer(
      ignoring: false,
      child: Align(
        alignment: Alignment.bottomCenter,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: PavalonCard(
            borderColor: PavalonColors.gold.withValues(alpha: 0.9),
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Step dots + skip
                Row(
                  children: [
                    const Spacer(),
                    for (var i = 1; i <= 7; i++)
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 300),
                        width: i == step.step ? 22 : 12,
                        height: 5,
                        margin: const EdgeInsets.symmetric(horizontal: 2),
                        decoration: BoxDecoration(
                          color: i == step.step
                              ? PavalonColors.goldBright
                              : i < step.step
                                  ? PavalonColors.gold
                                  : PavalonColors.slate600,
                          borderRadius: BorderRadius.circular(3),
                        ),
                      ),
                    Text('  ${step.step}/7',
                        style: const TextStyle(
                            fontSize: 11, color: PavalonColors.slate500)),
                    const Spacer(),
                    if (!step.isFinalStep)
                      GestureDetector(
                        onTap: () => _confirmSkip(context, finish),
                        child: const Icon(LucideIcons.x,
                            size: 18, color: PavalonColors.slate400),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(step.title, style: eagle(19), textAlign: TextAlign.center),
                const SizedBox(height: 6),
                Text(
                  // Server text carries light HTML for the web; strip tags.
                  step.text.replaceAll(RegExp(r'<[^>]+>'), ''),
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      fontSize: 13.5,
                      color: PavalonColors.slate200,
                      height: 1.45),
                ),
                const SizedBox(height: 12),
                if (step.actionRequired != null)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: PavalonColors.gold.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: PavalonColors.gold.withValues(alpha: 0.55)),
                    ),
                    child: Row(
                      children: [
                        const Icon(LucideIcons.hand,
                            size: 18, color: PavalonColors.goldBright),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            step.actionText ??
                                'Perform the highlighted action to continue',
                            style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFFFDE68A)),
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  PavalonButton(
                    label: step.isFinalStep ? '🎉 Start Playing' : 'Next →',
                    expand: true,
                    onPressed: step.isFinalStep
                        ? finish
                        : () => game.advanceTutorial(),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _confirmSkip(BuildContext context, VoidCallback onSkip) {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: PavalonColors.slate900,
        title: Text('Leave Tutorial?', style: eagle(20)),
        content: const Text('You can replay it anytime from Settings.',
            style: TextStyle(color: PavalonColors.slate300)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Keep Going'),
          ),
          PavalonButton(
            label: 'Skip',
            variant: PavalonButtonVariant.danger,
            onPressed: () {
              Navigator.of(dialogContext).pop();
              onSkip();
            },
          ),
        ],
      ),
    );
  }
}
