import 'package:flutter/services.dart';

/// Haptic vocabulary ported from client/lib/haptics.ts.
/// Globally toggleable from Settings.
class Haptics {
  static bool enabled = true;

  static void tap() {
    if (enabled) HapticFeedback.selectionClick();
  }

  static void confirm() {
    if (enabled) HapticFeedback.lightImpact();
  }

  static void success() {
    if (enabled) HapticFeedback.mediumImpact();
  }

  static void failure() {
    if (enabled) HapticFeedback.heavyImpact();
  }

  static Future<void> dramatic() async {
    if (!enabled) return;
    await HapticFeedback.heavyImpact();
    await Future.delayed(const Duration(milliseconds: 120));
    await HapticFeedback.heavyImpact();
    await Future.delayed(const Duration(milliseconds: 220));
    await HapticFeedback.heavyImpact();
  }
}
