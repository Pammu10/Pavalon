import { useMemo } from 'react';
import { useGame } from '@/components/context/GameContext';
import { Player } from '@/types';

// Role visibility is now computed server-side: the server sets `visibleAs` on
// each player in the redacted per-viewer game state, and other players'
// role/alignment are never sent mid-game. This hook simply reads that field.
// Export this helper function for other components to use
export const getVisiblePlayers = (currentPlayer: Player | undefined, allPlayers: Player[]): { player: Player; knownAs: 'Evil' | 'Mystic' }[] => {
    if (!currentPlayer) return [];
    return allPlayers
        .filter((p): p is Player & { visibleAs: 'Evil' | 'Mystic' } => !!p.visibleAs)
        .map(p => ({ player: p, knownAs: p.visibleAs }));
};


export const usePlayerVisionMap = () => {
    const { gameState, playerId } = useGame();
    const { players } = gameState;
    const currentPlayer = players.find(p => p.id === playerId);

    const visiblePlayerMap = useMemo(() => {
        const visibleData = getVisiblePlayers(currentPlayer, players);
        const map = new Map<string, 'Evil' | 'Mystic'>();
        for (const { player, knownAs } of visibleData) {
            map.set(player.id, knownAs);
        }
        return map;
    }, [players, currentPlayer]);

    return visiblePlayerMap;
};
