import React, { useEffect, useRef } from "react";
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
import { motion, AnimatePresence, type TargetAndTransition } from "framer-motion";
import { ROLES } from "@/constants";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import Spinner from "../ui/Spinner";
import { toast } from "sonner";
import { useAudio } from "@/components/context/AudioContext";
import SwipeableCard from "@/components/ui/SwipeableCard";
import TeamVoteRevealOverlay from "@/components/ui/TeamVoteRevealOverlay";
import { haptics } from "@/lib/haptics";
import { ShieldAlert } from "lucide-react";
import Image from "next/image";

const PHASE_VARIANTS: Record<string, { initial: TargetAndTransition; animate: TargetAndTransition; exit: TargetAndTransition }> = {
  [GamePhase.TEAM_SELECTION]: {
    initial: { opacity: 0, x: 40 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -40 },
  },
  [GamePhase.TEAM_VOTE]: {
    initial: { opacity: 0, scale: 0.94, y: 12 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 1.04, y: -12 },
  },
  [GamePhase.QUEST_VOTE]: {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -16 },
  },
  [GamePhase.QUEST_RESULT]: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  [GamePhase.ASSASSINATION]: {
    initial: { opacity: 0, scale: 1.04 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0 },
  },
  default: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
};

// --- Reusable UI Components ---

const VoteResultDetails: React.FC<{
  vote: Quest["pastVotes"][0] | Quest["approvedVote"];
  players: Player[];
}> = ({ vote, players }) => {
  if (!vote) return null;
  const visiblePlayerMap = usePlayerVisionMap();

  const approvals = vote.votes.filter((v) => v.vote === "APPROVE");
  const rejections = vote.votes.filter((v) => v.vote === "REJECT");

  return (
    <div className="pt-2">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2 mb-4">
        {vote.team.map((p) => (
          <PlayerTile key={p.id} player={p} isKnownAs={visiblePlayerMap.get(p.id)} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-4 sm:gap-x-6 text-xs sm:text-sm">
        <div>
          <h5 className="font-bold text-blue-400 mb-2 text-center">Approved By:</h5>
          <ul className="list-none pl-0 mt-1 space-y-1.5 text-slate-200 text-center">
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
          <h5 className="font-bold text-red-400 mb-2 text-center">Rejected By:</h5>
          <ul className="list-none pl-0 mt-1 space-y-1.5 text-slate-200 text-center">
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
  const { playSound } = useAudio();
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
        toast.error("Team is full!", {
            description: `You can only select ${currentQuest.teamSize} knights for this quest.`
        });
        playSound('error', { manageBgm: false });
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
          <h3 className="font-eaglelake text-lg text-center mb-2 text-sky-50">
            Rejected Team Votes
          </h3>
          <Accordion type="single" collapsible className="w-full space-y-2">
            {currentQuest.pastVotes.map((vote, index) => {
              const approvals = vote.votes.filter(v => v.vote === 'APPROVE').length;
              const rejections = vote.votes.filter(v => v.vote === 'REJECT').length;
              return (
                 <AccordionItem value={`past-${index}`} key={`past-${index}`} className="bg-red-900/20 border-2 border-red-700/50 rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline font-bold text-red-400 data-[state=open]:border-b data-[state=open]:border-red-700/50">
                    <span>Vote {index + 1}: Team Rejected ({rejections} - {approvals})</span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4">
                    <VoteResultDetails
                      vote={vote}
                      players={gameState.players}
                    />
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
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
        <div id="propose-team-button" className="text-center mt-6">
          <Button
            onClick={() => { haptics.confirm(); selectTeam(pendingTeam); }}
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

  const rejectionsLeft = 5 - gameState.voteTrack;

  return (
    <Card className="w-full">
      {rejectionsLeft <= 2 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-2.5 mb-4 ${
            rejectionsLeft === 1
              ? 'bg-red-950/80 border-red-500 animate-pulse'
              : 'bg-amber-950/60 border-amber-600'
          }`}
        >
          <ShieldAlert size={18} className={rejectionsLeft === 1 ? 'text-red-400' : 'text-amber-400'} />
          <p className={`text-sm font-bold text-center ${rejectionsLeft === 1 ? 'text-red-300' : 'text-amber-300'}`}>
            {rejectionsLeft === 1
              ? 'FINAL VOTE — if this team is rejected, Evil wins!'
              : `Careful — ${rejectionsLeft} more rejections and Evil wins.`}
          </p>
        </motion.div>
      )}
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

      {player ? (
        <div id="team-vote-buttons" className="flex justify-center mt-6">
          <SwipeableCard
            title="Vote on Team"
            onSwipeRight={() => { haptics.confirm(); voteOnTeam("APPROVE"); }}
            onSwipeLeft={() => { haptics.confirm(); voteOnTeam("REJECT"); }}
            rightLabel="Approve"
            leftLabel="Reject"
            disabled={isPaused}
          />
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
  const canFail = player?.alignment === Alignment.EVIL;

  return (
    <Card className="w-full">
      <div className="mb-4">
        <h3 className="font-eaglelake text-lg text-center mb-2 text-white">
          Approved Team
        </h3>
        {currentQuest.approvedVote && (
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="approved-vote" className="bg-blue-900/20 border-2 border-blue-700/50 rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline font-bold text-blue-400 data-[state=open]:border-b data-[state=open]:border-blue-700/50">
                <span>
                  Team Approved ({currentQuest.approvedVote.votes.filter(v => v.vote === 'APPROVE').length} - {currentQuest.approvedVote.votes.filter(v => v.vote === 'REJECT').length})
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4">
                <VoteResultDetails
                  vote={currentQuest.approvedVote}
                  players={gameState.players}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </div>

      {currentQuest.pastVotes.length > 0 && (
        <div className="my-6 space-y-2">
          <h3 className="font-eaglelake text-lg text-center mb-2 text-slate-400">
            Rejected Votes this Quest
          </h3>
          <Accordion type="single" collapsible className="w-full space-y-2 opacity-80">
             {currentQuest.pastVotes.map((vote, index) => {
              const approvals = vote.votes.filter(v => v.vote === 'APPROVE').length;
              const rejections = vote.votes.filter(v => v.vote === 'REJECT').length;
              return (
                <AccordionItem value={`past-${index}`} key={`past-${index}`} className="bg-red-900/20 border-2 border-red-700/50 rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline font-bold text-red-400 data-[state=open]:border-b data-[state=open]:border-red-700/50">
                    <span>Vote {index + 1}: Team Rejected ({rejections} - {approvals})</span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4">
                    <VoteResultDetails
                      vote={vote}
                      players={gameState.players}
                    />
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      )}

      <div className="my-6">
        <PlayerStatusList 
          title="Mission Team Status"
          players={currentQuest.team}
          readyPlayerIds={votedPlayerIds}
        />
      </div>

      {isOnTeam ? (
        <>
          {player ? (
            <div id="quest-vote-buttons" className="flex justify-center mt-6">
              <SwipeableCard
                title="Vote on Quest"
                onSwipeRight={() => { haptics.confirm(); voteOnQuest("SUCCESS"); }}
                onSwipeLeft={() => { haptics.confirm(); voteOnQuest("FAIL"); }}
                rightLabel="Success"
                leftLabel="Fail"
                disabled={isPaused}
                leftSwipeDisabled={!canFail}
              />
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
  const { gameState, hasViewedCurrentQuestResult, markQuestResultAsViewed, teamVoteReveal } = useGame();

  const quest = gameState.questHistory[gameState.currentQuest - 1];
  // Phase guard: during the exit animation this component still renders with
  // the *advanced* game state (next quest, status ACTIVE, not yet viewed) —
  // without the guard the overlay remounts and plays the fail sting right
  // after a passed quest's success sting.
  if (gameState.phase !== GamePhase.QUEST_RESULT || !quest || hasViewedCurrentQuestResult) return null;

  const failVotes = quest.results.filter((r) => r.vote === "FAIL").length;
  const successVotes = quest.results.filter((r) => r.vote === "SUCCESS").length;

  return (
    <QuestResultOverlay
      // Defer the quest reveal (and its sound) until the team-vote reveal
      // animation has finished — the two are on independent client timers,
      // and bots can resolve the quest before the vote reveal has closed.
      show={!teamVoteReveal}
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
  const [isAssassinating, setIsAssassinating] = React.useState(false);

  const isAssassin = player?.role === Role.ASSASSIN;
  const isEvilTeam = player?.alignment === Alignment.EVIL && player?.role !== Role.OBERON;
  // Other players' alignment is no longer sent mid-game; the assassin may
  // target anyone who isn't themselves or a known evil teammate.
  const potentialTargets = gameState.players.filter(
    p => p.id !== playerId && p.visibleAs !== 'Evil'
  );
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
    setIsAssassinating(true);
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
                <Image
                    src={ROLES[Role.ASSASSIN].img}
                    alt="Assassin"
                    fill
                    sizes="(max-width: 768px) 12rem, 16rem"
                    className="relative object-cover rounded-full border-4 border-red-800 shadow-2xl shadow-black"
                />
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
            <div id="confirm-assassination-button" className="flex justify-center mt-6">
                <Button 
                    onClick={handleConfirmClick}
                    disabled={isPaused || !selectedTargetId || isAssassinating}
                    variant="fail"
                    className="py-4 text-xl flex items-center justify-center gap-2"
                >
                    {isAssassinating ? (
                        <>
                            <Spinner size="sm" />
                            <span>Going for the kill...</span>
                        </>
                    ) : (
                        'Confirm Assassination'
                    )}
                </Button>
            </div>
       )}
    </Card>
  );
};


// -- Main Game Screen Component --

const GameScreen: React.FC = () => {
  const { gameState, teamVoteReveal, clearTeamVoteReveal } = useGame();
  const { playSound } = useAudio();
  const prevPhaseRef = useRef(gameState.phase);

  // Play a phase-transition sound when the phase changes
  useEffect(() => {
    if (gameState.phase !== prevPhaseRef.current) {
      if (gameState.phase === GamePhase.ASSASSINATION) {
        // Assassination has its own dramatic audio handled inside the component
      } else if (
        gameState.phase === GamePhase.TEAM_SELECTION ||
        gameState.phase === GamePhase.TEAM_VOTE ||
        gameState.phase === GamePhase.QUEST_VOTE
      ) {
        playSound('transition', { manageBgm: false });
      }
      prevPhaseRef.current = gameState.phase;
    }
  }, [gameState.phase, playSound]);

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
    const finalStatus =
      gameState.phase === GamePhase.ASSASSINATION && quest.status === "ACTIVE"
        ? "PASSED"
        : quest.status;

    return {
      status: finalStatus,
      successVotes: quest.results.filter((r) => r.vote === "SUCCESS").length,
      failVotes: quest.results.filter((r) => r.vote === "FAIL").length,
      failsRequired: quest.failsRequired,
      teamSize: quest.teamSize,
    };
  });

  const variants = PHASE_VARIANTS[gameState.phase] ?? PHASE_VARIANTS.default;

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col items-center">
      {gameState.questHistory.length > 0 && (
        <div className="w-full">
          <QuestProgressWithPopover
            currentQuest={gameState.currentQuest}
            questResults={questProgressData}
          />
        </div>
      )}

      <div className="w-full bg-gradient-to-br from-slate-800/40 to-black/40 border border-slate-600/30 shadow-slate-700/20 shadow-inner rounded-2xl p-4 sm:p-6 mb-6 backdrop-blur-sm">
        <GamePhaseHeader />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={gameState.phase}
          className="w-full"
          initial={variants.initial}
          animate={variants.animate}
          exit={variants.exit}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          {renderPhaseComponent()}
        </motion.div>
      </AnimatePresence>

      {/* Dramatic vote reveal overlay */}
      {teamVoteReveal && (
        <TeamVoteRevealOverlay data={teamVoteReveal} onClose={clearTeamVoteReveal} />
      )}
    </div>
  );
};

export default GameScreen;