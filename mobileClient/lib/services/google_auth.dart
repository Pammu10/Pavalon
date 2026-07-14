import 'package:google_sign_in/google_sign_in.dart';

/// Thin wrapper around the google_sign_in plugin. The server's
/// /auth/google and /user/link-google endpoints verify an OAuth access
/// token against Google's userinfo API, so that's all we need here.
class GoogleAuth {
  static final _googleSignIn = GoogleSignIn(scopes: ['email', 'profile']);

  /// Opens the native account picker and returns an access token,
  /// or null if the user cancelled.
  static Future<String?> getAccessToken() async {
    // Sign out first so the account picker always appears instead of
    // silently reusing the previous account.
    await _googleSignIn.signOut();
    final account = await _googleSignIn.signIn();
    if (account == null) return null;
    final auth = await account.authentication;
    return auth.accessToken;
  }
}
