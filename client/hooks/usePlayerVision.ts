import { useMemo } from 'react';
import { useGame } from '@/components/context/GameContext';
import { Player, Role, Alignment } from '@/types';

// Export this helper function for other components to use
export const getVisiblePlayers = (currentPlayer: Player | undefined, allPlayers: Player[]): { player: Player; knownAs: 'Evil' | 'Mystic' }[] => {
    if (!currentPlayer?.role || !currentPlayer.alignment) return [];
    
    let visiblePlayers: { player: Player; knownAs: 'Evil' | 'Mystic' }[] = [];

    switch (currentPlayer.role) {
        case Role.MERLIN:
            visiblePlayers = allPlayers
                .filter(p => p.alignment === Alignment.EVIL && p.role !== Role.MORDRED)
                .map(p => ({ player: p, knownAs: 'Evil' }));
            break;
        case Role.PERCIVAL:
            visiblePlayers = allPlayers
                .filter(p => p.role === Role.MERLIN || p.role === Role.MORGANA)
                .map(p => ({ player: p, knownAs: 'Mystic' }));
            break;
        case Role.MORGANA:
        case Role.ASSASSIN:
        case Role.MORDRED:
        case Role.MINION:
            visiblePlayers = allPlayers
                .filter(p => p.id !== currentPlayer.id && p.alignment === Alignment.EVIL && p.role !== Role.OBERON)
                .map(p => ({ player: p, knownAs: 'Evil' }));
            break;
        default:
            visiblePlayers = [];
    }
    return visiblePlayers;
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
