import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../state/game_provider.dart';
import '../common.dart';

/// Blocking dialog while a restart vote is live (port of RestartVoteOverlay).
class RestartVoteOverlay extends StatefulWidget {
  final RestartVote vote;
  const RestartVoteOverlay({super.key, required this.vote});

  @override
  State<RestartVoteOverlay> createState() => _RestartVoteOverlayState();
}

class _RestartVoteOverlayState extends State<RestartVoteOverlay> {
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    _tick = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final game = context.watch<GameProvider>();
    final secondsLeft =
        ((widget.vote.endsAt - DateTime.now().millisecondsSinceEpoch) / 1000)
            .ceil()
            .clamp(0, 999);
    final myVote =
        game.playerId != null ? widget.vote.votes[game.playerId] : null;
    final yes = widget.vote.votes.values.where((v) => v == 'yes').length;
    final total = game.gameState.players
        .where((p) => p.status == 'CONNECTED')
        .length;

    return Material(
      color: Colors.black.withValues(alpha: 0.8),
      child: Center(
        child: PavalonCard(
          borderColor: PavalonColors.gold.withValues(alpha: 0.6),
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Restart Vote', style: eagle(24)),
              const SizedBox(height: 8),
              Text('${widget.vote.initiatorName} wants to restart the game.',
                  textAlign: TextAlign.center),
              const SizedBox(height: 6),
              Text('$yes / $total voted yes · ${secondsLeft}s left',
                  style: const TextStyle(
                      color: PavalonColors.slate400, fontSize: 13)),
              const SizedBox(height: 18),
              if (myVote == null)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    PavalonButton(
                        label: 'Yes, restart',
                        onPressed: () => game.voteOnRestart('yes')),
                    const SizedBox(width: 12),
                    PavalonButton(
                        label: 'No',
                        variant: PavalonButtonVariant.secondary,
                        onPressed: () => game.voteOnRestart('no')),
                  ],
                )
              else
                Text('You voted "$myVote". Waiting for others...',
                    style: const TextStyle(color: PavalonColors.slate400)),
            ],
          ),
        ),
      ),
    );
  }
}
