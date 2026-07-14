import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../state/auth_provider.dart';
import '../widgets/common.dart';

/// Hall of Heroes (port of LeaderboardScreen.tsx): title card, 2x2 tab
/// grid (Pavalon Stats / Dragon Breath / Pavalon Ranks / Dragon Ranks),
/// stat tiles + alignment bars + match history, and rank list cards.
class LeaderboardScreen extends StatefulWidget {
  const LeaderboardScreen({super.key});
  @override
  State<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends State<LeaderboardScreen> {
  int _tab = 0;
  PlayerStats? _stats;
  Map<String, dynamic>? _dbStats;
  Map<String, List<LeaderboardEntry>>? _pavalon;
  Map<String, List<LeaderboardEntry>>? _dragons;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = context.read<ApiService>();
    try {
      final results = await Future.wait([
        api.getStats(),
        api.getDragonsBreathStats(),
        api.getLeaderboard(),
        api.getDragonsBreathLeaderboard(),
      ]);
      if (!mounted) return;
      setState(() {
        _stats = results[0] as PlayerStats;
        _dbStats = results[1] as Map<String, dynamic>;
        _pavalon = results[2] as Map<String, List<LeaderboardEntry>>;
        _dragons = results[3] as Map<String, List<LeaderboardEntry>>;
      });
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final username = context.watch<AuthProvider>().user?.username;

    return RefreshIndicator(
      color: PavalonColors.gold,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(8),
        children: [
          PavalonCard(
            child: Text('Hall of Heroes',
                textAlign: TextAlign.center,
                style: eagle(34, shadows: [
                  const Shadow(color: Color(0x66EAB308), blurRadius: 15)
                ])),
          ),
          const SizedBox(height: 24),
          _TabGrid(
            index: _tab,
            onSelect: (i) => setState(() => _tab = i),
          ),
          const SizedBox(height: 24),
          ...switch (_tab) {
            0 => _myStats(),
            1 => _dragonStats(),
            2 => _rankLists(_pavalon, const [
                ('totalWins', 'Total Wins', LucideIcons.trophy, Color(0xFFFACC15)),
                ('winRate', 'Highest Win Rate', LucideIcons.trendingUp,
                    Color(0xFF4ADE80)),
                ('topAssassins', 'Top Assassins', LucideIcons.target,
                    Color(0xFFF87171)),
                ('winStreaks', 'Longest Win Streaks', LucideIcons.crown,
                    Color(0xFFFBBF24)),
                ('bestGood', 'Best of Good', LucideIcons.shieldCheck,
                    Color(0xFF60A5FA)),
                ('bestEvil', 'Best of Evil', LucideIcons.skull,
                    Color(0xFFC084FC)),
              ], username),
            _ => _rankLists(_dragons, const [
                ('mostWins', 'Most Wins', LucideIcons.trophy, Color(0xFFFACC15)),
                ('mostDefuses', 'Master of Defusal', LucideIcons.shield,
                    Color(0xFF4ADE80)),
                ('mostSees', 'The Oracle', LucideIcons.eye, Color(0xFFC084FC)),
                ('mostAttacks', 'Chief Aggressor', LucideIcons.swords,
                    Color(0xFFFB923C)),
                ('mostFillers', 'Dragon Hoarder', LucideIcons.heart,
                    Color(0xFFF472B6)),
              ], username),
          },
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  List<Widget> _loading() => const [
        Padding(
          padding: EdgeInsets.all(30),
          child: Center(
              child: CircularProgressIndicator(color: PavalonColors.gold)),
        )
      ];

  // --- My Pavalon Stats (web MyStatsTab) ---
  List<Widget> _myStats() {
    final s = _stats;
    if (s == null) return _loading();
    return [
      PavalonCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('My Pavalon Stats', style: eagle(28)),
            const SizedBox(height: 24),
            _StatTile(
                title: 'Total Wins',
                value: '${s.totalWins}',
                icon: LucideIcons.trophy),
            const SizedBox(height: 16),
            _StatTile(
                title: 'Total Games',
                value: '${s.totalGames}',
                icon: LucideIcons.swords),
            const SizedBox(height: 16),
            _StatTile(
                title: 'Overall Win Rate',
                value: '${s.winRate}%',
                icon: LucideIcons.trendingUp),
            const SizedBox(height: 24),
            Center(
                child: Text('Performance by Alignment',
                    style: eagle(20, color: Colors.white))),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: PavalonColors.slate900.withValues(alpha: 0.4),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(children: [
                _WinRateBar(
                    label: 'Good Win Rate',
                    rate: s.goodWinRate,
                    games: s.goodGames,
                    color: const Color(0xFF3B82F6),
                    labelColor: const Color(0xFF60A5FA)),
                const SizedBox(height: 16),
                _WinRateBar(
                    label: 'Evil Win Rate',
                    rate: s.evilWinRate,
                    games: s.evilGames,
                    color: const Color(0xFFDC2626),
                    labelColor: const Color(0xFFF87171)),
              ]),
            ),
            const SizedBox(height: 24),
            Center(
                child: Text('Recent Match History',
                    style: eagle(20, color: Colors.white))),
            const SizedBox(height: 8),
            if (s.recentMatches.isEmpty)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Center(
                    child: Text('No matches played yet. The battlefield awaits!',
                        style: TextStyle(
                            color: PavalonColors.slate400,
                            fontStyle: FontStyle.italic))),
              )
            else
              for (final m in s.recentMatches.take(10)) ...[
                _MatchRow(match: m),
                const SizedBox(height: 8),
              ],
          ],
        ),
      ),
    ];
  }

  // --- Dragon's Breath stats (web DragonsBreathStatsTab) ---
  List<Widget> _dragonStats() {
    final d = _dbStats;
    if (d == null) return _loading();
    final total = ((d['totalGames'] as num?) ?? 0).toInt();
    if (total == 0) {
      return [
        PavalonCard(
          padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 16),
          child: Column(children: [
            const Icon(LucideIcons.flame,
                size: 48, color: PavalonColors.slate500),
            const SizedBox(height: 16),
            Text('No Games Played', style: eagle(24, color: PavalonColors.slate300)),
            const SizedBox(height: 8),
            const Text(
              "You haven't played any Dragon's Breath games yet.\nChallenge a friend in a 2-player lobby!",
              textAlign: TextAlign.center,
              style: TextStyle(color: PavalonColors.slate400),
            ),
          ]),
        )
      ];
    }
    final wins = ((d['totalWins'] as num?) ?? 0).toInt();
    final opponents = (d['opponentStats'] as List?) ?? const [];
    final history = (d['matchHistory'] as List?) ?? const [];
    return [
      PavalonCard(
        child: Column(children: [
          Text('Overall Performance', style: eagle(28)),
          const SizedBox(height: 24),
          _StatTile(
              title: 'Total Games', value: '$total', icon: LucideIcons.swords),
          const SizedBox(height: 16),
          _StatTile(
              title: 'Total Wins', value: '$wins', icon: LucideIcons.trophy),
        ]),
      ),
      if (opponents.isNotEmpty) ...[
        const SizedBox(height: 24),
        PavalonCard(
          child: Column(children: [
            Text('Head-to-Head', style: eagle(28)),
            const SizedBox(height: 16),
            for (final op in opponents) _HeadToHeadRow(op: op as Map<String, dynamic>),
          ]),
        ),
      ],
      if (history.isNotEmpty) ...[
        const SizedBox(height: 24),
        PavalonCard(
          child: Column(children: [
            Text('Recent Matches', style: eagle(28)),
            const SizedBox(height: 16),
            for (final m in history)
              _DbMatchRow(m: m as Map<String, dynamic>),
          ]),
        ),
      ],
    ];
  }

  // --- Rank lists (web LeaderboardList) ---
  List<Widget> _rankLists(
      Map<String, List<LeaderboardEntry>>? data,
      List<(String, String, IconData, Color)> boards,
      String? username) {
    if (data == null) return _loading();
    return [
      for (final (key, title, icon, color) in boards) ...[
        _LeaderboardList(
          title: title,
          icon: icon,
          iconColor: color,
          entries: data[key] ?? const [],
          isPercent: key == 'winRate',
          username: username,
        ),
        const SizedBox(height: 24),
      ]
    ];
  }
}

/// 2x2 tab grid: bg-slate-800/50 container, active cell slate-700 + gold text.
class _TabGrid extends StatelessWidget {
  final int index;
  final ValueChanged<int> onSelect;
  const _TabGrid({required this.index, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    const tabs = [
      (LucideIcons.user, 'Pavalon Stats'),
      (LucideIcons.flame, 'Dragon Breath'),
      (LucideIcons.trophy, 'Pavalon Ranks'),
      (LucideIcons.trophy, 'Dragon Ranks'),
    ];
    Widget cell(int i) {
      final active = index == i;
      return Expanded(
        child: Semantics(
          button: true,
          selected: active,
          label: tabs[i].$2,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => onSelect(i),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: BoxDecoration(
                color: active ? PavalonColors.slate700 : Colors.transparent,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(tabs[i].$1,
                      size: 18,
                      color: active
                          ? PavalonColors.goldBright
                          : PavalonColors.slate300),
                  const SizedBox(width: 8),
                  Text(tabs[i].$2,
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: active
                              ? PavalonColors.goldBright
                              : PavalonColors.slate300)),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: PavalonColors.slate800.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(children: [
        Row(children: [cell(0), const SizedBox(width: 4), cell(1)]),
        const SizedBox(height: 4),
        Row(children: [cell(2), const SizedBox(width: 4), cell(3)]),
      ]),
    );
  }
}

/// Web StatCard: slate-800/50 tile, gold icon, uppercase label, big value.
class _StatTile extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  const _StatTile(
      {required this.title, required this.value, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: PavalonColors.slate800.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(children: [
        Icon(icon, size: 24, color: PavalonColors.goldBright),
        const SizedBox(height: 8),
        Text(title.toUpperCase(),
            style: const TextStyle(
                color: PavalonColors.slate400,
                fontSize: 13,
                fontWeight: FontWeight.bold,
                letterSpacing: 1.2)),
        const SizedBox(height: 8),
        Text(value, style: eagle(36, color: Colors.white)),
      ]),
    );
  }
}

class _WinRateBar extends StatelessWidget {
  final String label;
  final int rate;
  final int games;
  final Color color;
  final Color labelColor;
  const _WinRateBar(
      {required this.label,
      required this.rate,
      required this.games,
      required this.color,
      required this.labelColor});

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(label,
              style: TextStyle(
                  color: labelColor,
                  fontSize: 14,
                  fontWeight: FontWeight.bold)),
          Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text('($games games)',
                style: const TextStyle(
                    color: PavalonColors.slate400, fontSize: 12)),
            const SizedBox(width: 8),
            Text('$rate%',
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold)),
          ]),
        ],
      ),
      const SizedBox(height: 4),
      ClipRRect(
        borderRadius: BorderRadius.circular(999),
        child: SizedBox(
          height: 10,
          child: Row(children: [
            Expanded(
                flex: rate.clamp(0, 100),
                child: Container(color: color)),
            Expanded(
                flex: 100 - rate.clamp(0, 100),
                child: Container(color: PavalonColors.slate700)),
          ]),
        ),
      ),
    ]);
  }
}

class _MatchRow extends StatelessWidget {
  final MatchRecord match;
  const _MatchRow({required this.match});

  @override
  Widget build(BuildContext context) {
    final won = match.won;
    final date = DateTime.tryParse(match.playedAt);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: (won ? const Color(0xFF166534) : const Color(0xFF991B1B))
            .withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(match.role,
                style: const TextStyle(
                    color: Colors.white, fontWeight: FontWeight.bold)),
            Text(
                date != null
                    ? '${date.month}/${date.day}/${date.year}'
                    : match.playedAt,
                style: const TextStyle(
                    color: PavalonColors.slate400, fontSize: 12)),
          ]),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: (won ? const Color(0xFF14532D) : const Color(0xFF7F1D1D))
                  .withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(won ? 'Victory' : 'Defeat',
                style: TextStyle(
                    fontFamily: 'EagleLake',
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: won
                        ? const Color(0xFF86EFAC)
                        : const Color(0xFFFCA5A5))),
          ),
        ],
      ),
    );
  }
}

class _HeadToHeadRow extends StatelessWidget {
  final Map<String, dynamic> op;
  const _HeadToHeadRow({required this.op});

  @override
  Widget build(BuildContext context) {
    final games = ((op['gamesPlayed'] as num?) ?? 0).toInt();
    final wins = ((op['wins'] as num?) ?? 0).toInt();
    final rate = ((op['winRate'] as num?) ?? 0).toInt();
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: PavalonColors.slate800.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text('${op['opponentName']}',
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold)),
          Text('$games games',
              style: const TextStyle(
                  color: PavalonColors.slate400, fontSize: 14)),
        ]),
        const SizedBox(height: 8),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text('Your Wins: $wins',
              style: const TextStyle(
                  color: Color(0xFF60A5FA),
                  fontSize: 14,
                  fontWeight: FontWeight.w600)),
          Text('Opponent Wins: ${games - wins}',
              style: const TextStyle(
                  color: Color(0xFFF87171),
                  fontSize: 14,
                  fontWeight: FontWeight.w600)),
        ]),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: SizedBox(
            height: 12,
            child: Row(children: [
              Expanded(
                  flex: rate.clamp(0, 100),
                  child: Container(color: const Color(0xFF3B82F6))),
              Expanded(
                  flex: 100 - rate.clamp(0, 100),
                  child: Container(color: const Color(0xFFDC2626))),
            ]),
          ),
        ),
        const SizedBox(height: 8),
        Text('$rate% Win Rate',
            style: const TextStyle(
                color: PavalonColors.goldBright,
                fontSize: 14,
                fontWeight: FontWeight.bold)),
      ]),
    );
  }
}

class _DbMatchRow extends StatelessWidget {
  final Map<String, dynamic> m;
  const _DbMatchRow({required this.m});

  @override
  Widget build(BuildContext context) {
    final won = m['won'] == true;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: (won ? const Color(0xFF166534) : const Color(0xFF991B1B))
            .withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text.rich(TextSpan(text: 'vs ', children: [
              TextSpan(
                  text: '${m['opponentName']}',
                  style: const TextStyle(fontWeight: FontWeight.bold)),
            ]), style: const TextStyle(color: Colors.white)),
            Text('${m['playedAt'] ?? ''}',
                style: const TextStyle(
                    color: PavalonColors.slate400, fontSize: 12)),
          ]),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: (won ? const Color(0xFF14532D) : const Color(0xFF7F1D1D))
                  .withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(won ? 'VICTORY' : 'DEFEAT',
                style: TextStyle(
                    fontFamily: 'EagleLake',
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: won
                        ? const Color(0xFF86EFAC)
                        : const Color(0xFFFCA5A5))),
          ),
        ],
      ),
    );
  }
}

/// Web LeaderboardList card: darker fill, icon-in-circle header, ranked rows,
/// gold highlight for the current user, "Your Rank" footer when off-list.
class _LeaderboardList extends StatelessWidget {
  final String title;
  final IconData icon;
  final Color iconColor;
  final List<LeaderboardEntry> entries;
  final bool isPercent;
  final String? username;
  const _LeaderboardList({
    required this.title,
    required this.icon,
    required this.iconColor,
    required this.entries,
    required this.isPercent,
    required this.username,
  });

  @override
  Widget build(BuildContext context) {
    final top = entries.take(10).toList();
    final userIndex = entries.indexWhere((e) => e.username == username);
    final userInTop = top.any((e) => e.username == username);

    Widget row(int rank, LeaderboardEntry e, {bool highlight = false}) {
      final rankColor = switch (rank) {
        1 => const Color(0xFFFACC15),
        2 => PavalonColors.slate300,
        3 => const Color(0xFFD97706),
        _ => PavalonColors.slate400,
      };
      return Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: highlight
              ? const Color(0xFF854D0E).withValues(alpha: 0.6)
              : rank <= 3
                  ? PavalonColors.slate700.withValues(alpha: 0.5)
                  : PavalonColors.slate800.withValues(alpha: 0.3),
          borderRadius: BorderRadius.circular(8),
          border: highlight
              ? Border.all(color: const Color(0xFFCA8A04), width: 2)
              : null,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(children: [
              SizedBox(
                  width: 24,
                  child: Text('$rank',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          color: rankColor,
                          fontSize: 18,
                          fontWeight: FontWeight.bold))),
              const SizedBox(width: 16),
              Text(e.username,
                  style: const TextStyle(
                      color: Colors.white, fontWeight: FontWeight.w600)),
            ]),
            Text('${e.value}${isPercent ? '%' : ''}',
                style: const TextStyle(
                    color: Color(0xFFFDE047),
                    fontSize: 18,
                    fontWeight: FontWeight.bold)),
          ],
        ),
      );
    }

    return PavalonCard(
      borderColor: PavalonColors.slate700.withValues(alpha: 0.6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.only(bottom: 12),
            margin: const EdgeInsets.only(bottom: 16),
            decoration: const BoxDecoration(
                border: Border(
                    bottom:
                        BorderSide(color: PavalonColors.slate700, width: 2))),
            child: Row(children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: const BoxDecoration(
                    color: PavalonColors.slate800, shape: BoxShape.circle),
                child: Icon(icon, size: 24, color: iconColor),
              ),
              const SizedBox(width: 12),
              Expanded(child: Text(title, style: eagle(22))),
            ]),
          ),
          if (entries.isEmpty)
            const Padding(
              padding: EdgeInsets.all(16),
              child: Center(
                  child: Text('The chronicles are yet unwritten.',
                      style: TextStyle(
                          color: PavalonColors.slate500,
                          fontStyle: FontStyle.italic))),
            )
          else
            for (var i = 0; i < top.length; i++)
              row(i + 1, top[i], highlight: top[i].username == username),
          if (!userInTop && userIndex >= 0) ...[
            Container(
              width: double.infinity,
              margin: const EdgeInsets.only(top: 8, bottom: 8),
              padding: const EdgeInsets.only(top: 16),
              decoration: const BoxDecoration(
                  border: Border(
                      top: BorderSide(
                          color: PavalonColors.slate700, width: 2))),
              child: const Center(
                  child: Text('Your Rank',
                      style: TextStyle(
                          color: PavalonColors.slate400,
                          fontSize: 13,
                          fontWeight: FontWeight.bold))),
            ),
            row(userIndex + 1, entries[userIndex], highlight: true),
          ],
        ],
      ),
    );
  }
}
