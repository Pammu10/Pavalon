import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useGame } from '@/components/context/GameContext';
import { useAudio } from '@/components/context/AudioContext';
import api, { fetcher } from '@/services/api';
import { Achievement, AchievementReward, Player } from '@/types';
import Card from './Card';
import Spinner from './Spinner';
import Button from './Button';
import { ICON_MAP, DEFAULT_ICONS } from './AvailableIcons';
import { CheckCircle, Lock, Trophy, Star, Shield, Eye, Skull, Crown, Swords, Palette, VenetianMask, ShieldCheck, UserRound, Feather, HeartCrack, Castle, Spade, Cherry, ChevronLeft, ChevronRight } from 'lucide-react';
import PlayerTile from './PlayerTile';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from '@tanstack/react-query';

const icons: { [key: string]: React.ReactNode } = {
    Trophy: <Trophy className="w-8 h-8" />,
    Star: <Star className="w-8 h-8" />,
    Shield: <Shield className="w-8 h-8" />,
    Eye: <Eye className="w-8 h-8" />,
    Skull: <Skull className="w-8 h-8" />,
    Crown: <Crown className="w-8 h-8" />,
    Swords: <Swords className="w-8 h-8" />,
    ShieldCheck: <ShieldCheck className="w-8 h-8" />,
    Feather: <Feather className="w-8 h-8" />,
    HeartCrack: <HeartCrack className="w-8 h-8" />,
    Castle: <Castle className="w-8 h-8" />,
    Spade: <Spade className="w-8 h-8" />,
    Cherry: <Cherry className="w-8 h-8" />,
};

type RewardOption = AchievementReward & { unlocked: boolean, achievementName: string };


const BorderOption: React.FC<{
    option: RewardOption | { name: string, value: string, unlocked: boolean, achievementName?: string };
    isPreview: boolean;
    isApplied: boolean;
    onClick: () => void;
}> = ({ option, isPreview, isApplied, onClick }) => {
    const borderStyleClass = option.value ? `border-style-${option.value}` : 'border-slate-600';
    const displayName = option.name === 'None' ? 'Default' : option.name.replace(' Border', '');

    return (
        <div className="flex flex-col items-center gap-2">
            <button
                onClick={onClick}
                className={cn(
                    'relative w-20 h-20 rounded-lg border-4 transition-all duration-200 flex items-center justify-center bg-slate-900/50',
                    borderStyleClass,
                    (isApplied || isPreview) ? 'scale-110' : 'hover:scale-105',
                    !option.unlocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                )}
                title={displayName}
            >
                {!option.unlocked && <Lock className="absolute bottom-1 right-1 w-4 h-4 text-slate-200 bg-slate-800 rounded-full p-0.5" />}
            </button>
            <span className={cn(
                "text-xs text-slate-300 text-center w-20 truncate",
                 isApplied && "text-yellow-400 animate-glow font-bold",
                !isApplied && isPreview && "text-blue-400 font-bold"
            )}>
                {displayName}
            </span>
        </div>
    );
};

const AchievementCardContent: React.FC<{ achievement: Achievement }> = React.memo(({ achievement }) => (
    <>
        <div className={`mt-1 flex-shrink-0 ${achievement.unlocked ? 'text-yellow-400' : 'text-slate-500'}`}>
            {icons[achievement.icon] || <Star className="w-8 h-8" />}
        </div>
        <div className="flex-grow">
            <h4 className={`font-bold ${achievement.unlocked ? 'text-white' : 'text-slate-300'}`}>{achievement.name}</h4>
            <p className="text-sm text-slate-400">{achievement.description}</p>
            {achievement.unlocked ? (
                <div className="flex items-center gap-2 mt-2 text-green-400 text-xs font-bold">
                    <CheckCircle size={14} />
                    Unlocked on {new Date(achievement.unlocked_at!).toLocaleDateString()}
                </div>
            ) : (
                <div className="flex items-center gap-2 mt-2 text-slate-500 text-xs font-bold">
                    <Lock size={14} />
                    Locked
                </div>
            )}
        </div>
    </>
));


const AchievementsTab: React.FC = () => {
    const { user, updateUser, setPreviewBackground } = useGame();
    const { playSound } = useAudio();
    
    const { data: achievements = [], isLoading: loading, isError: error } = useQuery({
        queryKey: ['achievements'],
        queryFn: () => fetcher<Achievement[]>('/achievements'),
    });

    const [selectedTitle, setSelectedTitle] = useState('');
    const [selectedBorder, setSelectedBorder] = useState('');
    const [selectedIcon, setSelectedIcon] = useState('');
    const [selectedBackground, setSelectedBackground] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    
    const themeScrollRef = useRef<HTMLDivElement>(null);
    const gridRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    useEffect(() => {
        if (user) {
            setSelectedTitle(user.selectedTitle || '');
            setSelectedBorder(user.selectedBorder || '');
            setSelectedIcon(user.selectedIcon || '');
            setSelectedBackground(user.selectedBackground || '');
        }
    }, [user]);

    const { allBorders, allIcons, themeToAchievementMap } = useMemo(() => {
        const rewards: RewardOption[] = achievements.flatMap(ach =>
            ach.rewards.map(reward => ({
                ...reward,
                unlocked: ach.unlocked,
                achievementName: ach.name
            }))
        );
        const tMap = new Map<string, Achievement>();
        achievements.forEach(ach => {
            ach.rewards.forEach(reward => {
                if (reward.type === 'BACKGROUND') {
                    tMap.set(reward.value, ach);
                }
            });
        });

        return {
            allBorders: rewards.filter(r => r.type === 'BORDER'),
            allIcons: rewards.filter(r => r.type === 'ICON'),
            themeToAchievementMap: tMap,
        };
    }, [achievements]);
    
    const achievementIconNames = useMemo(() => allIcons.map(i => i.value), [allIcons]);

    const previewPlayer: Player | null = useMemo(() => {
        if (!user) return null;
        return {
            id: user.id.toString(),
            userId: user.id,
            name: user.username,
            role: null,
            alignment: null,
            isHost: false,
            hasVoted: false,
            status: 'CONNECTED',
            selectedTitle,
            selectedBorder,
            selectedIcon,
            selectedBackground,
        };
    }, [user, selectedTitle, selectedBorder, selectedIcon, selectedBackground]);
    
    const handleLockedItemClick = (option: RewardOption) => {
        toast.error("Item Locked", {
            description: `Unlock the "${option.achievementName}" achievement to use this reward.`,
        });
        playSound('error', { manageBgm: false });
    };

    const handleSaveCustomization = async () => {
        setIsSaving(true);
        try {
            await api.post('/user/customize', { title: selectedTitle, border: selectedBorder, icon: selectedIcon, background: selectedBackground });
            updateUser({ selectedTitle, selectedBorder, selectedIcon, selectedBackground });
            setPreviewBackground(selectedBackground); // Ensure preview matches saved state
            toast.success("Profile Updated!");
            playSound('success', { manageBgm: false });
        } catch (err) {
            toast.error("Failed to save profile.");
            playSound('error', { manageBgm: false });
        } finally {
            setIsSaving(false);
        }
    };
    
    const themes = useMemo(() => [
       { id: '', name: "King's Hall", image: '/background/king.jpg' },
        { id: 'goodguy', name: "Arthur's Legacy", image: '/background/goodguy.png' },
        { id: 'badguy', name: "Assassin's Perch", image: '/background/badguy.png' },
        { id: 'forestday', name: "Mythical forest (day)", image: '/background/forestday.png' },
        { id: 'forestnight', name: "Mythical forest (night)", image: '/background/forestnight.png' },
        { id: 'cherry', name: "Cherry Blossom", image: '/background/cherry.png' },
        { id: 'pool', name: "Morgana's Scrying Pool", image: '/background/pool.png' },
        { id: 'chair', name: "The Siege Perilous", image: '/background/chair.png' },
        { id: 'tournament', name: "Camelot Tournament Grounds", image: '/background/tournament.png' },
        { id: 'ice', name: "Frozen Chamber", image: '/background/ice.png' },
        { id: 'fire', name: "Crimson Scar of Camlann", image: '/background/fire.png' },
        { id: 'dark', name: "Mordred's Umbral Sanctum", image: '/background/dark.png' },
        { id: 'light', name: "Celestial Zenith", image: '/background/light.png' },
        { id: 'reddrag', name: "Emberwing Dragon", image: '/background/reddrag.png' },
        { id: 'bluedrag', name: "Azure Tempest Dragon", image: '/background/bluedrag.png' },
        { id: 'purpledrag', name: "Amethyst Wyrm Dragon", image: '/background/purpledrag.png' },
    ], []);

    const checkScrollability = useCallback(() => {
        const el = themeScrollRef.current;
        if (!el) return;
        
        const tolerance = 2; // px tolerance for floating point issues
        const { scrollLeft, scrollWidth, clientWidth } = el;
        
        setCanScrollLeft(scrollLeft > tolerance);
        setCanScrollRight(scrollLeft + clientWidth < scrollWidth - tolerance);
    }, []);

    useEffect(() => {
        const scrollEl = themeScrollRef.current;
        const gridEl = gridRef.current;
        if (!scrollEl || !gridEl) return;

        const observer = new ResizeObserver(checkScrollability);
        observer.observe(gridEl);
        scrollEl.addEventListener('scroll', checkScrollability, { passive: true });
        
        const timeoutId = setTimeout(checkScrollability, 150);

        return () => {
            observer.disconnect();
            scrollEl.removeEventListener('scroll', checkScrollability);
            clearTimeout(timeoutId);
        };
    }, [checkScrollability]);

    
    const handleScroll = (direction: 'left' | 'right') => {
        const el = themeScrollRef.current;
        if (el) {
            const scrollAmount = el.clientWidth * 0.8;
            el.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
        }
    };


    const renderIconGrid = (iconList: string[], title: string) => (
        <div className="flex-1">
            <h4 className="font-bold text-slate-300 mt-4 mb-2 text-sm">{title}</h4>
            <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-5 lg:grid-cols-6 gap-2 bg-slate-900/40 border-2 border-slate-700 rounded-md p-3">
                {iconList.map(iconName => {
                    const Icon = ICON_MAP[iconName];
                    const iconReward = allIcons.find(i => i.value === iconName);
                    const isDefaultIcon = DEFAULT_ICONS.includes(iconName);
                    const isUnlocked = isDefaultIcon || (iconReward?.unlocked ?? false);
                    const isSelectedForPreview = selectedIcon === iconName;
                    const isApplied = (user?.selectedIcon || '') === iconName;

                    return (
                        <button 
                            key={iconName}
                            onClick={() => {
                                if (isUnlocked) {
                                    setSelectedIcon(iconName === selectedIcon ? '' : iconName);
                                } else if (iconReward) {
                                    handleLockedItemClick(iconReward);
                                }
                            }}
                             className={cn(
                                'relative p-2 rounded-md aspect-square transition-all duration-200',
                                {
                                    'bg-yellow-600 ring-2 ring-white scale-110': isApplied,
                                    'bg-blue-600 ring-2 ring-white scale-110': !isApplied && isSelectedForPreview,
                                    'bg-slate-800 hover:bg-slate-700': !isApplied && !isSelectedForPreview && isUnlocked,
                                    'bg-slate-800 opacity-40 cursor-not-allowed': !isUnlocked,
                                }
                            )}
                            title={iconName.charAt(0).toUpperCase() + iconName.slice(1)}
                        >
                            <Icon className="w-full h-full text-white" />
                            {!isUnlocked && <Lock className="absolute bottom-1 right-1 w-3 h-3 text-slate-400 bg-slate-800 rounded-full p-0.5"/>}
                        </button>
                    )
                })}
            </div>
        </div>
    );
    
    if (loading) return <div className="flex justify-center items-center h-40"><Spinner /></div>;
    if (error) return <p className="text-center text-red-500">Failed to load achievements.</p>;

    return (
        <div className="space-y-8">
            <Card id="profile-customization-card">
                <h2 className="font-eagleLake text-3xl mb-4 text-center text-yellow-500">Profile Customization</h2>
                
                <div className="mb-8">
                    <h3 className="text-xl font-eagleLake text-center text-slate-300 mb-4">Live Preview</h3>
                    <div className="flex justify-center items-center">
                        <div className="w-40 transform-gpu transition-transform duration-300 hover:scale-105">
                            {previewPlayer ? <PlayerTile player={previewPlayer} /> : <div className="aspect-[3/4] bg-slate-800 rounded-xl flex items-center justify-center"><Spinner size="sm" /></div>}
                        </div>
                    </div>
                </div>

                <div className="flex-1 mb-6">
                    <label className="flex items-center gap-2 mb-2 text-lg text-yellow-400 font-eagleLake">
                        <VenetianMask />
                        Custom Title
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            value={selectedTitle}
                            onChange={(e) => setSelectedTitle(e.target.value)}
                            placeholder="The Brave"
                            maxLength={10}
                            className="w-full bg-slate-900 border-2 border-slate-700 rounded-md p-3 pr-12 text-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:border-yellow-600 transition"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 pointer-events-none">
                            {selectedTitle.length} / 10
                        </span>
                    </div>
                </div>
                
                <Tabs defaultValue="border" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 bg-slate-800/50 p-1 h-auto rounded-lg">
                        <TabsTrigger value="border" className="flex items-center gap-2 py-2.5 data-[state=active]:bg-slate-700 data-[state=active]:text-yellow-400 text-slate-300 font-bold"><Palette size={16}/> Border</TabsTrigger>
                        <TabsTrigger value="icon" className="flex items-center gap-2 py-2.5 data-[state=active]:bg-slate-700 data-[state=active]:text-yellow-400 text-slate-300 font-bold"><UserRound size={16}/> Icon</TabsTrigger>
                        <TabsTrigger value="theme" className="flex items-center gap-2 py-2.5 data-[state=active]:bg-slate-700 data-[state=active]:text-yellow-400 text-slate-300 font-bold"><Palette size={16}/> Theme</TabsTrigger>
                    </TabsList>

                    <TabsContent value="border" className="mt-4">
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 bg-slate-900/40 border-2 border-slate-700 rounded-md p-4">
                            <BorderOption
                                option={{ name: 'None', value: '', unlocked: true }}
                                isPreview={selectedBorder === ''}
                                isApplied={(user?.selectedBorder || '') === ''}
                                onClick={() => setSelectedBorder('')}
                            />
                            {allBorders.map(border => (
                                <BorderOption
                                    key={border.value}
                                    option={border}
                                    isPreview={selectedBorder === border.value}
                                    isApplied={user?.selectedBorder === border.value}
                                    onClick={() => {
                                        if (border.unlocked) {
                                            setSelectedBorder(border.value);
                                        } else {
                                            handleLockedItemClick(border);
                                        }
                                    }}
                                />
                            ))}
                        </div>
                    </TabsContent>
                    
                    <TabsContent value="icon" className="mt-4">
                        <div className="flex flex-col md:flex-row gap-x-6">
                          {renderIconGrid(DEFAULT_ICONS, "Default Icons")}
                          {renderIconGrid(achievementIconNames, "Achievement Rewards")}
                        </div>
                    </TabsContent>
                    
                    <TabsContent value="theme" className="mt-4">
                        <div className="relative">
                            <button
                                onClick={() => handleScroll('left')}
                                disabled={!canScrollLeft}
                                className="absolute top-1/2 -translate-y-1/2 left-1 z-10 w-8 h-8 md:w-10 md:h-10 bg-yellow-900/60 hover:bg-yellow-800/80 backdrop-blur-sm rounded-full flex items-center justify-center border-2 border-yellow-500/80 text-yellow-300 shadow-lg shadow-yellow-500/20 transition-all hover:scale-110 active:scale-100 disabled:opacity-40 disabled:pointer-events-none disabled:hover:scale-100"
                                aria-label="Scroll left"
                            >
                                <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
                            </button>
                            <button
                                onClick={() => handleScroll('right')}
                                disabled={!canScrollRight}
                                className="absolute top-1/2 -translate-y-1/2 right-1 z-10 w-8 h-8 md:w-10 md:h-10 bg-yellow-900/60 hover:bg-yellow-800/80 backdrop-blur-sm rounded-full flex items-center justify-center border-2 border-yellow-500/80 text-yellow-300 shadow-lg shadow-yellow-500/20 transition-all hover:scale-110 active:scale-100 disabled:opacity-40 disabled:pointer-events-none disabled:hover:scale-100"
                                aria-label="Scroll right"
                            >
                                <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
                            </button>
                            <div ref={themeScrollRef} className="overflow-x-auto scroll-hide bg-slate-900/40 border-2 border-slate-700 rounded-md p-3 scroll-smooth">
                                <div ref={gridRef} className="grid grid-rows-2 grid-flow-col auto-cols-[48%] sm:auto-cols-[31%] md:auto-cols-[23.5%] gap-3">
                                    {themes.map((theme, index) => {
                                        const isSelectedForPreview = selectedBackground === theme.id;
                                        const isApplied = (user?.selectedBackground || '') === theme.id;
                                        const achievementToUnlock = themeToAchievementMap.get(theme.id);
                                        const isUnlocked = !achievementToUnlock || achievementToUnlock.unlocked;

                                        return (
                                            <button
                                                key={theme.id}
                                                onClick={() => {
                                                    if (isUnlocked) {
                                                        setSelectedBackground(theme.id);
                                                        setPreviewBackground(theme.id);
                                                    } else if (achievementToUnlock) {
                                                        handleLockedItemClick({
                                                            type: 'BACKGROUND',
                                                            value: theme.id,
                                                            name: theme.name,
                                                            unlocked: false,
                                                            achievementName: achievementToUnlock.name,
                                                        });
                                                    }
                                                }}
                                                className={cn(
                                                    'relative w-full aspect-[3/4] rounded-lg transition-all duration-200 ring-offset-2 ring-offset-slate-900 focus:outline-none focus:ring-2 overflow-hidden group',
                                                    isApplied
                                                        ? 'ring-4 ring-yellow-500'
                                                        : isSelectedForPreview
                                                            ? 'ring-4 ring-blue-500'
                                                            : 'ring-2 ring-transparent [@media(hover:hover)]:hover:ring-blue-500/70',
                                                    !isUnlocked && 'cursor-not-allowed'
                                                )}
                                                title={isUnlocked ? theme.name : `Unlock by completing: "${achievementToUnlock?.name}"`}
                                            >
                                                <Image 
                                                    src={theme.image} 
                                                    alt={theme.name}
                                                    fill
                                                    sizes="(max-width: 640px) 48vw, (max-width: 1024px) 24vw, 15vw"
                                                    priority={index < 8}
                                                    className={cn("object-cover rounded-md transition-transform duration-300 group-hover:scale-110", !isUnlocked && "grayscale")} 
                                                    onLoad={checkScrollability}
                                                />
                                                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none"></div>
                                                <span className={cn(
                                                    "absolute bottom-1 left-1 right-1 text-xs sm:text-sm text-center font-bold truncate p-1",
                                                    isApplied ? "text-yellow-400" : isSelectedForPreview ? "text-blue-400" : "text-slate-200"
                                                )}>
                                                    {theme.name}
                                                </span>
                                                {!isUnlocked && (
                                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                                        <Lock className="w-8 h-8 text-slate-200"/>
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>

                <div className="mt-6 text-center">
                    <Button onClick={handleSaveCustomization} disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save & Apply'}
                    </Button>
                </div>
            </Card>

            <Card>
                <h2 className="font-eagleLake text-3xl mb-6 text-center text-yellow-500">Achievements</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     {achievements.map(ach => (
                        ach.unlocked 
                        ? (
                            <div key={ach.id} className="unlocked-achievement-glow">
                                <div className="p-4 rounded-lg bg-slate-900 flex items-start gap-4 h-full">
                                    <AchievementCardContent achievement={ach} />
                                </div>
                            </div>
                        ) 
                        : (
                            <div key={ach.id} className="p-4 rounded-lg border-2 flex items-start gap-4 bg-slate-800/40 border-slate-700/50 opacity-60">
                                <AchievementCardContent achievement={ach} />
                            </div>
                        )
                    ))}
                </div>
            </Card>
        </div>
    );
};

export default AchievementsTab;