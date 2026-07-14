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
  int _customizeTab = 0; // 0 border, 1 icon, 2 theme

  // Local, unsaved picks — kept separate from the applied `user` fields so
  // tapping a swatch previews it without committing until Save is pressed
  // (mirrors web's AchievementsTab preview/apply split).
  String? _selBorder;
  String? _selIcon;
  String? _selBackground;

  @override
  void initState() {
    super.initState();
    final user = context.read<AuthProvider>().user;
    _selBorder = user?.selectedBorder;
    _selIcon = user?.selectedIcon;
    _selBackground = user?.selectedBackground;
    _load();
  }

  @override
  void dispose() {
    _title.dispose();
    // Leaving without saving: drop the live background preview override.
    context.read<AuthProvider>().setPreviewBackground(null);
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
            border: _selBorder,
            icon: _selIcon,
            background: _selBackground,
          );
      auth.updateUserLocal(user.copyWith(
        selectedTitle: _title.text.trim().isEmpty ? null : _title.text.trim(),
        selectedBorder: _selBorder ?? '',
        selectedIcon: _selIcon ?? '',
        selectedBackground: _selBackground ?? '',
      ));
      auth.setPreviewBackground(null); // now equals the applied value
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
      selectedBorder: _selBorder,
      selectedIcon: _selIcon,
      selectedBackground: _selBackground,
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

          PavalonCard(
            child: Column(
              children: [
                Text('Profile Customization',
                    style: eagle(20), textAlign: TextAlign.center),
                const SizedBox(height: 14),
                Text('LIVE PREVIEW',
                    style: const TextStyle(
                        fontSize: 11,
                        letterSpacing: 1.5,
                        color: PavalonColors.slate500)),
                const SizedBox(height: 10),
                Transform.scale(
                  scale: 1.25,
                  child: PlayerTile(player: previewPlayer, allowMarks: false),
                ),
                const SizedBox(height: 22),
                TextField(
                  controller: _title,
                  maxLength: 10,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    labelText: 'Custom title',
                    hintText: 'The Brave',
                    filled: true,
                    fillColor: PavalonColors.slate800,
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                ),
                const SizedBox(height: 14),
                _customizeTabBar(),
                const SizedBox(height: 12),
                AnimatedSwitcher(
                  duration: const Duration(milliseconds: 200),
                  child: KeyedSubtree(
                    key: ValueKey(_customizeTab),
                    child: switch (_customizeTab) {
                      0 => _borderGrid(unlocked),
                      1 => _iconGrid(unlocked),
                      _ => _backgroundGallery(user, unlocked),
                    },
                  ),
                ),
                const SizedBox(height: 16),
                PavalonButton(
                    label: 'Save & Apply',
                    expand: true,
                    busy: _saving,
                    onPressed: _save),
              ],
            ),
          ),

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

  Widget _customizeTabBar() {
    Widget tab(int i, IconData icon, String label) {
      final active = _customizeTab == i;
      return Expanded(
        child: GestureDetector(
          onTap: () => setState(() => _customizeTab = i),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(
              color: active
                  ? PavalonColors.slate700
                  : PavalonColors.slate800.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(9),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon,
                    size: 16,
                    color: active
                        ? PavalonColors.goldBright
                        : PavalonColors.slate400),
                const SizedBox(height: 3),
                Text(label,
                    style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.bold,
                        color: active
                            ? PavalonColors.goldBright
                            : PavalonColors.slate400)),
              ],
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: PavalonColors.slate800.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          tab(0, LucideIcons.shield, 'Border'),
          const SizedBox(width: 4),
          tab(1, LucideIcons.userRound, 'Icon'),
          const SizedBox(width: 4),
          tab(2, LucideIcons.image, 'Theme'),
        ],
      ),
    );
  }

  Widget _swatchGrid(List<Widget> children) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: PavalonColors.slate900.withValues(alpha: 0.4),
          border: Border.all(color: PavalonColors.slate700),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Wrap(spacing: 10, runSpacing: 10, children: children),
      );

  Widget _borderGrid(Set<String> unlocked) => _swatchGrid([
        _borderChoice(null, unlocked),
        for (final name in kBorderStyles.keys.where((k) => k != 'gold'))
          _borderChoice(name, unlocked),
      ]);

  Widget _borderChoice(String? name, Set<String> unlocked) {
    final isUnlocked = name == null || unlocked.contains(name);
    final isSelected = (_selBorder ?? '') == (name ?? '');
    final spec = name != null ? kBorderStyles[name] : null;
    return GestureDetector(
      onTap: isUnlocked ? () => setState(() => _selBorder = name ?? '') : null,
      child: Opacity(
        opacity: isUnlocked ? 1 : 0.35,
        child: AnimatedScale(
          scale: isSelected ? 1.08 : 1.0,
          duration: const Duration(milliseconds: 150),
          child: Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              gradient:
                  spec != null ? LinearGradient(colors: spec.gradient) : null,
              color: spec == null ? PavalonColors.slate700 : null,
              border: Border.all(
                  color: isSelected
                      ? PavalonColors.goldBright
                      : Colors.transparent,
                  width: 2.5),
              boxShadow: [
                if (isSelected)
                  BoxShadow(
                      color: (spec?.glow ?? PavalonColors.gold)
                          .withValues(alpha: 0.5),
                      blurRadius: 10),
              ],
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
      ),
    );
  }

  Widget _iconGrid(Set<String> unlocked) => _swatchGrid([
        for (final entry in kIconMap.entries)
          _iconChoice(entry.key, entry.value, unlocked),
      ]);

  Widget _iconChoice(String name, IconData icon, Set<String> unlocked) {
    final isUnlocked = unlocked.contains(name);
    final isSelected = _selIcon == name;
    return GestureDetector(
      onTap: isUnlocked ? () => setState(() => _selIcon = name) : null,
      child: Opacity(
        opacity: isUnlocked ? 1 : 0.35,
        child: Container(
          width: 46,
          height: 46,
          decoration: BoxDecoration(
            color: isSelected
                ? PavalonColors.gold.withValues(alpha: 0.25)
                : PavalonColors.slate800,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
                color: isSelected
                    ? PavalonColors.goldBright
                    : PavalonColors.slate700,
                width: 2),
          ),
          child: Icon(isUnlocked ? icon : LucideIcons.lock,
              size: 19,
              color: isSelected
                  ? PavalonColors.goldBright
                  : PavalonColors.slate300),
        ),
      ),
    );
  }

  Widget _backgroundGallery(User user, Set<String> unlocked) {
    final applied = user.selectedBackground ?? '';
    final entries = kBackgrounds.entries.toList();
    return SizedBox(
      height: 230,
      child: GridView.builder(
        scrollDirection: Axis.horizontal,
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 3 / 4,
        ),
        itemCount: entries.length,
        itemBuilder: (context, i) {
          final name = entries[i].key;
          final asset = entries[i].value;
          return _backgroundChoice(
              name, kBackgroundNames[name] ?? name, asset, applied, unlocked);
        },
      ),
    );
  }

  Widget _backgroundChoice(String name, String label, String asset,
      String applied, Set<String> unlocked) {
    final isUnlocked = unlocked.contains(name);
    final isApplied = applied == name;
    final isPreviewed = _selBackground == name;
    final ringColor = isApplied
        ? PavalonColors.goldBright
        : isPreviewed
            ? PavalonColors.good
            : Colors.transparent;
    return GestureDetector(
      onTap: isUnlocked
          ? () {
              setState(() => _selBackground = name);
              context.read<AuthProvider>().setPreviewBackground(name);
            }
          : null,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: ringColor, width: 3),
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          fit: StackFit.expand,
          children: [
            Image.asset(asset,
                fit: BoxFit.cover,
                color: isUnlocked ? null : Colors.black,
                colorBlendMode: isUnlocked ? null : BlendMode.saturation),
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Colors.transparent, Colors.black87],
                  ),
                ),
                child: Text(label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: isApplied
                            ? PavalonColors.goldBright
                            : Colors.white)),
              ),
            ),
            if (!isUnlocked)
              Container(
                color: Colors.black.withValues(alpha: 0.55),
                child:
                    const Icon(LucideIcons.lock, color: Colors.white70, size: 22),
              ),
          ],
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
