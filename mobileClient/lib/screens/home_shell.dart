import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../state/auth_provider.dart';
import '../state/social_provider.dart';
import 'achievements_screen.dart';
import 'home_screen.dart';
import 'leaderboard_screen.dart';
import 'settings_screen.dart';
import 'social_screen.dart';

/// Out-of-room shell: bottom navigation between Home / Social /
/// Achievements / Hall of Heroes / Settings (port of the web MainPageView).
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});
  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _tab = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<SocialProvider>().refresh();
    });
  }

  @override
  Widget build(BuildContext context) {
    final requests = context.watch<SocialProvider>().requests.length;
    final isAdmin = context.watch<AuthProvider>().user?.isAdmin ?? false;

    final pages = const [
      HomeScreen(),
      SocialScreen(),
      AchievementsScreen(),
      LeaderboardScreen(),
      SettingsScreen(),
    ];

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF17153A), PavalonColors.slate900],
          ),
        ),
        child: SafeArea(child: IndexedStack(index: _tab, children: pages)),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        backgroundColor: PavalonColors.slate900,
        indicatorColor: PavalonColors.gold.withValues(alpha: 0.2),
        destinations: [
          const NavigationDestination(
              icon: Icon(LucideIcons.swords), label: 'Home'),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: requests > 0,
              label: Text('$requests'),
              child: const Icon(LucideIcons.users),
            ),
            label: 'Social',
          ),
          const NavigationDestination(
              icon: Icon(LucideIcons.star), label: 'Awards'),
          const NavigationDestination(
              icon: Icon(LucideIcons.trophy), label: 'Heroes'),
          NavigationDestination(
              icon: Icon(
                  isAdmin ? LucideIcons.shieldAlert : LucideIcons.settings),
              label: 'Settings'),
        ],
      ),
    );
  }
}
