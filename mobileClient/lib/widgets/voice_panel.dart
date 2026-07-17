import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../services/voice_service.dart';
import '../state/auth_provider.dart';
import '../state/game_provider.dart';

/// Voice chat controls: connection status + per-player mute/volume, shown
/// as a bottom sheet from the in-game chrome (mirrors ChatPanel.show).
class VoicePanel extends StatelessWidget {
  const VoicePanel({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) =>
          const FractionallySizedBox(heightFactor: 0.6, child: VoicePanel()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final myUserId = context.watch<AuthProvider>().user?.id;
    final players = context
        .watch<GameProvider>()
        .gameState
        .players
        .where((p) => !p.isBot && p.userId != myUserId)
        .toList();

    return Container(
      decoration: const BoxDecoration(
        color: PavalonColors.slate900,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        border: Border(top: BorderSide(color: PavalonColors.slate700)),
      ),
      child: Consumer<VoiceService>(
        builder: (context, voice, _) => Column(
          children: [
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 14),
              child: Text('Voice Chat',
                  style: TextStyle(
                      fontFamily: 'EagleLake',
                      fontSize: 18,
                      color: PavalonColors.gold)),
            ),
            if (voice.status != VoiceStatus.connected)
              _statusRow(voice.status),
            Expanded(
              child: players.isEmpty
                  ? const Center(
                      child: Text('No other players',
                          style: TextStyle(color: PavalonColors.slate400)))
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: players.length,
                      itemBuilder: (context, i) {
                        final p = players[i];
                        final state = voice.peerState(p.userId);
                        final speaking = voice.isPeerSpeaking(p.userId);
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          child: Row(
                            children: [
                              Expanded(
                                flex: 2,
                                child: Text(p.name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        color: speaking
                                            ? Colors.greenAccent
                                            : Colors.white)),
                              ),
                              IconButton(
                                icon: Icon(
                                    state.isMuted
                                        ? LucideIcons.volumeX
                                        : LucideIcons.volume2,
                                    color: state.isMuted
                                        ? PavalonColors.evil
                                        : PavalonColors.slate300),
                                onPressed: () => voice.togglePeerMute(p.userId),
                              ),
                              Expanded(
                                flex: 3,
                                child: Slider(
                                  value: state.volume,
                                  onChanged: state.isMuted
                                      ? null
                                      : (v) => voice.setPeerVolume(p.userId, v),
                                  activeColor: PavalonColors.gold,
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }

  Widget _statusRow(VoiceStatus status) {
    final text = switch (status) {
      VoiceStatus.connecting => 'Connecting...',
      VoiceStatus.reconnecting => 'Reconnecting...',
      VoiceStatus.permissionDenied =>
        'Microphone permission denied - enable it in system settings',
      _ => 'Voice disconnected',
    };
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Text(text,
          textAlign: TextAlign.center,
          style: const TextStyle(
              fontSize: 12,
              fontStyle: FontStyle.italic,
              color: PavalonColors.slate400)),
    );
  }
}
