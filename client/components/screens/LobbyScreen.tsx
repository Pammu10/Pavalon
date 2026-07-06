import React, { useRef, useCallback, useEffect, useMemo, useState } from "react";
import { useGame } from "@/components/context/GameContext";
import { useAudio } from "@/components/context/AudioContext";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Player, Role, Alignment } from "@/types";
import { ROLES, EVIL_PLAYER_COUNT } from "@/constants";
import Spinner from "@/components/ui/Spinner";
import { Copy, LogOut, ShieldAlert, Flame, Check, Users, Bot as BotIcon } from "lucide-react";
import PlayerTile from "@/components/ui/PlayerTile";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const RoleToggle: React.FC<{
  role: Role;
  selected: boolean;
  onToggle: (role: Role) => void;
  disabled?: boolean;
  onDisabledClick?: () => void;
}> = ({ role, selected, onToggle, disabled = false, onDisabledClick }) => (
  <label
    onClick={(e) => {
      if (disabled && onDisabledClick) {
        e.preventDefault();
        onDisabledClick();
      }
    }}
    className={cn(
      'flex items-center p-3 rounded-lg border-2 transition-all',
      selected
        ? "bg-emerald-500/20 border-emerald-400 shadow-lg shadow-emerald-500/10"
        : "bg-slate-800 border-slate-700",
      disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-slate-500"
    )}
  >
    <input
      type="checkbox"
      checked={selected}
      onChange={() => onToggle(role)}
      disabled={disabled}
      className="hidden"
    />
    <div className="flex-grow">
      <p
        className={`font-bold ${
          ROLES[role].alignment === Alignment.GOOD
            ? "text-blue-400"
            : "text-red-500"
        }`}
      >
        {role}
      </p>
      <p className="text-xs text-slate-400">
        {ROLES[role].description.split(".")[0]}
      </p>
    </div>
  </label>
);

const FinalRosterDisplay: React.FC<{ finalRoles: Role[] }> = ({ finalRoles }) => {
  const goodTeam = finalRoles.filter(r => ROLES[r].alignment === Alignment.GOOD);
  const evilTeam = finalRoles.filter(r => ROLES[r].alignment === Alignment.EVIL);

  const rolePriority: Record<Role, number> = {
    // Good
    [Role.MERLIN]: 1,
    [Role.PERCIVAL]: 2,
    [Role.LOYAL_SERVANT]: 9,
    // Evil
    [Role.MORDRED]: 10,
    [Role.MORGANA]: 11,
    [Role.ASSASSIN]: 12,
    [Role.OBERON]: 13,
    [Role.MINION]: 19,
  };

  const TeamPanel: React.FC<{ title: string, team: Role[], color: 'blue' | 'red' }> = ({ title, team, color }) => {
    const baseClasses = 'p-4 rounded-xl border-2 shadow-2xl backdrop-blur-md transition-all duration-300';
    
    const colorClasses = {
      blue: {
        bg: 'bg-blue-950/30',
        border: 'border-blue-500/50',
        text: 'text-blue-300',
        dot: 'bg-blue-400',
        shadow: 'shadow-blue-500/20'
      },
      red: {
        bg: 'bg-red-950/30',
        border: 'border-red-500/50',
        text: 'text-red-300',
        dot: 'bg-red-400',
        shadow: 'shadow-red-500/20'
      }
    };
    const classes = colorClasses[color];
    
    // Sort roles by priority.
    const rolesString = [...team].sort((a, b) => (rolePriority[a] || 99) - (rolePriority[b] || 99)).join(', ');

    return (
      <div 
        className={cn(baseClasses, classes.bg, classes.border, classes.shadow)}
        style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.7)' }}
      >
        <h3 className={`font-eaglelake text-2xl font-bold ${classes.text} flex items-center gap-3 mb-2`}>
          <span className={`w-3 h-3 rounded-full ${classes.dot} shadow-md`}></span>
          {title}
        </h3>
        <p className="text-slate-200 mb-3 text-sm italic min-h-[40px]">
          {rolesString}
        </p>
        <p className="font-bold text-slate-100 border-t border-slate-700 pt-2">
          Total: {team.length} players
        </p>
      </div>
    );
  };

  return (
    <div className="mt-8 mb-6">
       <h3 className="font-eaglelake text-xl font-bold text-yellow-500 mb-4 text-center">
        Final Team Composition
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TeamPanel title="Good Team" team={goodTeam} color="blue" />
        <TeamPanel title="Evil Team" team={evilTeam} color="red" />
      </div>
    </div>
  );
};


const RoleCustomization: React.FC<{
  onStart: () => void;
  isPaused: boolean;
  selectedRoles: Set<Role>;
  onToggleRole: (role: Role) => void;
  validation: { isValid: boolean; message: string };
  disabledRoles: { good: boolean; evil: boolean };
  playerCount: number;
}> = ({ onStart, isPaused, selectedRoles, onToggleRole, validation, disabledRoles, playerCount }) => {
  const { playSound } = useAudio();
  const availableSpecialGood = [Role.PERCIVAL];
  const availableSpecialEvil = [Role.MORGANA, Role.MORDRED, Role.OBERON];
  const requiredEvilCount = EVIL_PLAYER_COUNT[playerCount as keyof typeof EVIL_PLAYER_COUNT] || 0;
  const requiredGoodCount = playerCount - requiredEvilCount;

  const handleDisabledGoodClick = () => {
    toast.error("Good role limit reached!", {
      description: `For ${playerCount} players, you can only have ${requiredGoodCount} Good roles (including Merlin).`
    });
    playSound('error', { manageBgm: false });
  };
  
  const handleDisabledEvilClick = () => {
    toast.error("Evil role limit reached!", {
      description: `For ${playerCount} players, you can only have ${requiredEvilCount} Evil roles (including Assassin).`
    });
    playSound('error', { manageBgm: false });
  };

  const handleDisabledPercivalMorganaClick = () => {
    toast.error("Cannot add Percival & Morgana.", {
      description: "Not enough space for both a Good and an Evil role."
    });
    playSound('error', { manageBgm: false });
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="font-bold mb-2 text-blue-400">Special Good Roles</h4>
          <div className="space-y-2">
            {availableSpecialGood.map((role) => {
              const isPercival = role === Role.PERCIVAL;
              const isSelected = selectedRoles.has(role);

              let isDisabled = false;
              if (isPercival) {
                isDisabled = !isSelected && (disabledRoles.good || disabledRoles.evil);
              } else {
                isDisabled = !isSelected && disabledRoles.good;
              }

              let onDisabledClickHandler = handleDisabledGoodClick;
              if (isPercival && isDisabled) {
                onDisabledClickHandler = handleDisabledPercivalMorganaClick;
              }
              
              return (
                <RoleToggle
                  key={role}
                  role={role}
                  selected={selectedRoles.has(role)}
                  onToggle={onToggleRole}
                  disabled={isDisabled}
                  onDisabledClick={onDisabledClickHandler}
                />
              )
            })}
          </div>
        </div>
        <div>
          <h4 className="font-bold mb-2 text-red-500">Special Evil Roles</h4>
          <div className="space-y-2">
            {availableSpecialEvil.map((role) => {
               const isMorgana = role === Role.MORGANA;
              const isSelected = selectedRoles.has(role);

              let isDisabled = false;
              if (isMorgana) {
                isDisabled = !isSelected && (disabledRoles.good || disabledRoles.evil);
              } else {
                isDisabled = !isSelected && disabledRoles.evil;
              }

              let onDisabledClickHandler = handleDisabledEvilClick;
              if (isMorgana && isDisabled) {
                onDisabledClickHandler = handleDisabledPercivalMorganaClick;
              }

               return (
                <RoleToggle
                  key={role}
                  role={role}
                  selected={selectedRoles.has(role)}
                  onToggle={onToggleRole}
                  disabled={isDisabled}
                  onDisabledClick={onDisabledClickHandler}
                />
               )
            })}
          </div>
        </div>
      </div>
      
      <div className="mt-6 text-center">
        <Button
          onClick={onStart}
          disabled={!validation.isValid || isPaused}
        >
          Start Game
        </Button>
        {!validation.isValid && (
          <p className="text-red-500 mt-2 text-sm">{validation.message}</p>
        )}
      </div>
    </>
  );
};

const GameTips: React.FC = () => {
  const tips = [
    "Merlin is powerful but vulnerable. Good must protect him at all costs.",
    "As Evil, voting to approve a team with another evil player can build trust with Good.",
    "Percival's challenge is to distinguish Merlin from Morgana through their actions.",
    "Pay attention to who votes on which teams. Patterns can reveal alignments.",
    "Failing a quest with two fail votes when only one is needed can expose evil players.",
    "As a Loyal Servant, your vote and voice are your greatest weapons. Speak up!",
  ];
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setCurrentTipIndex(prev => (prev + 1) % tips.length);
    }, 8000); // Change tip every 8 seconds
  }, [tips.length]);

  useEffect(() => {
    startTimer();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startTimer]);

  const handleManualNextTip = () => {
    setCurrentTipIndex(prev => (prev + 1) % tips.length);
    startTimer(); // Reset the timer on manual click
  };

  return (
    <div 
      className="mt-8 text-center bg-slate-900/50 p-4 rounded-lg border border-slate-700 cursor-pointer hover:border-yellow-600 transition-colors"
      onClick={handleManualNextTip}
      title="Click to see next tip"
    >
      <h4 className="font-bold text-yellow-400 mb-2 font-eaglelake">Game Tip</h4>
      <AnimatePresence mode="wait">
        <motion.p
          key={currentTipIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.5 }}
          className="text-slate-300 text-sm italic min-h-[40px]"
        >
          "{tips[currentTipIndex]}"
        </motion.p>
      </AnimatePresence>
    </div>
  );
};


const LobbyView: React.FC = () => {
    const { gameState, playerId, startGame, leaveRoom, kickPlayer, startDragonsBreath, justJoined, clearJustJoined, openSocialHub, friendRequests, updateSelectedRoles, addBot } = useGame();
    const { playSound } = useAudio();
    const { roomCode, players } = gameState;
    const isPaused = !!gameState.reconnectingPlayer;
  
    const [isCopied, setIsCopied] = useState(false);

    useEffect(() => {
        if (justJoined) {
            playSound('transition');
            clearJustJoined();
        }
    }, [justJoined, clearJustJoined, playSound]);

    const handleToggleRole = useCallback((role: Role) => {
        const rolesToUpdate = new Set(gameState.selectedRoles || []);
        const isAdding = !rolesToUpdate.has(role);

        if (role === Role.PERCIVAL || role === Role.MORGANA) {
            // This logic ensures both are added or removed together
            if (isAdding) {
                rolesToUpdate.add(Role.PERCIVAL);
                rolesToUpdate.add(Role.MORGANA);
            } else {
                rolesToUpdate.delete(Role.PERCIVAL);
                rolesToUpdate.delete(Role.MORGANA);
            }
        } else {
            if (isAdding) {
                rolesToUpdate.add(role);
            } else {
                rolesToUpdate.delete(role);
            }
        }
        updateSelectedRoles(Array.from(rolesToUpdate));
    }, [gameState.selectedRoles, updateSelectedRoles]);
    
    const selectedRolesSet = useMemo(() => new Set(gameState.selectedRoles || []), [gameState.selectedRoles]);

    const { finalRoles, validation, disabledRoles } = useMemo(() => {
        const playerCount = players.length;
        if (playerCount < 5) {
            return {
                finalRoles: [],
                validation: { isValid: false, message: 'Need at least 5 players.' },
                disabledRoles: { good: true, evil: true }
            };
        }
        
        const requiredEvilCount = EVIL_PLAYER_COUNT[playerCount as keyof typeof EVIL_PLAYER_COUNT] || 0;
        const requiredGoodCount = playerCount - requiredEvilCount;
        
        // Check if adding another special role would exceed the alignment counts
        const currentSpecialGoodRolesCount = [...selectedRolesSet].filter(
            r => ROLES[r].alignment === Alignment.GOOD && r !== Role.MERLIN
        ).length;
        const currentSpecialEvilRolesCount = [...selectedRolesSet].filter(
            r => ROLES[r].alignment === Alignment.EVIL && r !== Role.ASSASSIN
        ).length;

        // +1 for the mandatory roles (Merlin, Assassin)
        const isGoodFull = (1 + currentSpecialGoodRolesCount) >= requiredGoodCount;
        const isEvilFull = (1 + currentSpecialEvilRolesCount) >= requiredEvilCount;

        const disabled = {
            good: isGoodFull,
            evil: isEvilFull
        };
        
        // --- Calculate final roles and validation for the start button ---
        const rolesWithDefaults = new Set(selectedRolesSet);
        rolesWithDefaults.add(Role.MERLIN);
        rolesWithDefaults.add(Role.ASSASSIN);
        
        const currentEvilRoles = [...rolesWithDefaults].filter(r => ROLES[r].alignment === Alignment.EVIL);
        const currentGoodRoles = [...rolesWithDefaults].filter(r => ROLES[r].alignment === Alignment.GOOD);

        const evilSlotsToFill = requiredEvilCount - currentEvilRoles.length;
        const goodSlotsToFill = playerCount - requiredEvilCount - currentGoodRoles.length;
        
        let validationError = "";
        if (evilSlotsToFill < 0) {
          validationError = "Too many evil roles selected.";
        } else if (goodSlotsToFill < 0) {
          validationError = "Too many good roles selected.";
        }

        const finalEvil = [...currentEvilRoles, ...Array(Math.max(0, evilSlotsToFill)).fill(Role.MINION)];
        const finalGood = [...currentGoodRoles, ...Array(Math.max(0, goodSlotsToFill)).fill(Role.LOYAL_SERVANT)];

        const finalRolesList = [...finalGood, ...finalEvil];
        
        const hasMorgana = selectedRolesSet.has(Role.MORGANA);
        const hasPercival = selectedRolesSet.has(Role.PERCIVAL);

        if (finalRolesList.length !== playerCount) {
            validationError = `Role selection count (${finalRolesList.length}) must match player count (${playerCount}).`;
        } else if (hasMorgana !== hasPercival) {
            validationError = "Morgana and Percival must be in the game together.";
        }

        return {
            finalRoles: finalRolesList,
            validation: { isValid: validationError === "", message: validationError },
            disabledRoles: disabled,
        };
    }, [selectedRolesSet, players.length]);


    const handleShare = async () => {
        if (!roomCode) return;
        const inviteText = `Join my Pavalon game!\nCode: ${roomCode}\nLink: ${window.location.origin}/join/${roomCode}`;
        
        try {
            await navigator.clipboard.writeText(inviteText);
            toast.success("Invite copied to clipboard!");
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
        } catch (error) {
            console.error("Failed to copy invite:", error);
            toast.error("Could not copy invite.");
        }
    };
  
    const currentPlayer = players.find((p) => p.id === playerId);
    const canStartPavalon = players.length >= 5 && players.length <= 10;
    const canStartDragonsBreath = players.length === 2;
  
    return (
      <div className="animate-fadeIn w-full max-w-5xl mx-auto">
        <Card className="text-center relative">
          {/* Header Section */}
          <header className="flex flex-col sm:flex-row justify-between items-center mb-6 text-center sm:text-left gap-4">
            <div>
              <h1 className="font-eaglelake text-3xl md:text-4xl font-bold text-yellow-500">
                Game Lobby
              </h1>
              <p className="text-slate-400">Waiting for players to join...</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
                 <Button variant="icon-primary" onClick={openSocialHub} className="relative text-sm py-1.5 px-4 flex-[3] flex items-center gap-2 justify-center">
                    <Users size={16} />
                    Invite Friends
                     {friendRequests.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 text-xs flex items-center justify-center bg-blue-500 text-white font-sans font-bold rounded-full border-2 border-slate-900">
                            {friendRequests.length}
                        </span>
                    )}
                </Button>
                <Button variant="danger" onClick={leaveRoom} className="text-sm py-1.5 px-4 flex-[1] flex items-center gap-2 justify-center">
                    <LogOut size={16} />
                    Leave
                </Button>
            </div>
          </header>
  
          {/* Room Code Section */}
          <div className="mb-6 border-t-2 border-slate-800 pt-6">
              <Card className="bg-slate-800/50">
                  <h3 className="text-slate-300 text-sm uppercase tracking-widest font-bold mb-2">
                  Room Code
                  </h3>
                  <button
                    onClick={handleShare}
                    className="flex items-center justify-center gap-4 bg-slate-900/70 p-3 rounded-lg w-fit mx-auto border-2 border-slate-700 hover:border-yellow-600 transition-colors cursor-pointer"
                    aria-label="Copy game code"
                    title="Copy Game Invite"
                  >
                      <p className="font-mono text-3xl md:text-4xl font-bold text-white tracking-[0.1em]">
                      {roomCode}
                      </p>
                      {isCopied ? <Check className="w-6 h-6 text-green-500" /> : <Copy className="w-6 h-6 text-yellow-500" />}
                  </button>
              </Card>
          </div>
  
          {/* Players Section */}
          <div className="mb-6">
            <h2 className="font-eaglelake text-xl md:text-2xl font-bold text-yellow-500 mb-4 pb-2 border-b-2 border-slate-700">
              Players ({players.length}/10)
            </h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] md:grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-x-4 gap-y-6">
              {players.map((p) => (
                 <div key={p.userId} className="flex flex-col items-center gap-2">
                    <PlayerTile player={p} className="w-full" />
                    {currentPlayer?.isHost && p.id !== playerId && (
                        <Button 
                            variant="danger" 
                            onClick={() => kickPlayer(p.id)} 
                            className="text-xs py-1 px-2 h-7 w-full flex items-center justify-center gap-1"
                            title={`Kick ${p.name}`}
                        >
                            <ShieldAlert size={14} /> Kick
                        </Button>
                    )}
                </div>
              ))}
            </div>

            {/* Fill empty seats with CPU players (host only) */}
            {currentPlayer?.isHost && players.length < 10 && (
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 bg-slate-800/40 rounded-lg p-3">
                <span className="flex items-center gap-1.5 text-sm text-slate-300 font-bold">
                  <BotIcon size={16} className="text-slate-400" />
                  Add a CPU player:
                </span>
                <div className="flex gap-2">
                  {(['easy', 'medium', 'hard'] as const).map((difficulty) => (
                    <Button
                      key={difficulty}
                      variant="secondary"
                      onClick={() => addBot(difficulty)}
                      disabled={isPaused}
                      className="text-xs py-1.5 px-3 capitalize"
                    >
                      {difficulty}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <GameTips />

          {canStartPavalon && <FinalRosterDisplay finalRoles={finalRoles} />}
          
          {canStartPavalon && currentPlayer?.isHost && (
            <div className="my-8 border-t-2 border-slate-700/50" />
          )}

          {/* Host Controls Section */}
          {currentPlayer?.isHost ? (
            canStartPavalon ? (
              <div className="mt-2">
                  <h3 className="font-eaglelake text-xl font-bold text-yellow-500 mb-4 text-center">
                    Add Special Roles
                  </h3>
                  <RoleCustomization
                    onStart={() => startGame({ selectedRoles: finalRoles })}
                    isPaused={isPaused}
                    selectedRoles={selectedRolesSet}
                    onToggleRole={handleToggleRole}
                    validation={validation}
                    disabledRoles={disabledRoles}
                    playerCount={players.length}
                  />
              </div>
            ) : (
              <div className="mt-8 p-4 bg-slate-800/40 rounded-lg">
                <Button disabled={true}>Need 5-10 Players for Pavalon</Button>
                <p className="text-red-400 mt-2 font-semibold">
                  You currently have {players.length} players.
                </p>
                {canStartDragonsBreath && (
                    <div className="mt-4 pt-4 border-t border-slate-700">
                        <Button onClick={startDragonsBreath} disabled={isPaused} variant="secondary" className="flex items-center justify-center gap-2">
                            <Flame size={20} /> Play Dragon's Breath (2 Players)
                        </Button>
                    </div>
                )}
              </div>
            )
          ) : (
             <p className="text-slate-400 mt-8 italic text-lg">
              Waiting for the host, <span className="font-bold text-white">{players.find(p => p.isHost)?.name || '...'}</span>, to start the game...
            </p>
          )}
        </Card>
      </div>
    );
  };

const LobbyScreen: React.FC = () => {
  const { gameState, user } = useGame();

  if (gameState.roomCode && gameState.players.some((p) => p.userId === user?.id)) {
    return <LobbyView />;
  }
  
  return (
    <div className="text-center">
      <Spinner />
      <p className="mt-2 text-white">Loading lobby...</p>
    </div>
  );
};

export default LobbyScreen;