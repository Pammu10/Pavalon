import { TutorialStep } from './types';

export const TUTORIAL_STEPS: TutorialStep[] = [
    {
        step: 1,
        title: "Welcome to Pavalon!",
        text: "This interactive tutorial will guide you through a real round of the game. First, let's look at your assigned role.",
        highlight: ['player-info-bar'],
        actionRequired: 'playerReady',
        actionText: 'Tap the "Ready" button below to see your role',
    },
    {
        step: 2,
        title: "Your Role: Merlin",
        text: "You are <b>Merlin</b>! You can see who the Evil players are. Use your <b>Vision</b> to identify them — but stay hidden or the Assassin will target you.",
        highlight: ['role-reveal-card', 'role-vision'],
        actionRequired: 'playerReady',
        actionText: 'Tap "Ready" when you\'ve memorised your role',
    },
    {
        step: 3,
        title: "Team Selection",
        text: "You are the Quest Leader! Select <b>2 players</b> for the quest by tapping their tiles. Pick yourself and Bot Alice (a Good player).",
        highlight: ['player-grid', 'propose-team-button'],
        actionRequired: 'selectTeam',
        actionText: 'Tap 2 player tiles to select them, then tap "Propose Team"',
    },
    {
        step: 4,
        title: "Vote on the Team",
        text: "All players must vote on whether to approve or reject the proposed team. Since this is a Good team, vote <b>Approve</b>.",
        highlight: ['team-vote-buttons'],
        actionRequired: 'voteOnTeam',
        actionText: 'Tap "Approve" to vote for this team',
    },
    {
        step: 5,
        title: "Quest Vote",
        text: "The team was approved! As a Good player on the quest, you <b>must</b> vote <b>Success</b>. Only Evil players can sabotage quests.",
        highlight: ['quest-vote-buttons'],
        actionRequired: 'voteOnQuest',
        actionText: 'Tap "Success" to complete the quest',
    },
    {
        step: 6,
        title: "Quest Result",
        text: "The quest passed! Good needs <b>3 successful quests</b> to win. If 3 quests fail, Evil wins instantly. Watch the progress bar above.",
        highlight: ['quest-progress-bar'],
    },
    {
        step: 7,
        title: "You're Ready!",
        text: "You've learned team selection, voting, and quests. The full game adds more roles, deeper bluffing, and an assassination round. Good luck!",
        isFinalStep: true,
    },
];
