import React, { useState, useEffect, useMemo } from 'react';
import { useGame } from '@/components/context/GameContext';
import { useAudio } from '@/components/context/AudioContext';
import api from '@/services/api';
import { Achievement, AchievementReward, Player } from '@/types';
import Card from './Card';
import Spinner from './Spinner';
import Button from './Button';
import { ICON_MAP, DEFAULT_ICONS } from './AvailableIcons';
import { CheckCircle, Lock, Trophy, Star, Shield, Eye, Skull, Crown, Swords, Palette, VenetianMask, ShieldCheck, UserRound, Feather, HeartCrack, Castle, Spade, Cherry } from 'lucide-react';
import PlayerTile from './PlayerTile';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
    isSelected: boolean;
    onClick: () => void;
}> = ({ option, isSelected, onClick }) => {
    const borderStyleClass = option.value ? `border-style-${option.value}` : 'border-slate-600';
    const displayName = option.name === 'None' ? 'Default' : option.name.replace(' Border', '');

    return (
        <div className="flex flex-col items-center gap-2">
            <button
                onClick={onClick}
                className={cn(
                    'relative w-20 h-20 rounded-lg border-4 transition-all duration-200 flex items-center justify-center bg-slate-900/50',
                    borderStyleClass,
                    isSelected ? 'scale-110' : 'hover:scale-105',
                    !option.unlocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                )}
                title={displayName}
            >
                {!option.unlocked && <Lock className="absolute bottom-1 right-1 w-4 h-4 text-slate-200 bg-slate-800 rounded-full p-0.5" />}
            </button>
            <span className={cn(
                "text-xs text-slate-300 text-center w-20 truncate",
                isSelected && "text-yellow-400 animate-glow font-bold"
            )}>
                {displayName}
            </span>
        </div>
    );
};

const AchievementCardContent: React.FC<{ achievement: Achievement }> = ({ achievement }) => (
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
);


const AchievementsTab: React.FC = () => {
    const { user, updateUser, achievementsVersion } = useGame();
    const { playSound } = useAudio();
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [selectedTitle, setSelectedTitle] = useState('');
    const [selectedBorder, setSelectedBorder] = useState('');
    const [selectedIcon, setSelectedIcon] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    
    useEffect(() => {
        const fetchAchievements = async () => {
            setLoading(true);
            try {
                const { data } = await api.get<Achievement[]>('/achievements');
                setAchievements(data);
            } catch (err) {
                setError('Failed to load achievements.');
            } finally {
                setLoading(false);
            }
        };
        fetchAchievements();
    }, [achievementsVersion]);

    useEffect(() => {
        if (user) {
            setSelectedTitle(user.selectedTitle || '');
            setSelectedBorder(user.selectedBorder || '');
            setSelectedIcon(user.selectedIcon || '');
        }
    }, [user]);

    const { allBorders, allIcons } = useMemo(() => {
        const rewards: RewardOption[] = achievements.flatMap(ach =>
            ach.rewards.map(reward => ({
                ...reward,
                unlocked: ach.unlocked,
                achievementName: ach.name
            }))
        );
        return {
            allBorders: rewards.filter(r => r.type === 'BORDER'),
            allIcons: rewards.filter(r => r.type === 'ICON'),
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
        };
    }, [user, selectedTitle, selectedBorder, selectedIcon]);
    
    const handleLockedItemClick = (option: RewardOption) => {
        toast.error("Item Locked", {
            description: `Unlock the "${option.achievementName}" achievement to use this reward.`,
        });
        playSound('error', { manageBgm: false });
    };

    const handleSaveCustomization = async () => {
        setIsSaving(true);
        try {
            await api.post('/user/customize', { title: selectedTitle, border: selectedBorder, icon: selectedIcon });
            updateUser({ selectedTitle, selectedBorder, selectedIcon });
            toast.success("Profile Updated!");
            playSound('success', { manageBgm: false });
        } catch (err) {
            toast.error("Failed to save profile.");
            playSound('error', { manageBgm: false });
        } finally {
            setIsSaving(false);
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
                            className={`relative p-2 rounded-md aspect-square transition-all duration-200 ${selectedIcon === iconName ? 'bg-yellow-600 ring-2 ring-white scale-110' : (isUnlocked ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-800 opacity-40 cursor-not-allowed')} `}
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
    if (error) return <p className="text-center text-red-500">{error}</p>;

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

                <div className="space-y-6">
                    <div className="flex-1">
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

                    <div>
                        <label className="flex items-center gap-2 mb-2 text-lg text-yellow-400 font-eagleLake">
                            <Palette />
                            Border
                        </label>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 bg-slate-900/40 border-2 border-slate-700 rounded-md p-4">
                            <BorderOption
                                option={{ name: 'None', value: '', unlocked: true }}
                                isSelected={selectedBorder === ''}
                                onClick={() => setSelectedBorder('')}
                            />
                            {allBorders.map(border => (
                                <BorderOption
                                    key={border.value}
                                    option={border}
                                    isSelected={selectedBorder === border.value}
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
                    </div>
                    
                     <div>
                        <label className="flex items-center gap-2 mb-2 text-lg text-yellow-400 font-eagleLake">
                            <UserRound/>
                            Icon
                        </label>
                        <div className="flex flex-col md:flex-row gap-x-6">
                          {renderIconGrid(DEFAULT_ICONS, "Default Icons")}
                          {renderIconGrid(achievementIconNames, "Achievement Rewards")}
                        </div>
                    </div>
                </div>
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