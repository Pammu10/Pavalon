import 'package:audioplayers/audioplayers.dart';

/// Sound effect vocabulary — same set as the web AudioContext.
enum Sfx {
  transition('audio/transition.mp3'),
  questSuccess('audio/good.mp3'),
  questFail('audio/evil.mp3'),
  victory('audio/good_victory.mp3'),
  defeat('audio/evil_victory.mp3'),
  roleReveal('audio/role-reveals.mp3'),
  success('audio/transition.mp3'),
  error('audio/error.mp3'),
  cardSwish('audio/card_swish.mp3'),
  cardFan('audio/card_fan.mp3'),
  dbGameOver('audio/db_game_over.mp3');

  final String asset;
  const Sfx(this.asset);
}

/// BGM + SFX with the web's semantics: looping lobby/game music at low
/// volume, stings that duck the music and restore it when finished.
class AudioService {
  final _bgm = AudioPlayer(playerId: 'bgm');
  final _sfx = AudioPlayer(playerId: 'sfx');
  final _sfx2 = AudioPlayer(playerId: 'sfx2'); // card flips etc. over stings

  bool _muted = false;
  String? _currentBgm;

  AudioService() {
    _bgm.setReleaseMode(ReleaseMode.loop);
  }

  bool get muted => _muted;

  Future<void> setMuted(bool v) async {
    _muted = v;
    if (v) {
      await _bgm.pause();
    } else if (_currentBgm != null) {
      await _bgm.resume();
    }
  }

  Future<void> _playBgm(String asset, double volume) async {
    if (_currentBgm == asset) return;
    _currentBgm = asset;
    await _bgm.stop();
    if (_muted) return;
    await _bgm.play(AssetSource(asset), volume: volume);
  }

  Future<void> playLobbyMusic() => _playBgm('audio/bg-sound.mp3', 0.10);
  Future<void> playInGameMusic() => _playBgm('audio/bg-game.mp3', 0.25);

  Future<void> stopBgm() async {
    _currentBgm = null;
    await _bgm.stop();
  }

  /// Plays a sting. With [duckBgm] the music pauses and resumes when the
  /// sting completes (web's manageBgm behaviour).
  Future<void> play(Sfx sfx, {bool duckBgm = false, bool overlay = false}) async {
    if (_muted && duckBgm) return; // treat big stings as music-level audio
    final player = overlay ? _sfx2 : _sfx;
    if (duckBgm && _currentBgm != null) {
      await _bgm.pause();
      void resume(void _) {
        if (!_muted && _currentBgm != null) _bgm.resume();
      }
      player.onPlayerComplete.first.then(resume).catchError((_) {});
    }
    await player.stop();
    await player.play(AssetSource(sfx.asset), volume: 0.6);
  }

  void dispose() {
    _bgm.dispose();
    _sfx.dispose();
    _sfx2.dispose();
  }
}
