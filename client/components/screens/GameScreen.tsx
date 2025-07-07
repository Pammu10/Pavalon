import React, { useState } from 'react';
import { useGame } from '@/components/context/GameContext';
import { GamePhase, Player, Alignment, Role, GameState, Quest } from '@/types';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

// --- Reusable UI Components ---

const getAvatarInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length > 1 && parts[1]) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
};

const PlayerDisplay: React.FC<{ player: Player; size?: 'sm' | 'md' }> = ({ player, size = 'md' }) => {
    const sizeClasses = {
        sm: 'w-12 h-12 text-base',
        md: 'w-16 h-16 sm:w-20 sm:h-20 text-xl sm:text-2xl',
    };
    const isDisconnected = player.status === 'DISCONNECTED';
    return (
        <div className={`flex flex-col items-center justify-center text-center relative ${isDisconnected ? 'grayscale' : ''}`}>
            <div className={`mx-auto rounded-full flex items-center justify-center font-bold border-4 bg-slate-700 border-slate-600 ${sizeClasses[size]}`}>
                {getAvatarInitials(player.name)}
                 {isDisconnected && <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center text-white text-xs font-bold">DC</div>}
            </div>
            <p className="mt-1 text-xs sm:text-sm font-bold break-words w-16 sm:w-20">{player.name}</p>
        </div>
    );
};

const VoteResultDisplay: React.FC<{
    vote: Quest['pastVotes'][0] | Quest['approvedVote'],
    players: Player[],
    isApproved: boolean,
}> = ({ vote, players, isApproved }) => {
    if (!vote) return null;

    const approvals = vote.votes.filter(v => v.vote === 'APPROVE');
    const rejections = vote.votes.filter(v => v.vote === 'REJECT');

    const title = isApproved ? `Team Approved (${approvals.length}-${rejections.length})` : `Team Rejected (${approvals.length}-${rejections.length})`;
    const titleColor = isApproved ? 'text-blue-400' : 'text-red-400';
    const borderColor = isApproved ? 'border-blue-700' : 'border-red-700';

    return (
        <div className={`bg-slate-800/50 p-3 rounded-lg border ${borderColor}`}>
            <h4 className={`font-cinzel text-center ${titleColor} mb-2`}>{title}</h4>
            <div className="flex justify-center flex-wrap gap-2 mb-2">
                {vote.team.map(p => <PlayerDisplay key={p.id} player={p} size="sm" />)}
            </div>
            <div className="grid grid-cols-2 gap-x-2 text-xs">
                <div>
                    <h5 className="font-bold text-blue-400">Approved By:</h5>
                    <ul className="list-none pl-0">
                        {approvals.map(v => <li key={v.playerId}>{players.find(p => p.id === v.playerId)?.name}</li>)}
                    </ul>
                </div>
                <div>
                    <h5 className="font-bold text-red-400">Rejected By:</h5>
                     <ul className="list-none pl-0">
                        {rejections.map(v => <li key={v.playerId}>{players.find(p => p.id === v.playerId)?.name}</li>)}
                    </ul>
                </div>
            </div>
        </div>
    );
};

// --- Game Phase Components ---

const TeamSelection: React.FC = () => {
    const { gameState, playerId, selectTeam } = useGame();
    const [selectedTeam, setSelectedTeam] = useState<string[]>([]);
    const isLeader = gameState.leader?.id === playerId;
    const currentQuest = gameState.questHistory[gameState.currentQuest - 1];
    const isPaused = !!gameState.reconnectingPlayer;

    const handlePlayerClick = (id: string) => {
        if (isPaused) return;
        setSelectedTeam(prev =>
            prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
        );
    };
    
    const canSubmit = selectedTeam.length === currentQuest.teamSize;

    return (
        <Card className="w-full">
             <h2 className="font-cinzel text-xl sm:text-2xl text-yellow-500 mb-1 text-center">
                {isLeader ? 'Choose Your Team' : `Waiting for ${gameState.leader?.name} to choose`}
            </h2>
            <p className="text-center text-slate-400 mb-4">Vote Track: {gameState.voteTrack} / 5</p>
            
            {currentQuest.pastVotes.length > 0 && (
                <div className="mb-4 space-y-2">
                    <h3 className="font-cinzel text-lg text-center mb-2">Rejected Team Votes</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {currentQuest.pastVotes.map((vote, index) => (
                            <VoteResultDisplay key={`past-${index}`} vote={vote} players={gameState.players} isApproved={false} />
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1 sm:gap-4">
                {gameState.players.map(p => {
                    const isSelected = selectedTeam.includes(p.id);
                    const isDisconnected = p.status === 'DISCONNECTED';
                    return (
                        <div key={p.id} onClick={() => isLeader && handlePlayerClick(p.id)} className={`relative p-1 sm:p-2 rounded-lg text-center transition-all duration-200 ${isLeader && !isPaused ? 'cursor-pointer' : 'cursor-default'}`}>
                            <div className={`w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full flex items-center justify-center text-xl sm:text-2xl font-bold border-4 transition-all duration-200 relative ${isDisconnected ? 'grayscale' : ''} ${isSelected ? 'bg-yellow-500 border-yellow-300 shadow-lg scale-110' : 'bg-slate-700 border-slate-600'}`}>
                                {getAvatarInitials(p.name)}
                                {isDisconnected && <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center text-white text-xs font-bold">DC</div>}
                            </div>
                            <p className="mt-2 text-xs sm:text-sm font-bold break-words">{p.name}</p>
                            {p.id === gameState.leader?.id && (
                                <span className="absolute top-0 right-0 text-xs bg-yellow-600 text-white px-2 py-0.5 rounded-full font-bold shadow">L</span>
                            )}
                        </div>
                    );
                })}
            </div>

            {isLeader && (
                <div className="text-center mt-6">
                    <Button onClick={() => selectTeam(selectedTeam)} disabled={!canSubmit || isPaused}>
                        Propose Team ({selectedTeam.length}/{currentQuest.teamSize})
                    </Button>
                </div>
            )}
        </Card>
    );
};

const TeamVote: React.FC = () => {
    const { gameState, playerId, voteOnTeam } = useGame();
    const player = gameState.players.find(p => p.id === playerId);
    const teamOnMission = gameState.questHistory[gameState.currentQuest-1].team;
    const isPaused = !!gameState.reconnectingPlayer;

    return (
        <Card className="w-full">
            <h2 className="font-cinzel text-xl sm:text-2xl text-yellow-500 mb-4 text-center">Vote on the Proposed Team</h2>
            
            <div className="flex justify-center flex-wrap gap-2 sm:gap-4 bg-slate-900/50 p-4 rounded-lg mb-4">
                {teamOnMission.map(p => <PlayerDisplay key={p.id} player={p} />)}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-6">
                {gameState.players.map(p => (
                    <div key={p.id} className={`p-2 rounded-md text-center text-sm transition-colors ${p.hasVoted ? 'bg-green-800/50' : 'bg-slate-800/50'} ${p.status === 'DISCONNECTED' ? 'grayscale opacity-60' : ''}`}>
                        {p.name} {p.hasVoted ? '✓' : '...'}
                    </div>
                ))}
            </div>

            {player && !player.hasVoted ? (
                <div className="flex justify-center gap-4 mt-6">
                    <Button onClick={() => voteOnTeam('APPROVE')} disabled={isPaused}>Approve</Button>
                    <Button variant="danger" onClick={() => voteOnTeam('REJECT')} disabled={isPaused}>Reject</Button>
                </div>
            ) : (
                <p className="text-center mt-6 text-slate-400 font-bold text-xl">Waiting for votes...</p>
            )}
        </Card>
    );
};

const QuestVote: React.FC = () => {
    const { gameState, playerId, voteOnQuest } = useGame();
    const player = gameState.players.find(p => p.id === playerId);
    const currentQuest = gameState.questHistory[gameState.currentQuest-1];
    const isOnTeam = currentQuest.team.some(p => p.id === playerId);
    const isPaused = !!gameState.reconnectingPlayer;

    return (
        <Card className="w-full">
            <h2 className="font-cinzel text-xl sm:text-2xl text-yellow-500 mb-4 text-center">
                {isOnTeam ? 'Your Mission' : 'Awaiting Mission Result'}
            </h2>

            <div className="mb-4">
                <VoteResultDisplay vote={currentQuest.approvedVote} players={gameState.players} isApproved={true} />
            </div>

            {isOnTeam ? (
                <>
                    <div className="flex justify-center gap-2 mb-6">
                        {currentQuest.team.map(p => (
                             <div key={p.id} className={`p-2 rounded-md text-center text-sm transition-colors ${p.hasVoted ? 'bg-green-800/50' : 'bg-slate-800/50'} ${p.status === 'DISCONNECTED' ? 'grayscale opacity-60' : ''}`}>
                                {p.name} {p.hasVoted ? '✓' : '...'}
                            </div>
                        ))}
                    </div>
                    {player && !player.hasVoted ? (
                        <div className="flex justify-center gap-4 mt-6">
                            <Button onClick={() => voteOnQuest('SUCCESS')} disabled={isPaused}>Success</Button>
                            {player.alignment === Alignment.EVIL && (
                                <Button variant="danger" onClick={() => voteOnQuest('FAIL')} disabled={isPaused}>Fail</Button>
                            )}
                        </div>
                    ) : (
                        <p className="text-center mt-6 text-slate-400">Waiting for other team members...</p>
                    )}
                </>
            ) : (
                 <p className="text-center text-slate-400">Waiting for the quest team to complete their mission...</p>
            )}
        </Card>
    );
};

const QuestResult: React.FC = () => {
    const { gameState } = useGame();
    const quest = gameState.questHistory[gameState.currentQuest-1];
    const isSuccess = quest.status === 'PASSED';
    const failVotes = quest.results.filter(r => r === 'FAIL').length;

    return (
        <Card className={`border-4 ${isSuccess ? 'border-blue-500' : 'border-red-600'}`}>
            <h2 className={`font-cinzel text-3xl md:text-4xl text-center font-bold ${isSuccess ? 'text-blue-400' : 'text-red-500'}`}>
                Quest {isSuccess ? 'Succeeded' : 'Failed'}
            </h2>
            <div className="flex justify-center gap-2 md:gap-4 mt-4">
                {quest.results.sort().map((r, i) => (
                    <div key={i} className={`w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center font-bold text-white text-xs md:text-sm shadow-lg animate-fadeIn ${r === 'SUCCESS' ? 'bg-blue-600' : 'bg-red-700'}`}>
                        {r}
                    </div>
                ))}
            </div>
             <p className="text-center text-slate-400 mt-4 text-sm md:text-base">{failVotes} Fail vote{failVotes !== 1 ? 's' : ''} submitted. {quest.failsRequired} required to Fail.</p>
        </Card>
    );
};

const Assassination: React.FC = () => {
    const { gameState, playerId, assassinate } = useGame();
    const player = gameState.players.find(p => p.id === playerId);
    const isAssassin = player?.role === Role.ASSASSIN;
    const potentialTargets = gameState.players.filter(p => p.alignment === Alignment.GOOD);
    const isPaused = !!gameState.reconnectingPlayer;

    return (
        <Card>
            <h2 className="font-cinzel text-2xl md:text-3xl text-center text-red-500">The Assassination</h2>
            {isAssassin ? (
                <>
                    <p className="text-center mt-2 mb-4">You have one chance. Find and eliminate Merlin.</p>
                    <div className="flex flex-wrap justify-center gap-2 md:gap-4">
                        {potentialTargets.map(p => (
                            <Button key={p.id} variant="secondary" onClick={() => assassinate(p.id)} disabled={isPaused}>
                                Assassinate {p.name}
                            </Button>
                        ))}
                    </div>
                </>
            ) : (
                <p className="text-center mt-4">The Assassin is making their choice...</p>
            )}
        </Card>
    );
}

const QuestMarker: React.FC<{ quest: Quest }> = ({ quest }) => {
    const { status, questNumber, teamSize, failsRequired, results, questLeader, team } = quest;
    let bgColor = 'border-slate-600';
    let pulseClass = '';

    if (status === 'PASSED') {
        bgColor = 'bg-blue-600 border-blue-400';
    } else if (status === 'FAILED') {
        bgColor = 'bg-red-700 border-red-500';
    } else if (status === 'ACTIVE') {
        bgColor = 'border-yellow-500';
        pulseClass = 'animate-pulse-glow';
    }
    
    return (
        <div className="flex flex-col items-center group relative">
            <div className={`w-16 h-14 sm:w-20 sm:h-16 rounded-lg flex flex-col items-center justify-center border-2 transition-all ${bgColor} ${pulseClass}`}>
                <div className="font-cinzel text-xs text-slate-300">Q{questNumber}</div>
                <div className="text-sm font-bold">{teamSize}</div>
            </div>
             {failsRequired > 1 && <span className="text-xs font-bold text-slate-400 mt-1">*</span>}
            
            {status !== 'PENDING' && (
                <div className="quest-marker-tooltip">
                    <p className="font-bold border-b border-slate-600 mb-1 pb-1">Quest {questNumber} Details</p>
                    <p><span className="font-semibold text-slate-400">Leader:</span> {questLeader?.name || 'N/A'}</p>
                    <p><span className="font-semibold text-slate-400">Team:</span> {team.map(p => p.name).join(', ')}</p>
                    <p><span className="font-semibold text-slate-400">Result:</span> {quest.results.filter(r => r === 'SUCCESS').length} Success, {quest.results.filter(r => r === 'FAIL').length} Fail</p>
                </div>
            )}
        </div>
    );
};


const GameHeader: React.FC<{ gameState: GameState }> = ({ gameState }) => {
    const goodScore = gameState.questHistory.filter(q => q.status === 'PASSED').length;
    const evilScore = gameState.questHistory.filter(q => q.status === 'FAILED').length;
    
    return (
        <div className="w-full mb-6">
            <div className="flex justify-between items-center bg-slate-900/50 p-2 md:p-4 rounded-lg border border-slate-700 mb-4 text-sm md:text-base">
                <div className="text-blue-400 font-bold">Good: {goodScore}</div>
                <div className="font-cinzel text-lg md:text-xl">Vote Track: {gameState.voteTrack}</div>
                <div className="text-red-500 font-bold">Evil: {evilScore}</div>
            </div>
            <div className="flex justify-center gap-1 sm:gap-2 md:gap-4">
                {gameState.questHistory.map(q => <QuestMarker key={q.questNumber} quest={q} />)}
            </div>
        </div>
    );
};


// -- Main Game Screen Component --

const GameScreen: React.FC = () => {
    const { gameState } = useGame();
    
    const renderPhaseComponent = () => {
        switch (gameState.phase) {
            case GamePhase.TEAM_SELECTION:
                return <TeamSelection />;
            case GamePhase.TEAM_VOTE:
                return <TeamVote />;
            case GamePhase.QUEST_VOTE:
                return <QuestVote />;
            case GamePhase.QUEST_RESULT:
                return <QuestResult />;
            case GamePhase.ASSASSINATION:
                return <Assassination />;
            default:
                return <p>Loading phase...</p>;
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto flex flex-col items-center">
            <GameHeader gameState={gameState} />
            <div className="w-full animate-slideInUp">
                {renderPhaseComponent()}
            </div>
        </div>
    );
};

export default GameScreen;
