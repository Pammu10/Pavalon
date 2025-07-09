import React from "react";
import { useGame } from "@/components/context/GameContext";
import { ROLES } from "@/constants";
import { Role, Alignment } from "@/types";

const PlayerInfoBar: React.FC = () => {
  const { gameState, playerId } = useGame();
  const player = gameState.players.find((p) => p.id === playerId);

  if (!player || !player.role) {
    return null;
  }

  const roleInfo = ROLES[player.role];
  const alignmentColor =
    roleInfo.alignment === Alignment.GOOD ? "text-blue-400" : "text-red-500";

  const getVisiblePlayers = () => {
    const { players } = gameState;
    const self = player;

    if (!self.role || !self.alignment) return [];

    switch (self.role) {
      case Role.MERLIN:
        return players.filter(
          (p) => p.alignment === Alignment.EVIL && p.role !== Role.MORDRED
        );
      case Role.PERCIVAL:
        return players.filter(
          (p) => p.role === Role.MERLIN || p.role === Role.MORGANA
        );
      case Role.MORGANA:
      case Role.ASSASSIN:
      case Role.MORDRED:
      case Role.MINION:
        return players.filter(
          (p) =>
            p.id !== self.id &&
            p.alignment === Alignment.EVIL &&
            p.role !== Role.OBERON
        );
      default:
        return [];
    }
  };

  const visiblePlayers = getVisiblePlayers();

  return (
    <div className="bg-slate-900/50 p-2">
      <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center text-center text-sm">
        <div className="mb-1 md:mb-0">
          <span className="text-slate-400 font-semibold">ROLE: </span>
          <span className="font-bold text-white">{player.name}</span>
          <span className={`font-eaglelake ml-2 font-bold ${alignmentColor}`}>
            ({player.role})
          </span>
        </div>
        <div className="text-slate-300 italic">
          <span className="font-semibold text-yellow-500 not-italic mr-1">
            Vision:
          </span>
          {visiblePlayers.length > 0
            ? visiblePlayers.map((p) => p.name).join(", ")
            : "You see nothing out of the ordinary."}
        </div>
      </div>
    </div>
  );
};

export default PlayerInfoBar;
