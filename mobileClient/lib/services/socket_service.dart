import 'package:socket_io_client/socket_io_client.dart' as io;
import '../core/config.dart';

/// Socket.io wrapper (mirrors client/services/socketService.ts).
/// Auth token travels in the handshake `auth` payload, same as the web.
class SocketService {
  io.Socket? _socket;

  io.Socket? get socket => _socket;
  bool get connected => _socket?.connected ?? false;
  String? get id => _socket?.id;

  final List<({String event, dynamic Function(dynamic) handler})> _bound = [];

  void connect(String token) {
    if (_socket != null && _socket!.connected) return;
    disconnect();
    _socket = io.io(
      AppConfig.serverUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .setAuth({'token': token})
          .build(),
    );
    for (final b in _bound) {
      _socket!.on(b.event, b.handler);
    }
    _socket!.connect();
  }

  void disconnect() {
    _socket?.dispose();
    _socket = null;
  }

  /// Registers a handler that survives reconnects/new sockets.
  void on(String event, dynamic Function(dynamic) handler) {
    _bound.add((event: event, handler: handler));
    _socket?.on(event, handler);
  }

  void emit(String event, [dynamic data]) {
    if (data == null) {
      _socket?.emit(event);
    } else {
      _socket?.emit(event, data);
    }
  }
}
