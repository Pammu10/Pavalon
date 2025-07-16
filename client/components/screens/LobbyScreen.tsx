import React, { useState, useMemo, useCallback } from "react";
import { useGame } from "@/components/context/GameContext";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Player, Role, Alignment } from "@/types";
import { ROLES, EVIL_PLAYER_COUNT } from "@/constants";
import Spinner from "@/components/ui/Spinner";
import { Copy, Check, LogOut, ShieldAlert } from "lucide-react";
import PlayerTile from "@/components/ui/PlayerTile";

const RoleToggle: React.FC<{
  role: Role;
  selected: boolean;
  onToggle: (role: Role) => void;
  disabled?: boolean;
}> = ({ role, selected, onToggle, disabled = false }) => (
  <label
    className={`flex items-center p-3 rounded-lg border-2 transition-all cursor-pointer ${
      selected
        ? "bg-slate-700 border-yellow-500"
        : "bg-slate-800 border-slate-700"
    } ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-slate-500"}`}
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

const RoleCustomization: React.FC<{
  playerCount: number;
  onStart: (roles: Role[]) => void;
  isPaused: boolean;
}> = ({ playerCount, onStart, isPaused }) => {
  const [selectedRoles, setSelectedRoles] = useState<Set<Role>>(new Set());

  const handleToggle = useCallback((role: Role) => {
    setSelectedRoles((prev) => {
      const newRoles = new Set(prev);
      if (newRoles.has(role)) {
        newRoles.delete(role);
      } else {
        newRoles.add(role);
      }

      if (role === Role.PERCIVAL) {
        newRoles.has(Role.PERCIVAL)
          ? newRoles.add(Role.MORGANA)
          : newRoles.delete(Role.MORGANA);
      } else if (role === Role.MORGANA) {
        newRoles.has(Role.MORGANA)
          ? newRoles.add(Role.PERCIVAL)
          : newRoles.delete(Role.PERCIVAL);
      }
      return newRoles;
    });
  }, []);

  const { finalRoles, validation } = useMemo(() => {
    const rolesWithDefaults = new Set(selectedRoles);
    rolesWithDefaults.add(Role.MERLIN);
    rolesWithDefaults.add(Role.ASSASSIN);

    const requiredEvilCount =
      EVIL_PLAYER_COUNT[playerCount as keyof typeof EVIL_PLAYER_COUNT] || 0;
    const currentEvilRoles = [...rolesWithDefaults].filter(
      (r: Role) => ROLES[r].alignment === Alignment.EVIL
    );
    const currentGoodRoles = [...rolesWithDefaults].filter(
      (r: Role) => ROLES[r].alignment === Alignment.GOOD
    );

    const evilSlotsToFill = requiredEvilCount - currentEvilRoles.length;
    const goodSlotsToFill =
      playerCount - requiredEvilCount - currentGoodRoles.length;

    let validationError = "";
    if (evilSlotsToFill < 0) {
      validationError = "Too many evil roles selected.";
    } else if (goodSlotsToFill < 0) {
      validationError = "Too many good roles selected.";
    }

    const finalEvil = [
      ...currentEvilRoles,
      ...Array(Math.max(0, evilSlotsToFill)).fill(Role.MINION),
    ];
    const finalGood = [
      ...currentGoodRoles,
      ...Array(Math.max(0, goodSlotsToFill)).fill(Role.LOYAL_SERVANT),
    ];

    const finalRoles = [...finalGood, ...finalEvil];

    return {
      finalRoles,
      validation: { isValid: validationError === "", message: validationError },
    };
  }, [selectedRoles, playerCount]);

  const availableSpecialGood = [Role.PERCIVAL];
  const availableSpecialEvil = [Role.MORGANA, Role.MORDRED, Role.OBERON];

  return (
    <div className="mt-8 border-t-2 border-slate-700 pt-6">
      <h3 className="font-eaglelake text-xl font-bold text-yellow-500 mb-4 text-center">
        Customize Roles
      </h3>
      <div className="mb-4 bg-slate-900/50 p-3 rounded-lg text-center">
        <h4 className="font-bold text-base text-yellow-400">
          Core Roles (Always In)
        </h4>
        <p className="text-slate-300 text-sm">Merlin & Assassin</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="font-bold mb-2 text-blue-400">Optional Good Roles</h4>
          <div className="space-y-2">
            {availableSpecialGood.map((role) => (
              <RoleToggle
                key={role}
                role={role}
                selected={selectedRoles.has(role)}
                onToggle={handleToggle}
              />
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-bold mb-2 text-red-500">Optional Evil Roles</h4>
          <div className="space-y-2">
            {availableSpecialEvil.map((role) => (
              <RoleToggle
                key={role}
                role={role}
                selected={selectedRoles.has(role)}
                onToggle={handleToggle}
                disabled={
                  role === Role.MORGANA && selectedRoles.has(Role.PERCIVAL)
                }
              />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-6 text-center bg-slate-900/50 p-4 rounded-lg">
        <p className="font-bold">
          Final Roster ({finalRoles.length}):{" "}
          <span className="text-blue-400">{
            finalRoles.filter(
              (r: Role) => ROLES[r].alignment === Alignment.GOOD
            ).length
          }{" "}
          Good</span>,{" "}
          <span className="text-red-400">{
            finalRoles.filter(
              (r: Role) => ROLES[r].alignment === Alignment.EVIL
            ).length
          }{" "}
          Evil</span>
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {[...new Set(finalRoles)].sort().join(", ")}
        </p>
      </div>
      <div className="mt-6 text-center">
        <Button
          onClick={() => onStart(finalRoles)}
          disabled={!validation.isValid || isPaused}
        >
          Start Game
        </Button>
        {validation.message && (
          <p className="text-red-500 mt-2 text-sm">{validation.message}</p>
        )}
      </div>
    </div>
  );
};

const LobbyView: React.FC = () => {
    const { gameState, playerId, startGame, leaveRoom, kickPlayer } = useGame();
    const { roomCode, players } = gameState;
    const isPaused = !!gameState.reconnectingPlayer;
    const [copied, setCopied] = useState(false);
  
    const handleCopyClick = () => {
      if (roomCode) {
        navigator.clipboard.writeText(roomCode).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          },
          (err) => {
            console.error("Could not copy text: ", err);
          }
        );
      }
    };
  
    const currentPlayer = players.find((p) => p.id === playerId);
    const canStart = players.length >= 5 && players.length <= 10;
  
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
            <Button variant="danger" onClick={leaveRoom} className="text-sm py-1.5 px-4 flex items-center gap-2 w-full sm:w-auto justify-center">
              <LogOut size={16} />
              Leave
            </Button>
          </header>
  
          {/* Room Code Section */}
          <div className="mb-6 border-t-2 border-slate-800 pt-6">
              <Card className="bg-slate-800/50">
                  <h3 className="text-slate-300 text-sm uppercase tracking-widest font-bold mb-2">
                  Room Code
                  </h3>
                  <div className="flex items-center justify-center gap-2 bg-slate-900/70 p-2 rounded-lg w-fit mx-auto border-2 border-slate-700">
                      <p className="font-mono text-3xl md:text-4xl font-bold text-white tracking-[0.1em] px-4">
                      {roomCode}
                      </p>
                      <button
                      onClick={handleCopyClick}
                      className="bg-slate-700/70 p-2 rounded-md hover:bg-slate-600 transition-colors"
                      aria-label="Copy room code"
                      >
                      {copied ? (
                          <Check className="w-5 h-5 text-green-400" />
                      ) : (
                          <Copy className="w-5 h-5 text-slate-400" />
                      )}
                      </button>
                  </div>
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
          </div>
  
          {/* Host Controls Section */}
          {currentPlayer?.isHost &&
            (canStart ? (
              <RoleCustomization
                playerCount={players.length}
                onStart={(selectedRoles) => startGame({ selectedRoles })}
                isPaused={isPaused}
              />
            ) : (
              <div className="mt-8 p-4 bg-slate-800/40 rounded-lg">
                <Button disabled={true}>Need 5-10 Players to Start</Button>
                <p className="text-red-400 mt-2 font-semibold">
                  You currently have {players.length} players.
                </p>
              </div>
            ))}
          {!currentPlayer?.isHost && (
            <p className="text-slate-400 mt-8 italic text-lg">
              Waiting for the host, <span className="font-bold text-white">{players.find(p => p.isHost)?.name || '...'}</span>, to start the game...
            </p>
          )}
        </Card>
      </div>
    );
  };

const JoinHostView: React.FC = () => {
  const { joinRoom, user, logout } = useGame();
  const [roomCode, setRoomCode] = useState("");

  return (
    <div className="animate-fadeIn flex flex-col items-center justify-center space-y-8">
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

const LobbyScreen: React.FC = () => {
  const { gameState, user } = useGame();

  // Player is in a room if there's a room code and they are in the players list
  if (gameState.roomCode && gameState.players.some((p) => p.userId === user?.id)) {
    return <LobbyView />;
  }

  // Player is logged in but not in a room
  if (!gameState.roomCode) {
    return <JoinHostView />;
  }

  // This state occurs briefly during transitions, e.g., after logout before context resets
  return (
    <div className="text-center">
      <Spinner />
    </div>
  );
};

export default LobbyScreen;
