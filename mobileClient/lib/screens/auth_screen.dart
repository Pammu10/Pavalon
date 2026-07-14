import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../services/api_service.dart';
import '../services/google_auth.dart';
import '../state/auth_provider.dart';
import '../state/game_provider.dart';
import '../widgets/common.dart';
import '../widgets/dynamic_background.dart';

/// Login / register (port of AuthScreen.tsx). Google Sign-In needs the
/// project owner's OAuth config and is intentionally not wired in v1.
class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _username = TextEditingController();
  final _password = TextEditingController();
  bool _isRegister = false;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    // Submit stays disabled until both fields are filled, as on the web.
    _username.addListener(() => setState(() {}));
    _password.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _username.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _googleSignIn() async {
    final auth = context.read<AuthProvider>();
    final game = context.read<GameProvider>();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final accessToken = await GoogleAuth.getAccessToken();
      if (accessToken == null) return; // user cancelled the picker
      final isNewUser = await auth.googleLogin(accessToken);
      if (isNewUser) {
        game.notify(
            'Welcome! You can change your username in Settings.',
            kind: 'success');
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'Google sign-in failed. Please try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _submit() async {
    final auth = context.read<AuthProvider>();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (_isRegister) {
        await auth.register(_username.text.trim(), _password.text);
      } else {
        await auth.login(_username.text.trim(), _password.text);
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'Could not reach the server.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: DynamicBackground(
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Text('PAVALON',
                      style: eagle(48, shadows: [
                        const Shadow(
                            color: Color(0x80EAB308), blurRadius: 25)
                      ])),
                  const SizedBox(height: 32),
                  PavalonCard(
                    child: Column(
                      children: [
                        Text(_isRegister ? 'Register' : 'Login',
                            style: eagle(30, color: Colors.white,
                                weight: FontWeight.normal)),
                        const SizedBox(height: 24),
                        if (!kIsWeb) ...[
                          GoogleButton(
                            label: _isRegister
                                ? 'Sign up with Google'
                                : 'Sign in with Google',
                            onPressed: _busy ? null : _googleSignIn,
                          ),
                          const SizedBox(height: 12),
                          const Text(
                            'Already have an account? Log in normally, then link Google in settings for easy sign-in.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                                color: PavalonColors.slate400, fontSize: 12),
                          ),
                          const SizedBox(height: 16),
                          Row(children: [
                            const Expanded(
                                child:
                                    Divider(color: PavalonColors.slate700)),
                            const Padding(
                              padding: EdgeInsets.symmetric(horizontal: 8),
                              child: Text('OR',
                                  style: TextStyle(
                                      color: PavalonColors.slate500)),
                            ),
                            const Expanded(
                                child:
                                    Divider(color: PavalonColors.slate700)),
                          ]),
                          const SizedBox(height: 16),
                        ],
                        TextField(
                          controller: _username,
                          textInputAction: TextInputAction.next,
                          style: const TextStyle(
                              fontSize: 18, color: Colors.white),
                          decoration:
                              const InputDecoration(hintText: 'Username'),
                        ),
                        const SizedBox(height: 16),
                        TextField(
                          controller: _password,
                          obscureText: true,
                          onSubmitted: (_) => _submit(),
                          style: const TextStyle(
                              fontSize: 18, color: Colors.white),
                          decoration:
                              const InputDecoration(hintText: 'Password'),
                        ),
                        if (_error != null) ...[
                          const SizedBox(height: 12),
                          Text(_error!,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                  color: PavalonColors.evil, fontSize: 14)),
                        ],
                        const SizedBox(height: 16),
                        PavalonButton(
                          label: _isRegister ? 'Create Account' : 'Log In',
                          onPressed: _username.text.trim().isNotEmpty &&
                                  _password.text.isNotEmpty
                              ? _submit
                              : null,
                          busy: _busy,
                          expand: true,
                        ),
                        const SizedBox(height: 16),
                        TextButton(
                          onPressed: () =>
                              setState(() => _isRegister = !_isRegister),
                          child: Text(
                            _isRegister
                                ? 'Already have an account? Login'
                                : 'Need an account? Register',
                            style: const TextStyle(
                                color: PavalonColors.slate400, fontSize: 16),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
