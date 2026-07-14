import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';
import '../core/theme.dart';

/// Panel styling matching the web's Card component:
/// bg-slate-900/40 + backdrop-blur-sm, 1px slate-700/60 border, rounded-xl.
class PavalonCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color? borderColor;
  final bool transparent; // web `bg-transparent` cards keep border + blur only
  const PavalonCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.borderColor,
    this.transparent = false,
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 4, sigmaY: 4),
        child: Container(
          padding: padding,
          decoration: BoxDecoration(
            color: transparent
                ? Colors.transparent
                : PavalonColors.slate900.withValues(alpha: 0.4),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
                color: borderColor ??
                    PavalonColors.slate700.withValues(alpha: 0.6)),
          ),
          child: child,
        ),
      ),
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
  final double? height; // web CTAs: 56 (h-14) or 48 (h-12)
  final bool small; // web `text-sm py-1.5 px-4` (e.g. Log Out)

  const PavalonButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = PavalonButtonVariant.primary,
    this.icon,
    this.expand = false,
    this.busy = false,
    this.height,
    this.small = false,
  });

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (variant) {
      PavalonButtonVariant.primary => (const Color(0xFFCA8A04), Colors.white),
      PavalonButtonVariant.secondary =>
        (PavalonColors.slate700, PavalonColors.slate200),
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
              if (icon != null) ...[Icon(icon, size: 16), const SizedBox(width: 8)],
              Flexible(
                  child: Text(label,
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      style: TextStyle(
                          fontFamily: 'EagleLake',
                          fontSize: small ? 14 : 18,
                          height: 1.15,
                          fontWeight: FontWeight.bold))),
            ],
          );
    final btn = ElevatedButton(
      onPressed: busy ? null : onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: bg,
        foregroundColor: fg,
        disabledBackgroundColor: bg.withValues(alpha: 0.4),
        disabledForegroundColor: fg.withValues(alpha: 0.4),
        padding: small
            ? const EdgeInsets.symmetric(horizontal: 16, vertical: 6)
            : const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        minimumSize: small ? const Size(0, 34) : null,
        fixedSize: height != null ? Size.fromHeight(height!) : null,
      ),
      child: child,
    );
    final sized = height != null && !expand
        ? SizedBox(height: height, child: btn)
        : btn;
    return expand
        ? SizedBox(width: double.infinity, height: height, child: btn)
        : sized;
  }
}

/// Web's "Sign in with Google" button: slate secondary fill with the
/// official G logo.
class GoogleButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  const GoogleButton({super.key, required this.label, this.onPressed});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 56,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: PavalonColors.slate700,
          foregroundColor: Colors.white,
          disabledBackgroundColor:
              PavalonColors.slate700.withValues(alpha: 0.4),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Image.asset('assets/icons/google_g.png', width: 24, height: 24),
            const SizedBox(width: 12),
            Flexible(
              child: Text(label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontFamily: 'EagleLake',
                      fontSize: 17,
                      fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
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
