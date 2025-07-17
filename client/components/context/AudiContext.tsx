

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';

type SoundEffect = 'transition' | 'quest-success' | 'quest-fail' | 'victory' | 'defeat' | 'role-reveal' | 'success' | 'error' | 'card-swish' | 'db-game-over' | 'card-fan';

interface AudioContextType {
  isBgmMuted: boolean;
  toggleBgm: () => void;
  playSound: (sound: SoundEffect, options?: { manageBgm?: boolean }) => Promise<void>;
  playLobbyMusic: () => void;
  playInGameMusic: () => void;
  stopBackgroundMusic: () => void; // General purpose stop
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

// Define audio file paths
const AUDIO_FILES: Record<SoundEffect | 'background-lobby' | 'background-game', string> = {
  'background-lobby': '/audio/bg-sound.mp3', // Quieter, ambient music
  'background-game': '/audio/bg-game.mp3',   // More intense music
  'transition': '/audio/transition.mp3',
  'quest-success': '/audio/good.mp3',
  'quest-fail': '/audio/evil.mp3',
  'victory': '/audio/good_victory.mp3',
  'defeat': '/audio/evil_victory.mp3',
  'role-reveal': '/audio/role-reveals.mp3',
  'success': '/audio/transition.mp3',
  'error': '/audio/error.mp3',
  'card-swish': '/audio/card_swish.mp3',
  'db-game-over': '/audio/db_game_over.mp3',
  'card-fan': '/audio/card_fan.mp3',
};

export const AudioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isBgmMuted, setIsBgmMuted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const savedMute = localStorage.getItem('bgmMuted');
    return savedMute ? JSON.parse(savedMute) : false;
  });

  const sfxRefs = useRef<Partial<Record<SoundEffect, HTMLAudioElement>>>({});
  const lobbyMusicRef = useRef<HTMLAudioElement | null>(null);
  const gameMusicRef = useRef<HTMLAudioElement | null>(null);
  const activeMusicRef = useRef<HTMLAudioElement | null>(null);
  const wasPausedByVisibility = useRef(false);

  useEffect(() => {
    // Preload audio
    Object.entries(AUDIO_FILES).forEach(([key, src]) => {
      const audio = new Audio(src);
      audio.preload = 'auto';
      
      if (key === 'background-lobby') {
        audio.loop = true;
        audio.volume = 0.1; // Lobby music at 10% volume
        lobbyMusicRef.current = audio;
      } else if (key === 'background-game') {
        audio.loop = true;
        audio.volume = 0.25; // Game music at 25% volume
        gameMusicRef.current = audio;
      } else {
        audio.volume = 0.5; // Sound effects at 50%
        sfxRefs.current[key as SoundEffect] = audio;
      }
    });
  }, []);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (typeof document === 'undefined') return;

            if (document.hidden) {
                if (activeMusicRef.current && !activeMusicRef.current.paused) {
                    activeMusicRef.current.pause();
                    wasPausedByVisibility.current = true;
                }
            } else {
                if (activeMusicRef.current && activeMusicRef.current.paused && wasPausedByVisibility.current) {
                    if (!isBgmMuted) {
                        activeMusicRef.current.play().catch(e => console.error("Error resuming BGM on visibility change:", e));
                    }
                    wasPausedByVisibility.current = false;
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isBgmMuted]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        localStorage.setItem('bgmMuted', JSON.stringify(isBgmMuted));
    }
    if (lobbyMusicRef.current) lobbyMusicRef.current.muted = isBgmMuted;
    if (gameMusicRef.current) gameMusicRef.current.muted = isBgmMuted;
  }, [isBgmMuted]);

  const playSound = useCallback(async (
    sound: SoundEffect,
    options: { manageBgm?: boolean } = { manageBgm: true }
  ) => {
    const { manageBgm } = options;
    const bgmWasPlaying = manageBgm && activeMusicRef.current && !activeMusicRef.current.paused;

    if (bgmWasPlaying) {
      activeMusicRef.current?.pause();
    }

    const sfx = sfxRefs.current[sound];
    if (sfx) {
      await new Promise<void>(resolve => {
        sfx.currentTime = 0;
        const onEnded = () => {
          sfx.removeEventListener('ended', onEnded);
          resolve();
        };
        const onError = (e: any) => {
            console.error(`Error playing sound ${sound}:`, e);
            sfx.removeEventListener('error', onError);
            resolve();
        }
        sfx.addEventListener('ended', onEnded);
        sfx.addEventListener('error', onError);

        sfx.play().catch(e => {
          onError(e);
        });
      });
    }

    if (bgmWasPlaying) {
      activeMusicRef.current?.play().catch(e => console.error("Error resuming BGM:", e));
    }
  }, []);

  const stopLobbyMusic = useCallback(() => {
      if (lobbyMusicRef.current) {
          lobbyMusicRef.current.pause();
          lobbyMusicRef.current.currentTime = 0;
      }
  }, []);

  const stopInGameMusic = useCallback(() => {
      if (gameMusicRef.current) {
          gameMusicRef.current.pause();
          gameMusicRef.current.currentTime = 0;
      }
  }, []);

  const playLobbyMusic = useCallback(() => {
    stopInGameMusic();
    if (lobbyMusicRef.current) {
      if (lobbyMusicRef.current.paused) {
        lobbyMusicRef.current.muted = isBgmMuted;
        lobbyMusicRef.current.play().catch(e => console.error("Error playing lobby music:", e));
      }
      activeMusicRef.current = lobbyMusicRef.current;
    }
  }, [isBgmMuted, stopInGameMusic]);
  
  const playInGameMusic = useCallback(() => {
    stopLobbyMusic();
    if (gameMusicRef.current) {
      if (gameMusicRef.current.paused) {
        gameMusicRef.current.muted = isBgmMuted;
        gameMusicRef.current.play().catch(e => console.error("Error playing game music:", e));
      }
      activeMusicRef.current = gameMusicRef.current;
    }
  }, [isBgmMuted, stopLobbyMusic]);
  
  const stopBackgroundMusic = useCallback(() => {
    stopLobbyMusic();
    stopInGameMusic();
    activeMusicRef.current = null;
  }, [stopLobbyMusic, stopInGameMusic]);


  const toggleBgm = () => {
    setIsBgmMuted(prev => !prev);
  };

  const value = { 
    isBgmMuted, 
    toggleBgm, 
    playSound, 
    playLobbyMusic, 
    playInGameMusic,
    stopBackgroundMusic
  };

  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = (): AudioContextType => {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};
