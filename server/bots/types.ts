import { BotDifficulty } from '../types';

export type { BotDifficulty };

export type ChatTrigger =
    | 'game_start'
    | 'became_leader'
    | 'on_the_team'
    | 'not_on_team'
    | 'quest_passed'
    | 'quest_failed'
    | 'team_rejected'
    | 'vote_track_critical'
    | 'assassination_phase'
    | 'game_over_good_wins'
    | 'game_over_evil_wins';

export interface TimingProfile {
    ready: [number, number];
    readyStagger: number;
    teamSelect: [number, number];
    voteBase: number;
    voteStagger: number;
    questVote: [number, number];
    assassination: [number, number];
}

export interface BotPersona {
    id: string;
    name: string;
    difficulty: BotDifficulty;
    preferredAlignment: 'good' | 'evil' | 'any';
    chatFrequency: number;
    chatPool: Partial<Record<ChatTrigger, string[]>>;
    timing: TimingProfile;
    selectedBorder?: string;
    selectedIcon?: string;
}

export interface IBotGameActions {
    handlePlayerReady(botId: string): void;
    handleSelectTeam(botId: string, teamPlayerIds: string[]): void;
    handleVoteOnTeam(botId: string, vote: 'APPROVE' | 'REJECT'): void;
    handleVoteOnQuest(botId: string, vote: 'SUCCESS' | 'FAIL'): void;
    handleAssassinate(botId: string, targetId: string): Promise<void>;
    handleSendMessage(botId: string, text: string): void;
    handlePlayerReadyForNextGame(botId: string): void;
}
