import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';

import '../state/auth_provider.dart';
import '../state/game_provider.dart';

/// Chat + game log tabs (port of Chat.tsx / GameLog.tsx), shown as a
/// bottom sheet from the in-game FAB.
class ChatPanel extends StatefulWidget {
  const ChatPanel({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const FractionallySizedBox(
          heightFactor: 0.85, child: ChatPanel()),
    );
  }

  @override
  State<ChatPanel> createState() => _ChatPanelState();
}

class _ChatPanelState extends State<ChatPanel>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 2, vsync: this);
  final _input = TextEditingController();
  final _scroll = ScrollController();

  @override
  void dispose() {
    _tabs.dispose();
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _send() {
    final text = _input.text.trim();
    if (text.isEmpty) return;
    context.read<GameProvider>().sendMessage(text);
    _input.clear();
  }

  @override
  Widget build(BuildContext context) {
    final game = context.watch<GameProvider>();
    final myUserId = context.watch<AuthProvider>().user?.id;

    // Keep pinned to the newest message.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.jumpTo(_scroll.position.maxScrollExtent);
      }
    });

    return Container(
      decoration: const BoxDecoration(
        color: PavalonColors.slate900,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        border: Border(top: BorderSide(color: PavalonColors.slate700)),
      ),
      child: Column(
        children: [
          TabBar(
            controller: _tabs,
            indicatorColor: PavalonColors.gold,
            labelColor: PavalonColors.gold,
            unselectedLabelColor: PavalonColors.slate400,
            tabs: const [Tab(text: 'Chat'), Tab(text: 'Game Log')],
          ),
          Expanded(
            child: TabBarView(
              controller: _tabs,
              children: [
                // --- Chat ---
                ListView.builder(
                  controller: _scroll,
                  padding: const EdgeInsets.all(12),
                  itemCount: game.messages.length,
                  itemBuilder: (context, i) {
                    final m = game.messages[i];
                    if (m.isSystem) {
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: Text(m.text,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                                fontSize: 12,
                                fontStyle: FontStyle.italic,
                                color: PavalonColors.slate500)),
                      );
                    }
                    final mine = m.senderUserId == myUserId;
                    return Align(
                      alignment:
                          mine ? Alignment.centerRight : Alignment.centerLeft,
                      child: Container(
                        margin: const EdgeInsets.symmetric(vertical: 3),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 8),
                        constraints: const BoxConstraints(maxWidth: 280),
                        decoration: BoxDecoration(
                          color: mine
                              ? const Color(0xFF854D0E)
                              : PavalonColors.slate800,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (!mine)
                              Text(m.senderName,
                                  style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      color: PavalonColors.goldBright)),
                            Text(m.text),
                          ],
                        ),
                      ),
                    );
                  },
                ),
                // --- Game log ---
                ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: game.gameState.gameLog.length,
                  itemBuilder: (context, i) {
                    final log = game.gameState.gameLog[
                        game.gameState.gameLog.length - 1 - i];
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(_logIcon(log.type),
                              size: 14, color: _logColor(log.type)),
                          const SizedBox(width: 8),
                          Expanded(
                              child: Text(log.text,
                                  style: TextStyle(
                                      fontSize: 13,
                                      color: _logColor(log.type)))),
                        ],
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 6, 12, 10),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _input,
                      onSubmitted: (_) => _send(),
                      textInputAction: TextInputAction.send,
                      decoration: InputDecoration(
                        hintText: 'Say something...',
                        filled: true,
                        fillColor: PavalonColors.slate800,
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 10),
                        border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(24),
                            borderSide: BorderSide.none),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    onPressed: _send,
                    style: IconButton.styleFrom(
                        backgroundColor: const Color(0xFFCA8A04)),
                    icon: const Icon(LucideIcons.send, size: 18),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  IconData _logIcon(String type) => switch (type) {
        'leader' => LucideIcons.crown,
        'team' => LucideIcons.users,
        'vote' => LucideIcons.vote,
        'quest' => LucideIcons.swords,
        'assassination' => LucideIcons.skull,
        'dragonsBreath' => LucideIcons.flame,
        _ => LucideIcons.info,
      };

  Color _logColor(String type) => switch (type) {
        'leader' => PavalonColors.goldBright,
        'vote' => PavalonColors.good,
        'quest' => PavalonColors.amber,
        'assassination' => PavalonColors.evil,
        'dragonsBreath' => const Color(0xFFFB923C),
        _ => PavalonColors.slate400,
      };
}
