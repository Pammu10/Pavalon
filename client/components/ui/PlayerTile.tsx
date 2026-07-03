import React, { memo } from 'react';
import { Player, GamePhase } from '@/types';
import { useGame } from '../context/GameContext';
import { useVoice } from '../context/VoiceContext';
import { Crown, Ghost, Shield, Swords, Eye, Mic, Gem, ShieldCheck, HelpCircle, Skull, NotebookPen, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROLES } from '@/constants';
import { ICON_MAP } from './AvailableIcons';
import { motion, AnimatePresence } from 'framer-motion';
import { haptics } from '@/lib/haptics';

const MARKABLE_PHASES: GamePhase[] = [
  GamePhase.TEAM_SELECTION,
  GamePhase.TEAM_VOTE,
  GamePhase.QUEST_VOTE,
  GamePhase.QUEST_RESULT,
  GamePhase.ASSASSINATION,
];

const MARK_CONFIG = {
  trusted: { icon: ShieldCheck, classes: 'bg-blue-900/90 text-blue-300 border-blue-500', title: 'Marked: Trusted' },
  suspect: { icon: HelpCircle, classes: 'bg-amber-900/90 text-amber-300 border-amber-500', title: 'Marked: Suspect' },
  evil: { icon: Skull, classes: 'bg-red-900/90 text-red-300 border-red-500', title: 'Marked: Evil' },
} as const;

interface PlayerTileProps {
  player: Player;
  isLeader?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
  isKnownAs?: 'Evil' | 'Mystic' | null;
}

const PlayerTile: React.FC<PlayerTileProps> = ({
  player,
  isLeader = false,
  isSelected = false,
  onClick,
  className = '',
  isKnownAs = null,
}) => {
  const { playerId, gameState, activeEmotes, suspicionMarks, cycleSuspicionMark } = useGame();
  const { peerStates, isSelfSpeaking } = useVoice();

  const isLocalPlayer = player.id === playerId;
  const voiceState = peerStates[player.id];
  const isSpeaking = isLocalPlayer ? isSelfSpeaking : voiceState?.isSpeaking ?? false;

  const isDisconnected = player.status === 'DISCONNECTED';

  const activeEmote = activeEmotes[player.id];
  const canMark = !isLocalPlayer && MARKABLE_PHASES.includes(gameState.phase);
  const mark = suspicionMarks[player.userId];
  const borderClass = player.selectedBorder && player.selectedBorder !== 'default' ? `border-style-${player.selectedBorder}` : 'border-slate-600';

  const IconComponent = player.selectedIcon && ICON_MAP[player.selectedIcon] 
    ? ICON_MAP[player.selectedIcon] 
    : Gem;

  return (
    <motion.div
      onClick={onClick}
      className={cn(
        'relative group aspect-[3/4] flex flex-col items-center justify-end p-2 rounded-xl transition-all duration-300 shadow-lg [-webkit-tap-highlight-color:transparent]',
        'bg-slate-900/50 backdrop-blur-sm border-4',
        borderClass,
        isDisconnected ? 'grayscale opacity-50' : '',
        onClick && !isDisconnected ? 'cursor-pointer [@media(hover:hover)]:hover:border-yellow-500/80 [@media(hover:hover)]:hover:-translate-y-1 active:scale-95 active:border-yellow-500 active:brightness-90' : '',
        className
      )}
      animate={{ scale: isSelected ? 1.05 : 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
        {/* Avatar Area */}
        <div className="player-tile-avatar-area absolute top-2 left-2 right-2 bottom-12 flex items-center justify-center overflow-hidden">
             <div className="player-tile-avatar-glow"></div>
             <div className="absolute inset-0 bg-gradient-to-b from-slate-900/10 via-slate-900/50 to-slate-900/90 rounded-t-lg"></div>
             <IconComponent />
             {isDisconnected && <Ghost className="absolute w-12 h-12 text-slate-400"/>}
        </div>

      {/* Info Box */}
      <div className="relative w-full bg-black/50 backdrop-blur-sm rounded-md p-2 text-center z-10">
        <div className="text-base font-bold text-slate-100 truncate w-full flex items-center justify-center gap-1.5 h-6">
            <AnimatePresence>
                {isSpeaking && (
                    <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <Mic size={14} className="text-green-400" style={{ filter: 'drop-shadow(0 0 3px #4ade80)' }}/>
                    </motion.div>
                )}
            </AnimatePresence>
            <span className="truncate">{player.name}</span>
        </div>
        {player.selectedTitle ? (
            <p className="text-xs text-yellow-400 font-bold italic truncate w-full h-4">
                {player.selectedTitle}
            </p>
        ) : <div className="h-4" />}
      </div>

      {/* Emote bubble */}
      <AnimatePresence>
        {activeEmote && (
          <motion.div
            key={activeEmote.key}
            initial={{ opacity: 0, scale: 0.3, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: -14 }}
            transition={{ type: 'spring', stiffness: 500, damping: 24 }}
            className="absolute -top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
          >
            {activeEmote.emote.length > 2 ? (
              <div className="bg-slate-900/95 border border-yellow-500/70 rounded-xl rounded-bl-sm px-2.5 py-1 shadow-lg whitespace-nowrap">
                <span className="text-xs font-bold text-slate-100 italic">{activeEmote.emote}</span>
              </div>
            ) : (
              <motion.span
                className="block text-3xl drop-shadow-lg"
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                {activeEmote.emote}
              </motion.span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Suspicion mark (private deduction note) */}
      {canMark && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            haptics.tap();
            cycleSuspicionMark(player.userId);
          }}
          title={mark ? MARK_CONFIG[mark].title : 'Add deduction note'}
          className={cn(
            'absolute top-1.5 left-1.5 z-20 w-6 h-6 rounded-full flex items-center justify-center border transition-all active:scale-90',
            mark
              ? MARK_CONFIG[mark].classes
              : 'bg-slate-800/70 text-slate-500 border-slate-600/50 opacity-60 hover:opacity-100'
          )}
        >
          {mark ? (
            React.createElement(MARK_CONFIG[mark].icon, { size: 14 })
          ) : (
            <NotebookPen size={12} />
          )}
        </button>
      )}
      {/* Read-only mark badge outside markable phases */}
      {!canMark && !isLocalPlayer && mark && (
        <div
          title={MARK_CONFIG[mark].title}
          className={cn('absolute top-1.5 left-1.5 z-20 w-6 h-6 rounded-full flex items-center justify-center border', MARK_CONFIG[mark].classes)}
        >
          {React.createElement(MARK_CONFIG[mark].icon, { size: 14 })}
        </div>
      )}

      {/* Status Icons */}
      <div className="absolute top-1.5 right-1.5 flex flex-col gap-1.5">
        {player.userId < 0 && (
          <div className="w-6 h-6 bg-slate-700/80 text-slate-300 rounded-full flex items-center justify-center" title="CPU Player">
            <Bot size={12} />
          </div>
        )}
        {player.isHost && (
          <div className="w-6 h-6 bg-yellow-800/80 text-yellow-300 rounded-full flex items-center justify-center" title="Host">
            <Crown size={14} />
          </div>
        )}
        {isLeader && (
           <div className="w-6 h-6 bg-blue-800/80 text-blue-300 rounded-full flex items-center justify-center" title="Leader">
            <Crown size={14} />
          </div>
        )}
        {isKnownAs === 'Evil' && (
          <div className="w-6 h-6 bg-red-900/80 text-red-300 rounded-full flex items-center justify-center" title="Known Evil">
            <Eye size={14} />
          </div>
        )}
        {isKnownAs === 'Mystic' && (
          <div className="w-6 h-6 bg-purple-900/80 text-purple-300 rounded-full flex items-center justify-center" title="Known Mystic (Merlin/Morgana)">
            <Eye size={14} />
          </div>
        )}
      </div>

      {/* Selection Indicator */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* This overlay uses a ring to create a border effect that doesn't cover the custom animated borders. */}
            <div className="absolute inset-0 rounded-xl pointer-events-none ring-4 ring-yellow-500/80"></div>
            <div className="absolute top-1.5 right-1.5 w-7 h-7 bg-yellow-500 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-lg">
                <Swords size={16} className="text-white" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default memo(PlayerTile);