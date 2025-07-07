import { Role, Alignment, RoleDescription } from './types';

export const ROLES: Record<Role, { alignment: Alignment, description: string, vision: string }> = {
    [Role.MERLIN]: {
        alignment: Alignment.GOOD,
        description: "You know who the forces of Evil are, but you must hide your identity. If the Assassin discovers you, Good loses.",
        vision: "You see Morgana, the Assassin, Oberon, and Minions as Evil. You do NOT see Mordred."
    },
    [Role.PERCIVAL]: {
        alignment: Alignment.GOOD,
        description: "You see two people who appear to be Merlin. One is the true Merlin, the other is the deceptive Morgana.",
        vision: "You see Merlin and Morgana, but you don't know which is which."
    },
    [Role.LOYAL_SERVANT]: {
        alignment: Alignment.GOOD,
        description: "You are a loyal knight of Arthur. Find and support your fellow loyalists to complete the quests.",
        vision: "You know nothing."
    },
    [Role.MORGANA]: {
        alignment: Alignment.EVIL,
        description: "You appear as Merlin to Percival. Use this to deceive him and sow chaos among the ranks of Good.",
        vision: "You see your fellow Minions of Mordred, but not Oberon."
    },
    [Role.ASSASSIN]: {
        alignment: Alignment.EVIL,
        description: "You are a hidden killer. If the forces of Good succeed on three quests, you have one chance to assassinate Merlin to win.",
        vision: "You see your fellow Minions of Mordred, but not Oberon."
    },
    [Role.MORDRED]: {
        alignment: Alignment.EVIL,
        description: "Your identity is hidden from Merlin. You are the true mastermind behind the plot to destroy Camelot.",
        vision: "You see your fellow Minions of Mordred, but not Oberon."
    },
    [Role.OBERON]: {
        alignment: Alignment.EVIL,
        description: "You are a servant of evil, but your identity is hidden from both Good and Evil. You do not know who your allies are.",
        vision: "You know nothing. You appear as Good to Merlin."
    },
    [Role.MINION]: {
        alignment: Alignment.EVIL,
        description: "You are a loyal follower of Mordred. Your job is to fail quests and identify Merlin for the Assassin.",
        vision: "You see your fellow Minions of Mordred, but not Oberon."
    }
};

// Defines the number of evil players for a given number of total players.
export const EVIL_PLAYER_COUNT: Record<number, number> = {
    5: 2,
    6: 2,
    7: 3,
    8: 3,
    9: 3,
    10: 4,
};


export const ROLE_CONFIGURATIONS: Record<number, Role[]> = {
    5: [Role.MERLIN, Role.PERCIVAL, Role.LOYAL_SERVANT, Role.MORGANA, Role.ASSASSIN],
    6: [Role.MERLIN, Role.PERCIVAL, Role.LOYAL_SERVANT, Role.LOYAL_SERVANT, Role.MORGANA, Role.ASSASSIN],
    7: [Role.MERLIN, Role.PERCIVAL, Role.LOYAL_SERVANT, Role.LOYAL_SERVANT, Role.MORGANA, Role.ASSASSIN, Role.MINION],
    8: [Role.MERLIN, Role.PERCIVAL, Role.LOYAL_SERVANT, Role.LOYAL_SERVANT, Role.LOYAL_SERVANT, Role.MORGANA, Role.ASSASSIN, Role.MINION],
    9: [Role.MERLIN, Role.PERCIVAL, Role.LOYAL_SERVANT, Role.LOYAL_SERVANT, Role.LOYAL_SERVANT, Role.LOYAL_SERVANT, Role.MORDRED, Role.MORGANA, Role.ASSASSIN],
    10: [Role.MERLIN, Role.PERCIVAL, Role.LOYAL_SERVANT, Role.LOYAL_SERVANT, Role.LOYAL_SERVANT, Role.LOYAL_SERVANT, Role.MORDRED, Role.MORGANA, Role.ASSASSIN, Role.MINION],
};

export const QUEST_CONFIGURATIONS: Record<number, { teamSize: number; failsRequired: number }[]> = {
    5: [{ teamSize: 2, failsRequired: 1 }, { teamSize: 3, failsRequired: 1 }, { teamSize: 2, failsRequired: 1 }, { teamSize: 3, failsRequired: 1 }, { teamSize: 3, failsRequired: 1 }],
    6: [{ teamSize: 2, failsRequired: 1 }, { teamSize: 3, failsRequired: 1 }, { teamSize: 4, failsRequired: 1 }, { teamSize: 3, failsRequired: 1 }, { teamSize: 4, failsRequired: 1 }],
    7: [{ teamSize: 2, failsRequired: 1 }, { teamSize: 3, failsRequired: 1 }, { teamSize: 3, failsRequired: 1 }, { teamSize: 4, failsRequired: 2 }, { teamSize: 4, failsRequired: 1 }],
    8: [{ teamSize: 3, failsRequired: 1 }, { teamSize: 4, failsRequired: 1 }, { teamSize: 4, failsRequired: 1 }, { teamSize: 5, failsRequired: 2 }, { teamSize: 5, failsRequired: 1 }],
    9: [{ teamSize: 3, failsRequired: 1 }, { teamSize: 4, failsRequired: 1 }, { teamSize: 4, failsRequired: 1 }, { teamSize: 5, failsRequired: 2 }, { teamSize: 5, failsRequired: 1 }],
    10: [{ teamSize: 3, failsRequired: 1 }, { teamSize: 4, failsRequired: 1 }, { teamSize: 4, failsRequired: 1 }, { teamSize: 5, failsRequired: 2 }, { teamSize: 5, failsRequired: 1 }],
};