import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../widgets/common.dart';

/// Hall of Heroes: Pavalon + Dragon's Breath leaderboards
/// (port of LeaderboardScreen.tsx).
class LeaderboardScreen extends StatefulWidget {
  const LeaderboardScreen({super.key});
  @override
  State<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

const _pavalonBoards = {
  'totalWins': 'Total Wins',
  'winRate': 'Win Rate %',
  'topAssassins': 'Top Assassins',
  'winStreaks': 'Best Streaks',
  'bestGood': 'Champions of Good',
  'bestEvil': 'Champions of Evil',
};

const _dbBoards = {
  'mostWins': 'Most Wins',
  'mostDefuses': 'Most Defuses',
  'mostSees': 'Future Seers',
  'mostAttacks': 'Most Attacks',
  'mostFillers': 'Drake Collectors',
};

class _LeaderboardScreenState extends State<LeaderboardScreen> {
  Map<String, List<LeaderboardEntry>>? _pavalon;
  Map<String, List<LeaderboardEntry>>? _dragons;
  bool _showDragons = false;
  String _board = 'totalWins';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = context.read<ApiService>();
    try {
      final results = await Future.wait(
          [api.getLeaderboard(), api.getDragonsBreathLeaderboard()]);
      if (!mounted) return;
      setState(() {
        _pavalon = results[0];
        _dragons = results[1];
      });
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final boards = _showDragons ? _dbBoards : _pavalonBoards;
    final data = _showDragons ? _dragons : _pavalon;
    if (!boards.containsKey(_board)) _board = boards.keys.first;
    final entries = data?[_board] ?? const <LeaderboardEntry>[];

    return RefreshIndicator(
      color: PavalonColors.gold,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Hall of Heroes', style: eagle(26), textAlign: TextAlign.center),
          const SizedBox(height: 12),
          SegmentedButton<bool>(
            segments: const [
              ButtonSegment(value: false, label: Text('Pavalon')),
              ButtonSegment(value: true, label: Text("Dragon's Breath")),
            ],
            selected: {_showDragons},
            onSelectionChanged: (v) => setState(() {
              _showDragons = v.first;
              _board = (_showDragons ? _dbBoards : _pavalonBoards).keys.first;
            }),
            style: SegmentedButton.styleFrom(
              selectedBackgroundColor: PavalonColors.gold,
              selectedForegroundColor: Colors.black,
              foregroundColor: PavalonColors.slate300,
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                for (final e in boards.entries)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(e.value, style: const TextStyle(fontSize: 12)),
                      selected: _board == e.key,
                      selectedColor: PavalonColors.gold,
                      onSelected: (_) => setState(() => _board = e.key),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          if (data == null)
            const Center(
                child: Padding(
              padding: EdgeInsets.all(30),
              child: CircularProgressIndicator(color: PavalonColors.gold),
            ))
          else if (entries.isEmpty)
            const Padding(
              padding: EdgeInsets.all(30),
              child: Text('No champions yet — be the first!',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: PavalonColors.slate500)),
            )
          else
            PavalonCard(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Column(
                children: [
                  for (var i = 0; i < entries.length && i < 25; i++)
                    ListTile(
                      dense: true,
                      leading: SizedBox(
                        width: 34,
                        child: i < 3
                            ? Icon(LucideIcons.medal,
                                color: [
                                  const Color(0xFFFFD700),
                                  const Color(0xFFC0C0C0),
                                  const Color(0xFFCD7F32)
                                ][i])
                            : Text('#${i + 1}',
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                    color: PavalonColors.slate500)),
                      ),
                      title: Text(entries[i].username,
                          style: TextStyle(
                              fontWeight:
                                  i < 3 ? FontWeight.bold : FontWeight.normal)),
                      trailing: Text(
                        '${entries[i].value}${_board == 'winRate' ? '%' : ''}',
                        style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: PavalonColors.goldBright),
                      ),
                    ),
                ],
              ),
            ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}
