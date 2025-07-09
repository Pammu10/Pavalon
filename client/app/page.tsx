"use client";

import React, { useState, useEffect } from "react";
import { GameProvider, useGame } from "@/components/context/GameContext";
import AuthScreen from "@/components/screens/AuthScreen";
import LobbyScreen from "@/components/screens/LobbyScreen";
import RoleRevealScreen from "@/components/screens/RoleRevealScreen";
import GameScreen from "@/components/screens/GameScreen";
import EndGameScreen from "@/components/screens/EndGameScreen";
import StatsScreen from "@/components/screens/StatsScreen";
import { Chat } from "@/components/ui/Chat";
import PlayerInfoBar from "@/components/ui/PlayerInfoBar";
import { GamePhase } from "@/types";
import Spinner from "@/components/ui/Spinner";

type Tab = "game" | "chat" | "stats";

const ReconnectionBanner: React.FC<{
  player: { name: string; endsAt: number };
}> = ({ player }) => {
  const [timeLeft, setTimeLeft] = useState(
    Math.round((player.endsAt - Date.now()) / 1000)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const seconds = Math.round((player.endsAt - Date.now()) / 1000);
      setTimeLeft(Math.max(0, seconds));
    }, 1000);
    return () => clearInterval(interval);
  }, [player.endsAt]);

  return (
    <div className="fixed top-0 left-0 w-full bg-yellow-600/90 text-white font-bold text-center p-2 z-[200] flex items-center justify-center gap-4 animate-fadeIn">
      <Spinner size="sm" />
      <span>
        Waiting for {player.name} to reconnect... {timeLeft}s
      </span>
    </div>
  );
};

const MainContent: React.FC = () => {
  const { gameState, isAuthenticated, user, messages, playerId } = useGame();
  const [activeTab, setActiveTab] = useState<Tab>("game");
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (activeTab !== "chat" && lastMessage.senderId !== playerId) {
        setUnreadMessages((prev) => prev + 1);
      }
    }
  }, [messages, activeTab, playerId]);

  const handleTabClick = (tab: Tab) => {
    if (tab === "chat") {
      setUnreadMessages(0);
    }
    setActiveTab(tab);
  };

  if (!isAuthenticated || !user) {
    return <AuthScreen />;
  }

  const renderGameScreen = () => {
    switch (gameState.phase) {
      case GamePhase.LOBBY:
        return <LobbyScreen />;
      case GamePhase.ROLE_REVEAL:
        return <RoleRevealScreen />;
      case GamePhase.TEAM_SELECTION:
      case GamePhase.TEAM_VOTE:
      case GamePhase.QUEST_VOTE:
      case GamePhase.QUEST_RESULT:
      case GamePhase.ASSASSINATION:
        return <GameScreen />;
      case GamePhase.END_GAME:
        return <EndGameScreen />;
      default:
        return <LobbyScreen />;
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "chat":
        return <Chat isMobileView={true} />;
      case "stats":
        return <StatsScreen />;
      case "game":
      default:
        return renderGameScreen();
    }
  };

  const showPlayerInfo =
    gameState.phase !== GamePhase.HOME &&
    gameState.phase !== GamePhase.LOBBY &&
    gameState.phase !== GamePhase.END_GAME &&
    gameState.phase !== GamePhase.ROLE_REVEAL;
  const showTabs = gameState.phase !== GamePhase.HOME;

  return (
    <div className="flex flex-col h-screen w-screen">
      {gameState.reconnectingPlayer && (
        <ReconnectionBanner player={gameState.reconnectingPlayer} />
      )}
      <header className="w-full bg-slate-900/70 backdrop-blur-md border-b border-slate-700 z-40">
        {showPlayerInfo && <PlayerInfoBar />}
        {showTabs && (
          <nav className="flex justify-center">
            {(["game", "chat", "stats"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabClick(tab)}
                className={`relative flex-1 md:flex-none md:px-8 py-3 text-center font-eagleLake text-lg capitalize transition-colors duration-200 ${
                  activeTab === tab
                    ? "text-yellow-500 border-b-2 border-yellow-500"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {tab}
                {tab === "chat" && unreadMessages > 0 && (
                  <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-800"></span>
                )}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-grow p-2 sm:p-4 md:p-6 overflow-y-auto">
        <div className="w-full max-w-7xl mx-auto h-full">
          {renderTabContent()}
        </div>
      </main>
    </div>
  );
};

export default function Home() {
  return (
    <GameProvider>
      <MainContent />
    </GameProvider>
  );
}
