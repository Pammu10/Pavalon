import React from 'react';
import { 
    Shield, 
    Swords, 
    Crown, 
    Skull, 
    Gem, 
    Castle, 
    Scroll, 
    Ghost, 
    Zap, 
    HeartCrack, 
    Feather, 
    Sun, 
    MoonStar,
    Axe,
    BookHeart,
    KeyRound,
    Spade,
    Eye,
    Star,
    ShieldCheck,
    Trophy,
    Cherry
} from 'lucide-react';

// Default icons available to everyone
export const DEFAULT_ICONS_MAP: { [key: string]: React.FC<any> } = {
  gem: Gem,
  scroll: Scroll,
  ghost: Ghost,
  zap: Zap,
  axe: Axe,
  bookheart: BookHeart,
  keyround: KeyRound,
  sun: Sun,
  moonstar: MoonStar,
  spade: Spade,
};
export const DEFAULT_ICONS = Object.keys(DEFAULT_ICONS_MAP);

// Icons unlocked via achievements
export const ACHIEVEMENT_ICONS_MAP: { [key: string]: React.FC<any> } = {
  shield: Shield,
  swords: Swords,
  trophy: Trophy,
  crown: Crown,
  castle: Castle,
  shieldcheck: ShieldCheck,
  heartcrack: HeartCrack,
  eye: Eye,
  skull: Skull,
  star: Star,
  feather: Feather,
  cherry: Cherry,
};
export const ACHIEVEMENT_ICONS = Object.keys(ACHIEVEMENT_ICONS_MAP);

// Combined map for rendering
export const ICON_MAP = { ...DEFAULT_ICONS_MAP, ...ACHIEVEMENT_ICONS_MAP };
export const AVAILABLE_ICONS = [...DEFAULT_ICONS, ...ACHIEVEMENT_ICONS];