import React, { useEffect } from "react";
import { useGame } from "@/components/context/GameContext";
import { useAudio } from "@/components/context/AudioContext";
import { Alignment, Player, Quest, Role } from "@/types";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PlayerStatusList from "../ui/PlayerStatusList";
import GameEndOverlay from "../ui/GameEndOverlay";
import { Check, X, Vote, CheckCircle, XCircle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ROLES } from "@/constants";

// --- Sub-components for After-Action Report ---

const TimelineItem: React.FC<{
  children: React.ReactNode;
  isLast?: boolean;
}> = ({ children, isLast }) => (
  <div className="relative pl-6 sm:pl-8 pb-8">
    {!isLast && (
      <div className="absolute top-5 -left-1 sm:left-[-1px] w-0.5 h-full bg-slate-700"></div>
    )}
    <div className="absolute top-4 -left-1 sm:left-[-3px] w-5 h-5 bg-slate-800 rounded-full flex items-center justify-center ring-4 ring-slate-900">
      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
    </div>
    {children}
  </div>
);

const VoteResultItem: React.FC<{
  label: string;
  names: string[];
  icon: React.ReactNode;
  textColor: string;
}> = ({ label, names, icon, textColor }) => (
  <div>
    <h5
      className={`font-bold ${textColor} mb-2 flex items-center gap-2 text-sm`}
    >
      {icon}
      {label} ({names.length})
    </h5>
    <ul className="list-none pl-1 space-y-1 text-slate-300 text-xs">
      {names.map((name) => (
        <li key={name}>{name}</li>
      ))}
      {names.length === 0 && <li className="italic text-slate-500">None</li>}
    </ul>
  </div>
);

const TeamVoteDetails: React.FC<{
  vote: {
    team: Player[];
    votes: { playerId: string; vote: "APPROVE" | "REJECT" }[];
  };
  players: Player[];
  isApproved: boolean;
  leader: Player | null;
}> = ({ vote, players, isApproved, leader }) => {
  const playersById = new Map(players.map((p) => [p.id, p]));
  const approvals = vote.votes
    .filter((v) => v.vote === "APPROVE")
    .map((v) => playersById.get(v.playerId)?.name)
    .filter((name): name is string => !!name);
  const rejections = vote.votes
    .filter((v) => v.vote === "REJECT")
    .map((v) => playersById.get(v.playerId)?.name)
    .filter((name): name is string => !!name);
  const voteCount = `(${approvals.length}-${rejections.length})`;

  return (
    <div
      className={`p-4 rounded-lg border-l-4 ${
        isApproved
          ? "border-blue-600 bg-slate-800/40"
          : "border-red-600 bg-slate-800/40"
      } mt-2`}
    >
      <p className="font-bold text-sm mb-3 pb-2 border-b border-slate-700 text-white">
        Team Vote{" "}
        {isApproved ? (
          <span className="text-blue-400">Approved {voteCount}</span>
        ) : (
          <span className="text-red-400">Rejected {voteCount}</span>
        )}
      </p>
      <div className="mb-3">
        {leader && (
          <p className="text-xs text-slate-400 mb-1">
            Proposed by:{" "}
            <span className="font-bold text-white">{leader.name}</span>
          </p>
        )}
        <p className="text-xs text-slate-400">
          Team:{" "}
          <span className="font-bold text-white">
            {vote.team.map((p) => p.name).join(", ")}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-x-4 sm:gap-x-6">
        <VoteResultItem
          label="Approved By"
          names={approvals}
          icon={<Check size={16} />}
          textColor="text-blue-400"
        />
        <VoteResultItem
          label="Rejected By"
          names={rejections}
          icon={<X size={16} />}
          textColor="text-red-400"
        />
      </div>
    </div>
  );
};

const QuestMissionDetails: React.FC<{ quest: Quest; players: Player[] }> = ({
  quest,
  players,
}) => {
  if (quest.status !== "PASSED" && quest.status !== "FAILED") return null;
  const playersById = new Map(players.map((p) => [p.id, p]));
  const successVoters = quest.results
    .filter((r) => r.vote === "SUCCESS")
    .map((r) => playersById.get(r.playerId)!)
    .filter(Boolean);
  const failVoters = quest.results
    .filter((r) => r.vote === "FAIL")
    .map((r) => playersById.get(r.playerId)!)
    .filter(Boolean);

  return (
    <div className="p-4 rounded-lg border-l-4 border-yellow-600 bg-slate-800/40 mt-4">
      <h4 className="font-bold text-yellow-500 text-base mb-3 pb-2 border-b border-slate-700 flex items-center gap-2">
        <Vote size={18} />
        Mission Details
      </h4>
      <div className="grid grid-cols-2 gap-x-4 sm:gap-x-6">
        <VoteResultItem
          label="Voted Success"
          names={successVoters.map((p) => p.name)}
          icon={<CheckCircle size={16} />}
          textColor="text-blue-400"
        />
        <VoteResultItem
          label="Voted Fail"
          names={failVoters.map((p) => p.name)}
          icon={<XCircle size={16} />}
          textColor="text-red-400"
        />
      </div>
    </div>
  );
};

// --- Main Components ---
const shortenRoleName = (role: Role): string => {
  if (role === Role.LOYAL_SERVANT) return "Loyal Servant";
  if (role === Role.MINION) return "Minion";
  return role;
};

const FinalRolesDisplay: React.FC<{ players: Player[] }> = ({ players }) => {
  return (
    <div className="animate-fade-in-up">
      <h3
        className="font-eaglelake text-2xl text-white mb-4 text-left"
        style={{ textShadow: "1px 1px 5px rgba(0,0,0,0.8)" }}
      >
        Final Roles:
      </h3>
      <div className="space-y-2">
        {players.map((player) => {
          if (!player.role) return null;
          const isGood = player.alignment === Alignment.GOOD;
          const roleInfo = ROLES[player.role];

          const backgroundStyle = {
            background: isGood
              ? "radial-gradient(circle at top left, rgba(29, 78, 216, 0.3), transparent 60%), linear-gradient(105deg, #1a2a45 0%, #111827 100%)"
              : "radial-gradient(circle at top left, rgba(190, 18, 60, 0.3), transparent 60%), linear-gradient(105deg, #451a2a 0%, #111827 100%)",
          };

          const borderColor = isGood
            ? "border-blue-400/50"
            : "border-red-500/50";
          const alignmentTextColor = isGood ? "text-blue-300" : "text-rose-400";

          return (
            <div
              key={player.id}
              style={backgroundStyle}
              className={`relative flex items-center p-2 rounded-xl text-white shadow-lg border ${borderColor} ${
                player.status === "DISCONNECTED" ? "grayscale opacity-60" : ""
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <img
                    src={roleInfo.img}
                    alt={player.role}
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-yellow-500 object-cover shadow-md"
                  />
                </div>
                {/* Name and Role */}
                <div className="min-w-0 text-left">
                  <p
                    className="font-eaglelake text-sm sm:text-xl font-bold text-white tracking-wide truncate"
                    style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.7)" }}
                  >
                    {player.name}
                  </p>
                  <p
                    className="font-eaglelake text-xs sm:text-base text-yellow-300 truncate"
                    style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.7)" }}
                  >
                    {shortenRoleName(player.role)}
                  </p>
                </div>
              </div>

              {/* Alignment */}
              <div className="flex-shrink-0 px-2 sm:px-4">
                <p
                  className={`font-eaglelake text-sm sm:text-lg font-black tracking-wider ${alignmentTextColor}`}
                  style={{ textShadow: "1px 1px 4px rgba(0,0,0,0.7)" }}
                >
                  {player.alignment?.toUpperCase()}
                </p>
              </div>

              {player.status === "DISCONNECTED" && (
                <div className="absolute top-1 right-1 text-xs bg-slate-600 px-2 py-0.5 rounded-full">
                  DC
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ReadyForNextGame: React.FC<{
  players: Player[];
  readyPlayers: string[];
  currentPlayerId: string | null;
  onReady: () => void;
}> = ({ players, readyPlayers, currentPlayerId, onReady }) => {
  const isReady = !!(currentPlayerId && readyPlayers.includes(currentPlayerId));

  return (
    <div>
      <div className="mb-4">
        <PlayerStatusList
          title="Next Game Status"
          players={players}
          readyPlayerIds={readyPlayers}
        />
      </div>
      <Button onClick={onReady} disabled={isReady} className="w-full">
        {isReady ? "Waiting for other players..." : "Play Again"}
      </Button>
    </div>
  );
};

const EndGameScreen: React.FC = () => {
  const {
    gameState,
    playerId,
    playerReadyForNextGame,
    hasViewedEndGameResult,
    markEndGameAsViewed,
  } = useGame();
  const { playSound, stopBackgroundMusic, playLobbyMusic } = useAudio();
  const { winner, endGameReason, players, questHistory, endGameReadyPlayers } =
    gameState;

  useEffect(() => {
    if (winner && !hasViewedEndGameResult) {
      const endSound = winner === Alignment.GOOD ? "victory" : "defeat";

      const playEndGameSequence = async () => {
        stopBackgroundMusic();
        await playSound(endSound, { manageBgm: false });
        playLobbyMusic();
      };

      playEndGameSequence();
    }
  }, [
    winner,
    hasViewedEndGameResult,
    playSound,
    stopBackgroundMusic,
    playLobbyMusic,
  ]);

  const handlePlayAgain = () => {
    playerReadyForNextGame();
  };

  if (winner && !hasViewedEndGameResult) {
    return (
      <GameEndOverlay
        show={true}
        winner={winner}
        onClose={markEndGameAsViewed}
      />
    );
  }

  const gameReportAccordion = (
    <Accordion type="single" collapsible className="w-full my-8">
      <AccordionItem
        value="report"
        className="rounded-lg overflow-hidden bg-slate-800/20"
      >
        <AccordionTrigger className="px-4 sm:px-6 py-4 text-2xl sm:text-3xl font-eaglelake text-yellow-500 hover:no-underline data-[state=open]:border-b data-[state=open]:border-yellow-700/50">
          End of Game Report
        </AccordionTrigger>
        <AccordionContent className="px-2 sm:px-4">
          <div className="pt-4">
            <div className="text-left">
              {questHistory
                .filter((q) => q.status === "PASSED" || q.status === "FAILED")
                .map((quest, index, arr) => (
                  <TimelineItem
                    key={quest.questNumber}
                    isLast={index === arr.length - 1}
                  >
                    <h3 className="font-eaglelake text-xl sm:text-2xl mb-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-white">
                      Quest {quest.questNumber}
                      <span
                        className={`text-sm px-3 py-1 rounded-full font-bold tracking-wider ${
                          quest.status === "PASSED"
                            ? "bg-blue-600/40 text-blue-300"
                            : "bg-red-600/40 text-red-300"
                        }`}
                      >
                        {quest.status}
                      </span>
                    </h3>
                    <p className="text-slate-400 mb-4 ml-1">
                      Team of {quest.teamSize} | {quest.failsRequired} Fail vote
                      {quest.failsRequired > 1 ? "s" : ""} needed
                    </p>

                    <div className="space-y-4">
                      {quest.pastVotes.map((vote, vIndex) => (
                        <TeamVoteDetails
                          key={`past-${vIndex}`}
                          vote={vote}
                          players={players}
                          isApproved={false}
                          leader={vote.leader}
                        />
                      ))}
                      {quest.approvedVote && (
                        <TeamVoteDetails
                          vote={quest.approvedVote}
                          players={players}
                          isApproved={true}
                          leader={quest.questLeader}
                        />
                      )}
                    </div>

                    {quest.approvedVote && (
                      <QuestMissionDetails quest={quest} players={players} />
                    )}
                  </TimelineItem>
                ))}
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );

  const winnerColor =
    winner === Alignment.GOOD ? "text-blue-400" : "text-red-500";

  return (
    <div className="animate-fadeIn text-center">
      <Card
        className='bg-transparent'
      >
        {winner ? (
          <>
            <h1
              className={`font-eaglelake text-4xl md:text-6xl font-bold ${winnerColor}`}
              style={{ textShadow: "0 0 20px currentColor" }}
            >
              {winner} Wins!
            </h1>
            <p className="text-slate-300 mt-2 text-base md:text-lg font-eaglelake">
              {endGameReason}
            </p>
          </>
        ) : (
          <>
            <h1 className="font-eaglelake text-4xl md:text-6xl font-bold text-slate-400">
              Game Over
            </h1>
            <p className="text-slate-300 mt-2 text-base md:text-lg">
              {endGameReason}
            </p>
          </>
        )}

        {gameReportAccordion}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-2 pt-2">
          <FinalRolesDisplay players={players} />
          <ReadyForNextGame
            players={players}
            readyPlayers={endGameReadyPlayers}
            currentPlayerId={playerId}
            onReady={handlePlayAgain}
          />
        </div>
      </Card>
    </div>
  );
};

export default EndGameScreen;
