"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { speak, stopSpeaking } from "@/hooks/useNarration";
import Image from "next/image";
// import { useHapticFeedback } from "@/hooks/useHapticFeedback";

const storySlides = [
  {
    text: "In the time of King Arthur, a great evil lurked in the shadows…",
    image: "/story/slide1.jpeg",
  },
  {
    text: "Merlin foresaw the threat. traitors hidden among the King’s own",
    image: "/story/slide2.jpeg",
  },
  {
    text: "You have been summoned. Loyalty is your sword. Deceit is your shield.",
    image: "/story/slide3.jpeg",
  },
];

export const StorybookScene = ({ onSkip }: { onSkip: () => void }) => {
  const [index, setIndex] = useState(0);
  const handleNext = () => {
    if (index < storySlides.length - 1) {
      setIndex(index + 1);
    } else {
    stopSpeaking();
    onSkip();
    }
  };

  const handleBack = () => {
    if (index > 0) {
      setIndex(index - 1);
    }
  };

  useEffect(() => {
  
    speak(storySlides[index].text);
  
 return () => {
    stopSpeaking();
  };
}, [index]);

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

        <div className="mt-4 flex justify-center space-x-4">
          { index !== 0 && 
          <button
            onClick={async () => { handleBack();}}
            className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-black font-bold rounded-full transition"
          >
            Back
          </button>}
          <button
            onClick={async() => { handleNext()}}
            className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-black font-bold rounded-full transition"
          >
            {index < storySlides.length - 1 ? "Next" : "Begin"}
          </button>
        { index !== 2 && 
          <button
            onClick={async () => { stopSpeaking(); onSkip();}}
            className="px-4 py-2 text-amber-300 hover:text-white text-sm underline"
          >
            Skip
          </button>}
        </div>
      </motion.div>
    </div>
  );
};
