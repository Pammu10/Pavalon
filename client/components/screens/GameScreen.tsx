import React, { useState, useEffect } from "react";
import { useGame } from "@/components/context/GameContext";
import { GamePhase, Player, Alignment, Role, Quest } from "@/types";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import QuestProgressWithPopover from "@/components/ui/QuestProgressWithPopover";
import PlayerStatusList from "../ui/PlayerStatusList";
import QuestResultOverlay from "@/components/ui/QuestResultOverlay";
import PlayerTile from "../ui/PlayerTile";
import { GamePhaseHeader } from "../ui/GamePhaseHeader";
import { usePlayerVisionMap } from "@/hooks/usePlayerVision";
import { motion } from "framer-motion";
import { ROLES } from "@/constants";

// --- Reusable UI Components ---

const VoteResultDisplay: React.FC<{
  vote: Quest["pastVotes"][0] | Quest["approvedVote"];
  players: Player[];
  isApproved: boolean;
}> = ({ vote, players, isApproved }) => {
  if (!vote) return null;
  const visiblePlayerMap = usePlayerVisionMap();

  const approvals = vote.votes.filter((v) => v.vote === "APPROVE");
  const rejections = vote.votes.filter((v) => v.vote === "REJECT");

  const title = isApproved
    ? `Team Approved (${approvals.length} - ${rejections.length})`
    : `Team Rejected (${rejections.length} - ${approvals.length})`;
  const titleColor = isApproved ? "text-blue-400" : "text-red-400";
  const borderColor = isApproved ? "border-blue-700/50" : "border-red-700/50";
  const bgColor = isApproved ? "bg-blue-900/20" : "bg-red-900/20";

  return (
    <div className={`p-4 sm:p-5 rounded-xl border-2 ${borderColor} ${bgColor}`}>
      <h4
        className={`font-eaglelake text-center text-lg ${titleColor} mb-4 pb-3 border-b ${borderColor}`}
      >
        {title}
      </h4>
      <div className="flex justify-center flex-wrap gap-2 mb-5">
        {vote.team.map((p) => (
           <div key={p.id} className="w-28 md:w-36">
            <PlayerTile player={p} isKnownAs={visiblePlayerMap.get(p.id)} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-4 sm:gap-x-6 text-xs sm:text-sm">
        <div>
          <h5 className="font-bold text-blue-400 mb-2 text-center">Approved By:</h5>
          <ul className="list-none pl-0 mt-1 space-y-1.5 text-slate-200">
            {approvals.map((v) => (
              <li key={v.playerId}>
                {players.find((p) => p.id === v.playerId)?.name || "Unknown"}
              </li>
            ))}
            {approvals.length === 0 && (
              <li className="italic text-slate-500">None</li>
            )}
          </ul>
        </div>
        <div>
          <h5 className="font-bold text-red-400 mb-2">Rejected By:</h5>
          <ul className="list-none pl-0 mt-1 space-y-1.5 text-slate-200">
            {rejections.map((v) => (
              <li key={v.playerId}>
                {players.find((p) => p.id === v.playerId)?.name || "Unknown"}
              </li>
            ))}
            {rejections.length === 0 && (
              <li className="italic text-slate-500">None</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

// --- Game Phase Components ---

const TeamSelection: React.FC = () => {
  const { gameState, playerId, selectTeam, updatePendingTeam } = useGame();
  const isLeader = gameState.leader?.id === playerId;
  const currentQuest = gameState.questHistory[gameState.currentQuest - 1];
  const isPaused = !!gameState.reconnectingPlayer;
  const pendingTeam = gameState.pendingTeam || [];
  const visiblePlayerMap = usePlayerVisionMap();

  const handlePlayerClick = (id: string) => {
    if (isPaused || !isLeader) return;
    
    let newTeam;
    if (pendingTeam.includes(id)) {
      newTeam = pendingTeam.filter((pId) => pId !== id);
    } else {
      // Prevent selecting more than required
      if (pendingTeam.length < currentQuest.teamSize) {
        newTeam = [...pendingTeam, id];
      } else {
        newTeam = pendingTeam;
      }
    }
    updatePendingTeam(newTeam);
  };

  const canSubmit = pendingTeam.length === currentQuest.teamSize;

  return (
    <Card className="w-full">
      {currentQuest.pastVotes.length > 0 && (
        <div className="my-6 space-y-4">
          <h3 className="font-eaglelake text-lg text-center mb-2">
            Rejected Team Votes
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentQuest.pastVotes.map((vote, index) => (
              <VoteResultDisplay
                key={`past-${index}`}
                vote={vote}
                players={gameState.players}
                isApproved={false}
              />
            ))}
          </div>
        </div>
      )}

      <div id="player-grid" className="grid grid-cols-[repeat(auto-fit,minmax(7rem,1fr))] md:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-2 sm:gap-4 my-6">
        {gameState.players.map((p) => (
          <PlayerTile
            key={p.id}
            player={p}
            isLeader={p.id === gameState.leader?.id}
            isSelected={pendingTeam.includes(p.id)}
            onClick={() => handlePlayerClick(p.id)}
            isKnownAs={visiblePlayerMap.get(p.id)}
          />
        ))}
      </div>

      {isLeader && (
        <div className="text-center mt-6">
          <Button
            onClick={() => selectTeam(pendingTeam)}
            disabled={!canSubmit || isPaused}
          >
            Propose Team ({pendingTeam.length}/{currentQuest.teamSize})
          </Button>
        </div>
      )}
    </Card>
  );
};

const TeamVote: React.FC = () => {
  const { gameState, playerId, voteOnTeam } = useGame();
  const player = gameState.players.find((p) => p.id === playerId);
  const teamOnMission = gameState.questHistory[gameState.currentQuest - 1].team;
  const isPaused = !!gameState.reconnectingPlayer;
  const votedPlayerIds = gameState.players.filter(p => p.hasVoted).map(p => p.id);
  const visiblePlayerMap = usePlayerVisionMap();

  return (
    <Card className="w-full">
      <div className="flex justify-center flex-wrap gap-4 bg-slate-900/50 p-4 rounded-lg mb-4">
        {teamOnMission.map((p) => (
          <div key={p.id} className="w-28 md:w-36">
            <PlayerTile player={p} isKnownAs={visiblePlayerMap.get(p.id)}/>
          </div>
        ))}
      </div>

      <div className="mb-6">
        <PlayerStatusList 
            title="Voter Status"
            players={gameState.players}
            readyPlayerIds={votedPlayerIds}
        />
      </div>

      {player && !player.hasVoted ? (
        <div id="team-vote-buttons" className="flex justify-center gap-4 sm:gap-8 mt-6">
          <Button
            variant="success"
            onClick={() => voteOnTeam("APPROVE")}
            disabled={isPaused}
            className="flex-1 max-w-xs py-4 sm:py-5 text-xl sm:text-2xl"
          >
            Approve
          </Button>
          <Button
            variant="fail"
            onClick={() => voteOnTeam("REJECT")}
            disabled={isPaused}
            className="flex-1 max-w-xs py-4 sm:py-5 text-xl sm:text-2xl"
          >
            Reject
          </Button>
        </div>
      ) : (
        <p className="text-center mt-6 text-slate-400 font-bold text-xl">
          Waiting for votes...
        </p>
      )}
    </Card>
  );
};

const QuestVote: React.FC = () => {
  const { gameState, playerId, voteOnQuest } = useGame();
  const player = gameState.players.find((p) => p.id === playerId);
  const currentQuest = gameState.questHistory[gameState.currentQuest - 1];
  const isOnTeam = currentQuest.team.some((p) => p.id === playerId);
  const isPaused = !!gameState.reconnectingPlayer;
  const votedPlayerIds = currentQuest.team.filter(p => p.hasVoted).map(p => p.id);

  return (
    <Card className="w-full">
      <div className="mb-4">
        <h3 className="font-eaglelake text-lg text-center mb-2">
          Approved Team
        </h3>
        <VoteResultDisplay
          vote={currentQuest.approvedVote}
          players={gameState.players}
          isApproved={true}
        />
      </div>

      {currentQuest.pastVotes.length > 0 && (
        <div className="my-6 space-y-2">
          <h3 className="font-eaglelake text-lg text-center mb-2 text-slate-400">
            Rejected Votes this Quest
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-70">
            {currentQuest.pastVotes.map((vote, index) => (
              <VoteResultDisplay
                key={`past-${index}`}
                vote={vote}
                players={gameState.players}
                isApproved={false}
              />
            ))}
          </div>
        </div>
      )}

      {isOnTeam ? (
        <>
          <div className="my-6">
            <PlayerStatusList 
              title="Mission Team Status"
              players={currentQuest.team}
              readyPlayerIds={votedPlayerIds}
            />
          </div>
          {player && !player.hasVoted ? (
            <div id="quest-vote-buttons" className="flex justify-center gap-4 sm:gap-8 mt-6">
              <Button
                variant="success"
                onClick={() => voteOnQuest("SUCCESS")}
                disabled={isPaused}
                className="flex-1 max-w-xs py-4 sm:py-5 text-xl sm:text-2xl"
              >
                Success
              </Button>
              {player.alignment === Alignment.EVIL && (
                <Button
                  variant="fail"
                  onClick={() => voteOnQuest("FAIL")}
                  disabled={isPaused}
                  className="flex-1 max-w-xs py-4 sm:py-5 text-xl sm:text-2xl"
                >
                  Fail
                </Button>
              )}
            </div>
          ) : (
            <p className="text-center mt-6 text-slate-400">
              Waiting for other team members...
            </p>
          )}
        </>
      ) : (
        <p className="text-center text-slate-400 mt-6">
          Waiting for the quest team to complete their mission...
        </p>
      )}
    </Card>
  );
};

const QuestResult: React.FC = () => {
  const { gameState, hasViewedCurrentQuestResult, markQuestResultAsViewed } = useGame();
  
  const quest = gameState.questHistory[gameState.currentQuest - 1];
  if (!quest || hasViewedCurrentQuestResult) return null;

  const failVotes = quest.results.filter((r) => r.vote === "FAIL").length;
  const successVotes = quest.results.filter((r) => r.vote === "SUCCESS").length;

  return (
    <QuestResultOverlay
      show={true}
      isSuccess={quest.status === "PASSED"}
      failVotes={failVotes}
      successVotes={successVotes}
      failsRequired={quest.failsRequired}
      onClose={markQuestResultAsViewed}
    />
  );
};


const Assassination: React.FC = () => {
  const { gameState, playerId, assassinate, updateAssassinationTarget } = useGame();
  const player = gameState.players.find((p) => p.id === playerId);

  const isAssassin = player?.role === Role.ASSASSIN;
  const isEvilTeam = player?.alignment === Alignment.EVIL && player?.role !== Role.OBERON;
  const potentialTargets = gameState.players.filter(p => p.alignment === Alignment.GOOD);
  const selectedTargetId = gameState.assassinationTargetId;
  const isPaused = !!gameState.reconnectingPlayer;
  const visiblePlayerMap = usePlayerVisionMap();

  const handlePlayerClick = (targetId: string) => {
    if (isPaused || !isAssassin) return;

    const newTargetId = selectedTargetId === targetId ? null : targetId;
    updateAssassinationTarget(newTargetId);
  };

  const handleConfirmClick = () => {
    if (isPaused || !isAssassin || !selectedTargetId) return;
    assassinate(selectedTargetId);
  };

  // View for Good players and Oberon
  if (!isEvilTeam) {
    return (
        <Card className="flex flex-col items-center justify-center p-6 md:p-10">
            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                className="relative w-48 h-48 md:w-64 md:h-64"
            >
                <div className="absolute inset-0 bg-red-600 rounded-full blur-2xl animate-pulse-slow opacity-60"></div>
                <img src={ROLES[Role.ASSASSIN].img} alt="Assassin" className="relative w-full h-full object-cover rounded-full border-4 border-red-800 shadow-2xl shadow-black"/>
            </motion.div>
            <h3 className="font-eaglelake text-2xl md:text-4xl mt-6 text-red-400 animate-glow">A Fateful Choice</h3>
            <p className="text-center mt-2 text-slate-300">
              The Assassin is making their move... Pray for Merlin.
            </p>
        </Card>
    );
  }

  // View for Assassin and their evil teammates
  return (
    <Card>
      {isAssassin ? (
        <>
            <h3 className="text-center font-eaglelake text-xl text-yellow-500">Your Target</h3>
            <p className="text-center mt-1 mb-4 text-slate-300 text-sm">
                You have one chance. Find and eliminate Merlin. Your allies can see your choice.
            </p>
        </>
      ) : (
        <>
            <h3 className="text-center font-eaglelake text-xl text-yellow-500">The Target</h3>
            <p className="text-center mt-1 mb-4 text-slate-300 text-sm">
              The Assassin is choosing their target. Discuss and guide them to victory.
            </p>
        </>
      )}
      <div
        id="assassination-grid"
        className="grid grid-cols-[repeat(auto-fit,minmax(7rem,1fr))] md:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-2 sm:gap-4 my-6 justify-center"
      >
        {potentialTargets.map((p) => (
          <PlayerTile
            key={p.id}
            player={p}
            isSelected={p.id === selectedTargetId}
            onClick={isAssassin ? () => handlePlayerClick(p.id) : undefined}
            isKnownAs={visiblePlayerMap.get(p.id)}
            className={!isAssassin ? "cursor-default" : ""}
          />
        ))}
      </div>
       {isAssassin && (
            <div className="text-center mt-6">
                <Button 
                    onClick={handleConfirmClick}
                    disabled={isPaused || !selectedTargetId}
                    variant="fail"
                    className="py-4 text-xl"
                >
                    Confirm Assassination
                </Button>
            </div>
       )}
    </Card>
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

  const questProgressData = gameState.questHistory.map((quest) => {
    // If game is in assassination, any "ACTIVE" quest must have been the one that
    // passed to trigger the win condition. This corrects the UI state.
    const finalStatus =
      gameState.phase === GamePhase.ASSASSINATION && quest.status === "ACTIVE"
        ? "PASSED"
        : quest.status;

    return {
      status: finalStatus,
      successVotes: quest.results.filter((r) => r.vote === "SUCCESS").length,
      failVotes: quest.results.filter((r) => r.vote === "FAIL").length,
    };
  });

  const questConfig = {
    quests: gameState.questHistory.map((q) => q.teamSize),
  };

  const goodScore = gameState.questHistory.filter(
    (q) => q.status === "PASSED"
  ).length;
  const evilScore = gameState.questHistory.filter(
    (q) => q.status === "FAILED"
  ).length;

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col items-center">
      <div className="w-full mb-4 bg-slate-900/50 p-2 md:p-3 rounded-xl border border-slate-700">
        <div className="flex justify-between items-center text-sm md:text-base">
          <div className="text-blue-400 font-bold">Good: {goodScore}</div>
          <div className="font-eaglelake text-lg md:text-xl">
            Rejected Count: {gameState.voteTrack}
          </div>
          <div className="text-red-500 font-bold">Evil: {evilScore}</div>
        </div>
      </div>

      {gameState.questHistory.length > 0 && (
        <div className="w-full">
          <QuestProgressWithPopover
            currentQuest={gameState.currentQuest}
            questResults={questProgressData}
            config={questConfig}
          />
        </div>
      )}
      
      <GamePhaseHeader />
      <div className="w-full animate-slideInUp">{renderPhaseComponent()}</div>
    </div>
  );
};

export default GameScreen;