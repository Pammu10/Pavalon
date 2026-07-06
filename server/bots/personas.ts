import { BotPersona } from './types';

export const ALL_PERSONAS: BotPersona[] = [
    // ── EASY ──────────────────────────────────────────────────────────────────
    {
        id: 'elara',
        name: 'Elara',
        difficulty: 'easy',
        preferredAlignment: 'good',
        chatFrequency: 0.85,
        selectedBorder: 'azure',
        timing: {
            ready: [2500, 4500], readyStagger: 500,
            teamSelect: [5000, 8000],
            voteBase: 1800, voteStagger: 700,
            questVote: [1500, 3000],
            assassination: [6000, 9000],
        },
        chatPool: {
            game_start: ["Let's go!! I'm SO ready for this", "Finally, a quest! Let's WIN this thing"],
            became_leader: ["My turn my turn!!", "Okay team I've got this, trust me"],
            on_the_team: ["YES I'm on the team!!", "Let's do this!!"],
            not_on_team: ["Wish I was on it but ok...", "Go team go!!"],
            quest_passed: ["YESSS!! We did it!!", "That's what I'm talking about!!"],
            quest_failed: ["Ugh, someone sabotaged us!!", "Who did that?! We have a traitor!!"],
            team_rejected: ["Aw come on why did we reject that...", "Hmm okay interesting"],
            vote_track_critical: ["We HAVE to approve someone or evil wins!!"],
            assassination_phase: ["Oh no oh no oh no..."],
            game_over_good_wins: ["WE WON!!! Amazing team everyone!!"],
            game_over_evil_wins: ["Nooo... evil wins... :("],
        },
    },
    {
        id: 'rupert',
        name: 'Rupert',
        difficulty: 'easy',
        preferredAlignment: 'evil',
        chatFrequency: 0.75,
        selectedBorder: 'crimson',
        timing: {
            ready: [3000, 5000], readyStagger: 600,
            teamSelect: [5500, 8500],
            voteBase: 2000, voteStagger: 800,
            questVote: [1800, 3200],
            assassination: [6500, 9500],
        },
        chatPool: {
            game_start: ["Hehe let's see how this goes", "Ready! This is gonna be fun"],
            became_leader: ["My pick, my rules! Here we go", "Trust me on this one"],
            on_the_team: ["Awesome, let's make this quest count!"],
            not_on_team: ["Good luck team! You'll need it hehe"],
            quest_passed: ["Good job everyone! Definitely not suspicious at all", "Wow great team pick!"],
            quest_failed: ["Oops! Accidents happen I guess", "Someone made a mistake out there..."],
            team_rejected: ["Interesting choice everyone", "Why the rejection?? Seemed fine to me"],
            vote_track_critical: ["Okay okay we really need to pick someone here"],
            assassination_phase: ["Hmm... who could possibly be Merlin..."],
            game_over_good_wins: ["Congrats good team, well played I guess"],
            game_over_evil_wins: ["Hehe... darkness prevails"],
        },
    },
    {
        id: 'wanderer',
        name: 'The Wanderer',
        difficulty: 'easy',
        preferredAlignment: 'any',
        chatFrequency: 0.70,
        timing: {
            ready: [2800, 4800], readyStagger: 550,
            teamSelect: [5200, 8200],
            voteBase: 1900, voteStagger: 750,
            questVote: [1600, 3100],
            assassination: [6200, 9200],
        },
        chatPool: {
            game_start: ["Ready to quest!", "Let's do this everyone"],
            became_leader: ["Alright, picking my team...", "Here's who I trust"],
            on_the_team: ["I'm on the team! Let's go"],
            not_on_team: ["Rooting for you all", "Good luck out there"],
            quest_passed: ["Nice one!", "That's the way"],
            quest_failed: ["Ouch. Someone failed us", "Not great, not great"],
            team_rejected: ["Hmm, people didn't trust that team"],
            vote_track_critical: ["We need to stop rejecting or we all lose"],
            assassination_phase: ["Big moment here..."],
            game_over_good_wins: ["Good wins! Well played"],
            game_over_evil_wins: ["Evil takes it. Well played to them"],
        },
    },

    // ── MEDIUM ────────────────────────────────────────────────────────────────
    {
        id: 'veyra',
        name: 'Lady Veyra',
        difficulty: 'medium',
        preferredAlignment: 'good',
        chatFrequency: 0.45,
        selectedBorder: 'gold',
        timing: {
            ready: [2000, 3500], readyStagger: 450,
            teamSelect: [3500, 5500],
            voteBase: 2000, voteStagger: 550,
            questVote: [1800, 3000],
            assassination: [5000, 8000],
        },
        chatPool: {
            game_start: ["May we be worthy of Camelot's trust."],
            became_leader: ["I choose carefully. Watch my picks."],
            on_the_team: ["I intend to serve the quest faithfully."],
            not_on_team: ["Watching closely from here."],
            quest_passed: ["Well played. One step closer.", "Good. The realm holds."],
            quest_failed: ["Someone on that team was not who they claimed."],
            team_rejected: ["Curious. Very curious. Why the resistance?"],
            vote_track_critical: ["We cannot afford another rejection."],
            assassination_phase: ["The assassin moves. Choose wisely."],
            game_over_good_wins: ["Justice prevails. Well done, all."],
            game_over_evil_wins: ["We were outplayed. They hid well."],
        },
    },
    {
        id: 'dorian',
        name: 'Dorian',
        difficulty: 'medium',
        preferredAlignment: 'evil',
        chatFrequency: 0.50,
        selectedBorder: 'amethyst',
        timing: {
            ready: [1800, 3200], readyStagger: 430,
            teamSelect: [3200, 5200],
            voteBase: 1900, voteStagger: 530,
            questVote: [1600, 2800],
            assassination: [4800, 7800],
        },
        chatPool: {
            game_start: ["Trust is everything in this game. And I trust all of you."],
            became_leader: ["Let me show you the team I believe in."],
            on_the_team: ["I'll give everything for this quest."],
            not_on_team: ["Go ahead. I believe in this group."],
            quest_passed: ["Excellent. Exactly as expected.", "See? We work well together."],
            quest_failed: ["Someone on that team was reckless. Disappointing."],
            team_rejected: ["Why reject them? We need progress."],
            vote_track_critical: ["We're out of time. Someone step up."],
            assassination_phase: ["Fascinating moment. The endgame approaches."],
            game_over_good_wins: ["Impressive. Good team, well played."],
            game_over_evil_wins: ["As the shadows intended."],
        },
    },
    {
        id: 'halwyn',
        name: 'Brother Halwyn',
        difficulty: 'medium',
        preferredAlignment: 'any',
        chatFrequency: 0.40,
        timing: {
            ready: [2200, 3700], readyStagger: 460,
            teamSelect: [3700, 5700],
            voteBase: 2100, voteStagger: 560,
            questVote: [1900, 3100],
            assassination: [5200, 8200],
        },
        chatPool: {
            game_start: ["Let reason guide us."],
            became_leader: ["I will pick based on what I've observed."],
            on_the_team: ["I'll do what's right for the realm."],
            not_on_team: ["I'll be watching the results carefully."],
            quest_passed: ["Good outcome. The pattern continues.", "Noted."],
            quest_failed: ["A failure. Someone chose poorly or betrayed us."],
            team_rejected: ["The rejection speaks volumes about suspicions."],
            vote_track_critical: ["We must approve or surrender victory."],
            assassination_phase: ["One final deduction required."],
            game_over_good_wins: ["Logic and loyalty prevailed."],
            game_over_evil_wins: ["Evil was more disciplined today."],
        },
    },

    // ── HARD ──────────────────────────────────────────────────────────────────
    {
        id: 'aldric',
        name: 'Aldric',
        difficulty: 'hard',
        preferredAlignment: 'good',
        chatFrequency: 0.15,
        selectedBorder: 'silver',
        timing: {
            ready: [1500, 2500], readyStagger: 350,
            teamSelect: [2500, 4000],
            voteBase: 1200, voteStagger: 400,
            questVote: [1000, 2000],
            assassination: [4000, 7000],
        },
        chatPool: {
            on_the_team: ["Noted. I'll handle my part."],
            not_on_team: ["Watching."],
            quest_failed: ["Noted."],
            team_rejected: ["..."],
            vote_track_critical: ["Approve."],
            game_over_good_wins: ["Expected outcome."],
            game_over_evil_wins: ["They played better."],
        },
    },
    {
        id: 'cressida',
        name: 'Cressida',
        difficulty: 'hard',
        preferredAlignment: 'evil',
        chatFrequency: 0.12,
        selectedBorder: 'obsidian',
        timing: {
            ready: [1400, 2400], readyStagger: 330,
            teamSelect: [2300, 3800],
            voteBase: 1100, voteStagger: 380,
            questVote: [900, 1800],
            assassination: [3800, 6800],
        },
        chatPool: {
            on_the_team: ["Of course I'm on it."],
            not_on_team: ["Fine by me."],
            assassination_phase: ["..."],
            game_over_evil_wins: ["As the fates demanded."],
            vote_track_critical: ["We must proceed."],
        },
    },
];

/**
 * Select personas for bot slots, matching difficulty and preferred alignment.
 * alignments[] = ['good', 'evil', 'good', ...] one per bot slot.
 */
export function selectPersonasForSlots(
    difficulty: 'easy' | 'medium' | 'hard',
    alignments: ('good' | 'evil')[],
): BotPersona[] {
    const pool = ALL_PERSONAS.filter((p) => p.difficulty === difficulty);
    const result: BotPersona[] = [];
    const usedIds = new Set<string>();

    for (const alignment of alignments) {
        // Try preferred alignment first, then 'any', then opposite
        let persona =
            pool.find((p) => p.preferredAlignment === alignment && !usedIds.has(p.id)) ??
            pool.find((p) => p.preferredAlignment === 'any' && !usedIds.has(p.id)) ??
            pool.find((p) => !usedIds.has(p.id)) ??
            pool[result.length % pool.length]; // cycle if exhausted

        result.push(persona);
        usedIds.add(persona.id);
    }

    return result;
}
