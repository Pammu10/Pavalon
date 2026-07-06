import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../services/api_service.dart';
import '../state/auth_provider.dart';
import '../widgets/common.dart';

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
  void dispose() {
    _username.dispose();
    _password.dispose();
    super.dispose();
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
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF1E1B4B), PavalonColors.slate900],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  const Icon(LucideIcons.castle,
                      size: 72, color: PavalonColors.gold),
                  const SizedBox(height: 12),
                  Text('PAVALON', style: eagle(38, shadows: [
                    const Shadow(color: PavalonColors.gold, blurRadius: 24)
                  ])),
                  Text('THE SHATTERED THRONE',
                      style: eagle(14, color: const Color(0xFFFDE68A))),
                  const SizedBox(height: 32),
                  PavalonCard(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      children: [
                        Text(_isRegister ? 'Create Account' : 'Welcome Back',
                            style: eagle(20, color: Colors.white)),
                        const SizedBox(height: 18),
                        TextField(
                          controller: _username,
                          textInputAction: TextInputAction.next,
                          decoration:
                              _decoration('Username (3–10 characters)'),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _password,
                          obscureText: true,
                          onSubmitted: (_) => _submit(),
                          decoration: _decoration('Password'),
                        ),
                        if (_error != null) ...[
                          const SizedBox(height: 12),
                          Text(_error!,
                              style:
                                  const TextStyle(color: PavalonColors.evil)),
                        ],
                        const SizedBox(height: 18),
                        PavalonButton(
                          label: _isRegister ? 'Register' : 'Log In',
                          onPressed: _submit,
                          busy: _busy,
                          expand: true,
                        ),
                        const SizedBox(height: 12),
                        TextButton(
                          onPressed: () =>
                              setState(() => _isRegister = !_isRegister),
                          child: Text(
                            _isRegister
                                ? 'Already have an account? Log in'
                                : "New to Pavalon? Create an account",
                            style: const TextStyle(
                                color: PavalonColors.slate400),
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

  InputDecoration _decoration(String hint) => InputDecoration(
        hintText: hint,
        filled: true,
        fillColor: PavalonColors.slate900,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: PavalonColors.slate700),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: PavalonColors.slate700),
        ),
      );
}
