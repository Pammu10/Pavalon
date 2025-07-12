
import React, { useState, useEffect } from "react";
import { useGame } from "@/components/context/GameContext";
import api from "@/services/api";
import { LeaderboardData, LeaderboardEntry, PlayerStats, Match, Alignment } from "@/types";
import Card from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import { Crown, Trophy, Target, TrendingUp, ShieldCheck, Skull, User, Download, Swords, Star } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Button from "../ui/Button";
import MatchDetailsModal from "../ui/MatchDetailsModal";

// --- Stats Components ---
const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode }> = ({ title, value, icon }) => (
    <div className="bg-slate-800/50 p-4 rounded-lg text-center flex flex-col items-center justify-center gap-2">
      <div className="text-yellow-400">{icon}</div>
      <p className="text-slate-400 text-sm font-bold uppercase tracking-wider">{title}</p>
      <p className="font-eagleLake text-4xl text-white">{value}</p>
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
  
const MatchHistoryRow: React.FC<{ match: Match; onSelect: (id: number) => void; }> = ({ match, onSelect }) => (
    <button onClick={() => onSelect(match.id)} className={`w-full flex justify-between items-center p-3 rounded-lg text-left transition-colors duration-200 ${match.won ? "bg-green-800/20" : "bg-red-800/20"} hover:bg-slate-700/50`}>
      <div>
        <p className="font-bold text-white">{match.role}</p>
        <p className="text-xs text-slate-400">{new Date(match.playedAt).toLocaleDateString()}</p>
      </div>
      <div className={`font-eagleLake font-bold px-3 py-1 rounded-full text-sm ${match.won ? "text-green-300 bg-green-900/50" : "text-red-300 bg-red-900/50"}`}>
        {match.won ? "Victory" : "Defeat"}
      </div>
    </button>
);

const MyStatsTab: React.FC = () => {
    const { user } = useGame();
    const [stats, setStats] = useState<PlayerStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
          try {
            const { data } = await api.get("/stats");
            setStats(data);
          } catch (err) {
            setError("Failed to load stats.");
          } finally {
            setLoading(false);
          }
        };
        fetchStats();
    }, []);

    const handleDownloadStats = () => {
        if (!stats || !user) return;
        const headers = ["Category", "Value"];
        const data = [
          ["Username", user.username],
          ["Total Games", stats.totalGames],
          ["Total Wins", stats.totalWins],
          ["Win Rate (%)", stats.winRate],
          ["Good Games", stats.goodGames],
          ["Good Wins", stats.goodWins],
          ["Good Win Rate (%)", stats.goodWinRate],
          ["Evil Games", stats.evilGames],
          ["Evil Wins", stats.evilWins],
          ["Evil Win Rate (%)", stats.evilWinRate],
        ];
        let csvContent = "data:text/csv;charset=utf-8," + data.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `pavalon_stats_${user?.username}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };
    
      if (loading) return <div className="flex justify-center items-center h-40"><Spinner /></div>;
      if (error || !stats) return <p className="text-center text-red-500">{error || "Could not load stats."}</p>;

    return (
        <>
        <Card>
             <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
                <h2 className="font-eagleLake text-3xl text-yellow-500">My Personal Stats</h2>
                <Button variant="secondary" onClick={handleDownloadStats} disabled={!stats} className="text-sm py-1.5 px-3 flex items-center gap-2">
                    <Download size={16}/>
                    Download CSV
                </Button>
            </div>
            <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatCard title="Total Wins" value={stats.totalWins} icon={<Trophy size={24}/>} />
                    <StatCard title="Total Games" value={stats.totalGames} icon={<Swords size={24}/>} />
                    <StatCard title="Overall Win Rate" value={`${stats.winRate}%`} icon={<TrendingUp size={24}/>} />
                </div>
                <div>
                    <h3 className="font-eagleLake text-xl my-4 text-center">Performance by Alignment</h3>
                    <div className="space-y-4 bg-slate-900/40 p-4 rounded-lg">
                        <WinRateBar rate={stats.goodWinRate} alignment={Alignment.GOOD} totalGames={stats.goodGames} />
                        <WinRateBar rate={stats.evilWinRate} alignment={Alignment.EVIL} totalGames={stats.evilGames} />
                    </div>
                </div>
                <div>
                    <h3 className="font-eagleLake text-xl my-4 text-center">Recent Match History</h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2 scroll-hide">
                    {stats.recentMatches.length > 0 ? (
                        stats.recentMatches.map((match) => (
                        <MatchHistoryRow key={match.id} match={match} onSelect={setSelectedMatchId} />
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


// --- Leaderboard Components ---
const LeaderboardList: React.FC<{ title: string; icon: React.ReactNode; entries: LeaderboardEntry[]; isPercent?: boolean; }> = ({ title, icon, entries, isPercent = false }) => {
    const { user } = useGame();
    const topEntries = entries.slice(0, 10);
    const userInTop = topEntries.some(entry => entry.username === user?.username);
    const userEntryIndex = entries.findIndex(entry => entry.username === user?.username);
    const userEntry = userEntryIndex !== -1 ? entries[userEntryIndex] : null;

    return (
        <Card className="flex-1 min-w-[300px] w-full flex flex-col bg-slate-900/70">
            <h3 className="font-eagleLake text-2xl text-yellow-500 mb-4 flex items-center gap-3 border-b-2 border-slate-700 pb-3">
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


const LeaderboardTab: React.FC<{ data: LeaderboardData | null }> = ({ data }) => {
    if (!data) return null;

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


const LeaderboardScreen: React.FC = () => {
    const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const { data } = await api.get<LeaderboardData>("/leaderboard");
                setLeaderboard(data);
            } catch (err) {
                setError("Failed to load the leaderboard.");
            } finally {
                setLoading(false);
            }
        };
        fetchLeaderboard();
    }, []);

    const TABS_CONFIG = [
        { value: "my-stats", label: "My Stats", icon: <User size={18} /> },
        { value: "leaderboard", label: "Global Ranks", icon: <Trophy size={18} /> },
    ];

    return (
        <div className="animate-fadeIn max-w-7xl mx-auto space-y-6">
            <h1 className="font-eagleLake text-5xl text-center text-yellow-500" style={{ textShadow: "0 0 15px rgba(234, 179, 8, 0.4)" }}>Hall of Heroes</h1>
            <Tabs defaultValue="my-stats" className="w-full">
                <TabsList className="grid w-full max-w-lg mx-auto grid-cols-2 bg-slate-800/50 p-1 h-auto">
                    {TABS_CONFIG.map(tab => (
                        <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-2 py-2.5 data-[state=active]:bg-slate-700 data-[state=active]:text-yellow-400 text-slate-300 font-bold">
                            {tab.icon}
                            {tab.label}
                        </TabsTrigger>
                    ))}
                </TabsList>
                <TabsContent value="my-stats" className="mt-6">
                     {loading ? (
                        <div className="flex justify-center items-center h-full min-h-[50vh]"><Spinner /></div>
                    ) : error ? (
                        <Card><p className="text-center text-red-500">{error}</p></Card>
                    ) : (
                        <MyStatsTab />
                    )}
                </TabsContent>
                <TabsContent value="leaderboard" className="mt-6">
                     {loading ? (
                        <div className="flex justify-center items-center h-full min-h-[50vh]"><Spinner /></div>
                    ) : error ? (
                        <Card><p className="text-center text-red-500">{error}</p></Card>
                    ) : (
                        <LeaderboardTab data={leaderboard} />
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default LeaderboardScreen;
