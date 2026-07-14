import 'package:flutter/material.dart';

/// Visual language ported from the web client: dark slate surfaces,
/// gold/amber accents, blue for Good, red for Evil, Eagle Lake display font.
class PavalonColors {
  static const slate900 = Color(0xFF0F172A);
  static const slate800 = Color(0xFF1E293B);
  static const slate700 = Color(0xFF334155);
  static const slate600 = Color(0xFF475569);
  static const slate500 = Color(0xFF64748B);
  static const slate400 = Color(0xFF94A3B8);
  static const slate300 = Color(0xFFCBD5E1);
  static const slate200 = Color(0xFFE2E8F0);
  static const gold = Color(0xFFEAB308);
  static const goldBright = Color(0xFFFACC15);
  static const amber = Color(0xFFF59E0B);
  static const good = Color(0xFF60A5FA);
  static const goodDeep = Color(0xFF2563EB);
  static const evil = Color(0xFFF87171);
  static const evilDeep = Color(0xFFDC2626);
  static const success = Color(0xFF4ADE80);
}

/// Profile border styles mirroring the web's `border-style-*` CSS classes.
class BorderStyleSpec {
  final List<Color> gradient;
  final Color glow;
  const BorderStyleSpec(this.gradient, this.glow);
}

const Map<String, BorderStyleSpec> kBorderStyles = {
  'crimson': BorderStyleSpec(
      [Color(0xFFDC2626), Color(0xFF7F1D1D)], Color(0xFFEF4444)),
  'azure': BorderStyleSpec(
      [Color(0xFF38BDF8), Color(0xFF1E3A8A)], Color(0xFF60A5FA)),
  'amethyst': BorderStyleSpec(
      [Color(0xFFA855F7), Color(0xFF581C87)], Color(0xFFC084FC)),
  'golden': BorderStyleSpec(
      [Color(0xFFFACC15), Color(0xFF92400E)], Color(0xFFFBBF24)),
  'gold': BorderStyleSpec(
      [Color(0xFFFACC15), Color(0xFF92400E)], Color(0xFFFBBF24)),
  'sakura': BorderStyleSpec(
      [Color(0xFFF9A8D4), Color(0xFF9D174D)], Color(0xFFF472B6)),
  'silver': BorderStyleSpec(
      [Color(0xFFE5E7EB), Color(0xFF6B7280)], Color(0xFFD1D5DB)),
  'obsidian': BorderStyleSpec(
      [Color(0xFF4B5563), Color(0xFF111827)], Color(0xFF6B7280)),
};

ThemeData buildPavalonTheme() {
  const display = 'EagleLake';
  final base = ThemeData(
    brightness: Brightness.dark,
    useMaterial3: true,
    // Eagle Lake is the web body font — every text run uses it, not just
    // headings.
    fontFamily: display,
    // The web has no ripple/ink affordances.
    splashFactory: NoSplash.splashFactory,
    splashColor: Colors.transparent,
    highlightColor: Colors.transparent,
    scaffoldBackgroundColor: PavalonColors.slate900,
    colorScheme: const ColorScheme.dark(
      primary: PavalonColors.gold,
      secondary: PavalonColors.amber,
      surface: PavalonColors.slate800,
      error: PavalonColors.evilDeep,
    ),
  );
  return base.copyWith(
    textTheme: base.textTheme.copyWith(
      displayLarge: base.textTheme.displayLarge
          ?.copyWith(fontFamily: display, color: PavalonColors.gold),
      displayMedium: base.textTheme.displayMedium
          ?.copyWith(fontFamily: display, color: PavalonColors.gold),
      headlineMedium: base.textTheme.headlineMedium
          ?.copyWith(fontFamily: display, color: PavalonColors.gold),
      headlineSmall: base.textTheme.headlineSmall
          ?.copyWith(fontFamily: display, color: Colors.white),
      titleLarge: base.textTheme.titleLarge?.copyWith(fontFamily: display),
      titleMedium: base.textTheme.titleMedium?.copyWith(fontFamily: display),
    ),
    snackBarTheme: const SnackBarThemeData(
      backgroundColor: PavalonColors.slate800,
      contentTextStyle: TextStyle(color: Colors.white),
      behavior: SnackBarBehavior.floating,
    ),
    // Inputs: web style — solid slate-900 fill, 2px slate-700 border,
    // radius 6, 18px text, slate-500 hint, gold focus border.
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: PavalonColors.slate900,
      hintStyle: const TextStyle(
          fontFamily: display, color: PavalonColors.slate500, fontSize: 18),
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(6),
        borderSide: const BorderSide(color: PavalonColors.slate700, width: 2),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(6),
        borderSide: const BorderSide(color: Color(0xFFCA8A04), width: 2),
      ),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(6),
        borderSide: const BorderSide(color: PavalonColors.slate700, width: 2),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: const Color(0xFFCA8A04),
        foregroundColor: Colors.white,
        textStyle: const TextStyle(
            fontFamily: display, fontSize: 18, fontWeight: FontWeight.bold),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: PavalonColors.slate400,
        textStyle: const TextStyle(fontFamily: display, fontSize: 15),
      ),
    ),
  );
}

/// Display font text style helper (Eagle Lake).
TextStyle eagle(double size,
    {Color color = PavalonColors.gold,
    FontWeight weight = FontWeight.bold,
    List<Shadow>? shadows}) {
  return TextStyle(
    fontFamily: 'EagleLake',
    fontSize: size,
    color: color,
    fontWeight: weight,
    shadows: shadows,
  );
}
