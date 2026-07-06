import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../models/models.dart';
import '../state/game_provider.dart';
import '../state/social_provider.dart';
import '../widgets/common.dart';

/// Friends / requests / find players (port of SocialHub.tsx).
class SocialScreen extends StatefulWidget {
  const SocialScreen({super.key});
  @override
  State<SocialScreen> createState() => _SocialScreenState();
}

class _SocialScreenState extends State<SocialScreen> {
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
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

  @override
  Widget build(BuildContext context) {
    final social = context.watch<SocialProvider>();
    final game = context.watch<GameProvider>();

    return RefreshIndicator(
      color: PavalonColors.gold,
      onRefresh: social.refresh,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Social Hub', style: eagle(26), textAlign: TextAlign.center),
          const SizedBox(height: 14),

          // Add friend
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _search,
                  decoration: InputDecoration(
                    hintText: 'Add a friend by username...',
                    filled: true,
                    fillColor: PavalonColors.slate800,
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 10),
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filled(
                style:
                    IconButton.styleFrom(backgroundColor: const Color(0xFFCA8A04)),
                onPressed: () {
                  final name = _search.text.trim();
                  if (name.isEmpty) return;
                  _search.clear();
                  _run(() => social.addFriend(name));
                },
                icon: const Icon(LucideIcons.userPlus, size: 18),
              ),
            ],
          ),
          const SizedBox(height: 16),

          if (social.requests.isNotEmpty) ...[
            SectionTitle('Friend Requests (${social.requests.length})'),
            for (final r in social.requests)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const CircleAvatar(
                    backgroundColor: PavalonColors.slate700,
                    child: Icon(LucideIcons.user, size: 18)),
                title: Text(r.username),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      onPressed: () => _run(() => social.respond(r.id, 'accept')),
                      icon: const Icon(LucideIcons.check,
                          color: PavalonColors.success),
                    ),
                    IconButton(
                      onPressed: () =>
                          _run(() => social.respond(r.id, 'decline')),
                      icon:
                          const Icon(LucideIcons.x, color: PavalonColors.evil),
                    ),
                  ],
                ),
              ),
          ],

          SectionTitle('Friends (${social.friends.length})'),
          if (social.friends.isEmpty)
            const Padding(
              padding: EdgeInsets.all(12),
              child: Text('No friends yet — add someone above!',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: PavalonColors.slate500)),
            ),
          for (final f in social.friends) _friendRow(f, game, social),

          if (social.sentRequests.isNotEmpty) ...[
            SectionTitle('Sent Requests'),
            for (final r in social.sentRequests)
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(r.username),
                trailing: TextButton(
                  onPressed: () => _run(() => social.cancel(r.id)),
                  child: const Text('Cancel',
                      style: TextStyle(color: PavalonColors.slate400)),
                ),
              ),
          ],

          if (social.suggestions.isNotEmpty) ...[
            SectionTitle('People You May Know'),
            for (final s in social.suggestions)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const CircleAvatar(
                    backgroundColor: PavalonColors.slate700,
                    child: Icon(LucideIcons.sparkles, size: 16)),
                title: Text(s.username),
                trailing: TextButton.icon(
                  onPressed: () => _run(() => social.addFriend(s.username)),
                  icon: const Icon(LucideIcons.userPlus, size: 14),
                  label: const Text('Add'),
                ),
              ),
          ],
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _friendRow(Friend f, GameProvider game, SocialProvider social) {
    final statusColor = f.isInGame
        ? PavalonColors.amber
        : f.isOnline
            ? PavalonColors.success
            : PavalonColors.slate600;
    final statusText = f.isInGame
        ? 'In game${f.gamePhase != null ? ' · ${f.gamePhase!.toLowerCase().replaceAll('_', ' ')}' : ''}'
        : f.isOnline
            ? 'Online'
            : 'Offline';
    final canInvite = f.isOnline && !f.isInGame && game.gameState.roomCode != null;

    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Stack(
        children: [
          const CircleAvatar(
              backgroundColor: PavalonColors.slate700,
              child: Icon(LucideIcons.user, size: 18)),
          Positioned(
            right: 0,
            bottom: 0,
            child: Container(
              width: 12,
              height: 12,
              decoration: BoxDecoration(
                color: statusColor,
                shape: BoxShape.circle,
                border: Border.all(color: PavalonColors.slate900, width: 2),
              ),
            ),
          ),
        ],
      ),
      title: Text(f.username),
      subtitle: Text(statusText,
          style: TextStyle(fontSize: 12, color: statusColor)),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (canInvite)
            IconButton(
              tooltip: 'Invite to game',
              onPressed: () {
                game.inviteFriendToGame(f.id);
                game.notify('Game invite sent!', kind: 'success');
              },
              icon: const Icon(LucideIcons.mail, color: PavalonColors.gold),
            ),
          IconButton(
            tooltip: 'Remove friend',
            onPressed: () => _run(() => social.remove(f.id)),
            icon: const Icon(LucideIcons.userMinus,
                size: 18, color: PavalonColors.slate500),
          ),
        ],
      ),
    );
  }
}
