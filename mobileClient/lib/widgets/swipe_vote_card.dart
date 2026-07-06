import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../core/theme.dart';
import '../services/haptics.dart';

/// Port of the web SwipeableCard: drag the crown orb fully right/left to
/// lock in a vote. Left can be disabled (Good players can't vote FAIL).
class SwipeVoteCard extends StatefulWidget {
  final String title;
  final String rightLabel;
  final String leftLabel;
  final VoidCallback onSwipeRight;
  final VoidCallback onSwipeLeft;
  final bool disabled;
  final bool leftSwipeDisabled;

  const SwipeVoteCard({
    super.key,
    required this.title,
    required this.rightLabel,
    required this.leftLabel,
    required this.onSwipeRight,
    required this.onSwipeLeft,
    this.disabled = false,
    this.leftSwipeDisabled = false,
  });

  @override
  State<SwipeVoteCard> createState() => _SwipeVoteCardState();
}

class _SwipeVoteCardState extends State<SwipeVoteCard> {
  double _x = 0;
  String? _locked; // 'left' | 'right'

  static const _orb = 56.0;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(widget.title, style: eagle(22)),
        const SizedBox(height: 12),
        LayoutBuilder(builder: (context, box) {
          final trackWidth = box.maxWidth.clamp(0.0, 360.0);
          final maxOffset = (trackWidth - _orb) / 2;

          void onEnd(DragEndDetails _) {
            if (widget.disabled || _locked != null) return;
            if (_x >= maxOffset - 4) {
              setState(() => _locked = 'right');
              Haptics.confirm();
              widget.onSwipeRight();
            } else if (_x <= -maxOffset + 4 && !widget.leftSwipeDisabled) {
              setState(() => _locked = 'left');
              Haptics.confirm();
              widget.onSwipeLeft();
            } else {
              setState(() => _x = 0);
            }
          }

          final rightFrac = (_x / maxOffset).clamp(0.0, 1.0);
          final leftFrac = (-_x / maxOffset).clamp(0.0, 1.0);

          return Center(
            child: SizedBox(
              width: trackWidth,
              height: 64,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(32),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Container(
                      decoration: BoxDecoration(
                        color: PavalonColors.slate900.withValues(alpha: 0.85),
                        borderRadius: BorderRadius.circular(32),
                        border: Border.all(
                            color: PavalonColors.slate400
                                .withValues(alpha: 0.3)),
                      ),
                    ),
                    // Red fill from the left
                    if (!widget.leftSwipeDisabled)
                      Align(
                        alignment: Alignment.centerLeft,
                        child: FractionallySizedBox(
                          widthFactor: leftFrac,
                          child: Container(
                            height: 64,
                            color: const Color(0xFFDC2626)
                                .withValues(alpha: _locked == 'right' ? 0.3 : 1),
                            alignment: Alignment.centerLeft,
                            padding: const EdgeInsets.only(left: 18),
                            child: _fillLabel(
                                LucideIcons.x, widget.leftLabel, leftFrac),
                          ),
                        ),
                      ),
                    // Blue fill from the right
                    Align(
                      alignment: Alignment.centerRight,
                      child: FractionallySizedBox(
                        widthFactor: rightFrac,
                        child: Container(
                          height: 64,
                          color: const Color(0xFF2563EB)
                              .withValues(alpha: _locked == 'left' ? 0.3 : 1),
                          alignment: Alignment.centerRight,
                          padding: const EdgeInsets.only(right: 18),
                          child: _fillLabel(
                              LucideIcons.check, widget.rightLabel, rightFrac,
                              trailingIcon: true),
                        ),
                      ),
                    ),
                    // Draggable orb
                    AnimatedPositioned(
                      duration: _x == 0
                          ? const Duration(milliseconds: 250)
                          : Duration.zero,
                      curve: Curves.easeOutBack,
                      left: (trackWidth - _orb) / 2 + _x,
                      child: GestureDetector(
                        onHorizontalDragUpdate: widget.disabled ||
                                _locked != null
                            ? null
                            : (d) => setState(() {
                                  final min = widget.leftSwipeDisabled
                                      ? 0.0
                                      : -maxOffset;
                                  _x = (_x + d.delta.dx)
                                      .clamp(min, maxOffset);
                                }),
                        onHorizontalDragEnd: onEnd,
                        child: Container(
                          width: _orb,
                          height: _orb,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: PavalonColors.slate400.withValues(
                                alpha: _locked != null ? 0.55 : 0.35),
                            border: Border.all(
                                color: Colors.white.withValues(alpha: 0.35),
                                width: 2),
                            boxShadow: const [
                              BoxShadow(
                                  color: Colors.black54, blurRadius: 8)
                            ],
                          ),
                          child: Icon(
                            _locked == 'right'
                                ? LucideIcons.check
                                : _locked == 'left'
                                    ? LucideIcons.x
                                    : rightFrac > 0.5
                                        ? LucideIcons.check
                                        : leftFrac > 0.5
                                            ? LucideIcons.x
                                            : LucideIcons.crown,
                            color: _locked == 'right' || rightFrac > 0.5
                                ? const Color(0xFF93C5FD)
                                : _locked == 'left' || leftFrac > 0.5
                                    ? const Color(0xFFFCA5A5)
                                    : PavalonColors.goldBright,
                            size: 28,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }),
        const SizedBox(height: 8),
        Text(
          widget.leftSwipeDisabled
              ? 'Swipe right to ${widget.rightLabel.toLowerCase()}'
              : 'Swipe right: ${widget.rightLabel} · left: ${widget.leftLabel}',
          style: const TextStyle(fontSize: 12, color: PavalonColors.slate400),
        ),
      ],
    );
  }

  Widget _fillLabel(IconData icon, String label, double frac,
      {bool trailingIcon = false}) {
    final children = [
      Icon(icon, size: 18, color: Colors.white),
      const SizedBox(width: 6),
      Text(label,
          style: const TextStyle(
              fontFamily: 'EagleLake',
              fontWeight: FontWeight.bold,
              color: Colors.white)),
    ];
    return Opacity(
      opacity: frac.clamp(0.0, 1.0),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: trailingIcon ? children.reversed.toList() : children,
      ),
    );
  }
}
