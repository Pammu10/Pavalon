
"use client";

import React, { useState, useEffect } from "react";
import { useGame } from "@/components/context/GameContext";
import AuthScreen from "@/components/screens/AuthScreen";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import { useRouter } from "next/navigation";

const JoinHostView: React.FC = () => {
  const { joinRoom, user, logout } = useGame();
  const [roomCode, setRoomCode] = useState("");

  return (
    <div className="animate-fadeIn flex flex-col items-center justify-center space-y-8 min-h-[90vh]">
      <h1
        className="font-eaglelake text-5xl sm:text-6xl font-bold text-yellow-500 text-center tracking-wider"
        style={{ textShadow: "0 0 25px rgba(234, 179, 8, 0.5)" }}
      >
        PAVALON: THE SHATTERED THRONE
      </h1>
      <div className="text-center">
        <p className="text-slate-300 text-lg">
          Welcome,{" "}
          <span className="font-bold text-white">{user?.username}</span>!
        </p>
        <Button
          variant="danger"
          onClick={logout}
          className="text-sm py-1 px-3 mt-2"
        >
          Log Out
        </Button>
      </div>

      <Card className="w-full max-w-md">
        <div className="flex flex-col space-y-6">
          <Button onClick={() => joinRoom()} className="w-full">
            Host New Game
          </Button>
          <div className="flex items-center text-slate-500">
            <hr className="flex-grow border-slate-700" />
            <span className="px-2">OR</span>
            <hr className="flex-grow border-slate-700" />
          </div>
          <div className="flex flex-col gap-4 w-full">
            <input
              type="text"
              placeholder="Room Code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              className="w-full bg-slate-900 border-2 border-slate-700 rounded-md p-3 text-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:border-yellow-600 uppercase transition"
            />
            <Button
              variant="secondary"
              onClick={() => joinRoom(roomCode)}
              disabled={!roomCode.trim()}
              className="w-full"
            >
              Join Game
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};


export default function Home() {
  const { isAuthenticated, isLoading, gameState, settings } = useGame();
  const router = useRouter();
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    if (settings.skipIntro) {
      setShowIntro(false);
    }
  }, [settings.skipIntro]);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen">
        <Spinner size="lg" />
      </div>
    );
  }
  
  if (isAuthenticated && gameState.roomCode) {
    router.replace(`/game/${gameState.roomCode}`);
    return (
        <div className="flex items-center justify-center h-screen w-screen">
            <Spinner size="lg" />
            <p className="ml-4 text-white">Redirecting to your game...</p>
        </div>
    )
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return (
    <main className="flex-grow p-2 sm:p-4 md:p-6 overflow-y-auto scroll-smooth">
      <JoinHostView />
    </main>
  );
}
