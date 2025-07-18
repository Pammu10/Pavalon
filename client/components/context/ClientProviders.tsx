
"use client";

import React from "react";
import { AudioProvider } from "./AudiContext";
import { GameProvider } from "./GameContext";
import { Toaster } from "@/components/ui/sonner";
// import { VoiceProvider } from "./VoiceContext";

const InteractionContext = React.createContext({
  hasInteracted: false,
});

const InteractionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [hasInteracted, setHasInteracted] = React.useState(false);
    
    const handleFirstInteraction = React.useCallback(() => {
        if (!hasInteracted) {
            setHasInteracted(true);
        }
    }, [hasInteracted]);

    return (
        <InteractionContext.Provider value={{ hasInteracted }}>
            <div onClick={handleFirstInteraction} onTouchStart={handleFirstInteraction} className="h-full w-full">
                {children}
            </div>
        </InteractionContext.Provider>
    );
};

export const useInteraction = () => React.useContext(InteractionContext);

export default function ClientProviders({ children }: { children: React.ReactNode }) {
    return (
        <AudioProvider>
            <GameProvider>
                {/* <VoiceProvider> */}
                    <InteractionProvider>
                        {children}
                        <Toaster richColors position="top-right" />
                    </InteractionProvider>
                {/* </VoiceProvider> */}
            </GameProvider>
        </AudioProvider>
    );
}