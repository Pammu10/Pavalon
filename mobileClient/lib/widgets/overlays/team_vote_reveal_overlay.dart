import 'dart:async';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../services/audio_service.dart';
import '../../services/haptics.dart';
import '../../state/game_provider.dart';
import 'flip_card.dart';

/// "The votes are in..." — flips every player's APPROVE/REJECT card,
/// then shows the tally. Timings ported from the web overlay.
class TeamVoteRevealOverlay extends StatefulWidget {
  final TeamVoteRevealData data;
  final VoidCallback onClose;
  const TeamVoteRevealOverlay(
      {super.key, required this.data, required this.onClose});

  @override
  State<TeamVoteRevealOverlay> createState() => _TeamVoteRevealOverlayState();
}

class _TeamVoteRevealOverlayState extends State<TeamVoteRevealOverlay> {
  static const _flipStart = Duration(milliseconds: 1600);
  static const _flipInterval = Duration(milliseconds: 480);
  static const _resultDelay = Duration(milliseconds: 600);
  static const _autoCloseAfterResult = Duration(milliseconds: 3800);

  int _revealed = 0;
  bool _showResult = false;
  final List<Timer> _timers = [];

  @override
  void initState() {
    super.initState();
    final audio = context.read<AudioService>();
    final n = widget.data.votes.length;
    for (var i = 0; i < n; i++) {
      _timers.add(Timer(_flipStart + _flipInterval * i, () {
        if (!mounted) return;
        setState(() => _revealed = i + 1);
        audio.play(Sfx.cardFan, overlay: true);
      }));
    }
    final resultAt = _flipStart + _flipInterval * n + _resultDelay;
    _timers.add(Timer(resultAt, () {
      if (!mounted) return;
      setState(() => _showResult = true);
      widget.data.wasApproved ? Haptics.success() : Haptics.failure();
    }));
    _timers.add(Timer(resultAt + _autoCloseAfterResult, widget.onClose));
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
    final approved = widget.data.wasApproved;
    final approveCount =
        widget.data.votes.where((v) => v.vote == 'APPROVE').length;
    final rejectCount = widget.data.votes.length - approveCount;

    return Material(
      color: Colors.black.withValues(alpha: 0.95),
      child: Stack(
        children: [
          Positioned.fill(
            child: AnimatedOpacity(
              opacity: 0.10,
              duration: const Duration(seconds: 1),
              child: Container(
                  color: approved
                      ? PavalonColors.goodDeep
                      : PavalonColors.evilDeep),
            ),
          ),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('The votes are in...',
                        textAlign: TextAlign.center,
                        style: eagle(30, shadows: [
                          const Shadow(
                              color: PavalonColors.gold, blurRadius: 24)
                        ])),
                    const SizedBox(height: 28),
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      alignment: WrapAlignment.center,
                      children: [
                        for (var i = 0; i < widget.data.votes.length; i++)
                          _voteCard(i),
                      ],
                    ),
                    const SizedBox(height: 28),
                    AnimatedScale(
                      scale: _showResult ? 1 : 0.6,
                      duration: const Duration(milliseconds: 400),
                      curve: Curves.elasticOut,
                      child: AnimatedOpacity(
                        opacity: _showResult ? 1 : 0,
                        duration: const Duration(milliseconds: 250),
                        child: Column(
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                _tally('$approveCount', 'APPROVE',
                                    PavalonColors.good),
                                const Padding(
                                  padding:
                                      EdgeInsets.symmetric(horizontal: 16),
                                  child: Text('vs',
                                      style: TextStyle(
                                          fontSize: 22,
                                          color: PavalonColors.slate600)),
                                ),
                                _tally('$rejectCount', 'REJECT',
                                    PavalonColors.evil),
                              ],
                            ),
                            const SizedBox(height: 16),
                            Text(
                              approved ? 'Team Approved!' : 'Team Rejected!',
                              style: eagle(34,
                                  color: approved
                                      ? PavalonColors.good
                                      : PavalonColors.evil),
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

  Widget _voteCard(int i) {
    final vote = widget.data.votes[i];
    final player = widget.data.players
        .where((p) => p.id == vote.playerId)
        .firstOrNull;
    final isApprove = vote.vote == 'APPROVE';
    return FlipCard(
      flipped: i < _revealed,
      width: 76,
      height: 104,
      back: Column(
        children: [
          const Expanded(child: CardBack()),
          const SizedBox(height: 3),
          Text(player?.name ?? 'Player',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style:
                  const TextStyle(fontSize: 9, color: PavalonColors.slate400)),
        ],
      ),
      front: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
              color: isApprove ? const Color(0xFF3B82F6) : const Color(0xFFEF4444),
              width: 2),
          gradient: LinearGradient(
            colors: isApprove
                ? [const Color(0xFF1E3A8A), const Color(0xFF172554)]
                : [const Color(0xFF7F1D1D), const Color(0xFF450A0A)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        padding: const EdgeInsets.all(4),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(isApprove ? LucideIcons.check : LucideIcons.x,
                size: 30,
                color: isApprove
                    ? const Color(0xFF93C5FD)
                    : const Color(0xFFFCA5A5)),
            const SizedBox(height: 4),
            Text(player?.name ?? 'Player',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.bold,
                    color: PavalonColors.slate300)),
            Text(isApprove ? 'APPROVE' : 'REJECT',
                style: TextStyle(
                    fontSize: 8,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.2,
                    color: isApprove
                        ? const Color(0xFF60A5FA)
                        : const Color(0xFFF87171))),
          ],
        ),
      ),
    );
  }

  Widget _tally(String n, String label, Color color) => Column(
        children: [
          Text(n,
              style: TextStyle(
                  fontSize: 42, fontWeight: FontWeight.bold, color: color)),
          Text(label,
              style: const TextStyle(
                  fontSize: 11,
                  letterSpacing: 2,
                  color: PavalonColors.slate400)),
        ],
      );
}
