import React, { useState, useCallback } from "react";
import { useGame } from "@/components/context/GameContext";
import { fetcher } from "@/services/api";
import { LeaderboardData, LeaderboardEntry, PlayerStats, Match, Alignment, DragonsBreathStats, DragonsBreathOpponentStats, DragonsBreathLeaderboardData } from "@/types";
import Card from "@/components/ui/Card";
import { Crown, Trophy, Target, TrendingUp, ShieldCheck, Skull, User, Swords, Flame, Eye, Heart, Shield } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MatchDetailsModal from "../ui/MatchDetailsModal";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

// --- Skeleton Components ---
const Skeleton = ({ className }: { className?: string }) => (
    <div className={cn("bg-slate-700/50 rounded-md animate-pulse", className)} />
);

const StatCardSkeleton = () => (
    <div className="bg-slate-800/50 p-4 rounded-lg flex flex-col items-center justify-center gap-2">
        <Skeleton className="w-8 h-8 rounded-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-16" />
    </div>
);

const WinRateBarSkeleton = () => (
    <div>
        <div className="flex justify-between items-baseline mb-1">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="h-2.5 w-full" />
    </div>
);

const MatchHistoryRowSkeleton = () => (
    <div className="flex justify-between items-center p-3 rounded-lg bg-slate-800/20">
        <div>
            <Skeleton className="h-5 w-24 mb-1" />
            <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-8 w-20 rounded-full" />
    </div>
);

const LeaderboardListSkeleton = () => (
    <Card className="flex-1 min-w-[300px] w-full flex flex-col bg-slate-900/70">
        <div className="flex items-center gap-3 border-b-2 border-slate-700 pb-3 mb-4">
            <Skeleton className="w-12 h-12 rounded-full" />
            <Skeleton className="h-7 w-48" />
        </div>
        <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/30">
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-6 w-6" />
                        <Skeleton className="h-5 w-32" />
                    </div>
                    <Skeleton className="h-6 w-12" />
                </div>
            ))}
        </div>
    </Card>
);


// --- Pavalon Stats Components ---
const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode }> = ({ title, value, icon }) => (
    <div className="bg-slate-800/50 p-4 rounded-lg text-center flex flex-col items-center justify-center gap-2">
      <div className="text-yellow-400">{icon}</div>
      <p className="text-slate-400 text-sm font-bold uppercase tracking-wider">{title}</p>
      <p className="font-eaglelake text-4xl text-white">{value}</p>
    </div>
  );
  
const WinRateBar: React.FC<{ rate: number; alignment: Alignment; totalGames: number; }> = ({ rate, alignment, totalGames }) => {
    const color = alignment === Alignment.GOOD ? "bg-blue-500" : "bg-red-600";
    return (
      <div>
        <div className="flex justify-between items-baseline text-sm font-bold mb-1">
          <span className={alignment === Alignment.GOOD ? "text-blue-400" : "text-red-400"}>{alignment} Win Rate</span>
          <div className="flex items-baseline gap-2">
            <span className="text-slate-400 text-xs">({totalGames} games)</span>
            <span className="text-white text-lg">{rate}%</span>
          </div>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2.5">
          <div className={`${color} h-2.5 rounded-full transition-all duration-500`} style={{ width: `${rate}%` }}></div>
        </div>
      </div>
    );
};
  
const MatchHistoryRow: React.FC<{ match: Match; onSelect: (id: number) => void; }> = React.memo(({ match, onSelect }) => {
    const handleClick = useCallback(() => {
        onSelect(match.id);
    }, [onSelect, match.id]);

    return (
        <button onClick={handleClick} className={`w-full flex justify-between items-center p-3 rounded-lg text-left transition-colors duration-200 ${match.won ? "bg-green-800/20" : "bg-red-800/20"} hover:bg-slate-700/50`}>
          <div>
            <p className="font-bold text-white">{match.role}</p>
            <p className="text-xs text-slate-400">{new Date(match.playedAt).toLocaleDateString()}</p>
          </div>
          <div className={`font-eaglelake font-bold px-3 py-1 rounded-full text-sm ${match.won ? "text-green-300 bg-green-900/50" : "text-red-300 bg-red-900/50"}`}>
            {match.won ? "Victory" : "Defeat"}
          </div>
        </button>
    );
});

const MyStatsTab: React.FC = () => {
    const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
    const { data: stats, isLoading, isError } = useQuery({
        queryKey: ['myStats', 'pavalon'],
        queryFn: () => fetcher<PlayerStats>('/stats'),
    });
    
    const handleSelectMatch = useCallback((id: number) => {
        setSelectedMatchId(id);
    }, []);

    if (isLoading) return (
         <Card>
            <Skeleton className="h-8 w-64 mb-6" />
            <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatCardSkeleton />
                    <StatCardSkeleton />
                    <StatCardSkeleton />
                </div>
                <div className="space-y-4 pt-4">
                    <Skeleton className="h-6 w-56 mx-auto my-4" />
                    <WinRateBarSkeleton />
                    <WinRateBarSkeleton />
                </div>
                <div className="space-y-2 pt-4">
                    <Skeleton className="h-6 w-56 mx-auto my-4" />
                    <MatchHistoryRowSkeleton />
                    <MatchHistoryRowSkeleton />
                    <MatchHistoryRowSkeleton />
                </div>
            </div>
        </Card>
    );
    if (isError || !stats) return null;

    return (
        <>
        <Card>
             <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
                <h2 className="font-eaglelake text-3xl text-yellow-500">My Pavalon Stats</h2>
            </div>
            <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatCard title="Total Wins" value={stats.totalWins} icon={<Trophy size={24}/>} />
                    <StatCard title="Total Games" value={stats.totalGames} icon={<Swords size={24}/>} />
                    <StatCard title="Overall Win Rate" value={`${stats.winRate}%`} icon={<TrendingUp size={24}/>} />
                </div>
                <div>
                    <h3 className="font-eaglelake text-xl my-4 text-center text-white">Performance by Alignment</h3>
                    <div className="space-y-4 bg-slate-900/40 p-4 rounded-lg">
                        <WinRateBar rate={stats.goodWinRate} alignment={Alignment.GOOD} totalGames={stats.goodGames} />
                        <WinRateBar rate={stats.evilWinRate} alignment={Alignment.EVIL} totalGames={stats.evilGames} />
                    </div>
                </div>
                <div>
                    <h3 className="font-eaglelake text-xl my-4 text-center text-white">Recent Match History</h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2 scroll-hide">
                    {stats.recentMatches.length > 0 ? (
                        stats.recentMatches.map((match) => (
                        <MatchHistoryRow key={match.id} match={match} onSelect={handleSelectMatch} />
                        ))
                    ) : ( <p className="text-center text-slate-400 italic py-4">No matches played yet. The battlefield awaits!</p> )}
                    </div>
                </div>
            </div>
        </Card>
        {selectedMatchId && (
            <MatchDetailsModal matchId={selectedMatchId} onClose={() => setSelectedMatchId(null)} />
          )}
        </>
    )
}

// --- Dragon's Breath Stats Component ---
const HeadToHeadStatRow: React.FC<{ opponentStat: DragonsBreathOpponentStats }> = ({ opponentStat: op }) => {
    return (
        <div className="bg-slate-800/60 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-lg text-white">{op.opponentName}</span>
                <span className="text-slate-400 text-sm">{op.gamesPlayed} games</span>
            </div>
            <div className="flex justify-between items-center text-sm mb-2">
                <span className="text-blue-400 font-semibold">Your Wins: {op.wins}</span>
                <span className="text-red-400 font-semibold">Opponent Wins: {op.gamesPlayed - op.wins}</span>
            </div>
            <div className="w-full flex h-3 rounded-full overflow-hidden bg-slate-700">
                <div className="bg-blue-500 transition-all duration-500" style={{ width: `${op.winRate}%` }}></div>
                <div className="bg-red-600 transition-all duration-500" style={{ width: `${100 - op.winRate}%` }}></div>
            </div>
            <div className="text-center text-sm font-bold text-yellow-400 mt-2">{op.winRate}% Win Rate</div>
        </div>
    );
};

const DragonsBreathStatsTab: React.FC = () => {
    const { data: stats, isLoading, isError } = useQuery({
        queryKey: ['myStats', 'dragonsBreath'],
        queryFn: () => fetcher<DragonsBreathStats>('/stats/dragons-breath'),
    });

    if (isLoading) return (
        <div className="space-y-8">
            <Card><Skeleton className="h-8 w-64 mx-auto mb-6" /><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><StatCardSkeleton /><StatCardSkeleton /></div></Card>
            <Card><Skeleton className="h-8 w-64 mx-auto mb-6" /><MatchHistoryRowSkeleton /><MatchHistoryRowSkeleton /></Card>
        </div>
    );
    if (isError || !stats) return null;
    if (stats.totalGames === 0) {
        return (
            <Card className="text-center py-12">
                <Flame size={48} className="mx-auto text-slate-500 mb-4" />
                <h3 className="text-2xl font-eaglelake text-slate-300">No Games Played</h3>
                <p className="text-slate-400 mt-2">You haven't played any Dragon's Breath games yet. <br/>Challenge a friend in a 2-player lobby!</p>
            </Card>
        )
    }

    return (
        <div className="space-y-8">
            <Card>
                <h2 className="font-eaglelake text-3xl text-yellow-500 text-center mb-6">Overall Performance</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <StatCard title="Total Games" value={stats.totalGames} icon={<Swords size={24} />} />
                    <StatCard title="Total Wins" value={stats.totalWins} icon={<Trophy size={24} />} />
                </div>
            </Card>
            <Card>
                <h2 className="font-eaglelake text-3xl text-yellow-500 text-center mb-6">Head-to-Head</h2>
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {stats.opponentStats.map(op => (
                        <HeadToHeadStatRow key={op.opponentId} opponentStat={op} />
                    ))}
                </div>
            </Card>
            <Card>
                <h2 className="font-eaglelake text-3xl text-yellow-500 text-center mb-6">Recent Matches</h2>
                <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                    {stats.matchHistory.map(match => (
                        <div key={match.id} className={`flex justify-between items-center p-3 rounded-lg ${match.won ? 'bg-green-800/20' : 'bg-red-800/20'}`}>
                            <div>
                                <p className="text-white">vs <span className="font-bold">{match.opponentName}</span></p>
                                <p className="text-xs text-slate-400">{new Date(match.playedAt).toLocaleString()}</p>
                            </div>
                            <span className={`font-eaglelake font-bold px-3 py-1 rounded-full text-sm ${match.won ? "text-green-300 bg-green-900/50" : "text-red-300 bg-red-900/50"}`}>
                                {match.won ? 'VICTORY' : 'DEFEAT'}
                            </span>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}

// --- Leaderboard Components ---
const LeaderboardList: React.FC<{ title: string; icon: React.ReactNode; entries: LeaderboardEntry[]; isPercent?: boolean; }> = ({ title, icon, entries, isPercent = false }) => {
    const { user } = useGame();
    const topEntries = entries.slice(0, 10);
    const userInTop = topEntries.some(entry => entry.username === user?.username);
    const userEntryIndex = entries.findIndex(entry => entry.username === user?.username);
    const userEntry = userEntryIndex !== -1 ? entries[userEntryIndex] : null;

    return (
        <Card className="flex-1 min-w-[300px] w-full flex flex-col bg-slate-900/70">
            <h3 className="font-eaglelake text-2xl text-yellow-500 mb-4 flex items-center gap-3 border-b-2 border-slate-700 pb-3">
                <div className="bg-slate-800 p-3 rounded-full">{icon}</div>
                {title}
            </h3>
            <div className="flex-grow">
                <ol className="space-y-2">
                    {topEntries.map((entry, index) => {
                        const isCurrentUser = entry.username === user?.username;
                        return (
                            <li key={entry.username} className={`flex items-center justify-between p-2.5 rounded-lg transition-all ${isCurrentUser ? 'bg-yellow-800/60 ring-2 ring-yellow-600' : (index < 3 ? 'bg-slate-700/50' : 'bg-slate-800/30')}`}>
                                <div className="flex items-center gap-4">
                                    <span className={`w-6 text-center font-bold text-lg ${
                                        index === 0 ? 'text-yellow-400' : 
                                        index === 1 ? 'text-slate-300' : 
                                        index === 2 ? 'text-amber-600' : 'text-slate-400'
                                    }`}>{index + 1}</span>
                                    <span className="text-white font-semibold">{entry.username}</span>
                                </div>
                                <span className="font-bold text-lg text-yellow-300">{entry.value}{isPercent ? '%' : ''}</span>
                            </li>
                        );
                    })}
                    {entries.length === 0 && <p className="text-slate-500 italic text-center p-4">The chronicles are yet unwritten.</p>}
                </ol>
            </div>
            {!userInTop && userEntry && (
                 <div className="mt-4 pt-4 border-t-2 border-dashed border-slate-700">
                    <h4 className="text-sm text-center text-slate-400 mb-2 font-bold">Your Rank</h4>
                    <ol>
                        <li className="flex items-center justify-between p-2.5 rounded-lg bg-yellow-800/60 ring-2 ring-yellow-600">
                            <div className="flex items-center gap-4">
                                <span className="w-6 text-center font-bold text-yellow-300 text-lg">{userEntryIndex + 1}</span>
                                <span className="text-white font-semibold">{userEntry.username}</span>
                            </div>
                            <span className="font-bold text-yellow-300 text-lg">{userEntry.value}{isPercent ? '%' : ''}</span>
                        </li>
                    </ol>
                </div>
            )}
        </Card>
    );
};


const LeaderboardTab: React.FC = () => {
    const { data, isLoading, isError } = useQuery({
        queryKey: ['leaderboard', 'pavalon'],
        queryFn: () => fetcher<LeaderboardData>('/leaderboard'),
    });

    if (isLoading) return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 place-items-start">
            <LeaderboardListSkeleton />
            <LeaderboardListSkeleton />
            <LeaderboardListSkeleton />
        </div>
    );
    if (isError || !data) return null;

    const leaderboards = [
        { title: "Total Wins", icon: <Trophy size={24} className="text-yellow-400"/>, entries: data.totalWins },
        { title: "Highest Win Rate", icon: <TrendingUp size={24} className="text-green-400"/>, entries: data.winRate, isPercent: true },
        { title: "Top Assassins", icon: <Target size={24} className="text-red-400"/>, entries: data.topAssassins },
        { title: "Longest Win Streaks", icon: <Crown size={24} className="text-amber-400"/>, entries: data.winStreaks },
        { title: "Best of Good", icon: <ShieldCheck size={24} className="text-blue-400"/>, entries: data.bestGood },
        { title: "Best of Evil", icon: <Skull size={24} className="text-purple-400"/>, entries: data.bestEvil },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 place-items-start">
            {leaderboards.map(lb => (
                <LeaderboardList key={lb.title} title={lb.title} icon={lb.icon} entries={lb.entries} isPercent={lb.isPercent} />
            ))}
        </div>
    );
};

const DragonsBreathRanksTab: React.FC = () => {
    const { data, isLoading, isError } = useQuery({
        queryKey: ['leaderboard', 'dragonsBreath'],
        queryFn: () => fetcher<DragonsBreathLeaderboardData>('/leaderboard/dragons-breath'),
    });

    if (isLoading) return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 place-items-start">
            <LeaderboardListSkeleton />
            <LeaderboardListSkeleton />
            <LeaderboardListSkeleton />
        </div>
    );
    if (isError || !data) return null;
    
    const leaderboards = [
        { title: "Most Wins", icon: <Trophy size={24} className="text-yellow-400"/>, entries: data.mostWins },
        { title: "Master of Defusal", icon: <Shield size={24} className="text-green-400"/>, entries: data.mostDefuses },
        { title: "The Oracle", icon: <Eye size={24} className="text-purple-400"/>, entries: data.mostSees },
        { title: "Chief Aggressor", icon: <Swords size={24} className="text-orange-400"/>, entries: data.mostAttacks },
        { title: "Dragon Hoarder", icon: <Heart size={24} className="text-pink-400"/>, entries: data.mostFillers },
    ];
    
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 place-items-start">
            {leaderboards.map(lb => (
                <LeaderboardList key={lb.title} title={lb.title} icon={lb.icon} entries={lb.entries} />
            ))}
        </div>
    );
};


const LeaderboardScreen: React.FC = () => {
    const TABS_CONFIG = [
        { value: "my-stats", label: "Pavalon Stats", icon: <User size={18} /> },
        { value: "dragons-breath", label: "Dragon Breath", icon: <Flame size={18} /> },
        { value: "leaderboard", label: "Pavalon Ranks", icon: <Trophy size={18} /> },
        { value: "db-ranks", label: "Dragon Ranks", icon: <Trophy size={18} /> },
    ];

    return (
        <div className="animate-fadeIn max-w-7xl mx-auto space-y-6 pb-16 md:pb-0">
            <Card>
                <h1 className="font-eaglelake text-4xl text-center text-yellow-500" style={{ textShadow: "0 0 15px rgba(234, 179, 8, 0.4)" }}>Hall of Heroes</h1>
            </Card>
            <Tabs defaultValue="my-stats" className="w-full">
                <TabsList className="w-full max-w-2xl mx-auto grid grid-cols-2 md:grid-cols-4 bg-slate-800/50 p-1 h-auto gap-1 rounded-lg">
                    {TABS_CONFIG.map(tab => (
                        <TabsTrigger
                            key={tab.value}
                            value={tab.value}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 py-2.5 data-[state=active]:bg-slate-700 data-[state=active]:text-yellow-400 text-slate-300 font-bold rounded-md"
                            )}
                        >
                            {tab.icon}
                            {tab.label}
                        </TabsTrigger>
                    ))}
                </TabsList>
                <TabsContent value="my-stats" className="mt-6">
                    <MyStatsTab />
                </TabsContent>
                <TabsContent value="dragons-breath" className="mt-6">
                    <DragonsBreathStatsTab />
                </TabsContent>
                <TabsContent value="leaderboard" className="mt-6">
                    <LeaderboardTab />
                </TabsContent>
                <TabsContent value="db-ranks" className="mt-6">
                    <DragonsBreathRanksTab />
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default LeaderboardScreen;