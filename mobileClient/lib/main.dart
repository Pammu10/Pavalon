import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/theme.dart';
import 'services/api_service.dart';
import 'services/audio_service.dart';
import 'services/haptics.dart';
import 'services/session_store.dart';
import 'services/socket_service.dart';
import 'services/voice_service.dart';
import 'state/auth_provider.dart';
import 'state/game_provider.dart';
import 'state/social_provider.dart';
import 'screens/auth_screen.dart';
import 'screens/game_shell.dart';
import 'screens/home_shell.dart';
import 'widgets/toast_overlay.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final store = await SessionStore.load();
  Haptics.enabled = store.hapticsEnabled;

  final api = ApiService();
  final socketService = SocketService();
  final audio = AudioService();
  await audio.setMuted(store.bgmMuted);

  runApp(PavalonApp(
    store: store,
    api: api,
    socketService: socketService,
    audio: audio,
  ));
}

class PavalonApp extends StatelessWidget {
  final SessionStore store;
  final ApiService api;
  final SocketService socketService;
  final AudioService audio;

  const PavalonApp({
    super.key,
    required this.store,
    required this.api,
    required this.socketService,
    required this.audio,
  });

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider.value(value: store),
        Provider.value(value: api),
        Provider.value(value: audio),
        ChangeNotifierProvider(
            create: (_) => AuthProvider(api: api, store: store)..init()),
        ChangeNotifierProvider(
            create: (_) =>
                GameProvider(socketService: socketService, audio: audio)),
        ChangeNotifierProvider(
            create: (_) =>
                SocialProvider(api: api, socketService: socketService)),
        ChangeNotifierProvider(create: (_) => VoiceService(api: api)),
      ],
      child: MaterialApp(
        title: 'Pavalon',
        debugShowCheckedModeBanner: false,
        theme: buildPavalonTheme(),
        builder: (context, child) => ToastHost(child: child!),
        home: const RootGate(),
      ),
    );
  }
}

/// Auth gate + socket lifecycle + global notice snackbars.
class RootGate extends StatefulWidget {
  const RootGate({super.key});
  @override
  State<RootGate> createState() => _RootGateState();
}

class _RootGateState extends State<RootGate> with WidgetsBindingObserver {
  bool _socketStarted = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Coming back to the app: revive the socket so the server's
    // session-resume can kick in.
    if (state == AppLifecycleState.resumed) {
      final auth = context.read<AuthProvider>();
      final game = context.read<GameProvider>();
      if (auth.status == AuthStatus.signedIn &&
          auth.token != null &&
          !game.socketService.connected) {
        game.connect(auth.token!);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final game = context.watch<GameProvider>();

    final roomCode = context.select<GameProvider, String?>((g) => g.gameState.roomCode);
    context.read<VoiceService>().syncRoom(roomCode);

    switch (auth.status) {
      case AuthStatus.loading:
        return const Scaffold(
            body: Center(
                child: CircularProgressIndicator(color: PavalonColors.gold)));
      case AuthStatus.signedOut:
        if (_socketStarted) {
          _socketStarted = false;
          game.socketService.disconnect();
        }
        return const AuthScreen();
      case AuthStatus.signedIn:
        if (!_socketStarted && auth.token != null) {
          _socketStarted = true;
          game.connect(auth.token!);
        }
        return game.gameState.roomCode != null
            ? const GameShell()
            : const HomeShell();
    }
  }
}
