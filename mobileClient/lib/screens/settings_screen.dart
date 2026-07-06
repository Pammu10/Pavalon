import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../services/api_service.dart';
import '../services/audio_service.dart';
import '../services/haptics.dart';
import '../services/session_store.dart';
import '../state/auth_provider.dart';
import '../state/game_provider.dart';
import '../widgets/common.dart';

/// Audio/haptics, replay tutorial, username change, admin tools, logout
/// (port of SettingsScreen.tsx + AdminPage).
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});
  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final store = context.read<SessionStore>();
    final audio = context.read<AudioService>();
    final game = context.read<GameProvider>();

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('Settings', style: eagle(26), textAlign: TextAlign.center),
        const SizedBox(height: 14),

        SectionTitle('Sound & Feel'),
        SwitchListTile(
          value: !audio.muted,
          activeThumbColor: PavalonColors.gold,
          title: const Text('Background music'),
          secondary: const Icon(LucideIcons.music),
          onChanged: (v) async {
            await audio.setMuted(!v);
            await store.setBgmMuted(!v);
            setState(() {});
          },
        ),
        SwitchListTile(
          value: Haptics.enabled,
          activeThumbColor: PavalonColors.gold,
          title: const Text('Haptic feedback'),
          secondary: const Icon(LucideIcons.vibrate),
          onChanged: (v) async {
            Haptics.enabled = v;
            await store.setHapticsEnabled(v);
            if (v) Haptics.confirm();
            setState(() {});
          },
        ),

        SectionTitle('How to Play'),
        ListTile(
          leading: const Icon(LucideIcons.bookOpen, color: PavalonColors.gold),
          title: const Text('Replay the interactive tutorial'),
          subtitle: const Text('A guided round of Pavalon',
              style: TextStyle(fontSize: 12, color: PavalonColors.slate400)),
          trailing: const Icon(LucideIcons.chevronRight),
          onTap: () {
            store.clearTutorialSeen();
            game.joinRoom('TUTORIAL');
          },
        ),

        SectionTitle('Account'),
        ListTile(
          leading: const Icon(LucideIcons.user),
          title: Text(auth.user?.username ?? ''),
          subtitle: const Text('Change username',
              style: TextStyle(fontSize: 12, color: PavalonColors.slate400)),
          trailing: const Icon(LucideIcons.pencil, size: 16),
          onTap: () => _changeUsername(context),
        ),
        ListTile(
          leading: const Icon(LucideIcons.logOut, color: PavalonColors.evil),
          title:
              const Text('Log out', style: TextStyle(color: PavalonColors.evil)),
          onTap: () {
            if (game.gameState.roomCode != null) game.leaveRoom();
            auth.logout();
          },
        ),

        if (auth.user?.isAdmin == true) ...[
          SectionTitle('Admin'),
          ListTile(
            leading:
                const Icon(LucideIcons.shieldAlert, color: PavalonColors.amber),
            title: const Text('Active rooms'),
            trailing: const Icon(LucideIcons.chevronRight),
            onTap: () => _showRooms(context),
          ),
        ],
        const SizedBox(height: 30),
        const Center(
          child: Text('Pavalon Mobile v1.0.0',
              style: TextStyle(fontSize: 12, color: PavalonColors.slate600)),
        ),
        const SizedBox(height: 20),
      ],
    );
  }

  void _changeUsername(BuildContext context) {
    final controller =
        TextEditingController(text: context.read<AuthProvider>().user?.username);
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: PavalonColors.slate900,
        title: Text('Change Username', style: eagle(20)),
        content: TextField(
          controller: controller,
          maxLength: 10,
          decoration: const InputDecoration(hintText: '3–10 characters'),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Cancel')),
          PavalonButton(
            label: 'Save',
            onPressed: () async {
              final game = context.read<GameProvider>();
              try {
                await context
                    .read<AuthProvider>()
                    .changeUsername(controller.text.trim());
                game.notify('Username updated!', kind: 'success');
              } catch (e) {
                game.notify(e.toString(), kind: 'error');
              }
              if (dialogContext.mounted) Navigator.of(dialogContext).pop();
            },
          ),
        ],
      ),
    );
  }

  void _showRooms(BuildContext context) async {
    final api = context.read<ApiService>();
    final game = context.read<GameProvider>();
    List<Map<String, dynamic>> rooms;
    try {
      rooms = await api.adminRooms();
    } catch (e) {
      game.notify(e.toString(), kind: 'error');
      return;
    }
    if (!mounted) return;
    showModalBottomSheet(
      // ignore: use_build_context_synchronously
      context: context,
      backgroundColor: PavalonColors.slate900,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (sheetContext) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.all(16),
          children: [
            Text('Active Rooms (${rooms.length})',
                style: eagle(18), textAlign: TextAlign.center),
            const SizedBox(height: 8),
            if (rooms.isEmpty)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text('No active rooms.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: PavalonColors.slate500)),
              ),
            for (final r in rooms)
              ListTile(
                title: Text('${r['roomCode']} · ${r['phase']}'),
                subtitle: Text('${r['playerCount']} players',
                    style: const TextStyle(fontSize: 12)),
                trailing: IconButton(
                  icon: const Icon(LucideIcons.trash2,
                      color: PavalonColors.evil, size: 18),
                  onPressed: () async {
                    try {
                      await api.adminCloseRoom(r['roomCode'] as String);
                      game.notify('Room closed.', kind: 'success');
                    } catch (e) {
                      game.notify(e.toString(), kind: 'error');
                    }
                    if (sheetContext.mounted) {
                      Navigator.of(sheetContext).pop();
                    }
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}
