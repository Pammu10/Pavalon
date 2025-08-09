"use client";

import React from "react";
import { AudioProvider, useAudio } from "./AudioContext";
import { GameProvider, useGame } from "./GameContext";
import { Toaster } from "@/components/ui/sonner";
import { VoiceProvider } from "./VoiceContext";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { GoogleOAuthProvider } from '@react-oauth/google';
import UsernameSetupModal from "../ui/UsernameSetupModal";
import TutorialPromptModal from "../ui/TutorialPromptModal";
import TutorialOverlay from "../ui/TutorialOverlay";

// Create a client
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            refetchOnWindowFocus: false,
        },
    },
});


const InteractionContext = React.createContext({
  hasInteracted: false,
});

const InteractionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [hasInteracted, setHasInteracted] = React.useState(false);
    const { playLobbyMusic } = useAudio();
    
    const handleFirstInteraction = React.useCallback(() => {
        if (!hasInteracted) {
            setHasInteracted(true);
        }
    }, [hasInteracted]);

    React.useEffect(() => {
        if (hasInteracted) {
            playLobbyMusic();
        }
    }, [hasInteracted, playLobbyMusic]);

    return (
        <InteractionContext.Provider value={{ hasInteracted }}>
            <div onClick={handleFirstInteraction} onTouchStart={handleFirstInteraction} className="h-full w-full">
                {children}
            </div>
        </InteractionContext.Provider>
    );
};

const ModalRenderer: React.FC = () => {
    const { 
        isUsernameModalOpen, closeUsernameModal, suggestedUsername,
        isTutorialPromptOpen, closeTutorialPrompt, startTutorial,
        isTutorialActive,
    } = useGame();

    // Prioritize username modal
    if (isUsernameModalOpen) {
        return <UsernameSetupModal suggestedUsername={suggestedUsername} onClose={closeUsernameModal} />;
    }
    
    if (isTutorialPromptOpen) {
        return <TutorialPromptModal onStart={startTutorial} onClose={closeTutorialPrompt} />;
    }

    if (isTutorialActive) {
        return <TutorialOverlay />;
    }

    return null;
}


export const useInteraction = () => React.useContext(InteractionContext);

export default function ClientProviders({ children }: { children: React.ReactNode }) {
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    if (!googleClientId) {
        console.error("Google Client ID is not configured. Google login will not work.");
        // You might want to render an error message or a fallback UI here
        return <div>Error: Google Login is not configured.</div>;
    }

    return (
        <GoogleOAuthProvider clientId={googleClientId}>
            <QueryClientProvider client={queryClient}>
                <AudioProvider>
                    <GameProvider>
                        <VoiceProvider>
                            <InteractionProvider>
                                {children}
                                <Toaster richColors position="top-right" />
                                <ModalRenderer />
                            </InteractionProvider>
                        </VoiceProvider>
                    </GameProvider>
                </AudioProvider>
                <ReactQueryDevtools initialIsOpen={false} />
            </QueryClientProvider>
        </GoogleOAuthProvider>
    );
}