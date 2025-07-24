
import React, { useState } from "react";
import { useGame } from "@/components/context/GameContext";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";

interface AuthScreenProps {
  onLoginSuccess?: () => void;
  onRegisterSuccess?: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess, onRegisterSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { login, register, authError, isLoading } = useGame();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && password.trim()) {
      if (isLogin) {
        login({ username, password }, onLoginSuccess);
      } else {
        register({ username, password }, onRegisterSuccess);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="animate-fadeIn flex flex-col items-center justify-center space-y-8 min-h-screen">
      <h1
        className="font-eaglelake text-5xl sm:text-6xl md:text-8xl font-bold text-yellow-500 text-center tracking-wider"
        style={{ textShadow: "0 0 25px rgba(234, 179, 8, 0.5)" }}
      >
        PAVALON
      </h1>

      <Card className="w-full max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col space-y-6">
          <h2 className="font-eaglelake text-3xl text-center text-white">
            {isLogin ? "Login" : "Register"}
          </h2>

          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-slate-900 border-2 border-slate-700 rounded-md p-3 text-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:border-yellow-600 transition"
            required
            maxLength={10}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-900 border-2 border-slate-700 rounded-md p-3 text-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:border-yellow-600 transition"
            required
          />
          {authError && (
            <p className="text-red-500 text-center text-sm">{authError}</p>
          )}
          <Button type="submit" disabled={!username.trim() || !password.trim()}>
            {isLogin ? "Log In" : "Create Account"}
          </Button>
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-center text-slate-400 hover:text-yellow-500 transition"
          >
            {isLogin
              ? "Need an account? Register"
              : "Already have an account? Login"}
          </button>
        </form>
      </Card>
    </div>
  );
};

export default AuthScreen;
