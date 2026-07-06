import 'dart:math';
import 'package:flutter/material.dart';

/// A card that 3D-flips from [back] to [front] when [flipped] becomes true.
class FlipCard extends StatelessWidget {
  final bool flipped;
  final Widget back;
  final Widget front;
  final double width;
  final double height;

  const FlipCard({
    super.key,
    required this.flipped,
    required this.back,
    required this.front,
    this.width = 72,
    this.height = 100,
  });

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: flipped ? pi : 0),
      duration: const Duration(milliseconds: 550),
      curve: Curves.easeInOutCubic,
      builder: (context, angle, _) {
        final showFront = angle > pi / 2;
        return Transform(
          alignment: Alignment.center,
          transform: Matrix4.identity()
            ..setEntry(3, 2, 0.0015)
            ..rotateY(angle),
          child: SizedBox(
            width: width,
            height: height,
            child: showFront
                ? Transform(
                    alignment: Alignment.center,
                    transform: Matrix4.identity()..rotateY(pi),
                    child: front,
                  )
                : back,
          ),
        );
      },
    );
  }
}

/// Standard decorative back used by every reveal card.
class CardBack extends StatelessWidget {
  const CardBack({super.key});
  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF475569), width: 2),
        gradient: const LinearGradient(
          colors: [Color(0xFF334155), Color(0xFF0F172A)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Center(
        child: Container(
          width: 18,
          height: 18,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(
                color: const Color(0xFF64748B).withValues(alpha: 0.6),
                width: 2),
          ),
        ),
      ),
    );
  }
}
