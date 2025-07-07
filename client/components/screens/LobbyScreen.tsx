import React, { useState, useMemo, useCallback } from 'react';
import { useGame } from '@/components/context/GameContext';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { Player, Role, Alignment } from '@/types';
import { ROLES, EVIL_PLAYER_COUNT } from '@/constants';
import Spinner from '@/components/ui/Spinner';

const PlayerIcon: React.FC<{ player: Player }> = ({ player }) => {
    const isDisconnected = player.status === 'DISCONNECTED';
    return (
        <div className={`animate-fadeIn bg-slate-700 p-4 rounded-lg flex items-center justify-between shadow-md relative ${isDisconnected ? 'grayscale' : ''}`}>
            <span className="text-lg font-bold text-slate-200">{player.name}</span>
            {isDisconnected && <div className="absolute top-1 right-1 text-xs bg-slate-600 px-2 py-0.5 rounded-full">DC</div>}
            {player.isHost && (
                <span className="text-xs font-bold text-yellow-500 bg-slate-800 px-2 py-1 rounded">HOST</span>
            )}
        </div>
    );
};

const RoleToggle: React.FC<{ role: Role; selected: boolean; onToggle: (role: Role) => void; disabled?: boolean }> = ({ role, selected, onToggle, disabled = false }) => (
    <label className={`flex items-center p-3 rounded-lg border-2 transition-all cursor-pointer ${selected ? 'bg-slate-700 border-yellow-500' : 'bg-slate-800 border-slate-700'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-slate-500'}`}>
        <input type="checkbox" checked={selected} onChange={() => onToggle(role)} disabled={disabled} className="hidden" />
        <div className="flex-grow">
            <p className={`font-bold ${ROLES[role].alignment === Alignment.GOOD ? 'text-blue-400' : 'text-red-500'}`}>{role}</p>
            <p className="text-xs text-slate-400">{ROLES[role].description.split('.')[0]}</p>
        </div>
    </label>
);

const RoleCustomization: React.FC<{ playerCount: number; onStart: (roles: Role[]) => void; isPaused: boolean }> = ({ playerCount, onStart, isPaused }) => {
    const [selectedRoles, setSelectedRoles] = useState<Set<Role>>(new Set());

    const handleToggle = useCallback((role: Role) => {
        setSelectedRoles(prev => {
            const newRoles = new Set(prev);
            if (newRoles.has(role)) {
                newRoles.delete(role);
            } else {
                newRoles.add(role);
            }

            if (role === Role.PERCIVAL) {
                newRoles.has(Role.PERCIVAL) ? newRoles.add(Role.MORGANA) : newRoles.delete(Role.MORGANA);
            } else if (role === Role.MORGANA) {
                newRoles.has(Role.MORGANA) ? newRoles.add(Role.PERCIVAL) : newRoles.delete(Role.PERCIVAL);
            }
            return newRoles;
        });
    }, []);

    const { finalRoles, validation } = useMemo(() => {
        const rolesWithDefaults = new Set(selectedRoles);
        rolesWithDefaults.add(Role.MERLIN);
        rolesWithDefaults.add(Role.ASSASSIN);
        
        const requiredEvilCount = EVIL_PLAYER_COUNT[playerCount as keyof typeof EVIL_PLAYER_COUNT] || 0;
        const currentEvilRoles = [...rolesWithDefaults].filter((r: Role) => ROLES[r].alignment === Alignment.EVIL);
        const currentGoodRoles = [...rolesWithDefaults].filter((r: Role) => ROLES[r].alignment === Alignment.GOOD);

        const evilSlotsToFill = requiredEvilCount - currentEvilRoles.length;
        const goodSlotsToFill = playerCount - requiredEvilCount - currentGoodRoles.length;

        let validationError = '';
        if (evilSlotsToFill < 0) {
            validationError = 'Too many evil roles selected.';
        } else if (goodSlotsToFill < 0) {
            validationError = 'Too many good roles selected.';
        }

        const finalEvil = [...currentEvilRoles, ...Array(Math.max(0, evilSlotsToFill)).fill(Role.MINION)];
        const finalGood = [...currentGoodRoles, ...Array(Math.max(0, goodSlotsToFill)).fill(Role.LOYAL_SERVANT)];
        
        const finalRoles = [...finalGood, ...finalEvil];

        return { finalRoles, validation: { isValid: validationError === '', message: validationError } };

    }, [selectedRoles, playerCount]);

    const availableSpecialGood = [Role.PERCIVAL];
    const availableSpecialEvil = [Role.MORGANA, Role.MORDRED, Role.OBERON];
    
    return (
        <div className="mt-8 border-t-2 border-slate-700 pt-6">
            <h2 className="font-cinzel text-2xl font-bold text-yellow-600 mb-4">Customize Roles</h2>
            <div className="mb-4 bg-slate-900/50 p-3 rounded-lg text-center">
                 <h3 className="font-cinzel text-lg text-yellow-500">Core Roles (Always In)</h3>
                 <p className="text-slate-300">Merlin & Assassin</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h3 className="font-bold mb-2 text-blue-400">Optional Good Roles</h3>
                    <div className="space-y-2">
                        {availableSpecialGood.map(role => <RoleToggle key={role} role={role} selected={selectedRoles.has(role)} onToggle={handleToggle} />)}
                    </div>
                </div>
                 <div>
                    <h3 className="font-bold mb-2 text-red-500">Optional Evil Roles</h3>
                     <div className="space-y-2">
                        {availableSpecialEvil.map(role => (
                            <RoleToggle 
                                key={role} 
                                role={role} 
                                selected={selectedRoles.has(role)} 
                                onToggle={handleToggle} 
                                disabled={ (role === Role.MORGANA && selectedRoles.has(Role.PERCIVAL))}
                            />
                        ))}
                    </div>
                </div>
            </div>
            <div className="mt-6 text-center bg-slate-900/50 p-4 rounded-lg">
                <p>Final Roles ({finalRoles.length}): {finalRoles.filter((r: Role) => ROLES[r].alignment === Alignment.GOOD).length} Good, {finalRoles.filter((r: Role) => ROLES[r].alignment === Alignment.EVIL).length} Evil</p>
                <p className="text-xs text-slate-400">{[...new Set(finalRoles)].sort().join(', ')}</p>
            </div>
            <div className="mt-6 text-center">
                <Button onClick={() => onStart(finalRoles)} disabled={!validation.isValid || isPaused}>
                    Start Game
                </Button>
                {validation.message && <p className="text-red-500 mt-2 text-sm">{validation.message}</p>}
            </div>
        </div>
    );
};


const LobbyView: React.FC = () => {
    const { gameState, playerId, startGame } = useGame();
    const { roomCode, players } = gameState;
    const isPaused = !!gameState.reconnectingPlayer;

    const currentPlayer = players.find(p => p.id === playerId);
    const canStart = players.length >= 5 && players.length <= 10;

    return (
        <div className="animate-fadeIn w-full max-w-4xl mx-auto">
            <Card className="text-center">
                <h1 className="font-cinzel text-3xl md:text-4xl font-bold text-yellow-500 mb-2">Game Lobby</h1>
                <p className="text-slate-400 mb-6">Waiting for players to join...</p>

                <div className="mb-6">
                    <p className="text-slate-400 text-sm uppercase tracking-widest">Room Code</p>
                    <p className="font-cinzel text-4xl md:text-5xl font-bold text-white tracking-[0.2em] bg-slate-900/50 py-3 rounded-lg">
                        {roomCode}
                    </p>
                </div>

                <div className="mb-8">
                    <h2 className="font-cinzel text-xl md:text-2xl font-bold text-yellow-600 mb-4 border-b-2 border-slate-700 pb-2">
                        Players ({players.length}/10)
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {players.map(p => <PlayerIcon key={p.userId} player={p} />)}
                    </div>
                </div>

                {currentPlayer?.isHost && (
                    canStart ? (
                        <RoleCustomization playerCount={players.length} onStart={(selectedRoles) => startGame({ selectedRoles })} isPaused={isPaused}/>
                    ) : (
                        <div className="mt-8">
                            <Button disabled={true}>Need 5-10 Players</Button>
                            <p className="text-red-500 mt-2 text-sm">You have {players.length} players.</p>
                        </div>
                    )
                )}
                 {!currentPlayer?.isHost && (
                    <p className="text-slate-400 mt-8">Waiting for the host to start the game...</p>
                 )}
            </Card>
        </div>
    );
}

const JoinHostView: React.FC = () => {
    const { joinRoom, user, logout } = useGame();
    const [roomCode, setRoomCode] = useState('');
    
    return (
         <div className="animate-fadeIn flex flex-col items-center justify-center space-y-8">
            <h1 className="font-cinzel text-5xl sm:text-6xl md:text-8xl font-bold text-yellow-500 text-center tracking-wider" style={{ textShadow: '0 0 25px rgba(234, 179, 8, 0.5)' }}>
                Avalon Online
            </h1>
            <div className="text-center">
                <p className="text-slate-300 text-lg">Welcome, <span className="font-bold text-white">{user?.username}</span>!</p>
                <Button variant="danger" onClick={logout} className="text-sm py-1 px-3 mt-2">Log Out</Button>
            </div>

            <Card className="w-full max-w-md">
                <div className="flex flex-col space-y-6">
                    <Button onClick={() => joinRoom()} className="w-full">
                        Host New Game
                    </Button>
                    <div className="flex items-center text-slate-500">
                        <hr className="flex-grow border-slate-700"/>
                        <span className="px-2">OR</span>
                        <hr className="flex-grow border-slate-700"/>
                    </div>
                    <div className="flex flex-col gap-4 w-full">
                       <input
                            type="text"
                            placeholder="Room Code"
                            value={roomCode}
                            onChange={(e) => setRoomCode(e.target.value)}
                            className="w-full bg-slate-900 border-2 border-slate-700 rounded-md p-3 text-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:border-yellow-600 uppercase transition"
                        />
                        <Button variant="secondary" onClick={() => joinRoom(roomCode)} disabled={!roomCode.trim()} className="w-full">
                            Join Game
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};

const LobbyScreen: React.FC = () => {
    const { gameState, playerId } = useGame();
    
    // Player is in a room
    if (gameState.roomCode && gameState.players.some(p => p.id === playerId)) {
        return <LobbyView />;
    }

    // Player is logged in but not in a room
    if (!gameState.roomCode) {
        return <JoinHostView />;
    }

    // This state occurs briefly during transitions, e.g., after logout before context resets
    return <div className="text-center"><Spinner /></div>;
}

export default LobbyScreen;
