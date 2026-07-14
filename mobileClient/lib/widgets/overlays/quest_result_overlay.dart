import 'dart:async';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../services/audio_service.dart';
import '../../services/haptics.dart';
import 'flip_card.dart';

/// "Quest results are in..." — sting, anonymous card flips, verdict.
/// Auto-closes at 7.5s, before the server advances the phase at 8s.
class QuestResultOverlay extends StatefulWidget {
  final bool isSuccess;
  final int successVotes;
  final int failVotes;
  final int failsRequired;
  final VoidCallback onClose;

  const QuestResultOverlay({
    super.key,
    required this.isSuccess,
    required this.successVotes,
    required this.failVotes,
    required this.failsRequired,
    required this.onClose,
  });

  @override
  State<QuestResultOverlay> createState() => _QuestResultOverlayState();
}

class _QuestResultOverlayState extends State<QuestResultOverlay> {
  static const _cardRevealStart = Duration(milliseconds: 3000);
  static const _cardRevealInterval = Duration(milliseconds: 520);
  static const _resultShowDelay = Duration(milliseconds: 700);
  static const _autoCloseDelay = Duration(milliseconds: 7500);

  int _revealed = 0;
  bool _showResult = false;
  final List<Timer> _timers = [];

  @override
  void initState() {
    super.initState();
    final audio = context.read<AudioService>();
    audio.play(widget.isSuccess ? Sfx.questSuccess : Sfx.questFail,
        duckBgm: true);
    final total = widget.successVotes + widget.failVotes;
    for (var i = 0; i < total; i++) {
      _timers.add(Timer(_cardRevealStart + _cardRevealInterval * i, () {
        if (!mounted) return;
        setState(() => _revealed = i + 1);
        audio.play(Sfx.cardFan, overlay: true);
      }));
    }
    _timers.add(Timer(
        _cardRevealStart + _cardRevealInterval * total + _resultShowDelay, () {
      if (!mounted) return;
      setState(() => _showResult = true);
      widget.isSuccess ? Haptics.success() : Haptics.failure();
    }));
    _timers.add(Timer(_autoCloseDelay, widget.onClose));
  }

  @override
  void dispose() {
    for (final t in _timers) {
      t.cancel();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ok = widget.isSuccess;
    final votes = [
      ...List.filled(widget.successVotes, 'SUCCESS'),
      ...List.filled(widget.failVotes, 'FAIL'),
    ];
    final color = ok ? PavalonColors.good : PavalonColors.evil;

    return Material(
      color: Colors.black.withValues(alpha: 0.94),
      child: Stack(
        children: [
          Positioned.fill(
              child: Opacity(
                  opacity: 0.08,
                  child: Container(
                      color:
                          ok ? PavalonColors.goodDeep : PavalonColors.evilDeep))),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('Quest results are in...',
                        textAlign: TextAlign.center,
                        style: eagle(28, shadows: [
                          const Shadow(
                              color: PavalonColors.gold, blurRadius: 20)
                        ])),
                    const SizedBox(height: 32),
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      alignment: WrapAlignment.center,
                      children: [
                        for (var i = 0; i < votes.length; i++)
                          FlipCard(
                            flipped: i < _revealed,
                            width: 60,
                            height: 84,
                            back: const CardBack(),
                            front: _resultFace(votes[i] == 'SUCCESS'),
                          ),
                      ],
                    ),
                    const SizedBox(height: 32),
                    AnimatedScale(
                      scale: _showResult ? 1 : 0.7,
                      duration: const Duration(milliseconds: 450),
                      curve: Curves.elasticOut,
                      child: AnimatedOpacity(
                        opacity: _showResult ? 1 : 0,
                        duration: const Duration(milliseconds: 250),
                        child: Column(
                          children: [
                            Container(
                              width: 88,
                              height: 88,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(color: color, width: 4),
                                boxShadow: [
                                  BoxShadow(
                                      color: color.withValues(alpha: 0.4),
                                      blurRadius: 24)
                                ],
                              ),
                              child: Icon(
                                  ok
                                      ? LucideIcons.shieldCheck
                                      : LucideIcons.shieldClose,
                                  size: 44,
                                  color: color),
                            ),
                            const SizedBox(height: 16),
                            Text(ok ? 'QUEST PASSED' : 'QUEST FAILED',
                                style: eagle(32, color: color)),
                            const SizedBox(height: 8),
                            Text(
                              '${widget.failVotes} fail vote'
                              '${widget.failVotes != 1 ? 's' : ''} · '
                              '${widget.failsRequired} needed to fail',
                              style: const TextStyle(
                                  color: PavalonColors.slate400, fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _resultFace(bool success) {
    final color = success ? const Color(0xFF3B82F6) : const Color(0xFFEF4444);
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color, width: 2),
        gradient: LinearGradient(
          colors: success
              ? [const Color(0xFF1E3A8A), const Color(0xFF172554)]
              : [const Color(0xFF7F1D1D), const Color(0xFF450A0A)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Icon(success ? LucideIcons.shieldCheck : LucideIcons.shieldClose,
          size: 30,
          color:
              success ? const Color(0xFF93C5FD) : const Color(0xFFFCA5A5)),
    );
  }
}
