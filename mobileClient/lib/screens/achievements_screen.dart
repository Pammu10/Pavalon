import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../core/constants.dart';
import '../core/theme.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../state/auth_provider.dart';
import '../state/game_provider.dart';
import '../widgets/common.dart';
import '../widgets/player_tile.dart';

/// Achievements + profile customization with live preview
/// (port of AchievementsTab.tsx).
class AchievementsScreen extends StatefulWidget {
  const AchievementsScreen({super.key});
  @override
  State<AchievementsScreen> createState() => _AchievementsScreenState();
}

class _AchievementsScreenState extends State<AchievementsScreen> {
  List<Achievement>? _achievements;
  PlayerStats? _stats;
  final _title = TextEditingController();
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _title.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final api = context.read<ApiService>();
    try {
      final results =
          await Future.wait([api.getAchievements(), api.getStats()]);
      if (!mounted) return;
      setState(() {
        _achievements = results[0] as List<Achievement>;
        _stats = results[1] as PlayerStats;
        _title.text = context.read<AuthProvider>().user?.selectedTitle ?? '';
      });
    } catch (_) {/* pull-to-refresh recovers */}
  }

  Set<String> get _unlockedRewards {
    final set = <String>{...kDefaultIcons, ...kDefaultBackgrounds};
    for (final a in _achievements ?? const <Achievement>[]) {
      if (a.unlocked) {
        for (final r in a.rewards) {
          set.add(r.value);
        }
      }
    }
    return set;
  }

  Future<void> _save() async {
    final auth = context.read<AuthProvider>();
    final game = context.read<GameProvider>();
    final user = auth.user;
    if (user == null) return;
    setState(() => _saving = true);
    try {
      await context.read<ApiService>().customize(
            title: _title.text.trim().isEmpty ? null : _title.text.trim(),
            border: user.selectedBorder,
            icon: user.selectedIcon,
            background: user.selectedBackground,
          );
      auth.updateUserLocal(user.copyWith(
          selectedTitle: _title.text.trim().isEmpty ? null : _title.text.trim()));
      game.notify('Profile updated!', kind: 'success');
    } catch (e) {
      game.notify(e.toString(), kind: 'error');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    if (user == null) return const SizedBox.shrink();
    final unlocked = _unlockedRewards;

    final previewPlayer = Player(
      id: 'preview',
      userId: user.id,
      name: user.username,
      selectedTitle: _title.text.trim().isEmpty ? null : _title.text.trim(),
      selectedBorder: user.selectedBorder,
      selectedIcon: user.selectedIcon,
      selectedBackground: user.selectedBackground,
    );

    return RefreshIndicator(
      color: PavalonColors.gold,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Achievements', style: eagle(26), textAlign: TextAlign.center),
          const SizedBox(height: 12),

          if (_stats != null) _statsCard(_stats!),
          const SizedBox(height: 14),

          SectionTitle('Profile Customization'),
          Center(child: PlayerTile(player: previewPlayer, allowMarks: false)),
          const SizedBox(height: 12),
          TextField(
            controller: _title,
            maxLength: 10,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              labelText: 'Title (max 10 chars)',
              filled: true,
              fillColor: PavalonColors.slate800,
              border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10)),
            ),
          ),
          const SizedBox(height: 6),
          const Text('BORDER',
              style: TextStyle(
                  fontSize: 11,
                  letterSpacing: 1.5,
                  color: PavalonColors.slate500)),
          const SizedBox(height: 6),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _borderChoice(auth, user, null, unlocked),
              for (final name in kBorderStyles.keys.where((k) => k != 'gold'))
                _borderChoice(auth, user, name, unlocked),
            ],
          ),
          const SizedBox(height: 10),
          const Text('ICON',
              style: TextStyle(
                  fontSize: 11,
                  letterSpacing: 1.5,
                  color: PavalonColors.slate500)),
          const SizedBox(height: 6),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final entry in kIconMap.entries)
                _iconChoice(auth, user, entry.key, entry.value, unlocked),
            ],
          ),
          const SizedBox(height: 10),
          const Text('BACKGROUND',
              style: TextStyle(
                  fontSize: 11,
                  letterSpacing: 1.5,
                  color: PavalonColors.slate500)),
          const SizedBox(height: 6),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final entry in kBackgrounds.entries)
                _backgroundChoice(auth, user, entry.key, entry.value, unlocked),
            ],
          ),
          const SizedBox(height: 14),
          PavalonButton(
              label: 'Save Profile',
              expand: true,
              busy: _saving,
              onPressed: _save),

          const SizedBox(height: 20),
          SectionTitle('Trophy Hall'),
          if (_achievements == null)
            const Center(
                child: Padding(
              padding: EdgeInsets.all(20),
              child: CircularProgressIndicator(color: PavalonColors.gold),
            ))
          else
            for (final a in _achievements!.where((a) => !a.hidden || a.unlocked))
              _achievementRow(a),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _statsCard(PlayerStats s) {
    Widget stat(String label, String value, Color color) => Column(
          children: [
            Text(value,
                style: TextStyle(
                    fontSize: 20, fontWeight: FontWeight.bold, color: color)),
            Text(label,
                style: const TextStyle(
                    fontSize: 11, color: PavalonColors.slate400)),
          ],
        );
    return PavalonCard(
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          stat('Games', '${s.totalGames}', Colors.white),
          stat('Win rate', '${s.winRate}%', PavalonColors.goldBright),
          stat('Good', '${s.goodWinRate}%', PavalonColors.good),
          stat('Evil', '${s.evilWinRate}%', PavalonColors.evil),
        ],
      ),
    );
  }

  Widget _borderChoice(
      AuthProvider auth, User user, String? name, Set<String> unlocked) {
    final isUnlocked = name == null || unlocked.contains(name);
    final isSelected = (user.selectedBorder ?? '') == (name ?? '');
    final spec = name != null ? kBorderStyles[name] : null;
    return GestureDetector(
      onTap: isUnlocked
          ? () =>
              auth.updateUserLocal(user.copyWith(selectedBorder: name ?? ''))
          : null,
      child: Opacity(
        opacity: isUnlocked ? 1 : 0.35,
        child: Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            gradient: spec != null
                ? LinearGradient(colors: spec.gradient)
                : null,
            color: spec == null ? PavalonColors.slate700 : null,
            border: Border.all(
                color:
                    isSelected ? PavalonColors.goldBright : Colors.transparent,
                width: 2.5),
          ),
          child: Center(
            child: isUnlocked
                ? (name == null
                    ? const Text('None', style: TextStyle(fontSize: 9))
                    : null)
                : const Icon(LucideIcons.lock, size: 14),
          ),
        ),
      ),
    );
  }

  Widget _iconChoice(AuthProvider auth, User user, String name, IconData icon,
      Set<String> unlocked) {
    final isUnlocked = unlocked.contains(name);
    final isSelected = user.selectedIcon == name;
    return GestureDetector(
      onTap: isUnlocked
          ? () => auth.updateUserLocal(user.copyWith(selectedIcon: name))
          : null,
      child: Opacity(
        opacity: isUnlocked ? 1 : 0.35,
        child: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: PavalonColors.slate800,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
                color:
                    isSelected ? PavalonColors.goldBright : PavalonColors.slate700,
                width: 2),
          ),
          child: Icon(isUnlocked ? icon : LucideIcons.lock,
              size: 18,
              color: isSelected
                  ? PavalonColors.goldBright
                  : PavalonColors.slate300),
        ),
      ),
    );
  }

  Widget _backgroundChoice(AuthProvider auth, User user, String name,
      String asset, Set<String> unlocked) {
    final isUnlocked = unlocked.contains(name);
    final isSelected = user.selectedBackground == name;
    return GestureDetector(
      onTap: isUnlocked
          ? () => auth.updateUserLocal(user.copyWith(selectedBackground: name))
          : null,
      child: Opacity(
        opacity: isUnlocked ? 1 : 0.35,
        child: Container(
          width: 64,
          height: 44,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
                color:
                    isSelected ? PavalonColors.goldBright : PavalonColors.slate700,
                width: 2),
            image:
                DecorationImage(image: AssetImage(asset), fit: BoxFit.cover),
          ),
          child: isUnlocked
              ? null
              : const Center(child: Icon(LucideIcons.lock, size: 14)),
        ),
      ),
    );
  }

  Widget _achievementRow(Achievement a) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: a.unlocked
            ? const Color(0xFF14532D).withValues(alpha: 0.2)
            : PavalonColors.slate800.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
            color: a.unlocked
                ? PavalonColors.success.withValues(alpha: 0.4)
                : PavalonColors.slate700),
      ),
      child: Row(
        children: [
          Text(a.icon.isEmpty ? '🏆' : a.icon,
              style: const TextStyle(fontSize: 26)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(a.name,
                    style: const TextStyle(fontWeight: FontWeight.bold)),
                Text(a.description,
                    style: const TextStyle(
                        fontSize: 12, color: PavalonColors.slate400)),
                if (a.rewards.isNotEmpty)
                  Text(
                      'Rewards: ${a.rewards.map((r) => r.name).join(', ')}',
                      style: const TextStyle(
                          fontSize: 11, color: PavalonColors.goldBright)),
              ],
            ),
          ),
          Icon(a.unlocked ? LucideIcons.checkCircle : LucideIcons.lock,
              size: 18,
              color: a.unlocked
                  ? PavalonColors.success
                  : PavalonColors.slate600),
        ],
      ),
    );
  }
}
