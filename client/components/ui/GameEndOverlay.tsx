'use client';
import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { ShieldCheck, Skull } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Alignment } from "@/types";
import { useAudio } from "@/components/context/AudioContext";
import { haptics } from "@/lib/haptics";

interface GameEndOverlayProps {
  show: boolean;
  winner: Alignment | null;
  onClose: () => void;
}

interface ParticleDef {
  id: number;
  x: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  drift: number;
}

const PARTICLE_COUNT = 36;

function useParticles(isGoodWin: boolean): ParticleDef[] {
  return useMemo(() => {
    const colors = isGoodWin
      ? ["#60a5fa", "#93c5fd", "#bfdbfe", "#dbeafe", "#a5f3fc"]
      : ["#f87171", "#fca5a5", "#ef4444", "#fcd34d", "#f97316"];
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      size: 4 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 2.5,
      duration: 2.8 + Math.random() * 2.4,
      drift: (Math.random() - 0.5) * 80,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGoodWin]);
}

const GameEndOverlay: React.FC<GameEndOverlayProps> = ({ show, winner, onClose }) => {
  const { playSound } = useAudio();

  useEffect(() => {
    if (show) {
      playSound(winner === Alignment.GOOD ? "victory" : "defeat");
      haptics.dramatic();
      const timer = setTimeout(onClose, 9000);
      return () => clearTimeout(timer);
    }
  }, [show, winner, onClose, playSound]);

  const isGoodWin = winner === Alignment.GOOD;
  const particles = useParticles(isGoodWin);

  const title = isGoodWin ? "GOOD PREVAILS" : "EVIL TRIUMPHS";
  const subtitle = isGoodWin
    ? "The light has prevailed. The kingdom is safe — for now."
    : "Darkness has consumed Avalon. Evil stands victorious.";

  const textColor = isGoodWin ? "text-blue-300" : "text-red-400";
  const glowColor = isGoodWin ? "bg-blue-500" : "bg-red-600";
  const borderColor = isGoodWin ? "border-blue-400" : "border-red-500";
  const Icon = isGoodWin ? ShieldCheck : Skull;

  return createPortal(
    <AnimatePresence>
      {show && winner && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black px-4 text-center overflow-hidden">

          {/* Instant screen flash */}
          <motion.div
            className={`absolute inset-0 ${glowColor}`}
            initial={{ opacity: 0.7 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />

          {/* Persistent atmospheric glow */}
          <motion.div
            className={`absolute inset-0 ${glowColor} opacity-0`}
            animate={{ opacity: [0, 0.12, 0.08] }}
            transition={{ duration: 2, times: [0, 0.3, 1] }}
          />

          {/* Particles */}
          {particles.map((p) => (
            <div
              key={p.id}
              className="absolute bottom-0 rounded-full pointer-events-none"
              style={{
                left: `${p.x}%`,
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
                animation: `gameEndParticle ${p.duration}s ease-in ${p.delay}s both`,
                '--drift': `${p.drift}px`,
              } as React.CSSProperties}
            />
          ))}

          {/* Icon */}
          <motion.div
            className="relative w-28 h-28 sm:w-40 sm:h-40 mx-auto mb-6"
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.3 }}
          >
            <div className={`absolute inset-0 rounded-full blur-2xl opacity-50 ${glowColor}`} />
            <div className={`absolute inset-0 rounded-full blur-xl opacity-30 ${glowColor} animate-pulse-slow`} />
            <div className={`w-full h-full rounded-full border-4 ${borderColor} flex items-center justify-center`}>
              <Icon className={`${textColor} w-12 h-12 sm:w-16 sm:h-16`} />
            </div>
          </motion.div>

          {/* Title */}
          <motion.h2
            className={`text-3xl sm:text-5xl font-extrabold mb-4 tracking-widest uppercase font-eaglelake animate-glow ${textColor}`}
            initial={{ opacity: 0, y: 24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.55 }}
          >
            {title}
          </motion.h2>

          {/* Subtitle */}
          <motion.p
            className="text-white/70 text-sm sm:text-lg italic max-w-xs sm:max-w-md mx-auto"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.85 }}
          >
            {subtitle}
          </motion.p>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default GameEndOverlay;
