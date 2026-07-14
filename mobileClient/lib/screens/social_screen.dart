import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../models/models.dart';
import '../state/game_provider.dart';
import '../state/social_provider.dart';

/// Social Hub (port of SocialHub.tsx, screen presentation): gold title,
/// Friends / Requests / Add tab bar, slate row items with square icon
/// action buttons.
class SocialScreen extends StatefulWidget {
  const SocialScreen({super.key});
  @override
  State<SocialScreen> createState() => _SocialScreenState();
}

class _SocialScreenState extends State<SocialScreen> {
  final _addName = TextEditingController();
  int _tab = 0;
  bool _adding = false;

  @override
  void initState() {
    super.initState();
    _addName.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _addName.dispose();
    super.dispose();
  }

  Future<void> _run(Future<dynamic> Function() action) async {
    final game = context.read<GameProvider>();
    try {
      final result = await action();
      if (result is String) game.notify(result, kind: 'success');
    } catch (e) {
      game.notify(e.toString(), kind: 'error');
    }
  }

  Future<void> _sendRequest() async {
    final name = _addName.text.trim();
    if (name.isEmpty || _adding) return;
    setState(() => _adding = true);
    await _run(() => context.read<SocialProvider>().addFriend(name));
    if (mounted) {
      _addName.clear();
      setState(() => _adding = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final social = context.watch<SocialProvider>();
    final game = context.watch<GameProvider>();

    return RefreshIndicator(
      color: PavalonColors.gold,
      onRefresh: social.refresh,
      child: ListView(
        padding: const EdgeInsets.all(8),
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text('Social Hub', style: eagle(28)),
          ),
          _SocialTabBar(
            index: _tab,
            friendCount: social.friends.length,
            requestBadge: social.requests.length,
            onSelect: (i) => setState(() => _tab = i),
          ),
          const SizedBox(height: 16),
          ...switch (_tab) {
            0 => _friendsTab(social, game),
            1 => _requestsTab(social),
            _ => _addTab(social),
          },
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  List<Widget> _friendsTab(SocialProvider social, GameProvider game) {
    if (social.friends.isEmpty) {
      return const [
        _EmptyState(
            icon: LucideIcons.users,
            title: 'Your friends list is empty',
            message:
                "Use the 'Add' tab to find and add friends by their username.")
      ];
    }
    return [
      for (final f in social.friends) ...[
        _FriendRow(friend: f, game: game, onRun: _run),
        const SizedBox(height: 8),
      ]
    ];
  }

  List<Widget> _requestsTab(SocialProvider social) {
    return [
      const _SectionLabel('Received Requests'),
      if (social.requests.isEmpty)
        const _EmptyState(
            icon: LucideIcons.mail,
            title: 'No pending requests',
            message: 'You have no new friend requests at this time.')
      else
        for (final r in social.requests) ...[
          _RowItem(
            title: r.username,
            trailing: Row(mainAxisSize: MainAxisSize.min, children: [
              _IconBtn(
                  icon: LucideIcons.check,
                  color: const Color(0xFF22C55E),
                  onTap: () => _run(() =>
                      context.read<SocialProvider>().respond(r.id, 'accept'))),
              const SizedBox(width: 8),
              _IconBtn(
                  icon: LucideIcons.x,
                  color: const Color(0xFFEF4444),
                  onTap: () => _run(() =>
                      context.read<SocialProvider>().respond(r.id, 'decline'))),
            ]),
          ),
          const SizedBox(height: 8),
        ],
      const SizedBox(height: 16),
      const Divider(color: PavalonColors.slate700, height: 1),
      const SizedBox(height: 16),
      const _SectionLabel('Sent Requests'),
      if (social.sentRequests.isEmpty)
        const _EmptyState(
            icon: LucideIcons.send,
            title: 'No sent requests',
            message:
                "You haven't sent any friend requests that are still pending.")
      else
        for (final r in social.sentRequests) ...[
          _RowItem(
            title: r.username,
            trailing: TextButton(
              onPressed: () =>
                  _run(() => context.read<SocialProvider>().cancel(r.id)),
              child: const Text('Cancel',
                  style: TextStyle(
                      color: PavalonColors.slate200, fontSize: 14)),
            ),
          ),
          const SizedBox(height: 8),
        ],
    ];
  }

  List<Widget> _addTab(SocialProvider social) {
    return [
      TextField(
        controller: _addName,
        style: const TextStyle(fontSize: 18, color: Colors.white),
        decoration: InputDecoration(
          hintText: 'Enter username...',
          fillColor: PavalonColors.slate800,
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide:
                const BorderSide(color: PavalonColors.slate700, width: 2),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: Color(0xFFCA8A04), width: 2),
          ),
        ),
      ),
      const SizedBox(height: 16),
      SizedBox(
        width: double.infinity,
        child: ElevatedButton(
          onPressed:
              _addName.text.trim().isNotEmpty && !_adding ? _sendRequest : null,
          child: _adding
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white))
              : const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(LucideIcons.userPlus, size: 20),
                    SizedBox(width: 8),
                    Text('Send Request'),
                  ],
                ),
        ),
      ),
      const SizedBox(height: 24),
      const Divider(color: PavalonColors.slate700, height: 1),
      const SizedBox(height: 16),
      const _SectionLabel('People You May Know'),
      if (social.suggestions.isEmpty)
        const _EmptyState(
            icon: LucideIcons.users,
            title: 'No Suggestions',
            message:
                "We couldn't find any friend suggestions for you right now. Try adding more friends!")
      else
        for (final s in social.suggestions) ...[
          _RowItem(
            title: s.username,
            trailing: _IconBtn(
                icon: LucideIcons.userPlus,
                color: PavalonColors.gold,
                onTap: () => _run(
                    () => context.read<SocialProvider>().addFriend(s.username))),
          ),
          const SizedBox(height: 8),
        ],
    ];
  }
}

/// Web SocialHub tab bar: 3 equal cells, slate-800/50 track, active cell
/// slate-700 with gold text, blue count badge on Requests.
class _SocialTabBar extends StatelessWidget {
  final int index;
  final int friendCount;
  final int requestBadge;
  final ValueChanged<int> onSelect;
  const _SocialTabBar(
      {required this.index,
      required this.friendCount,
      required this.requestBadge,
      required this.onSelect});

  @override
  Widget build(BuildContext context) {
    final tabs = [
      (LucideIcons.users, 'Friends ($friendCount)', 0),
      (LucideIcons.mail, 'Requests', requestBadge),
      (LucideIcons.userPlus, 'Add', 0),
    ];
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: PavalonColors.slate800.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(children: [
        for (var i = 0; i < tabs.length; i++)
          Expanded(
            child: Semantics(
              button: true,
              selected: index == i,
              label: tabs[i].$2,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => onSelect(i),
                child: Stack(children: [
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      color: index == i
                          ? PavalonColors.slate700
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(tabs[i].$1,
                            size: 16,
                            color: index == i
                                ? PavalonColors.goldBright
                                : PavalonColors.slate300),
                        const SizedBox(width: 6),
                        Text(tabs[i].$2,
                            style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: index == i
                                    ? PavalonColors.goldBright
                                    : PavalonColors.slate300)),
                      ],
                    ),
                  ),
                  if (tabs[i].$3 > 0)
                    Positioned(
                      top: 2,
                      right: 2,
                      child: Container(
                        width: 18,
                        height: 18,
                        alignment: Alignment.center,
                        decoration: const BoxDecoration(
                            color: Color(0xFF3B82F6), shape: BoxShape.circle),
                        child: Text('${tabs[i].$3}',
                            style: const TextStyle(
                                fontSize: 10,
                                color: Colors.white,
                                fontWeight: FontWeight.bold)),
                      ),
                    ),
                ]),
              ),
            ),
          ),
      ]),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(text,
          style: const TextStyle(
              color: PavalonColors.goldBright,
              fontSize: 17,
              fontWeight: FontWeight.bold)),
    );
  }
}

/// Web list row: bg-slate-800/60 rounded-lg.
class _RowItem extends StatelessWidget {
  final String title;
  final Widget trailing;
  const _RowItem({required this.title, required this.trailing});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: PavalonColors.slate800.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          color: Colors.white, fontWeight: FontWeight.bold)),
                ]),
          ),
          trailing,
        ],
      ),
    );
  }
}

/// Web icon-* Button: 40x40, slate-800/60 fill, slate-700 border, colored icon.
class _IconBtn extends StatelessWidget {
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  const _IconBtn({required this.icon, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: PavalonColors.slate800.withValues(alpha: 0.6),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: PavalonColors.slate700),
          ),
          child: Icon(icon, size: 20, color: color),
        ),
      ),
    );
  }
}

class _FriendRow extends StatelessWidget {
  final Friend friend;
  final GameProvider game;
  final Future<void> Function(Future<dynamic> Function()) onRun;
  const _FriendRow(
      {required this.friend, required this.game, required this.onRun});

  @override
  Widget build(BuildContext context) {
    final f = friend;
    final statusColor = f.isInGame
        ? PavalonColors.amber
        : f.isOnline
            ? const Color(0xFF4ADE80)
            : PavalonColors.slate500;
    final statusText = f.isInGame
        ? 'In game${f.gamePhase != null ? ' · ${f.gamePhase!.toLowerCase().replaceAll('_', ' ')}' : ''}'
        : f.isOnline
            ? 'Online'
            : 'Offline';
    final canInvite =
        f.isOnline && !f.isInGame && game.gameState.roomCode != null;

    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: PavalonColors.slate800.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(children: [
        Stack(clipBehavior: Clip.none, children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: PavalonColors.slate700,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(LucideIcons.user,
                size: 24, color: PavalonColors.slate300),
          ),
          if (f.isOnline)
            Positioned(
              right: -3,
              bottom: -3,
              child: Container(
                width: 14,
                height: 14,
                decoration: BoxDecoration(
                  color: const Color(0xFF4ADE80),
                  shape: BoxShape.circle,
                  border: Border.all(color: PavalonColors.slate800, width: 2),
                ),
              ),
            ),
        ]),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(f.username,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    color: Colors.white, fontWeight: FontWeight.bold)),
            Text(statusText,
                style: TextStyle(fontSize: 12, color: statusColor)),
          ]),
        ),
        if (canInvite) ...[
          _IconBtn(
              icon: LucideIcons.mail,
              color: PavalonColors.gold,
              onTap: () {
                game.inviteFriendToGame(f.id);
                game.notify('Game invite sent!', kind: 'success');
              }),
          const SizedBox(width: 8),
        ],
        _IconBtn(
            icon: LucideIcons.userMinus,
            color: const Color(0xFFEF4444),
            onTap: () =>
                onRun(() => context.read<SocialProvider>().remove(f.id))),
      ]),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String message;
  const _EmptyState(
      {required this.icon, required this.title, required this.message});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 16),
      child: Column(children: [
        Icon(icon, size: 48, color: PavalonColors.slate400),
        const SizedBox(height: 16),
        Text(title,
            textAlign: TextAlign.center,
            style: const TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        Text(message,
            textAlign: TextAlign.center,
            style: const TextStyle(color: PavalonColors.slate400)),
      ]),
    );
  }
}
