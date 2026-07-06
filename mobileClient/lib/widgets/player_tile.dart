import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../core/constants.dart';
import '../core/theme.dart';
import '../models/models.dart';
import '../state/game_provider.dart';

/// Port of the web PlayerTile: bordered avatar card with name/title,
/// host / bot / leader / known-as badges, emote bubble, deduction mark
/// (long-press to cycle), selection ring, disconnect ghosting.
class PlayerTile extends StatelessWidget {
  final Player player;
  final bool isLeader;
  final bool isSelected;
  final VoidCallback? onTap;
  final bool allowMarks;
  final double width;

  const PlayerTile({
    super.key,
    required this.player,
    this.isLeader = false,
    this.isSelected = false,
    this.onTap,
    this.allowMarks = true,
    this.width = 104,
  });

  @override
  Widget build(BuildContext context) {
    final game = context.watch<GameProvider>();
    final isLocal = player.id == game.playerId;
    final mark = game.suspicionMarks[player.userId];
    final emote = game.activeEmotes[player.id];
    final borderSpec = kBorderStyles[player.selectedBorder];
    final icon = kIconMap[player.selectedIcon] ?? LucideIcons.gem;

    final tile = AnimatedScale(
      scale: isSelected ? 1.05 : 1.0,
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOutBack,
      child: Container(
        width: width,
        height: width * 4 / 3,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          gradient: borderSpec != null
              ? LinearGradient(
                  colors: borderSpec.gradient,
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight)
              : null,
          color: borderSpec == null ? PavalonColors.slate600 : null,
          boxShadow: [
            if (borderSpec != null)
              BoxShadow(
                  color: borderSpec.glow.withValues(alpha: 0.45),
                  blurRadius: 10,
                  spreadRadius: 1),
            if (isSelected)
              const BoxShadow(
                  color: PavalonColors.gold, blurRadius: 12, spreadRadius: 1),
          ],
        ),
        padding: const EdgeInsets.all(3.5),
        child: Container(
          decoration: BoxDecoration(
            color: PavalonColors.slate900.withValues(alpha: 0.85),
            borderRadius: BorderRadius.circular(11),
          ),
          child: Stack(
            children: [
              // Avatar
              Positioned.fill(
                bottom: 40,
                child: Center(
                  child: player.isDisconnected
                      ? const Icon(LucideIcons.ghost,
                          size: 40, color: PavalonColors.slate400)
                      : Icon(icon,
                          size: 40,
                          color: borderSpec?.glow ?? PavalonColors.gold),
                ),
              ),
              // Name + title box
              Positioned(
                left: 4,
                right: 4,
                bottom: 4,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.55),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(player.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 12.5,
                              color: Colors.white)),
                      SizedBox(
                        height: 14,
                        child: player.selectedTitle != null
                            ? Text(player.selectedTitle!,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    fontSize: 10,
                                    fontStyle: FontStyle.italic,
                                    fontWeight: FontWeight.bold,
                                    color: PavalonColors.goldBright))
                            : null,
                      ),
                    ],
                  ),
                ),
              ),
              // Status badges (top-right column)
              Positioned(
                top: 4,
                right: 4,
                child: Column(
                  children: [
                    if (player.isBot)
                      _badge(LucideIcons.bot, PavalonColors.slate700,
                          PavalonColors.slate300),
                    if (player.isHost)
                      _badge(LucideIcons.crown, const Color(0xFF854D0E),
                          PavalonColors.goldBright),
                    if (isLeader)
                      _badge(LucideIcons.crown, const Color(0xFF1E40AF),
                          PavalonColors.good),
                    if (player.visibleAs == 'Evil')
                      _badge(LucideIcons.eye, const Color(0xFF7F1D1D),
                          PavalonColors.evil),
                    if (player.visibleAs == 'Mystic')
                      _badge(LucideIcons.eye, const Color(0xFF581C87),
                          const Color(0xFFC084FC)),
                  ],
                ),
              ),
              // Deduction mark (top-left)
              if (!isLocal && mark != null)
                Positioned(top: 4, left: 4, child: _markBadge(mark)),
              // Selection check
              if (isSelected)
                Positioned(
                  top: 4,
                  left: 4,
                  child: Container(
                    width: 24,
                    height: 24,
                    decoration: const BoxDecoration(
                        color: PavalonColors.gold, shape: BoxShape.circle),
                    child: const Icon(LucideIcons.swords,
                        size: 14, color: Colors.white),
                  ),
                ),
            ],
          ),
        ),
      ),
    );

    return Opacity(
      opacity: player.isDisconnected ? 0.45 : 1,
      child: GestureDetector(
        onTap: onTap,
        onLongPress: allowMarks && !isLocal
            ? () => context.read<GameProvider>().cycleSuspicionMark(player.userId)
            : null,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            tile,
            // Emote bubble
            if (emote != null)
              Positioned(
                top: -14,
                left: 0,
                right: 0,
                child: Center(
                  child: TweenAnimationBuilder<double>(
                    key: ValueKey(emote.key),
                    tween: Tween(begin: 0, end: 1),
                    duration: const Duration(milliseconds: 350),
                    curve: Curves.elasticOut,
                    builder: (context, v, child) =>
                        Transform.scale(scale: v, child: child),
                    child: emote.emote.length > 2
                        ? Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: PavalonColors.slate900
                                  .withValues(alpha: 0.95),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                  color: PavalonColors.gold
                                      .withValues(alpha: 0.7)),
                            ),
                            child: Text(emote.emote,
                                style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    fontStyle: FontStyle.italic,
                                    color: Colors.white)),
                          )
                        : Text(emote.emote,
                            style: const TextStyle(fontSize: 26)),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _badge(IconData icon, Color bg, Color fg) => Container(
        width: 22,
        height: 22,
        margin: const EdgeInsets.only(bottom: 3),
        decoration: BoxDecoration(
            color: bg.withValues(alpha: 0.85), shape: BoxShape.circle),
        child: Icon(icon, size: 12, color: fg),
      );

  Widget _markBadge(SuspicionMark mark) {
    final (icon, bg, fg) = switch (mark) {
      SuspicionMark.trusted => (
          LucideIcons.shieldCheck,
          const Color(0xFF1E3A8A),
          PavalonColors.good
        ),
      SuspicionMark.suspect => (
          LucideIcons.helpCircle,
          const Color(0xFF78350F),
          const Color(0xFFFCD34D)
        ),
      SuspicionMark.evil => (
          LucideIcons.skull,
          const Color(0xFF7F1D1D),
          PavalonColors.evil
        ),
    };
    return Container(
      width: 22,
      height: 22,
      decoration: BoxDecoration(
          color: bg.withValues(alpha: 0.9),
          shape: BoxShape.circle,
          border: Border.all(color: fg, width: 1)),
      child: Icon(icon, size: 12, color: fg),
    );
  }
}
