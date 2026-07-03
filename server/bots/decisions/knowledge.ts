import { Player, Role, Alignment } from '../../types';

/** What this bot's role lets it know about other players */
export function getKnownEvil(bot: Player, players: Player[]): Player[] {
    switch (bot.role) {
        case Role.MERLIN:
            // Merlin sees all Evil except Mordred
            return players.filter(
                (p) => p.id !== bot.id && p.alignment === Alignment.EVIL && p.role !== Role.MORDRED,
            );
        case Role.MORGANA:
        case Role.ASSASSIN:
        case Role.MORDRED:
        case Role.MINION:
            // Evil team sees each other, except Oberon is invisible to them
            return players.filter(
                (p) => p.id !== bot.id && p.alignment === Alignment.EVIL && p.role !== Role.OBERON,
            );
        default:
            // Loyal Servant, Percival, Oberon see nobody as Evil
            return [];
    }
}

/** Percival sees Merlin + Morgana as indistinguishable "Mystics" */
export function getKnownMystics(bot: Player, players: Player[]): Player[] {
    if (bot.role !== Role.PERCIVAL) return [];
    return players.filter((p) => p.role === Role.MERLIN || p.role === Role.MORGANA);
}

export function isBot(player: Player): boolean {
    return player.userId < 0;
}
