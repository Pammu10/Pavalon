import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart' as webrtc;
import 'package:livekit_client/livekit_client.dart';
import 'package:permission_handler/permission_handler.dart';

import 'api_service.dart';

enum VoiceStatus { disconnected, connecting, connected, reconnecting, permissionDenied }

class PeerAudioState {
  double volume;
  bool isMuted;
  bool isSpeaking;
  PeerAudioState({this.volume = 1.0, this.isMuted = false, this.isSpeaking = false});
}

/// Manages the LiveKit room lifecycle for the current game room.
/// Identity convention: LiveKit participant identity == String(player.userId).
class VoiceService extends ChangeNotifier {
  VoiceService({required this.api});

  final ApiService api;

  Room? _room;
  EventsListener<RoomEvent>? _listener;
  String? _roomCode;
  bool _isMuted = false;
  bool _isSelfSpeaking = false;
  VoiceStatus _status = VoiceStatus.disconnected;
  final Map<int, PeerAudioState> _peers = {};

  bool get isMuted => _isMuted;
  bool get isSelfSpeaking => _isSelfSpeaking;
  VoiceStatus get status => _status;
  bool isPeerSpeaking(int userId) => _peers[userId]?.isSpeaking ?? false;
  PeerAudioState peerState(int userId) => _peers.putIfAbsent(userId, PeerAudioState.new);

  /// Join/leave so that the connected room matches [roomCode].
  Future<void> syncRoom(String? roomCode) async {
    if (roomCode == _roomCode) return;
    await _disconnect();
    _roomCode = roomCode;
    if (roomCode == null) return;

    final mic = await Permission.microphone.request();
    if (!mic.isGranted) {
      _status = VoiceStatus.permissionDenied;
      notifyListeners();
      return;
    }

    _status = VoiceStatus.connecting;
    notifyListeners();
    try {
      final creds = await api.voiceToken(roomCode);
      final room = Room();
      _room = room;
      _listener = room.createListener()
        ..on<ActiveSpeakersChangedEvent>(_onActiveSpeakers)
        ..on<TrackSubscribedEvent>((e) => _applyPeerAudio(e.participant))
        ..on<ParticipantDisconnectedEvent>((e) {
          final id = int.tryParse(e.participant.identity);
          if (id != null) _peers.remove(id);
          notifyListeners();
        })
        ..on<RoomReconnectingEvent>((_) {
          _status = VoiceStatus.reconnecting;
          notifyListeners();
        })
        ..on<RoomReconnectedEvent>((_) {
          _status = VoiceStatus.connected;
          notifyListeners();
        })
        ..on<RoomDisconnectedEvent>((_) {
          _status = VoiceStatus.disconnected;
          notifyListeners();
        });
      await room.connect(creds.url, creds.token);
      await room.localParticipant?.setMicrophoneEnabled(!_isMuted);
      _status = VoiceStatus.connected;
    } catch (e) {
      debugPrint('[voice] failed to join: $e');
      await _disconnect();
    }
    notifyListeners();
  }

  void _onActiveSpeakers(ActiveSpeakersChangedEvent e) {
    final speaking = e.speakers.map((p) => p.identity).toSet();
    final local = _room?.localParticipant;
    _isSelfSpeaking = local != null && speaking.contains(local.identity);
    _room?.remoteParticipants.forEach((_, p) {
      final id = int.tryParse(p.identity);
      if (id != null) {
        _peers.putIfAbsent(id, PeerAudioState.new).isSpeaking = speaking.contains(p.identity);
      }
    });
    notifyListeners();
  }

  void toggleMute() {
    _isMuted = !_isMuted;
    _room?.localParticipant?.setMicrophoneEnabled(!_isMuted);
    notifyListeners();
  }

  void setPeerVolume(int userId, double volume) {
    peerState(userId).volume = volume;
    _applyPeerAudioById(userId);
    notifyListeners();
  }

  void togglePeerMute(int userId) {
    final s = peerState(userId);
    s.isMuted = !s.isMuted;
    _applyPeerAudioById(userId);
    notifyListeners();
  }

  void _applyPeerAudioById(int userId) {
    final p = _room?.remoteParticipants['$userId'];
    if (p != null) _applyPeerAudio(p);
  }

  void _applyPeerAudio(RemoteParticipant participant) {
    final id = int.tryParse(participant.identity);
    if (id == null) return;
    final s = peerState(id);
    final effective = s.isMuted ? 0.0 : s.volume;
    for (final pub in participant.audioTrackPublications) {
      final track = pub.track;
      if (track != null) {
        webrtc.Helper.setVolume(effective, track.mediaStreamTrack);
      }
    }
  }

  Future<void> _disconnect() async {
    await _listener?.dispose();
    _listener = null;
    await _room?.disconnect();
    await _room?.dispose();
    _room = null;
    _peers.clear();
    _isSelfSpeaking = false;
    _status = VoiceStatus.disconnected;
  }

  @override
  void dispose() {
    _disconnect();
    super.dispose();
  }
}
