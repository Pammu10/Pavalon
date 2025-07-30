
import React, { useState, useEffect } from "react";
import { useGame } from "@/components/context/GameContext";
import { useAudio } from "@/components/context/AudioContext";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import AchievementsTab from "../ui/AchievementsTab";
import Spinner from "../ui/Spinner";
import { toast } from "sonner";

const RESTART_COOLDOWN_MS = 120000; // 2 minutes

const Toggle: React.FC<{ label: string; enabled: boolean; onToggle: () => void }> = ({ label, enabled, onToggle }) => (
    <div className="flex items-center justify-between bg-slate-800/50 p-3 rounded-lg">
        <span className="text-slate-200">{label}</span>
        <button onClick={onToggle} className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${enabled ? 'bg-yellow-600' : 'bg-slate-600'}`}>
            <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
    </div>
);

const SettingsScreen: React.FC = () => {
  const { settings, updateSettings, logout, gameState, playerId, initiateRestart, kickPlayer, user, updateUsername } = useGame();
  const { isBgmMuted, toggleBgm } = useAudio();
  const [cooldownTime, setCooldownTime] = useState(0);
  
  const [newUsername, setNewUsername] = useState(user?.username || '');
  const [isSavingName, setIsSavingName] = useState(false);

  const isHost = gameState.players.find(p => p.id === playerId)?.isHost ?? false;
  const isGameInProgress = gameState.phase !== "LOBBY" && gameState.phase !== "HOME" && gameState.phase !== "END_GAME";

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
    <div className="animate-fadeIn max-w-2xl mx-auto space-y-6">
      <Card>
        <h2 className="font-eagleLake text-3xl mb-6 text-center text-yellow-500">Settings</h2>
        <div className="space-y-3">
            <Toggle label="Skip Intro Story" enabled={settings.skipIntro} onToggle={handleToggleSkipIntro} />
            <Toggle label="Mute Background Music" enabled={isBgmMuted} onToggle={toggleBgm} />
        </div>

        <div className="mt-6 border-t-2 border-slate-700 pt-4">
            <h3 className="font-eagleLake text-xl mb-4 text-center text-yellow-500">Change Username</h3>
            <div className="flex flex-col sm:flex-row items-stretch gap-3">
                <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="New Username"
                    className="flex-grow bg-slate-800 border-2 border-slate-700 rounded-lg p-3 text-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:border-yellow-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isGameInProgress || isSavingName}
                    maxLength={10}
                />
                <Button 
                    onClick={handleSaveName} 
                    disabled={isGameInProgress || isSavingName || !newUsername.trim() || newUsername.trim() === user?.username || newUsername.trim().length < 3 || newUsername.trim().length > 10}
                    className="w-full sm:w-auto"
                >
                    {isSavingName ? <Spinner size="sm" /> : 'Save'}
                </Button>
            </div>
             {isGameInProgress ? (
                <p className="text-amber-500 text-xs mt-2 text-center">Cannot change username while a game is in progress.</p>
            ) : (
                <>
                  {newUsername.trim().length > 0 && newUsername.trim().length < 3 && <p className="text-red-500 text-xs mt-2 text-center">Username must be at least 3 characters.</p>}
                  {newUsername.trim().length > 10 && <p className="text-red-500 text-xs mt-2 text-center">Username cannot exceed 10 characters.</p>}
                </>
            )}
        </div>
        
        {isHost && isGameInProgress && (
            <div className="mt-6 border-t-2 border-slate-700 pt-4 space-y-4">
                <div>
                    <Button onClick={initiateRestart} disabled={onCooldown || !!gameState.restartVote} className="w-full">
                        {onCooldown ? `Restart on Cooldown (${Math.ceil(cooldownTime / 1000)}s)` : (!!gameState.restartVote ? 'Vote in Progress' : 'Initiate Game Restart')}
                    </Button>
                </div>
                <div className="border-t-2 border-slate-700 pt-4">
                    <h3 className="font-eagleLake text-xl mb-2 text-center text-red-500">Danger Zone</h3>
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

export default SettingsScreen;
