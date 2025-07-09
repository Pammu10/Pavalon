import React, { useState, useEffect, useCallback } from "react";
import { useGame } from "@/components/context/GameContext";
import { PlayerStats, Match, Alignment } from "@/types";
import api from "@/services/api";
import Card from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import MatchDetailsModal from "@/components/ui/MatchDetailsModal";

const StatCard: React.FC<{
  title: string;
  value: string | number;
  className?: string;
}> = ({ title, value, className }) => (
  <div className={`bg-slate-800/50 p-4 rounded-lg text-center ${className}`}>
    <p className="text-slate-400 text-sm font-bold uppercase tracking-wider">
      {title}
    </p>
    <p className="font-eagleLake text-4xl text-white">{value}</p>
  </div>
);

const WinRateBar: React.FC<{ rate: number; alignment: Alignment }> = ({
  rate,
  alignment,
}) => {
  const color = alignment === Alignment.GOOD ? "bg-blue-500" : "bg-red-600";
  return (
    <div>
      <div className="flex justify-between text-sm font-bold mb-1">
        <span
          className={
            alignment === Alignment.GOOD ? "text-blue-400" : "text-red-400"
          }
        >
          {alignment} Win Rate
        </span>
        <span>{rate}%</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-2.5">
        <div
          className={`${color} h-2.5 rounded-full`}
          style={{ width: `${rate}%` }}
        ></div>
      </div>
    </div>
  );
};

const MatchHistoryRow: React.FC<{
  match: Match;
  onSelect: (id: number) => void;
}> = ({ match, onSelect }) => {
  const won = match.won;
  return (
    <button
      onClick={() => onSelect(match.id)}
      className={`w-full flex justify-between items-center p-3 rounded-lg text-left transition-colors duration-200 ${
        won ? "bg-green-800/20" : "bg-red-800/20"
      } hover:bg-slate-700/50`}
    >
      <div>
        <p className="font-bold text-white">{match.role}</p>
        <p className="text-xs text-slate-400">
          {new Date(match.playedAt).toLocaleDateString()}
        </p>
      </div>
      <div
        className={`font-eagleLake font-bold px-3 py-1 rounded-full text-sm ${
          won ? "text-green-300 bg-green-900/50" : "text-red-300 bg-red-900/50"
        }`}
      >
        {won ? "Victory" : "Defeat"}
      </div>
    </button>
  );
};

const StatsScreen: React.FC = () => {
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Spinner />
      </div>
    );
  }
  if (error || !stats) {
    return (
      <Card>
        <p className="text-center text-red-500">
          {error || "Could not load stats."}
        </p>
      </Card>
    );
  }

  return (
    <>
      <div className="animate-fadeIn max-w-4xl mx-auto space-y-6">
        <h1 className="font-eagleLake text-4xl text-center text-yellow-500">
          Stats for {user?.username}
        </h1>

        <Card>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Total Wins"
              value={stats.totalWins}
              className="sm:col-span-1"
            />
            <StatCard
              title="Total Games"
              value={stats.totalGames}
              className="sm:col-span-1"
            />
            <StatCard
              title="Win Rate"
              value={`${stats.winRate}%`}
              className="sm:col-span-1"
            />
          </div>
        </Card>

        <Card>
          <h2 className="font-eagleLake text-2xl mb-4 text-center">
            Performance by Alignment
          </h2>
          <div className="space-y-4">
            <WinRateBar rate={stats.goodWinRate} alignment={Alignment.GOOD} />
            <WinRateBar rate={stats.evilWinRate} alignment={Alignment.EVIL} />
          </div>
        </Card>

        <Card>
          <h2 className="font-eagleLake text-2xl mb-4 text-center">
            Recent Matches
          </h2>
          <div className="space-y-2">
            {stats.recentMatches.length > 0 ? (
              stats.recentMatches.map((match) => (
                <MatchHistoryRow
                  key={match.id}
                  match={match}
                  onSelect={setSelectedMatchId}
                />
              ))
            ) : (
              <p className="text-center text-slate-400">
                No matches played yet.
              </p>
            )}
          </div>
        </Card>
      </div>
      {selectedMatchId && (
        <MatchDetailsModal
          matchId={selectedMatchId}
          onClose={() => setSelectedMatchId(null)}
        />
      )}
    </>
  );
};

export default StatsScreen;
