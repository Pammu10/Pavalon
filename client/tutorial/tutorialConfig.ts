import { GameState, GamePhase, Role, Alignment, Player, Quest, TutorialStep } from "@/types";

const mockPlayers: Player[] = [
    { id: 'player-1', userId: 1, name: 'You', role: Role.MERLIN, alignment: Alignment.GOOD, isHost: true, hasVoted: false, status: 'CONNECTED', selectedIcon: 'gem' },
    { id: 'player-2', userId: 2, name: 'Alice', role: Role.PERCIVAL, alignment: Alignment.GOOD, isHost: false, hasVoted: false, status: 'CONNECTED', selectedIcon: 'star' },
    { id: 'player-3', userId: 3, name: 'Bob', role: Role.LOYAL_SERVANT, alignment: Alignment.GOOD, isHost: false, hasVoted: false, status: 'CONNECTED', selectedIcon: 'shield' },
    { id: 'player-4', userId: 4, name: 'Charlie', role: Role.MORGANA, alignment: Alignment.EVIL, isHost: false, hasVoted: false, status: 'CONNECTED', selectedIcon: 'feather' },
    { id: 'player-5', userId: 5, name: 'Diana', role: Role.ASSASSIN, alignment: Alignment.EVIL, isHost: false, hasVoted: false, status: 'CONNECTED', selectedIcon: 'skull' },
];

export const getInitialTutorialState = (): GameState => ({
    roomCode: 'TUTORIAL',
    players: mockPlayers.map(p => ({...p})), // Create copies to avoid mutation issues
    phase: GamePhase.LOBBY,
    currentQuest: 1,
    questHistory: [
        { questNumber: 1, teamSize: 2, failsRequired: 1, status: 'ACTIVE', team: [], votes: [], results: [], pastVotes: [], questLeader: null, approvedVote: null },
        { questNumber: 2, teamSize: 3, failsRequired: 1, status: 'PENDING', team: [], votes: [], results: [], pastVotes: [], questLeader: null, approvedVote: null },
        { questNumber: 3, teamSize: 2, failsRequired: 1, status: 'PENDING', team: [], votes: [], results: [], pastVotes: [], questLeader: null, approvedVote: null },
        { questNumber: 4, teamSize: 3, failsRequired: 1, status: 'PENDING', team: [], votes: [], results: [], pastVotes: [], questLeader: null, approvedVote: null },
        { questNumber: 5, teamSize: 3, failsRequired: 1, status: 'PENDING', team: [], votes: [], results: [], pastVotes: [], questLeader: null, approvedVote: null },
    ],
    leader: mockPlayers[0],
    voteTrack: 0,
    winner: null,
    endGameReason: '',
    chat: [],
    gameLog: [],
    readyPlayers: [],
    endGameReadyPlayers: [],
    reconnectingPlayer: null,
    restartVote: null,
    lastRestartInitiatedAt: null,
    pendingTeam: null,
    dragonsBreathState: null,
    assassinationTargetId: null,
    selectedRoles: [],
});

export const tutorialSteps: TutorialStep[] = [
    // --- ROLE REVEAL ---
    {
        phase: GamePhase.ROLE_REVEAL,
        elementId: 'role-reveal-card',
        title: 'Your Identity',
        content: "At the start of each game, you're secretly assigned a role and alignment. This is who you are for the entire match. Read your abilities carefully!",
        position: 'bottom',
    },
    {
        phase: GamePhase.ROLE_REVEAL,
        elementId: 'role-vision',
        title: 'Your Vision',
        content: "Some roles, like Merlin, can see other evil players. This is your most critical information. Your teammates cannot see this!",
        position: 'top',
    },
    // --- TEAM SELECTION ---
    {
        phase: GamePhase.TEAM_SELECTION,
        elementId: 'quest-progress-bar',
        title: 'Quest Progress',
        content: "This tracks the game's progress. The Good team wins by successfully completing 3 quests. The Evil team wins if 3 quests fail.",
        position: 'bottom'
    },
    {
        phase: GamePhase.TEAM_SELECTION,
        elementId: 'player-info-bar',
        title: 'Player Info',
        content: 'This bar shows your name, role, and provides quick access to your Vision. Other players cannot see your role!',
        position: 'bottom'
    },
    {
        phase: GamePhase.TEAM_SELECTION,
        elementId: 'player-grid',
        title: 'Quest Leader Selects a Team',
        content: "The current Quest Leader (marked with a crown) must select the required number of players to send on a quest. Since you are the leader in this tutorial, select two players (e.g., Alice and Bob).",
        position: 'bottom',
        mockStateChange: (state) => ({ ...state, leader: state.players.find(p => p.id === 'player-1')! })
    },
    // --- TEAM VOTE ---
    {
        phase: GamePhase.TEAM_VOTE,
        elementId: 'team-vote-buttons',
        title: 'Vote on the Team',
        content: "All players now vote on whether to APPROVE or REJECT the proposed team. A majority is needed. Use the swipe card to cast your vote.",
        position: 'top',
        mockStateChange: (state) => {
            const newState = { ...state };
            newState.questHistory[0].team = [newState.players.find(p => p.id === 'player-1')!, newState.players.find(p => p.id === 'player-2')!];
            newState.players.forEach(p => p.hasVoted = false);
            return newState;
        }
    },
    // --- QUEST VOTE ---
    {
        phase: GamePhase.QUEST_VOTE,
        elementId: 'quest-vote-buttons',
        title: 'Vote on the Quest',
        content: "The team was approved! Now, only the players on the quest vote for its outcome. As a Good player, you MUST vote SUCCESS. Evil players can choose to FAIL the quest.",
        position: 'top',
        mockStateChange: (state) => {
            const newState = { ...state };
            // Robustly set the team to ensure the user is on it for this step.
            const team = [
                newState.players.find(p => p.id === 'player-1')!, 
                newState.players.find(p => p.id === 'player-2')!
            ];
            newState.questHistory[0].team = team;
            newState.voteTrack = 0;
            newState.questHistory[0].votes = [
                { playerId: 'player-1', vote: 'APPROVE' },
                { playerId: 'player-2', vote: 'APPROVE' },
                { playerId: 'player-3', vote: 'REJECT' },
                { playerId: 'player-4', vote: 'APPROVE' },
                { playerId: 'player-5', vote: 'APPROVE' },
            ];
            newState.questHistory[0].approvedVote = { team: team, votes: newState.questHistory[0].votes };
            newState.players.forEach(p => p.hasVoted = false); // Reset for quest vote
            return newState;
        }
    },
    // --- ASSASSINATION ---
    {
        phase: GamePhase.ASSASSINATION,
        elementId: 'quest-progress-bar',
        title: 'Three Quests Passed!',
        content: "The Good team has successfully completed three quests! This usually triggers the final phase, where Evil gets one last chance to win.",
        position: 'bottom',
        mockStateChange: (state) => {
            const newState = { ...state };
            newState.questHistory[0].status = 'PASSED';
            newState.questHistory[1].status = 'PASSED';
            newState.questHistory[2].status = 'PASSED';
            
            // To ensure the user can experience the assassination, we'll make them the assassin.
            // We find the original assassin and swap roles.
            const userPlayerIndex = newState.players.findIndex(p => p.id === 'player-1');
            const assassinPlayer = newState.players.find(p => p.role === Role.ASSASSIN);
            
            if (userPlayerIndex !== -1 && assassinPlayer && newState.players[userPlayerIndex].id !== assassinPlayer.id) {
                const assassinPlayerIndex = newState.players.findIndex(p => p.id === assassinPlayer.id);

                // Safely swap roles and alignments
                const userOriginalRole = newState.players[userPlayerIndex].role;
                const userOriginalAlignment = newState.players[userPlayerIndex].alignment;
                
                newState.players[userPlayerIndex].role = assassinPlayer.role;
                newState.players[userPlayerIndex].alignment = assassinPlayer.alignment;

                newState.players[assassinPlayerIndex].role = userOriginalRole;
                newState.players[assassinPlayerIndex].alignment = userOriginalAlignment;
            }
            return newState;
        }
    },
    {
        phase: GamePhase.ASSASSINATION,
        elementId: 'assassination-grid',
        title: 'The Assassin Strikes',
        content: "Now, the Assassin must choose a player to eliminate. If they choose Merlin, Evil wins. As the Assassin for this tutorial, select any Good player to see what happens.",
        position: 'top',
    },
    // --- END GAME ---
    {
        phase: GamePhase.END_GAME,
        elementId: 'profile-customization-card', // A non-existent element, so it centers
        title: 'You\'ve Learned the Basics!',
        content: "That's the flow of a game of Pavalon! Use your deduction skills and knowledge of the roles to lead your team to victory. You can end the tutorial now.",
        position: 'center',
        mockStateChange: (state) => ({ 
            ...state,
            winner: Alignment.GOOD,
            endGameReason: "The Assassin chose poorly. Merlin survives!"
        })
    },
];