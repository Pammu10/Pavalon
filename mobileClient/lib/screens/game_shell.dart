import 'dart:async';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../models/models.dart';
import '../services/shake_detector.dart';
import '../state/game_provider.dart';
import '../widgets/chat_panel.dart';
import '../widgets/emote_wheel.dart';
import '../widgets/overlays/restart_vote_overlay.dart';
import '../widgets/overlays/tutorial_overlay.dart';
import 'dragons_breath_screen.dart';
import 'end_game_screen.dart';
import 'game_screen.dart';
import 'lobby_screen.dart';
import 'role_reveal_screen.dart';

/// In-room shell: renders the right screen for the current phase and owns
/// the game chrome — chat/emote buttons (shake also opens emotes), the
/// reconnection banner, restart-vote and tutorial overlays.
class GameShell extends StatefulWidget {
  const GameShell({super.key});
  @override
  State<GameShell> createState() => _GameShellState();
}

class _GameShellState extends State<GameShell> {
  ShakeDetector? _shake;
  Timer? _reconnectTick;
  bool _emoteOpen = false;

  @override
  void initState() {
    super.initState();
    _shake = ShakeDetector(onShake: () {
      final phase = context.read<GameProvider>().gameState.phase;
      const emotePhases = [
        GamePhase.teamSelection,
        GamePhase.teamVote,
        GamePhase.questVote,
        GamePhase.questResult,
        GamePhase.assassination,
        GamePhase.lobby,
      ];
      if (!_emoteOpen && emotePhases.contains(phase)) {
        _emoteOpen = true;
        EmoteWheel.show(context).whenComplete(() => _emoteOpen = false);
      }
    })
      ..start();
    // Ticks the reconnect countdown banner.
    _reconnectTick = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted &&
          context.read<GameProvider>().gameState.reconnectingPlayer != null) {
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    _shake?.stop();
    _reconnectTick?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final game = context.watch<GameProvider>();
    final state = game.gameState;

    final Widget body = switch (state.phase) {
      GamePhase.lobby || GamePhase.home => const LobbyScreen(),
      GamePhase.roleReveal => const RoleRevealScreen(),
      GamePhase.endGame => const EndGameScreen(),
      GamePhase.dragonsBreath => const DragonsBreathScreen(),
      _ => const GameScreen(),
    };

    const chromePhases = [
      GamePhase.lobby,
      GamePhase.teamSelection,
      GamePhase.teamVote,
      GamePhase.questVote,
      GamePhase.questResult,
      GamePhase.assassination,
      GamePhase.endGame,
    ];
    final showChrome =
        chromePhases.contains(state.phase) && state.tutorial == null;

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF17153A), PavalonColors.slate900],
          ),
        ),
        child: SafeArea(
          child: Stack(
            children: [
              Positioned.fill(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 350),
                  switchInCurve: Curves.easeOut,
                  switchOutCurve: Curves.easeIn,
                  transitionBuilder: (child, anim) => FadeTransition(
                    opacity: anim,
                    child: SlideTransition(
                      position: Tween(
                              begin: const Offset(0.04, 0),
                              end: Offset.zero)
                          .animate(anim),
                      child: child,
                    ),
                  ),
                  child: KeyedSubtree(
                      key: ValueKey(state.phase), child: body),
                ),
              ),
              // Reconnection banner
              if (state.reconnectingPlayer != null)
                Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  child: Container(
                    color: const Color(0xFFCA8A04).withValues(alpha: 0.92),
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white)),
                        const SizedBox(width: 10),
                        Text(
                          'Waiting for ${state.reconnectingPlayer!.name} to reconnect... '
                          '${((state.reconnectingPlayer!.endsAt - DateTime.now().millisecondsSinceEpoch) / 1000).ceil().clamp(0, 99)}s',
                          style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              color: Colors.white),
                        ),
                      ],
                    ),
                  ),
                ),
              // Restart vote
              if (state.restartVote != null)
                Positioned.fill(
                    child: RestartVoteOverlay(vote: state.restartVote!)),
              // Tutorial overlay (server-driven)
              if (state.tutorial != null)
                Positioned.fill(
                    child: TutorialOverlay(step: state.tutorial!)),
            ],
          ),
        ),
      ),
      floatingActionButton: showChrome
          ? Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                FloatingActionButton.small(
                  heroTag: 'emote',
                  backgroundColor: PavalonColors.slate800,
                  foregroundColor: PavalonColors.goldBright,
                  onPressed: () => EmoteWheel.show(context),
                  child: const Icon(LucideIcons.smile),
                ),
                const SizedBox(height: 10),
                FloatingActionButton(
                  heroTag: 'chat',
                  backgroundColor: PavalonColors.slate800,
                  foregroundColor: PavalonColors.goldBright,
                  onPressed: () => ChatPanel.show(context),
                  child: const Icon(LucideIcons.messageSquare),
                ),
              ],
            )
          : null,
    );
  }
}
