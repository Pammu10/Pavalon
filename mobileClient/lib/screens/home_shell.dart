import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../state/auth_provider.dart';
import '../state/social_provider.dart';
import '../widgets/dynamic_background.dart';
import 'home_screen.dart';
import 'leaderboard_screen.dart';
import 'settings_screen.dart';
import 'social_screen.dart';

/// Out-of-room shell (port of the web MainPageView, mobile layout):
/// bottom navigation between Home / Hall Of Heroes / Social / Settings.
/// Achievements live inside Settings, as on the mobile web layout.
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
      LeaderboardScreen(),
      SocialScreen(),
      SettingsScreen(),
    ];

    return Scaffold(
      extendBody: true,
      body: DynamicBackground(
        child: SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.only(bottom: 64),
            child: IndexedStack(index: _tab, children: pages),
          ),
        ),
      ),
      bottomNavigationBar: _PavalonNavBar(
        index: _tab,
        onSelect: (i) => setState(() => _tab = i),
        socialBadge: requests,
        isAdmin: isAdmin,
      ),
    );
  }
}

/// Web mobile tab bar: translucent blurred slate, 1px top border, gold
/// active icon + label, thin gold indicator bar at the very top of the tab.
class _PavalonNavBar extends StatelessWidget {
  final int index;
  final ValueChanged<int> onSelect;
  final int socialBadge;
  final bool isAdmin;
  const _PavalonNavBar({
    required this.index,
    required this.onSelect,
    required this.socialBadge,
    required this.isAdmin,
  });

  @override
  Widget build(BuildContext context) {
    final items = [
      (LucideIcons.swords, 'Home', 0),
      (LucideIcons.trophy, 'Hall Of Heroes', 0),
      (LucideIcons.users, 'Social', socialBadge),
      (isAdmin ? LucideIcons.shieldAlert : LucideIcons.settings, 'Settings', 0),
    ];
    final bottomInset = MediaQuery.of(context).padding.bottom;

    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
        child: Container(
          height: 64 + bottomInset,
          padding: EdgeInsets.only(bottom: bottomInset),
          decoration: BoxDecoration(
            color: PavalonColors.slate900.withValues(alpha: 0.2),
            border: const Border(
                top: BorderSide(color: PavalonColors.slate700)),
          ),
          child: Row(
            children: [
              for (var i = 0; i < items.length; i++)
                Expanded(
                  child: Semantics(
                    button: true,
                    selected: index == i,
                    label: items[i].$2,
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => onSelect(i),
                      child: _NavItem(
                        icon: items[i].$1,
                        label: items[i].$2,
                        active: index == i,
                        badge: items[i].$3,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool active;
  final int badge;
  const _NavItem({
    required this.icon,
    required this.label,
    required this.active,
    required this.badge,
  });

  @override
  Widget build(BuildContext context) {
    final color = active ? PavalonColors.gold : PavalonColors.slate400;
    return Stack(
      alignment: Alignment.center,
      children: [
        Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 24, color: color),
            const SizedBox(height: 2),
            Text(label,
                maxLines: 1,
                overflow: TextOverflow.visible,
                softWrap: false,
                style: TextStyle(
                    fontFamily: 'EagleLake', fontSize: 11, color: color)),
          ],
        ),
        // Active indicator: 48x4 gold bar hugging the top edge.
        Positioned(
          top: 0,
          child: Container(
            width: 48,
            height: 4,
            decoration: BoxDecoration(
              color: active ? PavalonColors.gold : Colors.transparent,
              borderRadius: const BorderRadius.vertical(
                  bottom: Radius.circular(999)),
            ),
          ),
        ),
        if (badge > 0)
          Positioned(
            top: 6,
            right: 22,
            child: Container(
              width: 18,
              height: 18,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: const Color(0xFF3B82F6),
                shape: BoxShape.circle,
                border: Border.all(color: PavalonColors.slate900, width: 2),
              ),
              child: Text('$badge',
                  style: const TextStyle(
                      fontSize: 10,
                      color: Colors.white,
                      fontWeight: FontWeight.bold)),
            ),
          ),
      ],
    );
  }
}
