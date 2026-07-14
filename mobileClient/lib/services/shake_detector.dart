import 'dart:async';
import 'dart:math';
import 'package:sensors_plus/sensors_plus.dart';

/// Accelerometer shake detection — used to open the emote wheel in-game.
class ShakeDetector {
  final void Function() onShake;
  final double threshold; // g-force
  StreamSubscription<UserAccelerometerEvent>? _sub;
  DateTime _lastShake = DateTime.fromMillisecondsSinceEpoch(0);

  ShakeDetector({required this.onShake, this.threshold = 2.4});

  void start() {
    _sub ??= userAccelerometerEventStream().listen((e) {
      final gForce = sqrt(e.x * e.x + e.y * e.y + e.z * e.z) / 9.81;
      if (gForce > threshold &&
          DateTime.now().difference(_lastShake).inMilliseconds > 1200) {
        _lastShake = DateTime.now();
        onShake();
      }
    }, onError: (_) {}); // devices without the sensor just never fire
  }

  void stop() {
    _sub?.cancel();
    _sub = null;
  }
}
