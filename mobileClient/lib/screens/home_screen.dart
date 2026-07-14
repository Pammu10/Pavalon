import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:sensors_plus/sensors_plus.dart';
import '../core/theme.dart';
import '../services/session_store.dart';
import '../state/auth_provider.dart';
import '../state/game_provider.dart';
import '../widgets/common.dart';

/// Host / join / CPU game / tutorial (port of JoinHostView) with a subtle
/// gyroscope parallax on the crest and the new/returning tutorial prompt.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _roomCode = TextEditingController();
  StreamSubscription<GyroscopeEvent>? _gyro;
  double _tiltX = 0, _tiltY = 0;
  bool _promptChecked = false;

  @override
  void initState() {
    super.initState();
    _roomCode.addListener(_onRoomCodeChanged);
    _gyro = gyroscopeEventStream().listen((e) {
      if (!mounted) return;
      setState(() {
        _tiltX = (_tiltX + e.y * 0.6).clamp(-8.0, 8.0) * 0.92;
        _tiltY = (_tiltY + e.x * 0.6).clamp(-8.0, 8.0) * 0.92;
      });
    }, onError: (_) {});
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeShowTutorialPrompt());
  }

  @override
  void dispose() {
    _gyro?.cancel();
    _roomCode.dispose();
    super.dispose();
  }

  // Join is disabled until a code is typed, as on the web.
  void _onRoomCodeChanged() => setState(() {});

  void _maybeShowTutorialPrompt() {
    if (_promptChecked) return;
    _promptChecked = true;
    final store = context.read<SessionStore>();
    final seenAt = store.tutorialSeenAt;
    const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
    final String? variant = seenAt == null
        ? 'new'
        : (DateTime.now().millisecondsSinceEpoch - seenAt > sixtyDaysMs
            ? 'returning'
            : null);
    if (variant == null) return;

    final username = context.read<AuthProvider>().user?.username ?? 'knight';
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: PavalonColors.slate900,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: BorderSide(
                color: PavalonColors.gold.withValues(alpha: 0.7), width: 2)),
        title: Column(
          children: [
            const Icon(LucideIcons.bookOpen,
                size: 40, color: PavalonColors.gold),
            const SizedBox(height: 10),
            Text(variant == 'new' ? 'Welcome, $username!' : 'Welcome back!',
                textAlign: TextAlign.center, style: eagle(22)),
          ],
        ),
        content: Text(
          variant == 'new'
              ? 'New to Pavalon? A 2-minute interactive tutorial will get you battle-ready.'
              : "It's been a while, $username. Want a quick refresher on the rules?",
          textAlign: TextAlign.center,
          style: const TextStyle(color: PavalonColors.slate300),
        ),
        actionsAlignment: MainAxisAlignment.center,
        actions: [
          TextButton(
            onPressed: () {
              store.markTutorialSeen();
              Navigator.of(dialogContext).pop();
            },
            child: Text(
                variant == 'new' ? 'Skip for now' : 'I remember the rules',
                style: const TextStyle(color: PavalonColors.slate400)),
          ),
          PavalonButton(
            label: variant == 'new' ? 'Start Tutorial' : 'Replay Tutorial',
            icon: LucideIcons.bookOpen,
            onPressed: () {
              store.markTutorialSeen();
              Navigator.of(dialogContext).pop();
              context.read<GameProvider>().joinRoom('TUTORIAL');
            },
          ),
        ],
      ),
    );
  }

  void _openCpuSheet() {
    var difficulty = 'medium';
    var playerCount = 5;
    showModalBottomSheet(
      context: context,
      backgroundColor: PavalonColors.slate900,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (sheetContext) => StatefulBuilder(
        builder: (context, setSheet) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  const Icon(LucideIcons.bot, color: PavalonColors.slate300),
                  const SizedBox(width: 10),
                  Text('Play vs CPU', style: eagle(20)),
                ]),
                const SizedBox(height: 4),
                const Text('Solo practice against AI opponents',
                    style: TextStyle(
                        color: PavalonColors.slate400, fontSize: 13)),
                const SizedBox(height: 16),
                const Text('DIFFICULTY',
                    style: TextStyle(
                        fontSize: 11,
                        letterSpacing: 1.5,
                        color: PavalonColors.slate500)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    for (final d in ['easy', 'medium', 'hard']) ...[
                      Expanded(
                        child: ChoiceChip(
                          label: Center(
                              child: Text(d[0].toUpperCase() + d.substring(1))),
                          selected: difficulty == d,
                          selectedColor: PavalonColors.gold,
                          onSelected: (_) => setSheet(() => difficulty = d),
                        ),
                      ),
                      if (d != 'hard') const SizedBox(width: 8),
                    ],
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  switch (difficulty) {
                    'easy' =>
                      'Chatty, impulsive opponents who make mistakes. Great for learning.',
                    'medium' =>
                      'Thoughtful players who notice patterns and vote strategically.',
                    _ => 'Near-optimal play. Minimal chat. No mercy.',
                  },
                  style: const TextStyle(
                      color: PavalonColors.slate400, fontSize: 13),
                ),
                const SizedBox(height: 16),
                Text('PLAYERS (you + ${playerCount - 1} bots)',
                    style: const TextStyle(
                        fontSize: 11,
                        letterSpacing: 1.5,
                        color: PavalonColors.slate500)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    for (final n in [5, 6, 7, 8]) ...[
                      Expanded(
                        child: ChoiceChip(
                          label: Center(child: Text('$n')),
                          selected: playerCount == n,
                          selectedColor: PavalonColors.gold,
                          onSelected: (_) => setSheet(() => playerCount = n),
                        ),
                      ),
                      if (n != 8) const SizedBox(width: 8),
                    ],
                  ],
                ),
                const SizedBox(height: 20),
                PavalonButton(
                  label: 'Begin Quest',
                  icon: LucideIcons.chevronRight,
                  expand: true,
                  onPressed: () {
                    Navigator.of(sheetContext).pop();
                    context
                        .read<GameProvider>()
                        .startCpuGame(difficulty, playerCount);
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final game = context.watch<GameProvider>();
    final auth = context.watch<AuthProvider>();
    final connected = game.isConnected;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          const SizedBox(height: 24),
          // Title with gyro parallax (mobile-only flourish; static look
          // matches the web title block)
          Transform(
            alignment: Alignment.center,
            transform: Matrix4.identity()
              ..setEntry(3, 2, 0.001)
              ..rotateX(_tiltY * pi / 180)
              ..rotateY(-_tiltX * pi / 180),
            child: Column(
              children: [
                Text('PAVALON',
                    style: eagle(36,
                        shadows: [
                          const Shadow(color: Color(0x80EAB308), blurRadius: 25)
                        ]).copyWith(letterSpacing: 2)),
                const SizedBox(height: 8),
                Text('The Shattered Throne',
                    style: eagle(18,
                            color: const Color(0xCCFDE68A),
                            weight: FontWeight.normal)
                        .copyWith(letterSpacing: 3)),
              ],
            ),
          ),
          const SizedBox(height: 40),
          PavalonCard(
            transparent: true,
            child: Column(
              children: [
                PavalonButton(
                  label: connected ? 'Host New Game' : 'Connecting...',
                  expand: true,
                  height: 56,
                  onPressed: connected ? () => game.joinRoom() : null,
                ),
                const SizedBox(height: 16),
                Row(children: [
                  const Expanded(child: Divider(color: PavalonColors.slate700)),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 8),
                    child: Text('OR',
                        style: TextStyle(color: PavalonColors.slate500)),
                  ),
                  const Expanded(child: Divider(color: PavalonColors.slate700)),
                ]),
                const SizedBox(height: 16),
                TextField(
                  controller: _roomCode,
                  textCapitalization: TextCapitalization.characters,
                  style: const TextStyle(fontSize: 18, color: Colors.white),
                  decoration: const InputDecoration(hintText: 'ROOM CODE'),
                ),
                const SizedBox(height: 8),
                PavalonButton(
                  label: 'Join Game',
                  variant: PavalonButtonVariant.secondary,
                  expand: true,
                  height: 56,
                  onPressed: connected && _roomCode.text.trim().isNotEmpty
                      ? () => game.joinRoom(_roomCode.text.trim())
                      : null,
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: PavalonButton(
                        label: 'Play vs CPU',
                        icon: LucideIcons.bot,
                        variant: PavalonButtonVariant.secondary,
                        height: 48,
                        small: true,
                        onPressed: connected ? _openCpuSheet : null,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: PavalonButton(
                        label: 'How to Play',
                        variant: PavalonButtonVariant.secondary,
                        height: 48,
                        small: true,
                        onPressed: connected
                            ? () => game.joinRoom('TUTORIAL')
                            : null,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                const Divider(color: PavalonColors.slate700, height: 1),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Flexible(
                      child: Text.rich(
                        TextSpan(
                          text: 'Logged in as ',
                          style: const TextStyle(
                              color: PavalonColors.slate400, fontSize: 14),
                          children: [
                            TextSpan(
                                text: auth.user?.username ?? '',
                                style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                    ),
                    PavalonButton(
                      label: 'Log Out',
                      variant: PavalonButtonVariant.danger,
                      small: true,
                      onPressed: () => auth.logout(),
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (!connected)
            const Padding(
              padding: EdgeInsets.only(top: 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: PavalonColors.gold)),
                  SizedBox(width: 8),
                  Text('Connecting to server...',
                      style: TextStyle(color: PavalonColors.goldBright)),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
