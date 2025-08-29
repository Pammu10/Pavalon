import { TutorialStep } from './types';

export const TUTORIAL_STEPS: TutorialStep[] = [
    {
        step: 1,
        title: "Welcome to Pavalon!",
        text: "This interactive tutorial will guide you through a round of the game. Let's start by looking at your assigned role for this match.",
        highlight: ['player-info-bar'],
        actionRequired: 'playerReady',
    },
    {
        step: 2,
        title: "Your Role: Merlin",
        text: "You are <b>Merlin</b>! You can see who the Evil players are. Use your <b>Vision</b> to identify them. Your goal is to guide Good to victory without being assassinated.",
        highlight: ['role-reveal-card', 'role-vision'],
        actionRequired: 'playerReady',
    },
    {
        step: 3,
        title: "Team Selection",
        text: "You are the Quest Leader! You must select <b>2 players</b> for the quest. Since you are Merlin, you should pick yourself and another Good player (like Bot Alice).",
        highlight: ['player-grid', 'propose-team-button'],
        actionRequired: 'selectTeam',
    },
    {
        step: 4,
        title: "Team Vote",
        text: "The team has been proposed. Now, all players vote. Since you proposed a Good team, you should <b>Approve</b> it.",
        highlight: ['team-vote-buttons'],
        actionRequired: 'voteOnTeam',
    },
    {
        step: 5,
        title: "Quest Vote",
        text: "The team was approved! As a Good player on a quest, you <b>must</b> vote for <b>Success</b>. Evil players can choose to Fail.",
        highlight: ['quest-vote-buttons'],
        actionRequired: 'voteOnQuest',
    },
    {
        step: 6,
        title: "Quest Result",
        text: "The quest has passed! Three successful quests are needed for Good to win. If three quests fail, Evil wins instantly. Click Next to continue.",
        highlight: ['quest-progress-bar'],
    },
    {
        step: 7,
        title: "Tutorial Complete!",
        text: "You've learned the basics of selecting teams and voting on quests! The full game has more roles and deeper strategy. You're ready to join a real game. Good luck!",
        isFinalStep: true,
    },
];
