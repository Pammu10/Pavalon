import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../services/api_service.dart';
import '../services/google_auth.dart';
import '../services/audio_service.dart';
import '../services/haptics.dart';
import '../services/session_store.dart';
import '../state/auth_provider.dart';
import '../state/game_provider.dart';
import '../widgets/common.dart';
import '../widgets/dynamic_background.dart';
import 'achievements_screen.dart';

/// Settings (port of SettingsScreen.tsx, mobile layout): one card with
/// toggle rows, Change Username, How to Play, Achievements & Profile,
/// admin tools, and Log Out.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});
  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _username = TextEditingController();
  bool _savingName = false;

  @override
  void initState() {
    super.initState();
    _username.text = context.read<AuthProvider>().user?.username ?? '';
    _username.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _username.dispose();
    super.dispose();
  }

  Future<void> _linkGoogle() async {
    final game = context.read<GameProvider>();
    final auth = context.read<AuthProvider>();
    try {
      final accessToken = await GoogleAuth.getAccessToken();
      if (accessToken == null) return; // user cancelled the picker
      await auth.linkGoogleAccount(accessToken);
      game.notify('Account linked successfully.', kind: 'success');
    } catch (e) {
      game.notify(e.toString(), kind: 'error');
    }
  }

  Future<void> _saveUsername() async {
    final game = context.read<GameProvider>();
    setState(() => _savingName = true);
    try {
      await context.read<AuthProvider>().changeUsername(_username.text.trim());
      game.notify('Username updated!', kind: 'success');
    } catch (e) {
      game.notify(e.toString(), kind: 'error');
    } finally {
      if (mounted) setState(() => _savingName = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final store = context.read<SessionStore>();
    final audio = context.read<AudioService>();
    final game = context.read<GameProvider>();

    final name = _username.text.trim();
    final nameChanged = name != (auth.user?.username ?? '');
    final nameValid = name.length >= 3 && name.length <= 10;

    return ListView(
      padding: const EdgeInsets.all(8),
      children: [
        PavalonCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Settings',
                  textAlign: TextAlign.center, style: eagle(30)),
              const SizedBox(height: 24),
              _ToggleRow(
                label: 'Mute Background Music',
                enabled: audio.muted,
                onToggle: () async {
                  await audio.setMuted(!audio.muted);
                  await store.setBgmMuted(audio.muted);
                  setState(() {});
                },
              ),
              const SizedBox(height: 12),
              _ToggleRow(
                label: 'Haptic Feedback',
                enabled: Haptics.enabled,
                onToggle: () async {
                  Haptics.enabled = !Haptics.enabled;
                  await store.setHapticsEnabled(Haptics.enabled);
                  if (Haptics.enabled) Haptics.confirm();
                  setState(() {});
                },
              ),

              _sectionDivider(),
              Text('Change Username',
                  textAlign: TextAlign.center, style: eagle(20)),
              const SizedBox(height: 16),
              TextField(
                controller: _username,
                maxLength: 10,
                buildCounter: (_, {required currentLength, required isFocused,
                        maxLength}) =>
                    null,
                style: const TextStyle(fontSize: 18, color: Colors.white),
                decoration: InputDecoration(
                  hintText: 'New username',
                  fillColor: PavalonColors.slate800,
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(
                        color: PavalonColors.slate700, width: 2),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide:
                        const BorderSide(color: Color(0xFFCA8A04), width: 2),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              PavalonButton(
                label: 'Save',
                expand: true,
                busy: _savingName,
                onPressed:
                    nameChanged && nameValid && !_savingName ? _saveUsername : null,
              ),
              if (name.isNotEmpty && name.length < 3)
                const Padding(
                  padding: EdgeInsets.only(top: 8),
                  child: Text('Username must be at least 3 characters.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          color: PavalonColors.evil, fontSize: 12)),
                ),

              if (!kIsWeb && auth.user?.isGoogleLinked != true) ...[
                _sectionDivider(),
                Text('Link Account',
                    textAlign: TextAlign.center, style: eagle(20)),
                const SizedBox(height: 8),
                const Text(
                  'Connect your Google account for a faster login experience.',
                  textAlign: TextAlign.center,
                  style:
                      TextStyle(color: PavalonColors.slate400, fontSize: 14),
                ),
                const SizedBox(height: 16),
                GoogleButton(
                  label: 'Link Google Account',
                  onPressed: _linkGoogle,
                ),
              ],

              _sectionDivider(),
              Text('How to Play',
                  textAlign: TextAlign.center, style: eagle(20)),
              const SizedBox(height: 8),
              const Text(
                'Replay the interactive tutorial to brush up on the rules.',
                textAlign: TextAlign.center,
                style: TextStyle(color: PavalonColors.slate400, fontSize: 14),
              ),
              const SizedBox(height: 16),
              PavalonButton(
                label: 'Replay Tutorial',
                icon: LucideIcons.bookOpen,
                variant: PavalonButtonVariant.secondary,
                expand: true,
                onPressed: () {
                  store.clearTutorialSeen();
                  game.joinRoom('TUTORIAL');
                },
              ),

              _sectionDivider(),
              Text('Profile & Achievements',
                  textAlign: TextAlign.center, style: eagle(20)),
              const SizedBox(height: 16),
              PavalonButton(
                label: 'Open Achievements',
                icon: LucideIcons.star,
                variant: PavalonButtonVariant.secondary,
                expand: true,
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => Scaffold(
                      body: DynamicBackground(
                        child: SafeArea(
                          child: Column(children: [
                            Align(
                              alignment: Alignment.centerLeft,
                              child: IconButton(
                                tooltip: 'Back',
                                icon: const Icon(LucideIcons.arrowLeft,
                                    color: Colors.white),
                                onPressed: () => Navigator.of(context).pop(),
                              ),
                            ),
                            const Expanded(child: AchievementsScreen()),
                          ]),
                        ),
                      ),
                    ),
                  ),
                ),
              ),

              if (auth.user?.isAdmin == true) ...[
                _sectionDivider(),
                Text('Admin',
                    textAlign: TextAlign.center,
                    style: eagle(20, color: PavalonColors.amber)),
                const SizedBox(height: 16),
                PavalonButton(
                  label: 'Active Rooms',
                  icon: LucideIcons.shieldAlert,
                  variant: PavalonButtonVariant.secondary,
                  expand: true,
                  onPressed: () => _showRooms(context),
                ),
              ],

              _sectionDivider(),
              PavalonButton(
                label: 'Log Out',
                variant: PavalonButtonVariant.danger,
                expand: true,
                onPressed: () {
                  if (game.gameState.roomCode != null) game.leaveRoom();
                  auth.logout();
                },
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        const Center(
          child: Text('Pavalon Mobile v1.0.0',
              style: TextStyle(fontSize: 12, color: PavalonColors.slate600)),
        ),
        const SizedBox(height: 20),
      ],
    );
  }

  Widget _sectionDivider() => Container(
        margin: const EdgeInsets.symmetric(vertical: 20),
        decoration: const BoxDecoration(
            border: Border(
                top: BorderSide(color: PavalonColors.slate700, width: 2))),
      );

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

/// Web Toggle: slate-800/50 row, slate-200 label, 44x24 pill switch
/// (yellow-600 on / slate-600 off) with a white thumb.
class _ToggleRow extends StatelessWidget {
  final String label;
  final bool enabled;
  final VoidCallback onToggle;
  const _ToggleRow(
      {required this.label, required this.enabled, required this.onToggle});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: PavalonColors.slate800.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(label,
                style: const TextStyle(
                    color: PavalonColors.slate200, fontSize: 16)),
          ),
          Semantics(
            button: true,
            toggled: enabled,
            label: label,
            child: GestureDetector(
              onTap: onToggle,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                width: 44,
                height: 24,
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: enabled
                      ? const Color(0xFFCA8A04)
                      : PavalonColors.slate600,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: AnimatedAlign(
                  duration: const Duration(milliseconds: 150),
                  alignment:
                      enabled ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    width: 16,
                    height: 16,
                    decoration: const BoxDecoration(
                        color: Colors.white, shape: BoxShape.circle),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
