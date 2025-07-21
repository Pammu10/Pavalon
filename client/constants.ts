import { Role, Alignment, RoleDescription } from './types';

export const ROLES: Record<Role, { alignment: Alignment, description: string, vision: string, img: string, strategy: string, color: string,  bgColor: string }> = {
    [Role.MERLIN]: {
        alignment: Alignment.GOOD,
        description: "The great wizard who sees all evil players except Mordred. Must guide good while staying hidden.",
        vision: "You see Morgana, the Assassin, Oberon, and Minions as Evil. You do NOT see Mordred.",
        img: "/characters/merlin.png",
        strategy: "Give subtle hints about evil players without revealing yourself. Beware of Mordred!",
        color: "text-blue-600",
      bgColor:
        "bg-gradient-to-br from-blue-600/15 to-blue-800/10 border-2 border-blue-400/40 backdrop-blur-sm",
    },
    [Role.PERCIVAL]: {
        alignment: Alignment.GOOD,
        description: "Sees both Merlin and Morgana but cannot distinguish between them.",
        vision: "You see Merlin and Morgana, but you don't know which is which.",
        img: "/characters/percival.png",
        strategy: "Watch for subtle differences in behavior to identify the real Merlin.",
        color: "text-blue-600",
      bgColor:
        "bg-gradient-to-br from-blue-600/15 to-blue-800/10 border-2 border-blue-400/40 backdrop-blur-sm",
    },
    [Role.LOYAL_SERVANT]: {
        alignment: Alignment.GOOD,
        description: "Loyal servants of Arthur m  ust help complete quests successfully and identify evil players.",
        vision: "You know nothing.",
        img: "/characters/loyal-servant.png",
        strategy: "Pay attention to voting patterns and quest failures to identify evil players.",
        color: "text-blue-600",
      bgColor:
        "bg-gradient-to-br from-blue-600/15 to-blue-800/10 border-2 border-blue-400/40 backdrop-blur-sm",
    },
    [Role.MORGANA]: {
        alignment: Alignment.EVIL,
        description: "The false wizard who appears as Merlin to Percival. Must fail quests and confuse good.",
        vision: "You see your fellow Minions of Mordred, but not Oberon.",
        img: "/characters/morgana.png",
        strategy: "Act like Merlin to confuse Percival while secretly coordinating with evil.",
        color: "text-red-600",
      bgColor:
        "bg-gradient-to-br from-red-600/15 to-red-800/10 border-2 border-red-400/40 backdrop-blur-sm",
    },
    [Role.ASSASSIN]: {
        alignment: Alignment.EVIL,
        description: "You are the evil killer. If the forces of Good succeed on three quests, you have one chance to assassinate Merlin to win.",
        vision: "You see your fellow Minions of Mordred, but not Oberon.",
        img: "/characters/assassin.png",
        strategy: "Your main job is to identify Merlin. Pay attention to who seem to have too much information.",
        color: "text-red-600",
      bgColor:
        "bg-gradient-to-br from-red-600/15 to-red-800/10 border-2 border-red-400/40 backdrop-blur-sm",
    },
    [Role.MORDRED]: {
        alignment: Alignment.EVIL,
        description: "The hidden evil knight unknown to Merlin. Can operate in complete secrecy.",
        vision: "You see your fellow Minions of Mordred, but not Oberon.",
        img: "/characters/mordred.png",
        strategy: "Use your invisibility to Merlin to your advantage. Lead from the shadows.",
        color: "text-red-600",
      bgColor:
        "bg-gradient-to-br from-red-600/15 to-red-800/10 border-2 border-red-400/40 backdrop-blur-sm",
    },
    [Role.OBERON]: {
        alignment: Alignment.EVIL,
        description: "The lone wolf of evil, unknown to other evil players and vice versa.",
        vision: "You know nothing. You appear as Good to Merlin.",
        img: "/characters/oberon.jpg",
        strategy: "Work alone and try to deduce who the other evil players are.",
        color: "text-red-600",
      bgColor:
        "bg-gradient-to-br from-red-600/15 to-red-800/10 border-2 border-red-400/40 backdrop-blur-sm",
    },
    [Role.MINION]: {
        alignment: Alignment.EVIL,
        description: "Standard evil minion. Works with other evil players to fail quests.",
        vision: "You see your fellow Minions of Mordred, but not Oberon.",
        img: "/characters/minion-of-mordred.png",
        strategy: "Coordinate with other evil players and blend in with good players.",
        color: "text-red-600",
      bgColor:
        "bg-gradient-to-br from-red-600/15 to-red-800/10 border-2 border-red-400/40 backdrop-blur-sm",
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