import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../models/models.dart';

/// Ports of client/constants.ts — must stay in sync with the server.

class RoleInfo {
  final Alignment2 alignment;
  final String description;
  final String vision;
  final String strategy;
  final String img;
  const RoleInfo(
      this.alignment, this.description, this.vision, this.strategy, this.img);
}

const Map<Role, RoleInfo> kRoles = {
  Role.merlin: RoleInfo(
    Alignment2.good,
    'The great wizard who sees all evil players except Mordred. Must guide good while staying hidden.',
    'You see Morgana, the Assassin, Oberon, and Minions as Evil. You do NOT see Mordred.',
    'Give subtle hints about evil players without revealing yourself. Beware of Mordred!',
    'assets/characters/merlin.jpg',
  ),
  Role.percival: RoleInfo(
    Alignment2.good,
    'Sees both Merlin and Morgana but cannot distinguish between them.',
    "You see Merlin and Morgana, but you don't know which is which.",
    'Watch for subtle differences in behavior to identify the real Merlin.',
    'assets/characters/percival.jpg',
  ),
  Role.loyalServant: RoleInfo(
    Alignment2.good,
    'Loyal servants of Arthur must help complete quests successfully and identify evil players.',
    'You know nothing.',
    'Pay attention to voting patterns and quest failures to identify evil players.',
    'assets/characters/loyal-servant.jpg',
  ),
  Role.morgana: RoleInfo(
    Alignment2.evil,
    'The false wizard who appears as Merlin to Percival. Must fail quests and confuse good.',
    'You see your fellow Minions of Mordred, but not Oberon.',
    'Act like Merlin to confuse Percival while secretly coordinating with evil.',
    'assets/characters/morgana.jpg',
  ),
  Role.assassin: RoleInfo(
    Alignment2.evil,
    'You are the evil killer. If the forces of Good succeed on three quests, you have one chance to assassinate Merlin to win.',
    'You see your fellow Minions of Mordred, but not Oberon.',
    'Your main job is to identify Merlin. Pay attention to who seems to have too much information.',
    'assets/characters/assassin.jpg',
  ),
  Role.mordred: RoleInfo(
    Alignment2.evil,
    'The hidden evil knight unknown to Merlin. Can operate in complete secrecy.',
    'You see your fellow Minions of Mordred, but not Oberon.',
    'Use your invisibility to Merlin to your advantage. Lead from the shadows.',
    'assets/characters/mordred.jpg',
  ),
  Role.oberon: RoleInfo(
    Alignment2.evil,
    'The lone wolf of evil, unknown to other evil players and vice versa.',
    'You know nothing. You appear as Good to Merlin.',
    'Work alone and try to deduce who the other evil players are.',
    'assets/characters/oberon.jpg',
  ),
  Role.minion: RoleInfo(
    Alignment2.evil,
    'Standard evil minion. Works with other evil players to fail quests.',
    'You see your fellow Minions of Mordred, but not Oberon.',
    'Coordinate with other evil players and blend in with good players.',
    'assets/characters/minion-of-mordred.jpg',
  ),
};

const Map<int, int> kEvilPlayerCount = {5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4};

class QuestConfig {
  final int teamSize;
  final int failsRequired;
  const QuestConfig(this.teamSize, this.failsRequired);
}

const Map<int, List<QuestConfig>> kQuestConfigurations = {
  5: [QuestConfig(2, 1), QuestConfig(3, 1), QuestConfig(2, 1), QuestConfig(3, 1), QuestConfig(3, 1)],
  6: [QuestConfig(2, 1), QuestConfig(3, 1), QuestConfig(4, 1), QuestConfig(3, 1), QuestConfig(4, 1)],
  7: [QuestConfig(2, 1), QuestConfig(3, 1), QuestConfig(3, 1), QuestConfig(4, 2), QuestConfig(4, 1)],
  8: [QuestConfig(3, 1), QuestConfig(4, 1), QuestConfig(4, 1), QuestConfig(5, 2), QuestConfig(5, 1)],
  9: [QuestConfig(3, 1), QuestConfig(4, 1), QuestConfig(4, 1), QuestConfig(5, 2), QuestConfig(5, 1)],
  10: [QuestConfig(3, 1), QuestConfig(4, 1), QuestConfig(4, 1), QuestConfig(5, 2), QuestConfig(5, 1)],
};

// Must stay in sync with server constants.ts ALLOWED_EMOTES.
const kEmoteEmojis = ['👍', '👎', '😂', '🤔', '😱', '😈', '👀', '🤥', '⚔️', '🛡️', '❤️', '🔥'];
const kEmotePhrases = [
  'Trust me!', "I'm good!", 'Sus...', 'Liar!', 'Nice one!', 'Hmm...',
  'Take me!', 'Bold move.', 'I knew it!', 'GG!',
];

/// Profile icon names → glyphs (mirrors AvailableIcons.tsx).
const Map<String, IconData> kIconMap = {
  'gem': LucideIcons.gem,
  'scroll': LucideIcons.scroll,
  'ghost': LucideIcons.ghost,
  'zap': LucideIcons.zap,
  'axe': LucideIcons.axe,
  'bookheart': LucideIcons.heart,
  'keyround': LucideIcons.keyRound,
  'sun': LucideIcons.sun,
  'moonstar': LucideIcons.moonStar,
  'spade': LucideIcons.spade,
  'shield': LucideIcons.shield,
  'swords': LucideIcons.swords,
  'trophy': LucideIcons.trophy,
  'crown': LucideIcons.crown,
  'castle': LucideIcons.castle,
  'shieldcheck': LucideIcons.shieldCheck,
  'heartcrack': LucideIcons.heartCrack,
  'eye': LucideIcons.eye,
  'skull': LucideIcons.skull,
  'star': LucideIcons.star,
  'feather': LucideIcons.feather,
  'cherry': LucideIcons.cherry,
};

const kDefaultIcons = [
  'gem', 'scroll', 'ghost', 'zap', 'axe', 'bookheart', 'keyround', 'sun',
  'moonstar', 'spade',
];

/// Background names → bundled asset (web served `/background/<name>.png`).
const Map<String, String> kBackgrounds = {
  'goodguy': 'assets/background/goodguy.jpg',
  'badguy': 'assets/background/badguy.jpg',
  'forestday': 'assets/background/forestday.jpg',
  'forestnight': 'assets/background/forestnight.jpg',
  'bluedrag': 'assets/background/bluedrag.jpg',
  'reddrag': 'assets/background/reddrag.jpg',
  'purpledrag': 'assets/background/purpledrag.jpg',
  'chair': 'assets/background/chair.jpg',
  'cherry': 'assets/background/cherry.jpg',
  'dark': 'assets/background/dark.jpg',
  'fire': 'assets/background/fire.jpg',
  'ice': 'assets/background/ice.jpg',
  'king': 'assets/background/king.jpg',
  'light': 'assets/background/light.jpg',
  'pool': 'assets/background/pool.jpg',
  'tournament': 'assets/background/tournament.jpg',
};

const kDefaultBackgrounds = ['goodguy', 'badguy', 'forestday', 'forestnight'];

const kGameTips = [
  'Merlin is powerful but vulnerable. Good must protect him at all costs.',
  'As Evil, voting to approve a team with another evil player can build trust with Good.',
  "Percival's challenge is to distinguish Merlin from Morgana through their actions.",
  'Pay attention to who votes on which teams. Patterns can reveal alignments.',
  'Failing a quest with two fail votes when only one is needed can expose evil players.',
  'As a Loyal Servant, your vote and voice are your greatest weapons. Speak up!',
];
