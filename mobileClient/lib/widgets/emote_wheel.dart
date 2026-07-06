import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/constants.dart';
import '../core/theme.dart';
import '../services/haptics.dart';
import '../state/game_provider.dart';

/// Emote / quick-chat picker. Opened from the in-game FAB or by shaking
/// the device.
class EmoteWheel {
  static Future<void> show(BuildContext context) {
    Haptics.tap();
    return showModalBottomSheet(
      context: context,
      backgroundColor: PavalonColors.slate900,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (sheetContext) {
        void send(String emote) {
          sheetContext.read<GameProvider>().sendEmote(emote);
          Haptics.confirm();
          Navigator.of(sheetContext).pop();
        }

        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 44,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                      color: PavalonColors.slate600,
                      borderRadius: BorderRadius.circular(2)),
                ),
                Text('React', style: eagle(18)),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  alignment: WrapAlignment.center,
                  children: [
                    for (final e in kEmoteEmojis)
                      _EmoteChip(
                          onTap: () => send(e),
                          child:
                              Text(e, style: const TextStyle(fontSize: 26))),
                  ],
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  alignment: WrapAlignment.center,
                  children: [
                    for (final p in kEmotePhrases)
                      _EmoteChip(
                        onTap: () => send(p),
                        child: Text(p,
                            style: const TextStyle(
                                fontSize: 13,
                                fontStyle: FontStyle.italic,
                                fontWeight: FontWeight.bold,
                                color: Colors.white)),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _EmoteChip extends StatelessWidget {
  final Widget child;
  final VoidCallback onTap;
  const _EmoteChip({required this.child, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: PavalonColors.slate800,
          borderRadius: BorderRadius.circular(14),
          border:
              Border.all(color: PavalonColors.gold.withValues(alpha: 0.35)),
        ),
        child: child,
      ),
    );
  }
}
