"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGame } from "@/components/context/GameContext";
import { useAudio } from "@/components/context/AudioContext";
import LobbyScreen from "@/components/screens/LobbyScreen";
import RoleRevealScreen from "@/components/screens/RoleRevealScreen";
import GameScreen from "@/components/screens/GameScreen";
import EndGameScreen from "@/components/screens/EndGameScreen";
import SettingsScreen from "@/components/screens/SettingsScreen";
import LeaderboardScreen from "@/components/screens/LeaderboardScreen";
import RestartVoteOverlay from "@/components/ui/RestartVoteOverlay";
import { Chat } from "@/components/ui/Chat";
import PlayerInfoBar from "@/components/ui/PlayerInfoBar";
import { GamePhase } from "@/types";
import Spinner from "@/components/ui/Spinner";
import {
  Swords,
  MessageSquare,
  Settings,
  Trophy,
  Star,
  ShieldAlert,
  Users,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import AchievementsTab from "@/components/ui/AchievementsTab";
import AdminPage from "@/app/admin/page";
import { useInteraction } from "@/components/context/ClientProviders";
import DragonsBreathScreen from "@/components/screens/DragonsBreathScreen";
import SocialHub from "@/components/ui/SocialHub";

type Tab =
  | "game"
  | "chat"
  | "leaderboard"
  | "achievements"
  | "settings"
  | "gamelog"
  | "admin"
  | "social";

const BASE_TABS_CONFIG: {
  id: Tab;
  label: string;
  icon: React.ReactNode;
  desktop: boolean;
  mobile: boolean;
}[] = [
  {
    id: "game",
    label: "Game",
    icon: <Swords size={24} />,
    desktop: true,
    mobile: true,
  },
  {
    id: "chat",
    label: "Chat & Log",
    icon: <MessageSquare size={24} />,
    desktop: true,
    mobile: false,
  },
  {
    id: "leaderboard",
    label: "Hall of Heroes",
    icon: <Trophy size={24} />,
    desktop: true,
    mobile: true,
  },
   {
    id: "social",
    label: "Social",
    icon: <Users size={24} />,
    desktop: true,
    mobile: true,
  },
  {
    id: "achievements",
    label: "Achievements",
    icon: <Star size={24} />,
    desktop: true,
    mobile: false,
  },
  {
    id: "settings",
    label: "Settings",
    icon: <Settings size={24} />,
    desktop: true,
    mobile: true,
  },
];

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
  const { gameState, messages, user, friendRequests, isSocialHubOpen, openSocialHub, closeSocialHub } = useGame();
  const { playLobbyMusic, playInGameMusic, stopBackgroundMusic } = useAudio();
  const { hasInteracted } = useInteraction();
  const [activeTab, setActiveTab] = useState<Tab>("game");
  const [chatActiveTab, setChatActiveTab] = useState("chat");
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const mainContentRef = useRef<HTMLElement>(null);
  const prevPhase = useRef(gameState.phase);
  const prevTab = useRef(activeTab);
  const prevMessageCountRef = useRef(messages.length);
  const isChatVisible = activeTab === "chat" || isChatOpen;

  useEffect(() => {
    if (gameState.phase !== prevPhase.current || activeTab !== prevTab.current) {
      mainContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
    prevPhase.current = gameState.phase;
    prevTab.current = activeTab;
  }, [gameState.phase, activeTab]);

  const TABS_CONFIG = useMemo(() => {
    let config = [...BASE_TABS_CONFIG];
    if (user?.is_admin) {
      config.push({
        id: "admin",
        label: "Admin Panel",
        icon: <ShieldAlert size={24} />,
        desktop: true,
        mobile: false,
      });
    }
    if (gameState.phase === GamePhase.LOBBY) {
        config = config.filter(tab => tab.id !== 'social');
    }
    return config;
  }, [user?.is_admin, gameState.phase]);

  const desktopTabs = TABS_CONFIG.filter((t) => t.desktop);
  const mobileTabs = TABS_CONFIG.filter((t) => t.mobile);

  useEffect(() => {
    if (!hasInteracted) return;

    const isGamePhase = [
      GamePhase.ROLE_REVEAL,
      GamePhase.TEAM_SELECTION,
      GamePhase.TEAM_VOTE,
      GamePhase.QUEST_VOTE,
      GamePhase.QUEST_RESULT,
      GamePhase.ASSASSINATION,
      GamePhase.DRAGONS_BREATH,
    ].includes(gameState.phase);

    const isLobbyPhase = [GamePhase.HOME, GamePhase.LOBBY].includes(
      gameState.phase
    );

    if (isGamePhase) {
      playInGameMusic();
    } else if (isLobbyPhase) {
      playLobbyMusic();
    } else if (gameState.phase !== GamePhase.END_GAME) {
      stopBackgroundMusic();
    }
  }, [
    gameState.phase,
    hasInteracted,
    playInGameMusic,
    playLobbyMusic,
    stopBackgroundMusic,
  ]);

  // --- Smart Notification Logic ---
  useEffect(() => {
    const currentMessageCount = messages.length;
    // Only process new messages
    if (!isChatVisible && currentMessageCount > prevMessageCountRef.current) {
      const newMessages = messages.slice(prevMessageCountRef.current);
      const countFromOthers = newMessages.filter(
        (msg) =>
          msg.senderUserId !== user?.id && msg.senderId !== "system" && msg.text
      ).length;

      if (countFromOthers > 0) {
        setUnreadMessages((prev) => prev + countFromOthers);
      }
    }
    prevMessageCountRef.current = currentMessageCount;
  }, [messages, user?.id, isChatVisible]);

  useEffect(() => {
    // Reset count whenever chat becomes visible
    if (isChatVisible) {
      setUnreadMessages(0);
    }
  }, [isChatVisible]);
  // --- End Smart Notification Logic ---

  const handleNavigateToProfile = () => {
    const isMobile = window.innerWidth < 768; // Tailwind's `md` breakpoint
    const targetTab = isMobile ? "settings" : "achievements";
    setActiveTab(targetTab);

    // Wait for the DOM to update after tab switch
    setTimeout(() => {
      const element = document.getElementById("profile-customization-card");
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 500);
  };

  const handleOpenChat = () => {
    setIsChatOpen(true);
  };

  const renderGameScreen = () => {
    switch (gameState.phase) {
      case GamePhase.LOBBY:
      case GamePhase.HOME:
        return <LobbyScreen />;
      case GamePhase.ROLE_REVEAL:
        return <RoleRevealScreen />;
      case GamePhase.TEAM_SELECTION:
      case GamePhase.TEAM_VOTE:
      case GamePhase.QUEST_VOTE:
      case GamePhase.QUEST_RESULT:
      case GamePhase.ASSASSINATION:
        return <GameScreen />;
      case GamePhase.DRAGONS_BREATH:
        return <DragonsBreathScreen />;
      case GamePhase.END_GAME:
        return <EndGameScreen />;
      default:
        return <LobbyScreen />;
    }
  };

  const showPlayerInfo =
    gameState.phase !== GamePhase.HOME &&
    gameState.phase !== GamePhase.LOBBY &&
    gameState.phase !== GamePhase.END_GAME &&
    gameState.phase !== GamePhase.ROLE_REVEAL &&
    gameState.phase !== GamePhase.DRAGONS_BREATH;

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as Tab)}
      className="flex flex-col h-[100dvh] w-screen"
    >
      <AnimatePresence>
        {isSocialHubOpen && <SocialHub onClose={closeSocialHub} />}
      </AnimatePresence>
      {gameState.reconnectingPlayer && (
        <ReconnectionBanner player={gameState.reconnectingPlayer} />
      )}
      {gameState.restartVote && <RestartVoteOverlay />}

     
      <header className="w-full bg-slate-900/70 backdrop-blur-md border-b border-slate-700 z-30 flex-shrink-0">
        {showPlayerInfo && (
          <PlayerInfoBar onNavigateToProfile={handleNavigateToProfile} />
        )}
      </header>

      <main
        ref={mainContentRef}
        className="flex-grow p-2 sm:p-4 md:p-6 overflow-y-auto pb-28 md:pb-6 scroll-smooth"
      >
        <div className="w-full max-w-7xl mx-auto">
          <TabsContent value="game" className="mt-0 outline-none">
            {renderGameScreen()}
          </TabsContent>
          <TabsContent value="chat" className="mt-0 outline-none">
            <Chat activeTab={chatActiveTab} onTabChange={setChatActiveTab} />
          </TabsContent>
           <TabsContent value="social" className="mt-0 outline-none">
             <SocialHub asScreen />
          </TabsContent>
          <TabsContent value="settings" className="mt-0 outline-none">
            <SettingsScreen />
          </TabsContent>
          <TabsContent value="leaderboard" className="mt-0 outline-none">
            <LeaderboardScreen />
          </TabsContent>
          <TabsContent value="achievements" className="mt-0 outline-none">
            <AchievementsTab />
          </TabsContent>
          <TabsContent value="admin" className="mt-0 outline-none">
            <AdminPage />
          </TabsContent>
        </div>
      </main>

      {/* MOBILE: Floating Action Buttons */}
      <div className="md:hidden fixed bottom-20 right-4 z-30">
        <button
          onClick={handleOpenChat}
          className="relative flex items-center justify-center w-16 h-16 bg-slate-800/80 backdrop-blur-md border-2 border-yellow-600 rounded-full text-yellow-500 shadow-lg hover:bg-slate-700 hover:border-yellow-500 hover:text-yellow-400 active:scale-95 transition-all pointer-events-auto"
          aria-label="Open chat"
        >
          <MessageSquare size={32} />
          {unreadMessages > 0 && (
            <span className="absolute -top-1 -right-1 w-6 h-6 text-sm flex items-center justify-center bg-red-500 text-white font-sans font-bold rounded-full border-2 border-slate-900">
              {unreadMessages > 9 ? "9+" : unreadMessages}
            </span>
          )}
        </button>
      </div>

      {/* MOBILE: Chat Modal */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            key="chat-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 bg-black/60 z-50"
            onClick={() => setIsChatOpen(false)}
          >
            <motion.div
              key="chat-modal-content"
              initial={{ y: "100%" }}
              animate={{ y: "0%" }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              className="absolute bottom-16 left-0 right-0 h-[calc(100dvh-4rem)] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <Chat
                isMobileView={true}
                onHeaderClose={() => setIsChatOpen(false)}
                activeTab={chatActiveTab}
                onTabChange={setChatActiveTab}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <TabsList className="md:hidden fixed bottom-0 left-0 w-full h-16 flex justify-around bg-slate-900/80 backdrop-blur-xl border-t border-slate-700 z-40 p-0 rounded-none">
        {mobileTabs.map(({ id, label, icon }) => (
          <TabsTrigger
            key={id}
            value={id}
            className="group relative h-full flex-1 flex flex-col items-center justify-center gap-1 text-xs capitalize transition-colors duration-200 
                     text-slate-400 data-[state=active]:text-yellow-500 font-eagleLake
                     focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=active]:bg-transparent data-[state=active]:shadow-none p-0"
          >
            {icon}
            <span className="mt-[-2px]">{label}</span>
             {id === 'social' && friendRequests.length > 0 && (
                <span className="absolute top-1 right-1 w-5 h-5 text-xs flex items-center justify-center bg-blue-500 text-white font-sans font-bold rounded-full border-2 border-slate-900">
                    {friendRequests.length}
                </span>
            )}
            <div className="absolute top-0 w-12 h-1 rounded-b-full bg-transparent group-data-[state=active]:bg-yellow-500"></div>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
};

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const { gameState, isAuthenticated, isLoading } = useGame();
  const roomCodeFromUrl = params.roomCode as string;

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace(`/join/${roomCodeFromUrl}`);
      return;
    }

    
    if (gameState.roomCode !== roomCodeFromUrl) {
      router.replace("/");
    }
  }, [isLoading, isAuthenticated, gameState.roomCode, roomCodeFromUrl, router]);


  if (isLoading || !isAuthenticated || gameState.roomCode !== roomCodeFromUrl) {
    return (
      <div className="flex items-center justify-center h-screen w-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  
  return <MainContent />;
}
