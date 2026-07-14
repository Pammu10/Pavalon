import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../services/haptics.dart';

/// "GOOD PREVAILS / EVIL TRIUMPHS" full-screen moment with rising
/// particles. Audio is owned by EndGameScreen (single-owner rule, ported
/// from the web fix).
class GameEndOverlay extends StatefulWidget {
  final Alignment2 winner;
  final VoidCallback onClose;
  const GameEndOverlay({super.key, required this.winner, required this.onClose});

  @override
  State<GameEndOverlay> createState() => _GameEndOverlayState();
}

class _Particle {
  final double x, size, delay, duration, drift;
  final Color color;
  _Particle(this.x, this.size, this.color, this.delay, this.duration, this.drift);
}

class _GameEndOverlayState extends State<GameEndOverlay>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
      vsync: this, duration: const Duration(seconds: 6))
    ..repeat();
  late final List<_Particle> _particles;
  Timer? _closeTimer;

  @override
  void initState() {
    super.initState();
    Haptics.dramatic();
    final rng = Random();
    final goodWin = widget.winner == Alignment2.good;
    final palette = goodWin
        ? [const Color(0xFF60A5FA), const Color(0xFF93C5FD), const Color(0xFFBFDBFE), const Color(0xFFA5F3FC)]
        : [const Color(0xFFF87171), const Color(0xFFFCA5A5), const Color(0xFFEF4444), const Color(0xFFFCD34D)];
    _particles = List.generate(36, (i) {
      return _Particle(
        rng.nextDouble(),
        4 + rng.nextDouble() * 8,
        palette[rng.nextInt(palette.length)],
        rng.nextDouble() * 0.5,
        0.45 + rng.nextDouble() * 0.4,
        (rng.nextDouble() - 0.5) * 80,
      );
    });
    _closeTimer = Timer(const Duration(seconds: 9), widget.onClose);
  }

  @override
  void dispose() {
    _closeTimer?.cancel();
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final goodWin = widget.winner == Alignment2.good;
    final color = goodWin ? PavalonColors.good : PavalonColors.evil;
    final glow = goodWin ? PavalonColors.goodDeep : PavalonColors.evilDeep;

    return Material(
      color: Colors.black,
      child: Stack(
        children: [
          // Screen flash → soft persistent glow
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0.7, end: 0.1),
            duration: const Duration(milliseconds: 1400),
            curve: Curves.easeOut,
            builder: (context, v, _) =>
                Positioned.fill(child: Container(color: glow.withValues(alpha: v))),
          ),
          // Particles
          AnimatedBuilder(
            animation: _c,
            builder: (context, _) {
              final h = MediaQuery.sizeOf(context).height;
              final w = MediaQuery.sizeOf(context).width;
              return Stack(
                children: [
                  for (final p in _particles)
                    () {
                      final t = ((_c.value - p.delay) / p.duration) % 1.0;
                      if (t < 0) return const SizedBox.shrink();
                      return Positioned(
                        left: p.x * w + p.drift * t,
                        bottom: t * (h + 40) - 20,
                        child: Opacity(
                          opacity: (1 - t).clamp(0.0, 1.0),
                          child: Container(
                            width: p.size,
                            height: p.size,
                            decoration: BoxDecoration(
                                color: p.color, shape: BoxShape.circle),
                          ),
                        ),
                      );
                    }(),
                ],
              );
            },
          ),
          SafeArea(
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TweenAnimationBuilder<double>(
                    tween: Tween(begin: 0, end: 1),
                    duration: const Duration(milliseconds: 700),
                    curve: Curves.elasticOut,
                    builder: (context, v, child) =>
                        Transform.scale(scale: v, child: child),
                    child: Container(
                      width: 130,
                      height: 130,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: color, width: 4),
                        boxShadow: [
                          BoxShadow(
                              color: glow.withValues(alpha: 0.5),
                              blurRadius: 40,
                              spreadRadius: 6)
                        ],
                      ),
                      child: Icon(
                          goodWin ? LucideIcons.shieldCheck : LucideIcons.skull,
                          size: 60,
                          color: color),
                    ),
                  ),
                  const SizedBox(height: 24),
                  TweenAnimationBuilder<double>(
                    tween: Tween(begin: 0, end: 1),
                    duration: const Duration(milliseconds: 900),
                    curve: Curves.easeOutBack,
                    builder: (context, v, child) => Opacity(
                        opacity: v.clamp(0.0, 1.0),
                        child: Transform.translate(
                            offset: Offset(0, 24 * (1 - v)), child: child)),
                    child: Text(
                      goodWin ? 'GOOD PREVAILS' : 'EVIL TRIUMPHS',
                      textAlign: TextAlign.center,
                      style: eagle(34, color: color, shadows: [
                        Shadow(color: glow, blurRadius: 28),
                      ]),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 40),
                    child: Text(
                      goodWin
                          ? 'The light has prevailed. The kingdom is safe — for now.'
                          : 'Darkness has consumed Avalon. Evil stands victorious.',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                          fontStyle: FontStyle.italic,
                          color: Colors.white70,
                          fontSize: 15),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
