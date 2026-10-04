import type { StyleProp, ViewStyle } from 'react-native';

import { ModelView } from './model-view';
import { createFittedScene } from './scene';
import { buildExplorerStatue, buildPodium, buildStatueShelf, buildTrophy, type StatueTier } from './statues';

const TIER_EMOJI: Record<StatueTier, string> = { bronze: '🥉', silver: '🥈', gold: '🥇', crystal: '💎' };

/** One explorer statue on its pedestal. */
export function StatueModel({
  tier,
  backgroundColor,
  style,
  interactive,
}: {
  tier: StatueTier;
  backgroundColor: string;
  style?: StyleProp<ViewStyle>;
  interactive?: boolean;
}) {
  return (
    <ModelView
      sceneKey={`statue-${tier}`}
      createScene={(aspect) => createFittedScene(buildExplorerStatue(tier), aspect)}
      backgroundColor={backgroundColor}
      motion="spin"
      interactive={interactive}
      fallback={TIER_EMOJI[tier]}
      style={style}
    />
  );
}

/** A spinning trophy cup (earned XP). */
export function TrophyModel({ backgroundColor, style }: { backgroundColor: string; style?: StyleProp<ViewStyle> }) {
  return (
    <ModelView
      sceneKey="trophy"
      createScene={(aspect) => createFittedScene(buildTrophy('gold'), aspect)}
      backgroundColor={backgroundColor}
      motion="spin"
      fallback="🏆"
      style={style}
    />
  );
}

/** The ranking podium with statues for the top 3 players. */
export function PodiumModel({
  players,
  backgroundColor,
  style,
}: {
  players: number;
  backgroundColor: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <ModelView
      sceneKey={`podium-${players}`}
      createScene={(aspect) => createFittedScene(buildPodium(players), aspect, { elevation: 14, padding: 1.05 })}
      backgroundColor={backgroundColor}
      motion="none"
      fallback="🏆"
      style={style}
    />
  );
}

/** The user's statue collection (current statue turns, locked ones are grey). */
export function StatueShelfModel({
  current,
  backgroundColor,
  style,
}: {
  current: StatueTier;
  backgroundColor: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <ModelView
      sceneKey={`shelf-${current}`}
      createScene={(aspect) => createFittedScene(buildStatueShelf(current), aspect, { elevation: 12, padding: 1.02 })}
      backgroundColor={backgroundColor}
      motion="none"
      fallback={TIER_EMOJI[current]}
      style={style}
    />
  );
}
