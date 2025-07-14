

import React, { useRef, useEffect } from 'react';
import { useGame } from '@/components/context/GameContext';
import { LogEntry } from '@/types';
import { Crown, Swords, Vote, CheckCircle, XCircle, Shield, Skull, Info, UserX, UserCheck, Users, ScrollText } from 'lucide-react';
import { motion } from 'framer-motion';

const logIcons: { [key in LogEntry['type']]: React.ReactNode } = {
  leader: <Crown className="w-5 h-5 text-yellow-400" />,
  team: <Users className="w-5 h-5 text-blue-400" />,
  vote: <Vote className="w-5 h-5 text-purple-400" />,
  quest: <Swords className="w-5 h-5 text-green-400" />,
  assassination: <Skull className="w-5 h-5 text-red-500" />,
  system: <Info className="w-5 h-5 text-slate-400" />,
};

const LogItem: React.FC<{ entry: LogEntry }> = ({ entry }) => {
    const getIcon = () => {
        if (entry.text.includes('Failed') || entry.text.includes('Rejected')) {
            return <XCircle className="w-5 h-5 text-red-400" />;
        }
        if (entry.text.includes('Succeeded') || entry.text.includes('Approved')) {
            return <CheckCircle className="w-5 h-5 text-green-400" />;
        }
         if (entry.text.includes('disconnected')) {
            return <UserX className="w-5 h-5 text-slate-500" />;
        }
        if (entry.text.includes('reconnected')) {
            return <UserCheck className="w-5 h-5 text-slate-300" />;
        }
        return logIcons[entry.type];
    }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-800/50"
    >
      <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
      <div className="flex-grow">
        <p className="text-sm text-slate-200">{entry.text}</p>
        <p className="text-xs text-slate-500">{new Date(entry.timestamp).toLocaleTimeString()}</p>
      </div>
    </motion.div>
  );
};

const GameLog: React.FC<{ isMobileView?: boolean }> = ({ isMobileView }) => {
  const { gameState } = useGame();
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState.gameLog]);

  const content = (
      <div className="flex-grow p-2 md:p-4 overflow-y-auto scroll-hide space-y-1">
        {gameState.gameLog.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <ScrollText size={48} className="mb-4" />
                <p className="font-bold text-lg">The Game Log is Empty</p>
                <p className="text-sm">Game events will appear here as they happen.</p>
            </div>
        ) : (
            <>
                {gameState.gameLog.map((entry) => (
                    <LogItem key={entry.id} entry={entry} />
                ))}
                <div ref={logEndRef} />
            </>
        )}
      </div>
  )

  if (isMobileView) {
      return (
          <div className="w-full h-full flex flex-col">
              {content}
          </div>
      )
  }

  return (
    <div className="w-full h-full max-h-[calc(100vh-250px)] flex flex-col font-sans bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden">
      <header className="flex-shrink-0 p-4 border-b border-slate-700/50">
          <h3 className="font-eaglelake text-xl text-yellow-500 flex items-center gap-2">
              <ScrollText size={20}/> Game Log
          </h3>
      </header>
      {content}
    </div>
  );
};

export default GameLog;
