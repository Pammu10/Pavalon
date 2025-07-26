import React from "react";
import { useGame } from "@/components/context/GameContext";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Player, Role, Alignment } from "@/types";
import { ROLES, EVIL_PLAYER_COUNT } from "@/constants";
import Spinner from "@/components/ui/Spinner";
import { Copy, LogOut, ShieldAlert, Flame } from "lucide-react";
import PlayerTile from "@/components/ui/PlayerTile";
import { toast } from "sonner";

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
  const [selectedRoles, setSelectedRoles] = React.useState<Set<Role>>(new Set());

  const handleToggle = React.useCallback((role: Role) => {
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
          : newRoles.delete(Role.MORGANA);
      }
      return newRoles;
    });
  }, []);

  const { finalRoles, validation } = React.useMemo(() => {
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
    const { gameState, playerId, startGame, leaveRoom, kickPlayer, startDragonsBreath } = useGame();
    const { roomCode, players } = gameState;
    const isPaused = !!gameState.reconnectingPlayer;
  
    const handleShare = async () => {
        if (!roomCode) return;
        const inviteText = `Join my Pavalon game!\nCode: ${roomCode}\nLink: ${window.location.origin}/join/${roomCode}`;
        const shareData = {
            title: "Join Pavalon Game",
            text: `Join my game on Pavalon! Code: ${roomCode}`,
            url: `${window.location.origin}/join/${roomCode}`,
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (error) {
                console.log("Web Share API failed, likely user cancellation.", error);
            }
        } else {
            try {
                await navigator.clipboard.writeText(inviteText);
                toast.success("Invite copied to clipboard!");
            } catch (error) {
                console.error("Failed to copy invite:", error);
                toast.error("Could not copy invite.");
            }
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
                <Button variant="danger" onClick={leaveRoom} className="text-sm py-1.5 px-4 flex-1 flex items-center gap-2 justify-center">
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
                    aria-label="Share game code"
                    title="Share Game Invite"
                  >
                      <p className="font-mono text-3xl md:text-4xl font-bold text-white tracking-[0.1em]">
                      {roomCode}
                      </p>
                      <Copy className="w-6 h-6 text-yellow-500" />
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
          </div>
  
          {/* Host Controls Section */}
          {currentPlayer?.isHost &&
            (canStartPavalon ? (
              <RoleCustomization
                playerCount={players.length}
                onStart={(selectedRoles) => startGame({ selectedRoles })}
                isPaused={isPaused}
              />
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