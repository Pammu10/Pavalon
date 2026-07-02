"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useGame } from "@/components/context/GameContext";
import AuthScreen from "@/components/screens/AuthScreen";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import { useRouter } from "next/navigation";
import HomeScreen from "@/components/screens/HomeScreen";
import { Tab } from "@/types";
import { Swords, Users, Trophy, Settings, Star, ShieldAlert } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LeaderboardScreen from "@/components/screens/LeaderboardScreen";
import SettingsScreen from "@/components/screens/SettingsScreen";
import AchievementsTab from "@/components/ui/AchievementsTab";
import AdminPage from "@/app/admin/page";
import SocialHub from "@/components/ui/SocialHub";
import TutorialPromptModal, { shouldShowTutorialPrompt, dismissTutorialPrompt } from "@/components/ui/TutorialPromptModal";

const JoinHostView: React.FC = () => {
  const { joinRoom, user, logout, isConnected } = useGame();
  const [roomCode, setRoomCode] = useState("");

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.trim() && isConnected) {
      joinRoom(roomCode);
    }
  };

  return (
    <div className="animate-fadeIn flex flex-col items-center justify-between min-h-full py-4 sm:py-6">
      {/* Top Card: Title */}
      <Card className="w-full max-w-md bg-transparent border-none shadow-none backdrop-blur-none p-0 mb-2">
        <h1
          className="font-eaglelake text-4xl sm:text-5xl font-bold text-yellow-500 text-center tracking-wider leading-tight"
          style={{ textShadow: "0 0 25px rgba(234, 179, 8, 0.5)" }}
        >
          PAVALON: THE SHATTERED THRONE
        </h1>
      </Card>

      {/* Bottom Card: Actions */}
      <div className="w-full max-w-md">
        <Card className="bg-transparent">
          <div className="flex flex-col space-y-4">
            <Button onClick={() => joinRoom()} className="w-full h-14" disabled={!isConnected}>
              {isConnected ? 'Host New Game' : <Spinner size="sm" />}
            </Button>
            <div className="flex items-center text-slate-500">
              <hr className="flex-grow border-slate-700" />
              <span className="px-2">OR</span>
              <hr className="flex-grow border-slate-700" />
            </div>
            <form onSubmit={handleJoinSubmit} className="flex flex-col gap-2 w-full">
              <input
                type="text"
                placeholder="Room Code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                className="w-full bg-slate-900 border-2 border-slate-700 rounded-md p-3 text-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:border-yellow-600 uppercase transition"
              />
              <Button
                type="submit"
                variant="secondary"
                disabled={!roomCode.trim() || !isConnected}
                className="w-full h-14"
              >
                {isConnected ? 'Join Game' : <Spinner size="sm" />}
              </Button>
            </form>
            
            <Button
                variant="secondary"
                onClick={() => joinRoom('TUTORIAL')}
                className="w-full h-12 flex items-center justify-center gap-2"
                disabled={!isConnected}
            >
                How to Play
            </Button>

            <div className="pt-4 border-t border-slate-700 flex items-center justify-between">
              {user && (
                  <p className="text-sm text-slate-400">
                      Logged in as <span className="font-bold text-white">{user.username}</span>
                  </p>
              )}
              <Button
                  variant="danger"
                  onClick={logout}
                  className="text-sm py-1.5 px-4"
              >
                  Log Out
              </Button>
            </div>
          </div>
        </Card>
        {!isConnected && (
          <div className="flex items-center justify-center gap-2 text-yellow-400 mt-4">
              <Spinner size="sm" />
              <p>Connecting to server...</p>
            </div>
        )}
      </div>
    </div>
  );
};


const BASE_TABS_CONFIG: {
  id: Tab;
  label: string;
  icon: React.ReactNode;
  desktop: boolean;
  mobile: boolean;
}[] = [
  { id: "home", label: "Home", icon: <Swords size={24} />, desktop: true, mobile: true },
  { id: "leaderboard", label: "Hall of Heroes", icon: <Trophy size={24} />, desktop: true, mobile: true },
  { id: "social", label: "Social", icon: <Users size={24} />, desktop: true, mobile: true },
  { id: "achievements", label: "Achievements", icon: <Star size={24} />, desktop: true, mobile: false },
  { id: "settings", label: "Settings", icon: <Settings size={24} />, desktop: true, mobile: true },
];

const MainPageView: React.FC = () => {
    const { user, friendRequests, setPreviewBackground, joinRoom } = useGame();
    const [activeTab, setActiveTab] = useState<Tab>("home");
    const [tutorialPromptVariant, setTutorialPromptVariant] = useState<'new' | 'returning' | null>(null);
    const mainContentRef = useRef<HTMLDivElement>(null);
    const prevTab = useRef<Tab>();

    // Check on mount whether to show the tutorial prompt
    useEffect(() => {
        const variant = shouldShowTutorialPrompt();
        if (variant) setTutorialPromptVariant(variant);
    }, []);

    useEffect(() => {
        if (mainContentRef.current) {
            mainContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
        
        const isCustomizationTab = (tab?: Tab) => tab === 'settings' || tab === 'achievements';
        if (isCustomizationTab(prevTab.current) && !isCustomizationTab(activeTab)) {
            setPreviewBackground(null);
        }
        prevTab.current = activeTab;

    }, [activeTab, setPreviewBackground]);
    
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
        return config;
    }, [user?.is_admin]);

    const desktopTabs = TABS_CONFIG.filter((t) => t.desktop);
    const mobileTabs = TABS_CONFIG.filter((t) => t.mobile);
    
    return (
        <>
        {tutorialPromptVariant && user && (
            <TutorialPromptModal
                username={user.username}
                variant={tutorialPromptVariant}
                onStartTutorial={() => {
                    setTutorialPromptVariant(null);
                    joinRoom('TUTORIAL');
                }}
                onDismiss={() => {
                    dismissTutorialPrompt();
                    setTutorialPromptVariant(null);
                }}
            />
        )}
        <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as Tab)}
            className="flex flex-col h-[100dvh] w-screen"
        >
            <header className="w-full bg-slate-900/70 backdrop-blur-md border-b border-slate-700 z-30 flex-shrink-0">
                <TabsList className="hidden md:flex bg-transparent p-0 rounded-none h-auto">
                    {desktopTabs.map(({ id, label }) => (
                        <TabsTrigger
                            key={id}
                            value={id}
                            className="relative flex-1 py-6 font-eagleLake text-lg capitalize transition-colors duration-200 rounded-none 
                                        text-slate-400 data-[state=active]:text-yellow-500 
                                        data-[state=active]:border-b-2 data-[state=active]:border-yellow-500
                                        hover:text-white focus-visible:ring-0 focus-visible:ring-offset-0 
                                        data-[state=active]:shadow-none data-[state=active]:bg-transparent p-0"
                        >
                            {label}
                            {id === "social" && friendRequests.length > 0 && (
                                <span className="absolute top-2 right-4 w-3 h-3 bg-blue-500 rounded-full border-2 border-slate-800"></span>
                            )}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </header>
            
            <main ref={mainContentRef} className="flex-grow p-2 sm:p-4 md:p-6 overflow-y-auto pb-28 md:pb-6 scroll-smooth">
                <div className="w-full max-w-7xl mx-auto h-full">
                    <TabsContent value="home" className="mt-0 outline-none h-full">
                        <JoinHostView />
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
                    {user?.is_admin && (
                         <TabsContent value="admin" className="mt-0 outline-none">
                            <AdminPage />
                        </TabsContent>
                    )}
                </div>
            </main>
            
             <TabsList className="md:hidden fixed bottom-0 left-0 w-full h-16 flex justify-around bg-slate-900/20 backdrop-blur-xl border-t border-slate-700 z-40 p-0 rounded-none">
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
        </>
    );
};


export default function Home() {
  const { isAuthenticated, isLoading, gameState, settings } = useGame();
  const router = useRouter();
  // Initialize state from sessionStorage to prevent flicker on reload.
  const [introCompleted, setIntroCompleted] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem("introCompleted") === "true";
    }
    return false;
  });

  useEffect(() => {
    // If a user is already in a game when they hit the home page (e.g., new tab),
    // automatically mark the intro as completed for this session.
    // This prevents showing the intro if they log out and back in within the same session.
    if (isAuthenticated && gameState.roomCode && !introCompleted) {
      sessionStorage.setItem("introCompleted", "true");
      setIntroCompleted(true);
    }
  }, [isAuthenticated, gameState.roomCode, introCompleted]);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen">
        <Spinner size="lg" />
      </div>
    );
  }
  
  if (isAuthenticated && gameState.roomCode && gameState.roomCode !== 'TUTORIAL') {
    router.replace(`/game/${gameState.roomCode}`);
    return (
        <div className="flex items-center justify-center h-screen w-screen">
            <Spinner size="lg" />
            <p className="ml-4 text-white">Redirecting to your game...</p>
        </div>
    )
  }

  
    if (!introCompleted) {
        return <HomeScreen 
            onEnter={() => {
                sessionStorage.setItem('introCompleted', 'true');
                setIntroCompleted(true);
            }} 
            shouldSkipStory={isAuthenticated && settings.skipIntro}
        />;
    }
    if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return <MainPageView />;
}