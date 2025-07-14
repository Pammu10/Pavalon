import React, { useEffect, useState } from "react";
import { useGame } from "@/components/context/GameContext";
import { useAudio } from "@/components/context/AudiContext";
import { ROLES } from "@/constants";
import { Role, Alignment, Player } from "@/types";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { Star, Zap, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PlayerStatusList from "../ui/PlayerStatusList";
import { getVisiblePlayers } from "@/hooks/usePlayerVision";

const RoleRevealScreen: React.FC = () => {
  const { gameState, playerId, playerReady, hasViewedRole, setHasViewedRole } = useGame();
  const { playSound } = useAudio();
  const [isInitialLoad, setIsInitialLoad] = useState(!hasViewedRole);

  useEffect(() => {
    if (isInitialLoad) {
      playSound('role-reveal');
      const timer = setTimeout(() => {
        setIsInitialLoad(false); // After the first animation cycle, it's no longer an initial load
        setHasViewedRole(true);
      }, 4000); // Duration of the longest animation
      return () => clearTimeout(timer);
    }
  }, [isInitialLoad, playSound, setHasViewedRole]);


  const player = gameState.players.find((p) => p.id === playerId);
  const roleInfo = player?.role ? ROLES[player.role] : null;
  const isPaused = !!gameState.reconnectingPlayer;

  if (!player || !player.role || !roleInfo) {
    return (
      <div className="flex justify-center items-center h-full">
        <Spinner />
      </div>
    );
  }

  const visiblePlayerInfo = getVisiblePlayers(player, gameState.players);

  const handleReadyClick = () => {
    playerReady();
  };
  
  const isGood = roleInfo.alignment === Alignment.GOOD;
  const isReady = gameState.readyPlayers.includes(playerId!);

  const getVisionSpan = (seenPlayer: Player, knownAs: 'Evil' | 'Mystic') => {
    const text = knownAs === 'Mystic' ? "Merlin/Morgana" : seenPlayer.role ?? "Unknown";
    const colorClass = knownAs === 'Mystic' ? "text-purple-400" : "text-red-400";
    return <span className={`text-sm font-bold ${colorClass}`}>{text}</span>;
  };
  
  const animProps = (delay: number) => ({
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, ease: "easeOut" as const, delay: !hasViewedRole ? delay : 0 },
  });

  return (
    <AnimatePresence>
      <motion.div
        key="role-reveal-content"
        id="role-reveal-card"
        initial="hidden"
        animate="visible"
        className="flex flex-col items-center justify-start p-2 sm:p-4"
      >
        <div className="w-full max-w-md mx-auto text-center">
          <motion.h1 
            {...animProps(0.2)}
            className="font-eaglelake text-2xl sm:text-3xl md:text-4xl mb-4 text-center text-white"
          >
            Your Identity
          </motion.h1>

          <motion.div {...animProps(0.5)} className="relative w-58 h-58 mx-auto mb-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 3, ease: "easeOut", delay: !hasViewedRole ? 0.8 : 0 }}
              className={`absolute inset-0 rounded-xl blur-2xl z-0 pointer-events-none ${
                isGood
                  ? "bg-gradient-to-tr from-blue-500 via-indigo-400 to-purple-500"
                  : "bg-gradient-to-tr from-red-500 via-rose-400 to-yellow-500"
              }`}
            />
            <div
              className={`relative z-10 w-full h-full rounded-full overflow-hidden border-4 backdrop-blur-sm shadow-2xl ${
                isGood
                  ? "border-blue-400/50 bg-black/30"
                  : "border-red-400/50 bg-black/30"
              }`}
            >
              <motion.img
                key={player.role}
                src={roleInfo.img}
                alt={`${player.role} portrait`}
                initial={{ scale: 1, opacity: 0, rotate: -60 }}
                animate={{ scale: 1, opacity: 1, rotate: 0  }}
                transition={{ duration: 2.5, ease: "easeOut", delay: !hasViewedRole ? 1 : 0 }}
                className="w-full h-full object-cover"
              />
            </div>
          </motion.div>

          <motion.h3 {...animProps(1.5)} className="text-3xl font-bold mb-3 text-amber-300 font-eaglelake">
            {player.role}
          </motion.h3>

          <motion.div
            {...animProps(1.8)}
            className={`inline-block px-4 py-2 rounded-full text-sm font-bold mb-6 border-2 ${
              isGood
                ? "bg-blue-600/30 text-blue-300 border-blue-400/50"
                : "bg-red-600/30 text-red-300 border-red-400/50"
            }`}
          >
            {roleInfo.alignment}
          </motion.div>

          <motion.div {...animProps(2.2)} className="bg-gradient-to-br from-black/40 to-black/60 rounded-xl p-4 sm:p-6 mb-6 border border-amber-600/30 text-left">
            <h4 className="font-bold mb-3 text-amber-300 flex items-center font-eaglelake">
              <Star className="w-5 h-5 mr-2 flex-shrink-0" />
              Your Sacred Duty
            </h4>
            <p className="text-sm text-amber-100/90 mb-4 leading-relaxed">
              {roleInfo.description}
            </p>
            <div className="bg-gradient-to-r from-amber-600/20 to-yellow-600/20 rounded-lg p-4 border border-amber-400/30">
              <h5 className="font-bold text-amber-400 mb-2 flex items-center font-eaglelake">
                <Zap className="w-4 h-4 mr-2 flex-shrink-0" />
                Strategic Tips
              </h5>
              <p className="text-xs text-amber-100/80 leading-relaxed">
                {roleInfo.strategy}
              </p>
            </div>
          </motion.div>

          {visiblePlayerInfo.length > 0 && (
            <motion.div id="role-vision" {...animProps(2.5)} className="bg-gradient-to-br from-black/40 to-black/60 rounded-xl p-4 sm:p-6 mb-6 border border-amber-600/30 text-left">
              <h4 className="font-bold mb-3 text-amber-300 flex items-center font-eaglelake">
                <Eye className="w-5 h-5 mr-2 flex-shrink-0" />
                Your Vision
              </h4>
              <div className="space-y-2">
                {visiblePlayerInfo.map(({player: p, knownAs}) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between"
                  >
                    <span className="max-w-xs truncate inline-block text-slate-200">
                      {p.name}
                    </span>
                    {getVisionSpan(p, knownAs)}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        <motion.div {...animProps(3.0)} className="mt-4 text-center w-full max-w-lg pb-6">
          <PlayerStatusList
            title="Player Status"
            players={gameState.players}
            readyPlayerIds={gameState.readyPlayers}
          />
          <motion.div {...animProps(3.5)}>
            <Button
              onClick={handleReadyClick}
              disabled={isReady || isPaused}
              className="mt-6"
            >
              {isPaused
                ? "Game Paused"
                : isReady
                ? "Waiting for others..."
                : "I Am Ready"}
            </Button>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default RoleRevealScreen;