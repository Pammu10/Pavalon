import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '@/components/context/GameContext';
import { Player, DragonCard, DragonCardType } from '@/types';
import Button from '@/components/ui/Button';
import { AnimatePresence, motion, MotionProps } from 'framer-motion';
import { Flame, Shield, Swords, Eye, Shuffle, SkipForward, Heart, HelpCircle, User, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import Spinner from '../ui/Spinner';
import { toast } from 'sonner';
import { useAudio } from '../context/AudioContext';

// --- Card Data & Assets ---
const cardInfoMap = {
    [DragonCardType.DRAGON_BREATH]: { icon: Flame, borderColor: 'border-red-500/80', name: "Dragon's Breath", description: "If you draw this and cannot defuse it, you lose.", image: "/cards/dragon_breath.png" },
    [DragonCardType.DEFUSE]: { icon: Shield, borderColor: 'border-green-500/80', name: "Defuse", description: "Play this to survive the Dragon's Breath. You can then re-insert the Dragon's Breath card anywhere in the deck.", image: "/cards/defuse.png" },
    [DragonCardType.ATTACK]: { icon: Swords, borderColor: 'border-orange-500/80', name: "Attack", description: "End your turn without drawing. Your opponent must take two turns in a row.", image: "/cards/attack.png" },
    [DragonCardType.SKIP]: { icon: SkipForward, borderColor: 'border-blue-500/80', name: "Skip", description: "End your turn without drawing a card.", image: "/cards/skip.png" },
    [DragonCardType.SEE_THE_FUTURE]: { icon: Eye, borderColor: 'border-purple-500/80', name: "See the Future", description: "Privately view the top 3 cards of the draw pile.", image: "/cards/see_the_future.png" },
    [DragonCardType.SHUFFLE]: { icon: Shuffle, borderColor: 'border-yellow-500/80', name: "Shuffle", description: "Shuffle the draw pile thoroughly.", image: "/cards/shuffle.png" },
    [DragonCardType.EMBERDRAKE_HATCHLING]: { icon: Heart, borderColor: 'border-slate-500/80', name: "Emberdrake Hatchling", description: "A cute but ultimately useless creature. Does nothing on its own.", image: "/cards/cat_1.png" },
    [DragonCardType.GLIMMERING_WHELP]: { icon: Heart, borderColor: 'border-slate-500/80', name: "Glimmering Whelp", description: "A cute but ultimately useless creature. Does nothing on its own.", image: "/cards/cat_2.png" },
    [DragonCardType.SUNSTONE_DRAKE]: { icon: Heart, borderColor: 'border-slate-500/80', name: "Sunstone Drake", description: "A cute but ultimately useless creature. Does nothing on its own.", image: "/cards/cat_3.png" },
};


// --- Reusable Components ---
interface PlayingCardProps {
    card: DragonCard;
    onClick?: (e: React.MouseEvent) => void;
    className?: string;
    numberOverlay?: number;
}

const PlayingCard: React.FC<PlayingCardProps> = ({ card, onClick, className, numberOverlay }) => {
    const [showInfo, setShowInfo] = useState(false);
    const info = cardInfoMap[card.type];

    const handleInfoToggle = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card selection when toggling info
        setShowInfo(prev => !prev);
    };

    const handleCardClick = (e: React.MouseEvent) => {
        // If info overlay is visible, this click should hide it.
        if (showInfo) {
            setShowInfo(false);
            return; // Don't propagate to the play-card logic
        }
        // Otherwise, bubble up the click to the parent for play logic.
        if (onClick) {
            onClick(e);
        }
    };

    return (
        <div
            onClick={handleCardClick}
            className={cn(
                'w-36 sm:w-40 aspect-[3/4] rounded-xl shadow-xl border-2 flex flex-col relative text-white transition-all duration-300 overflow-hidden',
                'bg-slate-800',
                info.borderColor,
                onClick ? 'cursor-pointer' : 'cursor-default',
                className
            )}
        >
            {/* Title area at the top */}
            <div className="p-1 bg-black/40 backdrop-blur-sm relative z-10 flex items-center justify-center text-center h-10 flex-shrink-0">
                <h3 className="font-eaglelake text-xs leading-snug">{info.name}</h3>
            </div>
            
             {/* Image area takes up the rest of the space */}
            <div className="flex-grow relative">
                <img src={info.image} alt={info.name} className="absolute inset-0 w-full h-full object-cover" />
                 {numberOverlay && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-8xl font-black text-white/20" style={{ textShadow: '0 0 10px rgba(0,0,0,0.7)' }}>{numberOverlay}</span>
                    </div>
                )}
            </div>

            <div className="absolute bottom-1 right-1 z-20">
                <button
                    onClick={handleInfoToggle}
                    className="p-1.5 bg-black/50 hover:bg-black/80 rounded-full transition-colors"
                    aria-label="Show card info"
                >
                    <Info size={16} />
                </button>
            </div>
            
            <AnimatePresence>
                {showInfo && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-2 text-center"
                    >
                         <h3 className="font-eaglelake text-sm leading-tight mb-1 text-yellow-400">{info.name}</h3>
                         <p className="text-xs text-slate-200 leading-normal">{info.description}</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};


const CardBack: React.FC<{ className?: string, isClickable?: boolean }> = ({ className, isClickable }) => (
    <div className={cn(
        'relative w-36 sm:w-40 aspect-[3/4] rounded-xl shadow-lg border-2 border-slate-500 bg-slate-800 flex items-center justify-center transition-all',
        isClickable && 'hover:border-yellow-500 hover:shadow-yellow-500/20',
        className
    )}>
        <img src="/cards/card_back.png" alt="Card Back" className="w-full h-full object-cover rounded-xl" />
    </div>
);


// --- Main Screen ---
const DragonsBreathScreen: React.FC = () => {
    const { gameState, playerId, drawCard, playCard, placeDragonCard, endFutureView, returnToLobby } = useGame();
    const { playSound } = useAudio();
    const { players, dragonsBreathState: dbState } = gameState;
    
    const [isHandExpanded, setIsHandExpanded] = useState(false);
    const localPlayer = players.find(p => p.id === playerId);
    const prevGameLogLength = useRef(gameState.gameLog.length);

    useEffect(() => {
        if (!localPlayer) return;

        // This check prevents firing toasts for old logs on re-render.
        if (gameState.gameLog.length > prevGameLogLength.current) {
            const newEntries = gameState.gameLog.slice(prevGameLogLength.current);
            
            newEntries.forEach(entry => {
                // Only show toasts for Dragon's Breath game events not initiated by the current player.
                // This covers opponent moves and turn changes.
                if (entry.type === 'dragonsBreath' && !entry.text.startsWith(localPlayer.name)) {
                     toast.info(entry.text, {
                        icon: <Info size={16} />,
                    });
                }
            });
        }
        prevGameLogLength.current = gameState.gameLog.length;
    }, [gameState.gameLog, localPlayer]);


    // --- Modals ---
    const SeeTheFutureModal: React.FC<{ cards: DragonCard[]; onClose: () => void }> = ({ cards, onClose }) => (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4 animate-fadeIn">
            <h2 className="text-4xl font-eaglelake text-yellow-400 mb-2" style={{ textShadow: "0 0 10px rgba(234, 179, 8, 0.5)"}}>The Future...</h2>
            <p className="text-slate-300 mb-6">These are the top 3 cards of the deck.</p>
            <div className="flex flex-wrap justify-center gap-4 mb-8">
                {cards.length > 0 ? cards.map((card, index) => <PlayingCard key={card.id} card={card} numberOverlay={index + 1} />) : <p className="text-slate-400">The deck is empty.</p>}
            </div>
            <Button onClick={onClose} variant="secondary">Return to Game</Button>
        </div>
    );

    const PlaceDragonModal: React.FC<{ deckSize: number; onPlace: (index: number) => void }> = ({ deckSize, onPlace }) => {
        const [index, setIndex] = useState(0);
        return (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4 animate-fadeIn">
                <h2 className="text-4xl font-eaglelake text-red-500 mb-2" style={{ textShadow: "0 0 10px rgba(220, 38, 38, 0.5)"}}>Place the Dragon's Breath</h2>
                <p className="text-slate-300 mb-6 max-w-sm text-center">You have defused the Dragon's Breath! Now, secretly place it back into the draw pile.</p>
                <div className="w-full max-w-sm bg-slate-900/50 p-6 rounded-2xl border border-slate-700 space-y-4">
                    <Button onClick={() => onPlace(0)} className="w-full">Top of Deck (Position 0)</Button>
                    <Button onClick={() => onPlace(deckSize)} className="w-full">Bottom of Deck (Position {deckSize})</Button>
                    
                    <div className="text-center pt-4 border-t border-slate-700">
                        <label className="text-slate-400 block mb-2">Or choose a specific position:</label>
                        <p className="font-bold text-white text-2xl mb-2">{index}</p>
                        <input type="range" min="0" max={deckSize} value={index} onChange={e => setIndex(Number(e.target.value))} className="w-full accent-yellow-500 mt-2"/>
                        <Button onClick={() => onPlace(index)} className="mt-4 w-full">Place at position {index}</Button>
                    </div>
                </div>
            </div>
        );
    };

    const GameOverModal: React.FC<{ winner: Player, onLeave: () => void }> = ({ winner, onLeave }) => {
        useEffect(() => {
            playSound('db-game-over');
        }, [playSound]);
        
        return (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-lg z-50 flex flex-col items-center justify-center p-4 animate-fadeIn">
                <Flame className="w-24 h-24 text-yellow-400 animate-glow mb-4"/>
                <h2 className="text-5xl font-eaglelake text-yellow-400 mb-4">Game Over!</h2>
                <p className="text-2xl text-white mb-4"><span className="font-bold">{winner.name}</span> is victorious!</p>
            
                <div className="flex gap-4">
                    
                    <Button onClick={onLeave} variant="primary">Back to Lobby</Button>
                </div>
            </div>
        );
    };

    if (!dbState || !localPlayer) return <div className="h-full w-full flex items-center justify-center"><Spinner size="lg" /></div>;
    
    const opponent = players.find(p => p.id !== playerId)!;
    const myHand = dbState.hands[playerId!] || [];
    const opponentHandSize = dbState.hands[opponent.id]?.length || 0;
    const isMyTurn = dbState.currentPlayerId === playerId;
    const isUIBlocked = !!dbState.isViewingFuture || !!dbState.isPlacingDragon || !!dbState.winner;
    
    const handleCardClick = (card: DragonCard) => {
        if (!isMyTurn || isUIBlocked || !isHandExpanded) return;
        
        const isPlayable = card.type !== DragonCardType.DEFUSE;
        if (isPlayable) {
            playSound('card-swish', { manageBgm: false });
            playCard(card.id);
        } else {
            toast.info("Defuse cards are used automatically when you draw the Dragon's Breath.");
        }
    };

    const handleDrawClick = () => {
        if (isMyTurn && !isUIBlocked) {
            playSound('card-swish', { manageBgm: false });
            drawCard();
        }
    };
    
    const { winner, loser } = dbState;
    if (winner && loser) {
        const winnerPlayer = players.find(p => p.id === winner);
        const loserPlayer = players.find(p => p.id === loser);
        if (!winnerPlayer || !loserPlayer) return <div className="h-full w-full flex items-center justify-center"><p>Waiting...</p></div>;
        return <GameOverModal winner={winnerPlayer} onLeave={returnToLobby} />;
    }

    if (dbState.isViewingFuture === playerId) return <SeeTheFutureModal cards={dbState.futureCards} onClose={endFutureView} />;
    if (dbState.isPlacingDragon === playerId) return <PlaceDragonModal deckSize={dbState.deck.length} onPlace={placeDragonCard} />;


    return (
        <div 
            className="w-full h-full flex flex-col items-stretch p-2 sm:p-4 font-sans relative text-white"
            onClick={() => {
                if(isHandExpanded) setIsHandExpanded(false);
            }}
        >
            {/* --- TOP: Opponent Area --- */}
            <div className="w-full flex flex-col items-center gap-4 z-10">
                <div className="flex items-center gap-3 bg-black/40 backdrop-blur-sm p-2 px-4 rounded-lg border border-slate-700/50">
                    <User size={20} className={cn("transition-colors", !isMyTurn ? 'text-yellow-400' : 'text-slate-400')} />
                    <h2 className={cn("text-xl font-bold transition-all", !isMyTurn ? 'text-yellow-400 animate-glow' : 'text-slate-400')}>{opponent.name}</h2>
                </div>
                <div className="relative flex justify-center items-start h-48 w-full pt-4">
                    <AnimatePresence>
                    {Array.from({ length: opponentHandSize }).map((_, i) => (
                        <motion.div
                            key={`opponent-${i}`}
                            className="absolute origin-bottom"
                            initial={{ opacity: 0, y: -20 }}
                            animate={{
                                opacity: 1,
                                y: Math.abs(i - (opponentHandSize - 1) / 2) * 6,
                                x: (i - (opponentHandSize - 1) / 2) * 25,
                                rotate: (i - (opponentHandSize - 1) / 2) * 7,
                                zIndex: i,
                                transition: { delay: i * 0.05, type: 'spring', stiffness: 300, damping: 25 }
                            }}
                            exit={{
                                opacity: 0,
                                scale: 0.5,
                                transition: { duration: 0.2 }
                            }}
                        >
                            <CardBack className="w-24 sm:w-28" />
                        </motion.div>
                    ))}
                    </AnimatePresence>
                     {opponentHandSize === 0 && (
                        <div className="w-24 sm:w-28 aspect-[3/4] rounded-xl border-2 border-dashed border-slate-600/50 flex items-center justify-center text-slate-500 flex-col gap-1">
                            <HelpCircle size={24}/>
                            <span className="text-xs">No Cards</span>
                        </div>
                    )}
                </div>
            </div>

            {/* --- MIDDLE: Board Area --- */}
            <div className="w-full max-w-lg mx-auto flex-grow flex flex-col items-center justify-center z-10 p-4 sm:p-6 my-4 bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-700 relative">

                <div className="flex items-end justify-center gap-8 sm:gap-12 w-full mt-16">
                    {/* Discard Pile */}
                    <div className="flex flex-col items-center gap-2">
                         <div className="relative w-36 sm:w-40 aspect-[3/4] rounded-xl border-2 border-slate-600/50">
                            <AnimatePresence>
                                {dbState.discardPile.length > 0 && (
                                    <motion.div
                                        key={dbState.discardPile[dbState.discardPile.length - 1].id}
                                        initial={{ opacity: 0, scale: 0.5 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.5 }}
                                        transition={{ duration: 0.3 }}
                                        className="absolute inset-0"
                                    >
                                        <PlayingCard card={dbState.discardPile[dbState.discardPile.length - 1]} />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                             {dbState.discardPile.length === 0 && (
                                <div className="w-full h-full flex items-center justify-center text-slate-600 flex-col gap-1">
                                    <HelpCircle size={30}/>
                                    <span className="text-xs">Discard Pile</span>
                                </div>
                            )}
                        </div>
                        <span className="font-eaglelake text-base text-slate-300">Discard ({dbState.discardPile.length})</span>
                    </div>
                    {/* Draw Pile */}
                     <div className="flex flex-col items-center gap-2">
                        <button onClick={handleDrawClick} disabled={!isMyTurn || !!isUIBlocked} className="disabled:cursor-not-allowed">
                             <div>
                                <CardBack isClickable={isMyTurn && !isUIBlocked} className={cn(isMyTurn && !isUIBlocked && 'animate-pulse-glow shadow-glow-yellow')}/>
                             </div>
                        </button>
                        <span className="font-eaglelake text-base text-slate-300">Draw Pile ({dbState.deck.length})</span>
                    </div>
                </div>
            </div>

            {/* --- BOTTOM: Player Area & Hand --- */}
            <div className="w-full flex flex-col items-center gap-2 z-10 flex-shrink-0">
                <div className="flex items-center gap-3 bg-black/40 backdrop-blur-sm p-2 px-4 rounded-lg border border-slate-700/50">
                    <User size={20} className={cn("transition-colors", isMyTurn ? 'text-yellow-400' : 'text-slate-400')} />
                    <h2 className={cn("text-xl font-bold transition-all", isMyTurn ? 'text-yellow-400 animate-glow' : 'text-slate-400')}>{localPlayer.name}</h2>
                </div>

                <motion.div
                    layout
                    transition={{ type: 'spring', stiffness: 400, damping: 40 }}
                    className={cn(
                        "relative w-full min-h-[18rem]",
                        isHandExpanded
                            ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-4 justify-items-center'
                            : 'flex items-end justify-center p-4 cursor-pointer',
                    )}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!isHandExpanded) {
                            playSound('card-fan', { manageBgm: false });
                            setIsHandExpanded(true);
                        }
                    }}
                >
                    <AnimatePresence>
                        {myHand.map((card, index) => (
                             <motion.div
                                key={card.id}
                                layoutId={card.id}
                                whileHover={ isHandExpanded ? { y: -20, scale: 1.05 } : { y: -8 } }
                                className={cn(
                                    !isHandExpanded && "absolute pointer-events-none"
                                )}
                                animate={{
                                    rotate: isHandExpanded ? 0 : (index - (myHand.length - 1) / 2) * 4,
                                    zIndex: index,
                                }}
                                transition={{ type: 'spring', stiffness: 400, damping: 40 }}
                            >
                                <PlayingCard
                                    card={card}
                                    onClick={() => handleCardClick(card)}
                                />
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    {!isHandExpanded && myHand.length > 0 && (
                        <div className="absolute bottom-4 w-48 text-center p-2 bg-black/30 rounded-t-lg pointer-events-none">
                            <p className="font-eaglelake text-yellow-400">Your Hand ({myHand.length})</p>
                            <p className="text-xs text-slate-300">Click to expand</p>
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
};

export default DragonsBreathScreen;