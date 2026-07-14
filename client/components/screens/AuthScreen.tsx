import React, { useState, useRef, useEffect } from "react";
import { useGame } from "@/components/context/GameContext";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import { useGoogleLogin } from '@react-oauth/google';
import GoogleAuthProvider from "@/components/context/GoogleAuthProvider";
import { toast } from "sonner";

interface AuthScreenProps {
  onLoginSuccess?: () => void;
  onRegisterSuccess?: () => void;
}

const GoogleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-6 h-6">
        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.519-3.487-11.187-8.264l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C42.021,35.596,44,30.138,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
    </svg>
);

const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess, onRegisterSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { login, register, authError, isLoading, googleLogin } = useGame();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const formRef = useRef<HTMLFormElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const prevAuthError = useRef(authError);
  
  useEffect(() => {
    // If authError appears or changes, we know the submission failed.
    if (authError && prevAuthError.current !== authError) {
        setIsSubmitting(false);
    }
    prevAuthError.current = authError;
  }, [authError]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !username.trim() || !password.trim()) return;

    setIsSubmitting(true);
    if (isLogin) {
      login({ username, password }, onLoginSuccess);
    } else {
      register({ username, password }, onRegisterSuccess);
    }
  };

  const handleUsernameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      passwordInputRef.current?.focus();
    }
  };

  const handlePasswordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (username.trim() && password.trim()) {
            formRef.current?.requestSubmit();
        }
    }
  };
  
  const handleGoogleSuccess = async (tokenResponse: any) => {
      setIsSubmitting(true);
      try {
          await googleLogin(tokenResponse.access_token);
      } catch (error) {
          // Error is handled and toasted in context
      } finally {
          setIsSubmitting(false);
      }
  }

  const handleGoogleLogin = useGoogleLogin({
      onSuccess: handleGoogleSuccess,
      onError: () => {
        toast.error("Google login failed. Please try again.");
      }
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="animate-fadeIn flex flex-col items-center justify-center space-y-8 min-h-screen px-4">
      <h1
        className="font-eaglelake text-5xl sm:text-6xl md:text-8xl font-bold text-yellow-500 text-center tracking-wider"
        style={{ textShadow: "0 0 25px rgba(234, 179, 8, 0.5)" }}
      >
        PAVALON
      </h1>

      <Card className="w-full max-w-md">
        <div className="flex flex-col space-y-6">
          <h2 className="font-eaglelake text-3xl text-center text-white">
            {isLogin ? "Login" : "Register"}
          </h2>
          
           <div className="flex flex-col gap-3">
                <Button
                    variant="secondary"
                    onClick={() => handleGoogleLogin()}
                    className="w-full h-14 !text-lg flex items-center justify-center gap-3"
                    disabled={isSubmitting}
                >
                    <GoogleIcon />
                    {isLogin ? 'Sign in with Google' : 'Sign up with Google'}
                </Button>
                <p className="text-xs text-slate-400 text-center px-4">
                    Already have an account? Log in normally, then link Google in settings for easy sign-in.
                </p>
           </div>

           <div className="flex items-center text-slate-500">
            <hr className="flex-grow border-slate-700" />
            <span className="px-2">OR</span>
            <hr className="flex-grow border-slate-700" />
          </div>

          <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col space-y-4">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleUsernameKeyDown}
              className="w-full bg-slate-900 border-2 border-slate-700 rounded-md p-3 text-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:border-yellow-600 transition"
              required
              maxLength={10}
            />
            <input
              ref={passwordInputRef}
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handlePasswordKeyDown}
              className="w-full bg-slate-900 border-2 border-slate-700 rounded-md p-3 text-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:border-yellow-600 transition"
              required
            />
            {authError && (
              <p className="text-red-500 text-center text-sm">{authError}</p>
            )}
            <Button type="submit" disabled={!username.trim() || !password.trim() || isSubmitting}>
              {isSubmitting ? <Spinner size="sm"/> : (isLogin ? "Log In" : "Create Account")}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-center text-slate-400 hover:text-yellow-500 transition"
          >
            {isLogin
              ? "Need an account? Register"
              : "Already have an account? Login"}
          </button>
        </div>
      </Card>
    </div>
  );
};

const AuthScreenWithGoogle: React.FC<AuthScreenProps> = (props) => (
    <GoogleAuthProvider>
        <AuthScreen {...props} />
    </GoogleAuthProvider>
);

export default AuthScreenWithGoogle;