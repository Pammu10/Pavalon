import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, ShieldAlert, CheckCircle, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAudio } from '@/components/context/AudiContext';
import Spinner from './Spinner';

interface QuestResultOverlayProps {
  show: boolean;
  isSuccess: boolean;
  failVotes: number;
  successVotes: number;
  failsRequired: number;
  onClose: () => void;
}

const QuestResultOverlay: React.FC<QuestResultOverlayProps> = ({
  show,
  isSuccess,
  failVotes,
  successVotes,
  failsRequired,
  onClose,
}) => {
  const { playSound } = useAudio();
  const [isRevealing, setIsRevealing] = useState(false);

  useEffect(() => {
    if (show) {
      playSound(isSuccess ? 'quest-success' : 'quest-fail');
      const revealTimer = setTimeout(() => {
        setIsRevealing(true);
      }, 3000);

      const closeTimer = setTimeout(onClose, 7500);

      return () => {
        clearTimeout(revealTimer);
        clearTimeout(closeTimer);
      };
    } else {
        setIsRevealing(false);
    }
  }, [show, isSuccess, playSound, onClose]);

  if (!show) return null;

  // Suspense view
  if (!isRevealing) {
    return createPortal(
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black animate-fadeIn px-4 text-center">
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="font-eaglelake text-4xl md:text-6xl font-bold my-4 text-yellow-400"
          style={{ textShadow: '0 0 15px currentColor' }}
        >
          Quest results are in...
        </motion.h1>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-8"
        >
          <Spinner />
        </motion.div>
      </div>,
      document.body
    );
  }
  
  // Revealed view
  const title = isSuccess ? "Quest Passed" : "Quest Failed";
  const Icon = isSuccess ? ShieldCheck : ShieldAlert;
  const colorClass = isSuccess ? "text-blue-300" : "text-red-400";
  const borderColor = isSuccess ? "border-blue-400" : "border-red-500";
  const bgPulse = isSuccess ? "bg-blue-500/30" : "bg-red-600/30";

  const results = [
    ...Array(successVotes).fill("SUCCESS"),
    ...Array(failVotes).fill("FAIL"),
  ].sort();

  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black animate-fadeIn px-4 text-center">
       <div className="relative w-28 h-28 sm:w-40 sm:h-40 mx-auto mb-6">
        <div className={`absolute inset-0 rounded-full animate-pulse-slow blur-xl ${bgPulse}`} />
        <div className={`w-full h-full rounded-full border-4 ${borderColor} border-t-transparent animate-spin`} />
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className={`${colorClass} w-12 h-12 sm:w-16 sm:h-16`} />
        </div>
      </div>
      
      <motion.h1
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className={`font-eaglelake text-4xl md:text-6xl font-bold my-4 uppercase tracking-widest animate-glow ${colorClass}`}
      >
        {title}
      </motion.h1>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.8 }}
        className="flex justify-center gap-2 md:gap-4 my-6"
      >
        {results.map((r, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', delay: 0.8 + i * 0.1 }}
            className={`w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center font-bold text-white text-xs md:text-sm shadow-lg ${
              r === "SUCCESS" ? "bg-blue-600" : "bg-red-700"
            }`}
          >
            {r === "SUCCESS" ? (
              <CheckCircle size={24} />
            ) : (
              <XCircle size={24} />
            )}
          </motion.div>
        ))}
      </motion.div>

      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.1 }}
        className="text-slate-300 text-base md:text-lg"
      >
        <span className="font-bold text-red-400">{failVotes}</span> Fail
        vote{failVotes !== 1 ? "s" : ""} submitted.
      </motion.p>
      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.2 }}
        className="text-slate-400 text-sm md:text-base"
      >
        ({failsRequired} required to Fail Quest)
      </motion.p>
    </div>,
    document.body
  );
};

export default QuestResultOverlay;
