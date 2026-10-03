import type { StyleProp, ViewStyle } from 'react-native';

import type { ModelKind } from '@/api/types';

import { ModelView } from './model-view';
import { createModelScene } from './scene';

const FALLBACK_EMOJI: Record<ModelKind, string> = {
  barbican: '🏰',
  basilica: '⛪',
  clothhall: '🏛️',
  tower: '🗼',
  castle: '🏯',
  dragon: '🐉',
  synagogue: '🕍',
  bridge: '🌉',
  church: '⛪',
  twintower: '⛪',
  domechurch: '⛪',
  chapel: '⛪',
  orthodox: '☦️',
  synagogue2: '🕍',
  synagogue3: '🕍',
  museum: '🏛️',
  gallery: '🖼️',
  townhouse: '🏘️',
  palace: '🏛️',
  college: '🎓',
  gate: '🏰',
  wallgate: '🧱',
  statue: '🗿',
  rider: '🐎',
  bust: '🗿',
  theatre: '🎭',
  theatre2: '🎭',
  cave: '🕳️',
  generic: '📍',
};

interface Props {
  kind: ModelKind;
  /** Colour behind the model (also used as the GL clear colour). */
  backgroundColor: string;
  /** Spin continuously. Static models render once, which saves battery on the roadmap. */
  animate?: boolean;
  /** Grey "locked" version. */
  locked?: boolean;
  /** Let the user drag to spin the model. */
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * A rotating low-poly 3D mini-model of a landmark, rendered with three.js
 * on top of expo-gl (works on iOS, Android and web).
 */
export function LandmarkModel({ kind, backgroundColor, animate = true, locked = false, interactive = false, style }: Props) {
  return (
    <ModelView
      sceneKey={`${kind}-${locked}`}
      createScene={(aspect) => createModelScene(kind, aspect, locked)}
      backgroundColor={backgroundColor}
      motion={animate ? 'spin' : 'none'}
      interactive={interactive}
      fallback={FALLBACK_EMOJI[kind]}
      style={style}
    />
  );
}
