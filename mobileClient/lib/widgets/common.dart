import 'package:flutter/material.dart';
import '../core/theme.dart';

/// Panel styling matching the web's Card component.
class PavalonCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color? borderColor;
  const PavalonCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.borderColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: PavalonColors.slate800.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
            color: borderColor ?? PavalonColors.slate700, width: 1.5),
        boxShadow: const [
          BoxShadow(color: Colors.black38, blurRadius: 12, offset: Offset(0, 4))
        ],
      ),
      child: child,
    );
  }
}

enum PavalonButtonVariant { primary, secondary, danger }

class PavalonButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final PavalonButtonVariant variant;
  final IconData? icon;
  final bool expand;
  final bool busy;

  const PavalonButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = PavalonButtonVariant.primary,
    this.icon,
    this.expand = false,
    this.busy = false,
  });

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (variant) {
      PavalonButtonVariant.primary => (const Color(0xFFCA8A04), Colors.white),
      PavalonButtonVariant.secondary => (PavalonColors.slate700, Colors.white),
      PavalonButtonVariant.danger => (const Color(0xFF991B1B), Colors.white),
    };
    final child = busy
        ? const SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
        : Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (icon != null) ...[Icon(icon, size: 18), const SizedBox(width: 8)],
              Flexible(
                  child: Text(label,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontFamily: 'EagleLake', fontWeight: FontWeight.bold))),
            ],
          );
    final btn = ElevatedButton(
      onPressed: busy ? null : onPressed,
      style: ElevatedButton.styleFrom(backgroundColor: bg, foregroundColor: fg),
      child: child,
    );
    return expand ? SizedBox(width: double.infinity, child: btn) : btn;
  }
}

/// Section heading in the display font with a gold underline, web-style.
class SectionTitle extends StatelessWidget {
  final String text;
  const SectionTitle(this.text, {super.key});
  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.only(bottom: 8),
      margin: const EdgeInsets.only(bottom: 12),
      decoration: const BoxDecoration(
          border: Border(
              bottom: BorderSide(color: PavalonColors.slate700, width: 2))),
      child: Text(text, style: eagle(20), textAlign: TextAlign.center),
    );
  }
}

class PulsingGlow extends StatefulWidget {
  final Widget child;
  final Color color;
  const PulsingGlow({super.key, required this.child, required this.color});
  @override
  State<PulsingGlow> createState() => _PulsingGlowState();
}

class _PulsingGlowState extends State<PulsingGlow>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
      vsync: this, duration: const Duration(seconds: 2))
    ..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (context, child) => Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
                color: widget.color.withValues(alpha: 0.25 + 0.35 * _c.value),
                blurRadius: 16 + 12 * _c.value,
                spreadRadius: 1 + 2 * _c.value),
          ],
        ),
        child: child,
      ),
      child: widget.child,
    );
  }
}
