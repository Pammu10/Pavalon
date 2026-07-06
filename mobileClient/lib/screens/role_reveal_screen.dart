import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:sensors_plus/sensors_plus.dart';
import '../core/constants.dart';
import '../core/theme.dart';
import '../models/models.dart';
import '../services/audio_service.dart';
import '../state/game_provider.dart';
import '../widgets/common.dart';
import '../widgets/player_tile.dart';

/// Dramatic identity reveal with gyroscope parallax on the portrait,
/// duty/strategy panels, vision list and the ready roster.
class RoleRevealScreen extends StatefulWidget {
  const RoleRevealScreen({super.key});
  @override
  State<RoleRevealScreen> createState() => _RoleRevealScreenState();
}

class _RoleRevealScreenState extends State<RoleRevealScreen> {
  StreamSubscription<GyroscopeEvent>? _gyro;
  double _tx = 0, _ty = 0;
  bool _stingPlayed = false;

  @override
  void initState() {
    super.initState();
    _gyro = gyroscopeEventStream().listen((e) {
      if (!mounted) return;
      setState(() {
        _tx = (_tx + e.y).clamp(-10.0, 10.0) * 0.9;
        _ty = (_ty + e.x).clamp(-10.0, 10.0) * 0.9;
      });
    }, onError: (_) {});
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final game = context.read<GameProvider>();
      if (!_stingPlayed && !game.hasViewedRole) {
        _stingPlayed = true;
        context.read<AudioService>().play(Sfx.roleReveal, duckBgm: true);
        Future.delayed(const Duration(seconds: 4), () {
          if (mounted) context.read<GameProvider>().setHasViewedRole();
        });
      }
    });
  }

  @override
  void dispose() {
    _gyro?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final game = context.watch<GameProvider>();
    final me = game.me;
    final role = me?.role;
    final info = role != null ? kRoles[role] : null;

    if (me == null || role == null || info == null) {
      return const Center(
          child: CircularProgressIndicator(color: PavalonColors.gold));
    }

    final isGood = info.alignment == Alignment2.good;
    final teamColor = isGood ? PavalonColors.good : PavalonColors.evil;
    final isReady = game.gameState.readyPlayers.contains(game.playerId);
    final isPaused = game.gameState.reconnectingPlayer != null;
    final visible = game.gameState.players
        .where((p) => p.visibleAs != null && p.id != me.id)
        .toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          Text('Your Identity', style: eagle(26, color: Colors.white)),
          const SizedBox(height: 20),
          // Portrait with gyro parallax + glow
          Transform(
            alignment: Alignment.center,
            transform: Matrix4.identity()
              ..setEntry(3, 2, 0.0012)
              ..rotateX(_ty * pi / 220)
              ..rotateY(-_tx * pi / 220),
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: 1),
              duration: const Duration(milliseconds: 1600),
              curve: Curves.easeOutCubic,
              builder: (context, v, child) => Opacity(
                opacity: v,
                child: Transform.rotate(angle: (1 - v) * -0.5, child: child),
              ),
              child: Container(
                width: 210,
                height: 210,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                      color: teamColor.withValues(alpha: 0.6), width: 4),
                  boxShadow: [
                    BoxShadow(
                        color: teamColor.withValues(alpha: 0.45),
                        blurRadius: 46,
                        spreadRadius: 4),
                  ],
                  image: DecorationImage(
                      image: AssetImage(info.img), fit: BoxFit.cover),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(role.wire, style: eagle(26, color: const Color(0xFFFCD34D))),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            decoration: BoxDecoration(
              color: teamColor.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(24),
              border:
                  Border.all(color: teamColor.withValues(alpha: 0.5), width: 2),
            ),
            child: Text(info.alignment.wire,
                style:
                    TextStyle(fontWeight: FontWeight.bold, color: teamColor)),
          ),
          const SizedBox(height: 20),
          _panel('Your Sacred Duty', info.description, info.strategy),
          if (visible.isNotEmpty) ...[
            const SizedBox(height: 14),
            PavalonCard(
              borderColor: const Color(0xFF92400E).withValues(alpha: 0.5),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Your Vision', style: eagle(16)),
                  const SizedBox(height: 4),
                  Text(info.vision,
                      style: const TextStyle(
                          fontSize: 12,
                          fontStyle: FontStyle.italic,
                          color: PavalonColors.slate400)),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      for (final p in visible)
                        PlayerTile(player: p, allowMarks: false, width: 92),
                    ],
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 16),
          _readyRoster(game),
          const SizedBox(height: 14),
          PavalonButton(
            label: isPaused
                ? 'Game Paused'
                : isReady
                    ? 'Waiting for others...'
                    : 'I Am Ready',
            expand: true,
            onPressed:
                isReady || isPaused ? null : () => game.playerReady(),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _panel(String title, String description, String strategy) {
    return PavalonCard(
      borderColor: const Color(0xFF92400E).withValues(alpha: 0.5),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: eagle(16)),
          const SizedBox(height: 8),
          Text(description,
              style: const TextStyle(
                  fontSize: 13.5, color: Color(0xFFFDE68A), height: 1.5)),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFF92400E).withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                  color: const Color(0xFFF59E0B).withValues(alpha: 0.3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Strategic Tips',
                    style: eagle(13, color: const Color(0xFFFBBF24))),
                const SizedBox(height: 4),
                Text(strategy,
                    style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFFFDE68A),
                        height: 1.4)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _readyRoster(GameProvider game) {
    final ready = game.gameState.readyPlayers.toSet();
    return PavalonCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        children: [
          Text('Player Status', style: eagle(14)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            alignment: WrapAlignment.center,
            children: [
              for (final p in game.gameState.players)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: ready.contains(p.id)
                        ? const Color(0xFF14532D).withValues(alpha: 0.6)
                        : PavalonColors.slate800,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                        color: ready.contains(p.id)
                            ? PavalonColors.success
                            : PavalonColors.slate600),
                  ),
                  child: Text(p.name,
                      style: TextStyle(
                          fontSize: 12,
                          color: ready.contains(p.id)
                              ? PavalonColors.success
                              : PavalonColors.slate300)),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
