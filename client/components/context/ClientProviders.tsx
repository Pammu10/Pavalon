"use client";

import React from "react";
import { AudioProvider, useAudio } from "./AudioContext";
import { GameProvider, useGame } from "./GameContext";
import { Toaster } from "@/components/ui/sonner";
import { VoiceProvider } from "./VoiceContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import UsernameSetupModal from "../ui/UsernameSetupModal";

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

const InteractionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
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
      <div
        onClick={handleFirstInteraction}
        onTouchStart={handleFirstInteraction}
        className="h-full w-full"
      >
        {children}
      </div>
    </InteractionContext.Provider>
  );
};

const ModalRenderer: React.FC = () => {
  const { isUsernameModalOpen, closeUsernameModal, suggestedUsername } =
    useGame();

  // Prioritize username modal
  if (isUsernameModalOpen) {
    return (
      <UsernameSetupModal
        suggestedUsername={suggestedUsername}
        onClose={closeUsernameModal}
      />
    );
  }

  return null;
};

export const useInteraction = () => React.useContext(InteractionContext);

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
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
    </QueryClientProvider>
  );
}
