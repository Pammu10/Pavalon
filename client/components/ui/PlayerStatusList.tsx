import React from 'react';
import { Player } from '@/types';

interface PlayerStatusListProps {
  title: string;
  players: Player[];
  readyPlayerIds: string[];
  iconMapping?: { ready: string; notReady: string };
}

const PlayerStatusList: React.FC<PlayerStatusListProps> = ({
  title,
  players,
  readyPlayerIds,
  iconMapping = { ready: '●', notReady: '○' },
}) => {
  return (
    <div className="bg-slate-900/50 p-4 rounded-lg">
      <h4 className="font-eaglelake text-xl text-yellow-500 mb-3 text-center">
        {title}
      </h4>
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-left">
        {players.map((p) => {
          const isReady = readyPlayerIds.includes(p.id);
          return (
            <li
              key={p.id}
              className={`text-slate-300 truncate ${
                p.status === 'DISCONNECTED' ? 'text-slate-500 italic' : ''
              }`}
            >
              <span
                className={`mr-2 ${
                  isReady ? 'text-green-400' : 'text-slate-500'
                }`}
              >
                {isReady ? iconMapping.ready : iconMapping.notReady}
              </span>
              {p.name}
              {p.status === 'DISCONNECTED' && ' (DC)'}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default PlayerStatusList;
