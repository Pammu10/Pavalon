import { Role } from "./types";

export interface AchievementReward {
    type: 'TITLE' | 'BORDER' | 'ICON';
    value: string; // e.g., "The Seer" or "azure" or "zap"
    name: string; // e.g. "Azure Border" or "Zap Icon"
}

export interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string; // Lucide icon name
    rewards: AchievementReward[];
    check: (stats: any, performance: any) => boolean;
    hidden?: boolean; // If true, it won't show in the list unless unlocked
}

export const ALL_ACHIEVEMENTS: Achievement[] = [
    // --- Basic Achievements ---
    {
        id: 'first_game',
        name: 'First Quest',
        description: 'Complete your first game of Pavalon.',
        icon: 'Swords',
        rewards: [{ type: 'ICON', value: 'swords', name: 'Crossed Swords Icon'}],
        check: (stats, p) => stats?.totalGames >= 1,
    },
    {
        id: 'first_win',
        name: 'A Taste of Victory',
        description: 'Win your first game.',
        icon: 'Trophy',
        rewards: [
            { type: 'ICON', value: 'trophy', name: 'Trophy Icon' }
        ],
        check: (stats, p) => stats?.totalWins >= 1,
    },
    {
        id: 'ten_games',
        name: 'Seasoned Knight',
        description: 'Play 10 games.',
        icon: 'Shield',
        rewards: [
            { type: 'BORDER', value: 'crimson', name: 'Crimson Border' },
            { type: 'ICON', value: 'shield', name: 'Shield Icon' }
        ],
        check: (stats, p) => stats?.totalGames >= 10,
    },
    
    // --- Role Specific Wins ---
    {
        id: 'win_as_merlin',
        name: "Merlin's Foresight",
        description: 'Win a game as Merlin.',
        icon: 'Eye',
        rewards: [
            { type: 'ICON', value: 'eye', name: 'Eye Icon' },
        ],
        check: (stats, p) => p?.role === Role.MERLIN && p.won,
    },
    {
        id: 'win_as_assassin',
        name: 'Silent Blade',
        description: 'Win a game by assassinating Merlin.',
        icon: 'Skull',
        rewards: [
            { type: 'ICON', value: 'skull', name: 'Skull Icon' }
        ],
        check: (stats, p) => p?.role === Role.ASSASSIN && p.won,
    },
    {
        id: 'win_as_percival',
        name: 'True Sight',
        description: 'Win a game as Percival.',
        icon: 'Star',
        rewards: [
            { type: 'BORDER', value: 'azure', name: 'Azure Border' },
            { type: 'ICON', value: 'star', name: 'Star Icon' },
        ],
        check: (stats, p) => p?.role === Role.PERCIVAL && p.won,
    },
    {
        id: 'win_as_morgana',
        name: 'Master of Deception',
        description: 'Win a game as Morgana.',
        icon: 'Feather',
        rewards: [
            { type: 'ICON', value: 'feather', name: 'Feather Icon' },
        ],
        check: (stats, p) => p?.role === Role.MORGANA && p.won,
    },


    // --- Milestone Achievements ---
    {
        id: 'ten_wins',
        name: 'Champion of Camelot',
        description: 'Win 10 games.',
        icon: 'Crown',
        rewards: [
            { type: 'ICON', value: 'crown', name: 'Crown Icon' }
        ],
        check: (stats, p) => stats?.totalWins >= 10,
    },
    {
        id: 'five_good_wins',
        name: 'Guardian of the Realm',
        description: 'Win 5 games as a member of Good.',
        icon: 'ShieldCheck',
        rewards: [
            { type: 'ICON', value: 'shieldcheck', name: 'Shield Check Icon' },
        ],
        check: (stats, p) => stats?.goodWins >= 5,
    },
    {
        id: 'five_evil_wins',
        name: 'Agent of Chaos',
        description: 'Win 5 games as a member of Evil.',
        icon: 'HeartCrack',
        rewards: [
            { type: 'BORDER', value: 'amethyst', name: 'Amethyst Border' },
            { type: 'ICON', value: 'heartcrack', name: 'Heartcrack Icon' },
        ],
        check: (stats, p) => stats?.evilWins >= 5,
    },
     {
        id: 'twenty_five_wins',
        name: 'Legend of the Round Table',
        description: 'Win 25 games.',
        icon: 'Castle',
        rewards: [
            { type: 'BORDER', value: 'golden', name: 'Golden Border' },
            { type: 'ICON', value: 'castle', name: 'Castle Icon' },
        ],
        check: (stats, p) => stats?.totalWins >= 25,
    },
    {
        id: 'sakura_blessing',
        name: 'Sakura Blessing',
        description: 'A special blessing bestowed upon the most dedicated knights of the realm.',
        icon: 'Cherry',
        rewards: [
            { type: 'ICON', value: 'cherry', name: 'Cherry Icon' },
            { type: 'BORDER', value: 'sakura', name: 'Sakura Border' }
        ],
        check: () => false, // Cannot be earned automatically
        hidden: true,
    },
];