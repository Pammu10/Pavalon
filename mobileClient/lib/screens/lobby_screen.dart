import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import '../core/constants.dart';
import '../core/theme.dart';
import '../models/models.dart';
import '../services/haptics.dart';
import '../state/game_provider.dart';
import '../widgets/common.dart';
import '../widgets/player_tile.dart';

/// Result of the lobby role math (ported from LobbyScreen.tsx so behaviour
/// matches the server's validation exactly). Pure + unit-tested.
class RoleSetup {
  final List<Role> finalRoles;
  final bool isValid;
  final String message;
  final bool goodFull;
  final bool evilFull;
  const RoleSetup(
      this.finalRoles, this.isValid, this.message, this.goodFull, this.evilFull);
}

RoleSetup computeRoleSetup(Set<Role> selected, int playerCount) {
  if (playerCount < 5) {
    return const RoleSetup([], false, 'Need at least 5 players.', true, true);
  }
  final requiredEvil = kEvilPlayerCount[playerCount] ?? 0;
  final requiredGood = playerCount - requiredEvil;

  final specialGood = selected
      .where((r) =>
          kRoles[r]!.alignment == Alignment2.good && r != Role.merlin)
      .length;
  final specialEvil = selected
      .where((r) =>
          kRoles[r]!.alignment == Alignment2.evil && r != Role.assassin)
      .length;
  final goodFull = 1 + specialGood >= requiredGood;
  final evilFull = 1 + specialEvil >= requiredEvil;

  final withDefaults = {...selected, Role.merlin, Role.assassin};
  final evilRoles = withDefaults
      .where((r) => kRoles[r]!.alignment == Alignment2.evil)
      .toList();
  final goodRoles = withDefaults
      .where((r) => kRoles[r]!.alignment == Alignment2.good)
      .toList();

  final evilSlots = requiredEvil - evilRoles.length;
  final goodSlots = playerCount - requiredEvil - goodRoles.length;

  var error = '';
  if (evilSlots < 0) error = 'Too many evil roles selected.';
  if (goodSlots < 0) error = 'Too many good roles selected.';

  final finalRoles = [
    ...goodRoles,
    ...List.filled(goodSlots < 0 ? 0 : goodSlots, Role.loyalServant),
    ...evilRoles,
    ...List.filled(evilSlots < 0 ? 0 : evilSlots, Role.minion),
  ];

  if (finalRoles.length != playerCount) {
    error =
        'Role selection count (${finalRoles.length}) must match player count ($playerCount).';
  } else if (selected.contains(Role.morgana) !=
      selected.contains(Role.percival)) {
    error = 'Morgana and Percival must be in the game together.';
  }

  return RoleSetup(finalRoles, error.isEmpty, error, goodFull, evilFull);
}

class LobbyScreen extends StatefulWidget {
  const LobbyScreen({super.key});
  @override
  State<LobbyScreen> createState() => _LobbyScreenState();
}

class _LobbyScreenState extends State<LobbyScreen> {
  int _tipIndex = 0;

  void _toggleRole(GameProvider game, Role role) {
    final roles = {...game.gameState.selectedRoles};
    final adding = !roles.contains(role);
    if (role == Role.percival || role == Role.morgana) {
      if (adding) {
        roles.addAll([Role.percival, Role.morgana]);
      } else {
        roles.removeAll([Role.percival, Role.morgana]);
      }
    } else {
      adding ? roles.add(role) : roles.remove(role);
    }
    game.updateSelectedRoles(roles.toList());
  }

  @override
  Widget build(BuildContext context) {
    final game = context.watch<GameProvider>();
    final state = game.gameState;
    final players = state.players;
    final me = game.me;
    final isHost = me?.isHost ?? false;
    final isPaused = state.reconnectingPlayer != null;
    final selected = state.selectedRoles.toSet();
    final setup = computeRoleSetup(selected, players.length);
    final canStartPavalon = players.length >= 5 && players.length <= 10;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                flex: 3,
                child: Semantics(
                  button: true,
                  label: 'Invite Friends',
                  child: GestureDetector(
                    onTap: () {
                      Haptics.tap();
                      SharePlus.instance.share(ShareParams(
                          text:
                              'Join my Pavalon game!\nCode: ${state.roomCode}'));
                    },
                    child: Container(
                      height: 40,
                      decoration: BoxDecoration(
                        color: PavalonColors.slate800.withValues(alpha: 0.6),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: PavalonColors.slate700),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(LucideIcons.users,
                              size: 16, color: PavalonColors.gold),
                          SizedBox(width: 8),
                          Text('Invite Friends',
                              style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                  color: PavalonColors.gold)),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 2,
                child: PavalonButton(
                  label: 'Leave',
                  icon: LucideIcons.logOut,
                  variant: PavalonButtonVariant.danger,
                  small: true,
                  height: 40,
                  expand: true,
                  onPressed: () => game.leaveRoom(),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Room code + share
          PavalonCard(
            borderColor: PavalonColors.slate700.withValues(alpha: 0.6),
            child: Column(
              children: [
                const Text('ROOM CODE',
                    style: TextStyle(
                        fontSize: 13,
                        letterSpacing: 3,
                        fontWeight: FontWeight.bold,
                        color: PavalonColors.slate300)),
                const SizedBox(height: 8),
                InkWell(
                  onTap: () {
                    Haptics.tap();
                    SharePlus.instance.share(ShareParams(
                        text:
                            'Join my Pavalon game!\nCode: ${state.roomCode}'));
                  },
                  borderRadius: BorderRadius.circular(8),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: PavalonColors.slate900.withValues(alpha: 0.7),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                          color: PavalonColors.slate700, width: 2),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(state.roomCode ?? '',
                            style: const TextStyle(
                                fontFamily: 'monospace',
                                fontFamilyFallback: ['Courier'],
                                fontSize: 30,
                                letterSpacing: 3,
                                fontWeight: FontWeight.bold,
                                color: Colors.white)),
                        const SizedBox(width: 16),
                        const Icon(LucideIcons.copy,
                            size: 24, color: PavalonColors.gold),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Players
          SectionTitle('Players (${players.length}/10)'),
          Wrap(
            spacing: 10,
            runSpacing: 12,
            alignment: WrapAlignment.center,
            children: [
              for (final p in players)
                Column(
                  children: [
                    PlayerTile(player: p, allowMarks: false),
                    if (isHost && p.id != game.playerId)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: SizedBox(
                          width: 104,
                          height: 28,
                          child: OutlinedButton.icon(
                            onPressed: () => game.kickPlayer(p.id),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: PavalonColors.evil,
                              side: const BorderSide(
                                  color: PavalonColors.evilDeep),
                              padding: EdgeInsets.zero,
                            ),
                            icon: const Icon(LucideIcons.shieldAlert, size: 12),
                            label: const Text('Kick',
                                style: TextStyle(fontSize: 11)),
                          ),
                        ),
                      ),
                  ],
                ),
            ],
          ),

          // Add CPU players (host only)
          if (isHost && players.length < 10) ...[
            const SizedBox(height: 14),
            PavalonCard(
              padding: const EdgeInsets.all(12),
              child: Column(
                children: [
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(LucideIcons.bot,
                          size: 16, color: PavalonColors.slate400),
                      SizedBox(width: 6),
                      Text('Add a CPU player',
                          style: TextStyle(fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      for (final d in ['easy', 'medium', 'hard']) ...[
                        Expanded(
                          child: PavalonButton(
                            label: d[0].toUpperCase() + d.substring(1),
                            variant: PavalonButtonVariant.secondary,
                            small: true,
                            height: 40,
                            expand: true,
                            onPressed:
                                isPaused ? null : () => game.addBot(d),
                          ),
                        ),
                        if (d != 'hard') const SizedBox(width: 8),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ],

          // Game tip carousel
          const SizedBox(height: 14),
          GestureDetector(
            onTap: () =>
                setState(() => _tipIndex = (_tipIndex + 1) % kGameTips.length),
            child: PavalonCard(
              padding: const EdgeInsets.all(12),
              child: Column(
                children: [
                  Text('Game Tip', style: eagle(14)),
                  const SizedBox(height: 6),
                  AnimatedSwitcher(
                    duration: const Duration(milliseconds: 400),
                    child: Text(
                      '"${kGameTips[_tipIndex]}"',
                      key: ValueKey(_tipIndex),
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                          fontStyle: FontStyle.italic,
                          fontSize: 13,
                          color: PavalonColors.slate300),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Final roster preview
          if (canStartPavalon) ...[
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                    child: _teamPanel(
                        'Good Team',
                        setup.finalRoles
                            .where((r) =>
                                kRoles[r]!.alignment == Alignment2.good)
                            .toList(),
                        PavalonColors.good)),
                const SizedBox(width: 10),
                Expanded(
                    child: _teamPanel(
                        'Evil Team',
                        setup.finalRoles
                            .where((r) =>
                                kRoles[r]!.alignment == Alignment2.evil)
                            .toList(),
                        PavalonColors.evil)),
              ],
            ),
          ],

          // Host controls
          const SizedBox(height: 14),
          if (isHost && canStartPavalon) ...[
            SectionTitle('Add Special Roles'),
            _roleToggle(game, Role.percival, selected, setup),
            _roleToggle(game, Role.morgana, selected, setup),
            _roleToggle(game, Role.mordred, selected, setup),
            _roleToggle(game, Role.oberon, selected, setup),
            const SizedBox(height: 14),
            PavalonButton(
              label: 'Start Game',
              expand: true,
              onPressed: setup.isValid && !isPaused
                  ? () {
                      Haptics.confirm();
                      game.startGame(setup.finalRoles);
                    }
                  : null,
            ),
            if (!setup.isValid)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(setup.message,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                        color: PavalonColors.evil, fontSize: 13)),
              ),
          ] else if (isHost) ...[
            PavalonCard(
              child: Column(
                children: [
                  Text('Need 5–10 players for Pavalon',
                      style: eagle(15, color: Colors.white)),
                  Text('You currently have ${players.length}.',
                      style: const TextStyle(color: PavalonColors.evil)),
                  if (players.length == 2) ...[
                    const Divider(color: PavalonColors.slate700, height: 24),
                    PavalonButton(
                      label: "Play Dragon's Breath (2 players)",
                      icon: LucideIcons.flame,
                      variant: PavalonButtonVariant.secondary,
                      expand: true,
                      onPressed:
                          isPaused ? null : () => game.startDragonsBreath(),
                    ),
                  ],
                ],
              ),
            ),
          ] else
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text(
                  'Waiting for the host, '
                  '${players.where((p) => p.isHost).map((p) => p.name).firstOrNull ?? '...'}'
                  ', to start the game...',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      fontStyle: FontStyle.italic,
                      color: PavalonColors.slate400),
                ),
              ),
            ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _teamPanel(String title, List<Role> roles, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.4), width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: eagle(15, color: color)),
          const SizedBox(height: 6),
          Text(roles.map((r) => r.shortName).join(', '),
              style: const TextStyle(
                  fontSize: 12,
                  fontStyle: FontStyle.italic,
                  color: PavalonColors.slate300)),
          const SizedBox(height: 6),
          Text('Total: ${roles.length}',
              style: const TextStyle(
                  fontSize: 12, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _roleToggle(
      GameProvider game, Role role, Set<Role> selected, RoleSetup setup) {
    final info = kRoles[role]!;
    final isGood = info.alignment == Alignment2.good;
    final isSelected = selected.contains(role);
    final pairRole = role == Role.percival || role == Role.morgana;
    final disabled = !isSelected &&
        (pairRole
            ? (setup.goodFull || setup.evilFull)
            : (isGood ? setup.goodFull : setup.evilFull));

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: () {
          if (disabled) {
            context.read<GameProvider>().notify(
                pairRole
                    ? 'Not enough space for both a Good and an Evil role.'
                    : '${isGood ? 'Good' : 'Evil'} role limit reached!',
                kind: 'error');
            return;
          }
          _toggleRole(game, role);
        },
        borderRadius: BorderRadius.circular(12),
        child: Opacity(
          opacity: disabled ? 0.5 : 1,
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: isSelected
                  ? const Color(0xFF065F46).withValues(alpha: 0.25)
                  : PavalonColors.slate800,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                  color: isSelected
                      ? const Color(0xFF34D399)
                      : PavalonColors.slate700,
                  width: 1.5),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(role.wire,
                          style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: isGood
                                  ? PavalonColors.good
                                  : PavalonColors.evil)),
                      Text(info.description.split('.').first,
                          style: const TextStyle(
                              fontSize: 11, color: PavalonColors.slate400)),
                    ],
                  ),
                ),
                if (isSelected)
                  const Icon(LucideIcons.check,
                      color: Color(0xFF34D399), size: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
