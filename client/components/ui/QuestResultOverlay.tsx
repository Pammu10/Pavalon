'use client';
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ShieldCheck, ShieldX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudio } from "@/components/context/AudioContext";

interface QuestResultOverlayProps {
  show: boolean;
  isSuccess: boolean;
  failVotes: number;
  successVotes: number;
  failsRequired: number;
  onClose: () => void;
}

const CARD_REVEAL_START = 3000;
const CARD_REVEAL_INTERVAL = 520;
const RESULT_SHOW_DELAY = 700;
const AUTO_CLOSE_DELAY = 8500;

const FlipCard: React.FC<{
  vote: "SUCCESS" | "FAIL";
  isFlipped: boolean;
  entryDelay: number;
}> = ({ vote, isFlipped, entryDelay }) => {
  const isSuccess = vote === "SUCCESS";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: entryDelay }}
      className="relative w-12 h-16 sm:w-14 sm:h-20"
      style={{ perspective: "600px" }}
    >
      <motion.div
        className="w-full h-full relative"
        style={{ transformStyle: "preserve-3d", WebkitTransformStyle: "preserve-3d" }}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* Face down */}
        <div
          className="absolute inset-0 rounded-lg border-2 border-slate-600 bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center"
          style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
        >
          <div className="w-5 h-5 border-2 border-slate-500 rounded-full opacity-50" />
        </div>

        {/* Revealed face */}
        <div
          className={`absolute inset-0 rounded-lg border-2 flex items-center justify-center ${
            isSuccess
              ? "border-blue-500 bg-gradient-to-br from-blue-900 to-blue-950"
              : "border-red-500 bg-gradient-to-br from-red-900 to-red-950"
          }`}
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <div className={`absolute inset-0 rounded-lg blur opacity-25 ${isSuccess ? "bg-blue-400" : "bg-red-500"}`} />
          {isSuccess ? (
            <ShieldCheck className="relative w-6 h-6 sm:w-8 sm:h-8 text-blue-300" />
          ) : (
            <ShieldX className="relative w-6 h-6 sm:w-8 sm:h-8 text-red-400" />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

const QuestResultOverlay: React.FC<QuestResultOverlayProps> = ({
  show,
  isSuccess,
  failVotes,
  successVotes,
  failsRequired,
  onClose,
}) => {
  const { playSound } = useAudio();
  const [revealedCount, setRevealedCount] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const totalVotes = successVotes + failVotes;
  const votes: ("SUCCESS" | "FAIL")[] = [
    ...Array(successVotes).fill("SUCCESS"),
    ...Array(failVotes).fill("FAIL"),
  ];

  useEffect(() => {
    if (!show) {
      setRevealedCount(0);
      setShowResult(false);
      return;
    }

    playSound(isSuccess ? "quest-success" : "quest-fail");

    const timers: ReturnType<typeof setTimeout>[] = [];

    votes.forEach((_, i) => {
      timers.push(
        setTimeout(() => {
          setRevealedCount(i + 1);
          playSound("card-swish", { manageBgm: false });
        }, CARD_REVEAL_START + i * CARD_REVEAL_INTERVAL)
      );
    });

    timers.push(
      setTimeout(
        () => setShowResult(true),
        CARD_REVEAL_START + totalVotes * CARD_REVEAL_INTERVAL + RESULT_SHOW_DELAY
      )
    );
    timers.push(setTimeout(onClose, AUTO_CLOSE_DELAY));

    return () => timers.forEach(clearTimeout);
  }, [show]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!show) return null;

  const colorClass = isSuccess ? "text-blue-300" : "text-red-400";
  const borderColor = isSuccess ? "border-blue-400" : "border-red-500";
  const Icon = isSuccess ? ShieldCheck : ShieldX;
  const title = isSuccess ? "Quest Passed" : "Quest Failed";

  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/92 px-4 text-center animate-fadeIn">
      {/* Atmospheric background glow */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5 }}
        className={`absolute inset-0 opacity-8 ${isSuccess ? "bg-blue-600" : "bg-red-700"}`}
      />

      {/* Suspense text */}
      <motion.h2
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="relative font-eaglelake text-3xl sm:text-5xl text-yellow-400 mb-10 sm:mb-12"
        style={{ textShadow: "0 0 20px rgba(234,179,8,0.5)" }}
      >
        Quest results are in...
      </motion.h2>

      {/* Vote cards */}
      <div className="relative flex flex-wrap justify-center gap-2 sm:gap-3 max-w-lg mx-auto mb-10">
        {votes.map((v, i) => (
          <FlipCard
            key={i}
            vote={v}
            isFlipped={i < revealedCount}
            entryDelay={0.05 + i * 0.06}
          />
        ))}
      </div>

      {/* Result */}
      <AnimatePresence>
        {showResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="relative flex flex-col items-center gap-4"
          >
            <div className={`relative w-20 h-20 sm:w-24 sm:h-24`}>
              <div className={`absolute inset-0 rounded-full blur-xl opacity-40 ${isSuccess ? "bg-blue-500" : "bg-red-600"}`} />
              <div className={`w-full h-full rounded-full border-4 ${borderColor} flex items-center justify-center`}>
                <Icon className={`${colorClass} w-10 h-10 sm:w-12 sm:h-12`} />
              </div>
            </div>

            <h1
              className={`font-eaglelake text-4xl sm:text-6xl font-bold uppercase tracking-widest animate-glow ${colorClass}`}
            >
              {title}
            </h1>

            <p className="text-slate-400 text-sm sm:text-base">
              <span className="font-bold text-red-400">{failVotes}</span> fail vote{failVotes !== 1 ? "s" : ""}
              {" · "}
              <span className="font-bold text-slate-300">{failsRequired}</span> needed to fail
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
};

export default QuestResultOverlay;
