import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ShieldCheck, Skull } from "lucide-react";
import { Alignment } from "@/types";

interface GameEndOverlayProps {
  show: boolean;
  winner: Alignment | null;
  onClose: () => void;
}

const GameEndOverlay: React.FC<GameEndOverlayProps> = ({ show, winner, onClose }) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => onClose(), 6000); // Overlay stays for 6 seconds
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  if (!show || !winner) return null;

  const isGoodWin = winner === Alignment.GOOD;

  const title = isGoodWin ? "GOOD PREVAILS" : "EVIL TRIUMPHS";
  const message = isGoodWin
    ? "The light has prevailed. The kingdom is safe — for now."
    : "Darkness has consumed Avalon. Evil stands victorious.";

  const textColor = isGoodWin ? "text-blue-300" : "text-red-400";
  const bgPulse = isGoodWin ? "bg-blue-500/30" : "bg-red-600/30";
  const borderColor = isGoodWin ? "border-blue-400" : "border-red-500";
  const Icon = isGoodWin ? ShieldCheck : Skull;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/90 animate-fadeIn px-4 text-center">
      {/* Glowing and spinning icon */}
      <div className="relative w-28 h-28 sm:w-40 sm:h-40 mx-auto mb-6">
        <div className={`absolute inset-0 rounded-full animate-pulse-slow blur-xl ${bgPulse}`} />
        <div className={`w-full h-full rounded-full border-4 ${borderColor} border-t-transparent animate-spin`} />
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className={`${textColor} w-12 h-12 sm:w-16 sm:h-16`} />
        </div>
      </div>

      {/* Title */}
      <h2 className={`text-2xl sm:text-4xl font-extrabold mb-3 tracking-widest uppercase font-eaglelake animate-glow ${textColor}`}>
        {title}
      </h2>

      {/* Message */}
      <p className="text-white/80 text-sm sm:text-lg italic max-w-xs sm:max-w-md mx-auto">
        {message}
      </p>
    </div>,
    document.body
  );
};

export default GameEndOverlay;
