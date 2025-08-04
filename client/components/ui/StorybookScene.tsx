

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { useAudio } from "@/components/context/AudioContext";
import Image from "next/image";
import { ArrowLeft, ArrowRight } from "lucide-react";

const storySlides = [
  {
    text: "In the time of King Arthur, a great evil lurked in the shadows…",
    image: "/story/slide1.jpeg",
    audio: "narration1" as const,
  },
  {
    text: "Merlin foresaw the threat. traitors hidden among the King’s own",
    image: "/story/slide2.jpeg",
    audio: "narration2" as const,
  },
  {
    text: "You have been summoned. Loyalty is your sword. Deceit is your shield.",
    image: "/story/slide3.jpeg",
    audio: "narration3" as const,
  },
];

export const StorybookScene = ({ onSkip }: { onSkip: () => void }) => {
  const [index, setIndex] = useState(0);
  const { playSound, stopAllSfx } = useAudio();

  const handleNext = useCallback(() => {
    stopAllSfx();
    setIndex(prevIndex => {
      if (prevIndex < storySlides.length - 1) {
        return prevIndex + 1;
      } else {
        onSkip();
        return prevIndex;
      }
    });
  }, [onSkip, stopAllSfx]);

  const handleBack = useCallback(() => {
    stopAllSfx();
    setIndex(prevIndex => (prevIndex > 0 ? prevIndex - 1 : prevIndex));
  }, [stopAllSfx]);


  useEffect(() => {
    let isCancelled = false;

    const playAndAdvance = async () => {
        await playSound(storySlides[index].audio, { manageBgm: false });
        // Only advance if this effect is still active
        if (!isCancelled) {
            setTimeout(() => {
                // Check again in case state changed during timeout
                if (!isCancelled) {
                   if (index < storySlides.length - 1) {
                        setIndex(i => i + 1);
                    } else {
                        onSkip();
                    }
                }
            }, 500); // 500ms pause for pacing
        }
    };
    
    playAndAdvance();

    return () => {
      isCancelled = true;
      stopAllSfx();
    };
  }, [index, playSound, stopAllSfx, onSkip]);

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col items-center justify-center p-6 overflow-hidden">
        <div className="w-full max-w-xl text-center flex-grow flex flex-col items-center justify-center">
            <AnimatePresence mode="wait">
                <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    className="flex flex-col items-center space-y-6"
                >
                    <Image
                        src={storySlides[index].image}
                        alt={`Slide ${index + 1}`}
                        width={600}
                        height={400}
                        className="rounded-xl object-cover shadow-lg"
                        priority={false}
                    />
                    <p className="min-h-[96px] text-xl sm:text-2xl font-serif italic leading-relaxed drop-shadow">
                        {storySlides[index].text}
                    </p>
                </motion.div>
            </AnimatePresence>
        </div>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 mt-8 flex justify-center items-center space-x-8 z-10">
            <button
                onClick={handleBack}
                disabled={index === 0}
                className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-black font-bold rounded-full transition flex items-center gap-2 disabled:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
                <ArrowLeft size={20} />
                Back
            </button>
            <button
                onClick={handleNext}
                className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-black font-bold rounded-full transition flex items-center gap-2"
            >
                {index < storySlides.length - 1 ? "Next" : "Begin"}
                <ArrowRight size={20} />
            </button>
        </div>
    </div>
  );
};
