import 'dart:async';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../models/models.dart';
import '../services/shake_detector.dart';
import '../services/voice_service.dart';
import '../state/game_provider.dart';
import '../widgets/chat_panel.dart';
import '../widgets/dynamic_background.dart';
import '../widgets/emote_wheel.dart';
import '../widgets/overlays/restart_vote_overlay.dart';
import '../widgets/overlays/tutorial_overlay.dart';
import '../widgets/voice_panel.dart';
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
      body: DynamicBackground(
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
              // Bottom chrome (chat/emote) — slides away off-phase.
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: IgnorePointer(
                  ignoring: !showChrome,
                  child: AnimatedSlide(
                    duration: const Duration(milliseconds: 300),
                    curve: Curves.easeOut,
                    offset: showChrome ? Offset.zero : const Offset(0, 1.3),
                    child: AnimatedOpacity(
                      duration: const Duration(milliseconds: 220),
                      opacity: showChrome ? 1 : 0,
                      child: _BottomChromeBar(
                        onEmote: () => EmoteWheel.show(context),
                        onChat: () => ChatPanel.show(context),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Floating emote/chat buttons in the bottom corners, matching the web's
/// circular gold-ringed action buttons.
class _BottomChromeBar extends StatelessWidget {
  final VoidCallback onEmote;
  final VoidCallback onChat;
  const _BottomChromeBar({required this.onEmote, required this.onChat});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            _chromeButton(LucideIcons.smile, 'Emotes', onEmote),
            Consumer<VoiceService>(
              builder: (context, voice, _) => _chromeButton(
                voice.isMuted ? LucideIcons.micOff : LucideIcons.mic,
                'Mic',
                () => context.read<VoiceService>().toggleMute(),
                muted: voice.isMuted,
              ),
            ),
            _chromeButton(
                LucideIcons.headphones, 'Voice', () => VoicePanel.show(context)),
            _chromeButton(LucideIcons.messageSquare, 'Chat', onChat),
          ],
        ),
      ),
    );
  }

  Widget _chromeButton(IconData icon, String label, VoidCallback onTap,
      {bool muted = false}) {
    final ringColor = muted ? PavalonColors.evil : PavalonColors.gold;
    final iconColor = muted ? PavalonColors.evil : PavalonColors.goldBright;
    return Semantics(
      button: true,
      label: label,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            color: PavalonColors.slate900.withValues(alpha: 0.85),
            shape: BoxShape.circle,
            border: Border.all(color: ringColor, width: 2),
            boxShadow: const [
              BoxShadow(
                  color: Colors.black54, blurRadius: 12, offset: Offset(0, 4)),
            ],
          ),
          child: Icon(icon, color: iconColor, size: 24),
        ),
      ),
    );
  }
}
