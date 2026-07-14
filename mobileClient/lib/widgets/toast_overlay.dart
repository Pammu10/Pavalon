import 'dart:async';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../state/game_provider.dart';

/// Root-level toast host — replaces the bare Material SnackBar with a
/// themed, stacked toast stream (port of the web's sonner toasts). Mount
/// once near the top of the widget tree (MaterialApp's `builder`) so it
/// survives navigation between the auth/home/game shells.
class ToastHost extends StatefulWidget {
  final Widget child;
  const ToastHost({super.key, required this.child});

  @override
  State<ToastHost> createState() => _ToastHostState();
}

class _ToastEntry {
  final int id;
  final AppNotice notice;
  _ToastEntry(this.id, this.notice);
}

class _ToastHostState extends State<ToastHost> {
  final List<_ToastEntry> _toasts = [];
  int _nextId = 0;
  StreamSubscription<AppNotice>? _sub;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _sub = context.read<GameProvider>().notices.listen(_push);
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  void _push(AppNotice notice) {
    if (!mounted) return;
    final id = _nextId++;
    setState(() => _toasts.add(_ToastEntry(id, notice)));
    final duration = notice.kind == 'invite'
        ? const Duration(seconds: 10)
        : const Duration(seconds: 4);
    Timer(duration, () => _dismiss(id));
  }

  void _dismiss(int id) {
    if (!mounted) return;
    setState(() => _toasts.removeWhere((t) => t.id == id));
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        widget.child,
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  for (final t in _toasts)
                    _ToastCard(
                      key: ValueKey(t.id),
                      notice: t.notice,
                      onDismiss: () => _dismiss(t.id),
                    ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _ToastCard extends StatelessWidget {
  final AppNotice notice;
  final VoidCallback onDismiss;
  const _ToastCard({super.key, required this.notice, required this.onDismiss});

  (Color, IconData) _style() => switch (notice.kind) {
        'error' => (PavalonColors.evilDeep, LucideIcons.circleX),
        'success' || 'achievement' => (
            PavalonColors.success,
            LucideIcons.circleCheck
          ),
        'invite' => (PavalonColors.good, LucideIcons.mail),
        _ => (PavalonColors.gold, LucideIcons.info),
      };

  @override
  Widget build(BuildContext context) {
    final (accent, icon) = _style();
    return Dismissible(
      key: key!,
      direction: DismissDirection.horizontal,
      onDismissed: (_) => onDismiss(),
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: 1),
        duration: const Duration(milliseconds: 280),
        curve: Curves.easeOutBack,
        builder: (context, v, child) => Opacity(
          opacity: v.clamp(0.0, 1.0),
          child: Transform.translate(
              offset: Offset(0, -18 * (1 - v)), child: child),
        ),
        child: Container(
          margin: const EdgeInsets.only(bottom: 8),
          decoration: BoxDecoration(
            color: PavalonColors.slate900.withValues(alpha: 0.96),
            borderRadius: BorderRadius.circular(12),
            border: Border(left: BorderSide(color: accent, width: 4)),
            boxShadow: const [
              BoxShadow(
                  color: Colors.black54, blurRadius: 14, offset: Offset(0, 3)),
            ],
          ),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              Icon(icon, color: accent, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(notice.text,
                    style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                        fontSize: 13.5)),
              ),
              if (notice.invite != null)
                TextButton(
                  onPressed: () {
                    context
                        .read<GameProvider>()
                        .acceptInvite(notice.invite!.roomCode);
                    onDismiss();
                  },
                  child: Text('JOIN',
                      style: TextStyle(
                          color: accent, fontWeight: FontWeight.bold)),
                )
              else
                GestureDetector(
                  onTap: onDismiss,
                  child: const Padding(
                    padding: EdgeInsets.all(4),
                    child: Icon(LucideIcons.x,
                        size: 16, color: PavalonColors.slate500),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
