"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Progress } from "@/components/ui/progress";

const messages = [
  "Summoning heroes of Albion…",
  "Forging Excalibur in sacred fire…",
  "Villains finish their last goblets of ale…",
  "Destiny awaits. Ready thy courage…",
];

export const AvalonLoadingOverlay = ({ onFinish }: { onFinish?: () => void }) => {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 33.33;
        if (next >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            if (onFinish) {
              onFinish();
            } 
          }, 1000);
        }
        return next;
      });

      setMessageIndex((prev) => (prev < messages.length - 1 ? prev + 1 : prev));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-100 flex flex-col items-center justify-center text-center text-amber-300 p-8 space-y-10 transition-all">
      <h1 className="text-2xl sm:text-3xl font-serif font-bold animate-pulse drop-shadow text-glow">
        {messages[messageIndex]}
      </h1>

      <Progress
        value={progress}
        className="h-6 w-72 bg-amber-900 border-2 border-amber-600 shadow-lg rounded-full overflow-hidden"
      />
    </div>
  );
};
