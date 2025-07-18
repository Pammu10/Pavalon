  "use client";

  import { motion } from "framer-motion";
  import { useEffect, useState } from "react";
  import { useAudio } from "@/components/context/AudiContext";
  import Image from "next/image";
  import { ArrowLeft, ArrowRight } from "lucide-react";
  // import { useHapticFeedback } from "@/hooks/useHapticFeedback";

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

    const handleNext = () => {
      stopAllSfx();
      if (index < storySlides.length - 1) {
        setIndex(index + 1);
      } else {
        onSkip();
      }
    };

    const handleBack = () => {
      stopAllSfx();
      if (index > 0) {
        setIndex(index - 1);
      }
    };

    useEffect(() => {
      playSound(storySlides[index].audio, { manageBgm: false });
      return () => {
        stopAllSfx();
      };
    }, [index, playSound, stopAllSfx]);

  // const {impact} = useHapticFeedback();

    return (
      
      <div className="fixed inset-0 z-50 bg-black text-white flex flex-col items-center justify-center p-6">
        
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -30 }}
          transition={{ duration: 0.8 }}
          className="max-w-xl text-center space-y-6"
        >
          <Image
            src={storySlides[index].image}
            alt={`Slide ${index + 1}`}
            width={600}
            height={400}
            className="rounded-xl object-cover shadow-lg"
          />

          <p className="text-xl sm:text-2xl font-serif italic leading-relaxed drop-shadow">
            {storySlides[index].text}
          </p>

          <div className="mt-8 flex justify-center items-center space-x-8">
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
        </motion.div>
      </div>
    );
  };