import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/constants.dart';
import '../state/auth_provider.dart';

/// Full-bleed animated scene background driven by the user's selected (or
/// previewed) theme — port of the web's DynamicBackground.tsx. Crossfades
/// between scene art with a dark scrim + radial vignette so foreground
/// chrome stays readable.
class DynamicBackground extends StatelessWidget {
  final Widget child;
  const DynamicBackground({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final key = auth.previewBackground ?? auth.user?.selectedBackground ?? '';
    final asset = kBackgrounds[key] ?? kBackgrounds['king']!;

    return Stack(
      fit: StackFit.expand,
      children: [
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 700),
          switchInCurve: Curves.easeOut,
          switchOutCurve: Curves.easeIn,
          layoutBuilder: (currentChild, previousChildren) => Stack(
            fit: StackFit.expand,
            children: [
              ...previousChildren,
              ?currentChild,
            ],
          ),
          child: Image.asset(
            asset,
            key: ValueKey(asset),
            fit: BoxFit.cover,
          ),
        ),
        Container(color: Colors.black.withValues(alpha: 0.30)),
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: RadialGradient(
              center: Alignment.center,
              radius: 1.1,
              colors: [Colors.transparent, Color(0xB3000000)],
              stops: [0.4, 1.0],
            ),
          ),
        ),
        child,
      ],
    );
  }
}
