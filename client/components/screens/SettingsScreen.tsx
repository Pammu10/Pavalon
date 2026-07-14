import React, { useState, useEffect } from "react";
import { useGame } from "@/components/context/GameContext";
import { useAudio } from "@/components/context/AudioContext";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import AchievementsTab from "../ui/AchievementsTab";
import Spinner from "../ui/Spinner";
import { toast } from "sonner";
import { useGoogleLogin } from '@react-oauth/google';
import GoogleAuthProvider from "@/components/context/GoogleAuthProvider";
import { TUTORIAL_SEEN_KEY } from "@/components/ui/TutorialPromptModal";
import { BookOpen } from "lucide-react";

const RESTART_COOLDOWN_MS = 120000; // 2 minutes

const Toggle: React.FC<{ label: string; enabled: boolean; onToggle: () => void }> = ({ label, enabled, onToggle }) => (
    <div className="flex items-center justify-between bg-slate-800/50 p-3 rounded-lg">
        <span className="text-slate-200">{label}</span>
        <button onClick={onToggle} className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${enabled ? 'bg-yellow-600' : 'bg-slate-600'}`}>
            <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
    </div>
);

const GoogleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-6 h-6">
        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.519-3.487-11.187-8.264l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C42.021,35.596,44,30.138,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
    </svg>
);

const SettingsScreen: React.FC = () => {
  const { settings, updateSettings, logout, gameState, playerId, initiateRestart, kickPlayer, user, updateUsername, linkGoogleAccount, joinRoom } = useGame();
  const { isBgmMuted, toggleBgm } = useAudio();
  const [cooldownTime, setCooldownTime] = useState(0);
  
  const [newUsername, setNewUsername] = useState(user?.username || '');
  const [isSavingName, setIsSavingName] = useState(false);
  const [usernameCooldown, setUsernameCooldown] = useState('');


  const isHost = gameState.players.find(p => p.id === playerId)?.isHost ?? false;
  const isGameInProgress = gameState.phase !== "LOBBY" && gameState.phase !== "HOME" && gameState.phase !== "END_GAME";

  const handleLinkGoogle = useGoogleLogin({
      onSuccess: (tokenResponse) => {
          linkGoogleAccount(tokenResponse.access_token);
      },
      onError: () => {
          toast.error("Failed to link Google Account.");
      },
  });

  useEffect(() => {
    if (user) {
        setNewUsername(user.username);
    }
  }, [user]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (gameState.lastRestartInitiatedAt) {
      const updateCooldown = () => {
        const timePassed = Date.now() - (gameState.lastRestartInitiatedAt ?? 0);
        const remaining = RESTART_COOLDOWN_MS - timePassed;
        setCooldownTime(Math.max(0, remaining));
      };
      updateCooldown();
      interval = setInterval(updateCooldown, 1000);
    }
    return () => clearInterval(interval);
  }, [gameState.lastRestartInitiatedAt]);

  useEffect(() => {
    if (user?.usernameLastChangedAt) {
        const lastChanged = new Date(user.usernameLastChangedAt).getTime();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        const cooldownEnds = lastChanged + sevenDays;

        const interval = setInterval(() => {
            const timeLeft = cooldownEnds - Date.now();
            if (timeLeft <= 0) {
                setUsernameCooldown('');
                clearInterval(interval);
            } else {
                const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                
                let msg = 'You can change your username again in ';
                if (days > 0) msg += `${days}d `;
                if (hours > 0 || days > 0) msg += `${hours}h `;
                msg += `${minutes}m.`;
                setUsernameCooldown(msg);
            }
        }, 1000);

        return () => clearInterval(interval);
    } else {
        setUsernameCooldown('');
    }
}, [user?.usernameLastChangedAt]);

  const onCooldown = cooldownTime > 0;

  const handleSaveName = async () => {
    if (!user || !newUsername.trim() || newUsername.trim() === user.username) {
        return;
    }
    setIsSavingName(true);
    try {
        await updateUsername(newUsername.trim());
    } catch (error) {
        // Error is handled by context toast, revert name in input
        if(user) setNewUsername(user.username);
    } finally {
        setIsSavingName(false);
    }
  }

  const handleToggleSkipIntro = () => {
    updateSettings({ skipIntro: !settings.skipIntro });
  };

  return (
    <div className="animate-fadeIn max-w-2xl mx-auto space-y-6 pb-16 md:pb-0">
      <Card>
        <h2 className="font-eaglelake text-3xl mb-6 text-center text-yellow-500">Settings</h2>
        <div className="space-y-3">
            <Toggle label="Skip Story Intro" enabled={settings.skipIntro} onToggle={handleToggleSkipIntro} />
            <Toggle label="Mute Background Music" enabled={isBgmMuted} onToggle={toggleBgm} />
        </div>

        <div className="mt-6 border-t-2 border-slate-700 pt-4">
            <h3 className="font-eaglelake text-xl mb-4 text-center text-yellow-500">Change Username</h3>
            <div className="flex flex-col sm:flex-row items-stretch gap-3">
                <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="New Username"
                    className="flex-grow bg-slate-800 border-2 border-slate-700 rounded-lg p-3 text-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:border-yellow-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isGameInProgress || isSavingName || !!usernameCooldown}
                    maxLength={10}
                />
                <Button 
                    onClick={handleSaveName} 
                    disabled={isGameInProgress || isSavingName || !!usernameCooldown || !newUsername.trim() || newUsername.trim() === user?.username || newUsername.trim().length < 3 || newUsername.trim().length > 10}
                    className="w-full sm:w-auto"
                >
                    {isSavingName ? <Spinner size="sm" /> : 'Save'}
                </Button>
            </div>
             {isGameInProgress ? (
                <p className="text-amber-500 text-xs mt-2 text-center">Cannot change username while a game is in progress.</p>
            ) : usernameCooldown ? (
                <p className="text-amber-500 text-xs mt-2 text-center">{usernameCooldown}</p>
            ) : (
                <>
                  {newUsername.trim().length > 0 && newUsername.trim().length < 3 && <p className="text-red-500 text-xs mt-2 text-center">Username must be at least 3 characters.</p>}
                  {newUsername.trim().length > 10 && <p className="text-red-500 text-xs mt-2 text-center">Username cannot exceed 10 characters.</p>}
                </>
            )}
        </div>

        {user && !user.isGoogleLinked && (
            <div className="mt-6 border-t-2 border-slate-700 pt-4">
                <h3 className="font-eaglelake text-xl mb-4 text-center text-yellow-500">Link Account</h3>
                <p className="text-center text-slate-400 text-sm mb-4">Connect your Google account for a faster login experience.</p>
                <div className="flex justify-center">
                    <Button
                        variant="secondary"
                        onClick={() => handleLinkGoogle()}
                        className="w-full max-w-xs mx-auto h-14 !text-lg flex items-center justify-center gap-3"
                    >
                        <GoogleIcon />
                        Link Google Account
                    </Button>
                </div>
            </div>
        )}
        
        {isHost && isGameInProgress && (
            <div className="mt-6 border-t-2 border-slate-700 pt-4 space-y-4">
                <div>
                    <Button onClick={initiateRestart} disabled={onCooldown || !!gameState.restartVote} className="w-full">
                        {onCooldown ? `Restart on Cooldown (${Math.ceil(cooldownTime / 1000)}s)` : (!!gameState.restartVote ? 'Vote in Progress' : 'Initiate Game Restart')}
                    </Button>
                </div>
                <div className="border-t-2 border-slate-700 pt-4">
                    <h3 className="font-eaglelake text-xl mb-2 text-center text-red-500">Danger Zone</h3>
                    <p className="text-slate-400 text-center text-xs mb-4">Kicking a player will immediately end the current game for everyone.</p>
                    <div className="space-y-2">
                        {gameState.players.map(p => {
                            if (p.id === playerId) return null; // Can't kick self
                            return (
                                <div key={p.id} className="flex justify-between items-center bg-slate-800/50 p-2 rounded-lg">
                                    <span className="text-slate-200">{p.name}</span>
                                    <Button variant="danger" onClick={() => kickPlayer(p.id)} className="text-sm py-1 px-3">
                                        Kick
                                    </Button>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        )}

        <div className="mt-6 border-t-2 border-slate-700 pt-4">
            <h3 className="font-eaglelake text-xl mb-2 text-center text-yellow-500">How to Play</h3>
            <p className="text-slate-400 text-sm text-center mb-4">
                Replay the interactive tutorial to brush up on the rules.
            </p>
            <Button
                variant="secondary"
                onClick={() => {
                    // Clear the "seen" flag so the prompt reappears next time
                    localStorage.removeItem(TUTORIAL_SEEN_KEY);
                    joinRoom('TUTORIAL');
                }}
                disabled={isGameInProgress}
                className="w-full flex items-center justify-center gap-2"
            >
                <BookOpen size={16} />
                Replay Tutorial
            </Button>
            {isGameInProgress && (
                <p className="text-amber-500 text-xs mt-2 text-center">Cannot start tutorial while a game is in progress.</p>
            )}
        </div>

        <div className="mt-6 border-t-2 border-slate-700 pt-4">
            <Button onClick={logout} variant="danger" className="w-full">Log Out</Button>
        </div>
        
      </Card>
      
      {/* Profile & Achievements Section only for mobile*/}
      <div className="md:hidden">
        <AchievementsTab />
      </div>
    </div>
  );
};

const SettingsScreenWithGoogle: React.FC = () => (
    <GoogleAuthProvider>
        <SettingsScreen />
    </GoogleAuthProvider>
);

export default SettingsScreenWithGoogle;