/**
 * Low-poly 3D statues and trophies for the reward system:
 *  - an explorer statue in bronze / silver / gold / crystal (unlocked by level),
 *  - a trophy cup (shown when you earn XP),
 *  - the ranking podium with the top 3 players' statues,
 *  - the profile shelf with your statue collection.
 * Built from simple shapes, like the landmark models (no model files).
 */
import * as THREE from 'three';

export type StatueTier = 'bronze' | 'silver' | 'gold' | 'crystal';

export const STATUE_TIERS: StatueTier[] = ['bronze', 'silver', 'gold', 'crystal'];

/** Level needed to unlock each statue. */
export const TIER_MIN_LEVEL: Record<StatueTier, number> = { bronze: 1, silver: 3, gold: 5, crystal: 7 };

export function tierForLevel(level: number): StatueTier {
  if (level >= TIER_MIN_LEVEL.crystal) return 'crystal';
  if (level >= TIER_MIN_LEVEL.gold) return 'gold';
  if (level >= TIER_MIN_LEVEL.silver) return 'silver';
  return 'bronze';
}

const TIER_COLOR: Record<StatueTier, number> = {
  bronze: 0xcd7f32,
  silver: 0xc9d3df,
  gold: 0xffc83d,
  crystal: 0x7fe7ff,
};

const STONE = 0x3a4860;
const STONE_LIGHT = 0x4c5d78;

// Shared materials (shiny metal, flat-shaded for the low-poly look)
const metalMats = new Map<string, THREE.Material>();
function metal(tier: StatueTier | 'grey'): THREE.Material {
  let m = metalMats.get(tier);
  if (!m) {
    const color = tier === 'grey' ? 0x6b7a93 : TIER_COLOR[tier];
    m = new THREE.MeshPhongMaterial({
      color,
      specular: tier === 'grey' ? 0x222222 : 0xffffff,
      shininess: tier === 'crystal' ? 120 : 70,
      emissive: tier === 'crystal' ? 0x0d3a44 : 0x000000,
      flatShading: true,
      side: THREE.DoubleSide,
    });
    metalMats.set(tier, m);
  }
  return m;
}
const stoneMats = new Map<number, THREE.Material>();
function stone(color: number): THREE.Material {
  let m = stoneMats.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, flatShading: true });
    stoneMats.set(color, m);
  }
  return m;
}

function mesh(geo: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  return m;
}
/** Box with its bottom at y. */
const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) =>
  mesh(new THREE.BoxGeometry(w, h, d), m, x, y + h / 2, z);
/** Cylinder with its bottom at y. */
const cyl = (rt: number, rb: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 10) =>
  mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y + h / 2, z);

/** Stone pedestal with a metal plaque; returns its height. */
function pedestal(g: THREE.Group, plaque: THREE.Material): number {
  g.add(box(0.95, 0.12, 0.95, stone(STONE)));
  g.add(box(0.74, 0.5, 0.74, stone(STONE_LIGHT), 0, 0.12));
  g.add(box(0.86, 0.08, 0.86, stone(STONE), 0, 0.62));
  g.add(box(0.4, 0.16, 0.02, plaque, 0, 0.3, 0.38));
  return 0.7;
}

/**
 * An explorer with a hat, a backpack and a raised flag.
 * @param withPedestal stand on a stone pedestal (false on the podium)
 */
export function buildExplorerStatue(tier: StatueTier | 'grey', withPedestal = true): THREE.Group {
  const root = new THREE.Group();
  const m = metal(tier);
  const y0 = withPedestal ? pedestal(root, m) : 0;
  const figure = new THREE.Group();
  figure.position.y = y0;
  // legs
  figure.add(box(0.13, 0.5, 0.16, m, -0.1, 0));
  figure.add(box(0.13, 0.5, 0.16, m, 0.1, 0));
  // coat and chest
  figure.add(cyl(0.2, 0.27, 0.32, m, 0, 0.42));
  figure.add(cyl(0.23, 0.2, 0.36, m, 0, 0.72));
  // head and hat
  figure.add(mesh(new THREE.IcosahedronGeometry(0.15, 1), m, 0, 1.22));
  figure.add(cyl(0.27, 0.27, 0.03, m, 0, 1.31));
  figure.add(cyl(0.12, 0.15, 0.15, m, 0, 1.33));
  // backpack
  figure.add(box(0.28, 0.32, 0.14, m, 0, 0.66, -0.26));
  // left arm down, right arm up holding the flag
  const left = box(0.1, 0.46, 0.1, m, -0.3, 0.62);
  left.rotation.z = 0.2;
  figure.add(left);
  const right = box(0.1, 0.46, 0.1, m, 0.34, 0.9);
  right.rotation.z = -0.75;
  figure.add(right);
  figure.add(cyl(0.025, 0.025, 1.15, m, 0.44, 0.9, 0, 6));
  figure.add(box(0.42, 0.26, 0.03, m, 0.65, 1.78));
  if (tier === 'crystal' || tier === 'gold') {
    const star = mesh(new THREE.OctahedronGeometry(0.09), m, 0.44, 2.12);
    figure.add(star);
  }
  root.add(figure);
  root.userData.figure = figure;
  return root;
}

/** A trophy cup with handles and a star on top. */
export function buildTrophy(tier: StatueTier = 'gold'): THREE.Group {
  const g = new THREE.Group();
  const m = metal(tier);
  g.add(box(0.8, 0.18, 0.8, stone(STONE)));
  g.add(box(0.58, 0.14, 0.58, m, 0, 0.18));
  g.add(cyl(0.07, 0.13, 0.42, m, 0, 0.32));
  g.add(cyl(0.2, 0.2, 0.06, m, 0, 0.72));
  const profile = [
    [0.0, 0.0],
    [0.16, 0.02],
    [0.3, 0.12],
    [0.42, 0.36],
    [0.48, 0.66],
    [0.5, 0.78],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  g.add(mesh(new THREE.LatheGeometry(profile, 14), m, 0, 0.76));
  for (const side of [-1, 1]) {
    const handle = mesh(new THREE.TorusGeometry(0.17, 0.035, 6, 12, Math.PI), m, side * 0.47, 1.22);
    handle.rotation.z = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    g.add(handle);
  }
  const star = mesh(new THREE.OctahedronGeometry(0.16), m, 0, 1.78);
  g.add(star);
  g.userData.tick = (t: number) => {
    star.rotation.y = t * 2.2;
    star.position.y = 1.78 + Math.sin(t * 3) * 0.05;
  };
  return g;
}

/**
 * The ranking podium: 2nd · 1st · 3rd, with a statue on each occupied step.
 * @param players how many of the top 3 places are taken (0–3)
 */
export function buildPodium(players: number): THREE.Group {
  const g = new THREE.Group();
  const steps: { x: number; h: number; tier: StatueTier; place: number }[] = [
    { x: -1.3, h: 0.62, tier: 'silver', place: 2 },
    { x: 0, h: 0.9, tier: 'gold', place: 1 },
    { x: 1.3, h: 0.42, tier: 'bronze', place: 3 },
  ];
  const figures: THREE.Object3D[] = [];
  for (const s of steps) {
    g.add(box(1.22, s.h, 1.0, stone(STONE_LIGHT), s.x, 0));
    g.add(box(1.22, 0.08, 0.02, metal(s.tier), s.x, s.h - 0.16, 0.51));
    if (s.place <= players) {
      const statue = buildExplorerStatue(s.tier, false);
      statue.scale.setScalar(s.place === 1 ? 0.72 : 0.62);
      statue.position.set(s.x, s.h, 0);
      statue.rotation.y = s.x * -0.25;
      g.add(statue);
      figures.push(statue);
    }
  }
  g.userData.tick = (t: number) => {
    figures.forEach((f, i) => {
      f.rotation.y = Math.sin(t * 0.7 + i * 1.7) * 0.5;
    });
  };
  return g;
}

/**
 * The profile shelf: every statue in a row. Unlocked ones shine in their
 * metal, locked ones are grey; the current one is a bit bigger and turns.
 */
export function buildStatueShelf(current: StatueTier): THREE.Group {
  const g = new THREE.Group();
  const currentIndex = STATUE_TIERS.indexOf(current);
  g.add(box(5.9, 0.22, 1.2, stone(STONE)));
  let spinning: THREE.Object3D | null = null;
  STATUE_TIERS.forEach((tier, i) => {
    const unlocked = i <= currentIndex;
    const statue = buildExplorerStatue(unlocked ? tier : 'grey');
    const isCurrent = i === currentIndex;
    statue.scale.setScalar(isCurrent ? 1.15 : 0.95);
    statue.position.set(-2.2 + i * 1.47, 0.22, 0);
    statue.rotation.y = -0.35;
    g.add(statue);
    if (isCurrent) spinning = statue;
  });
  g.userData.tick = (t: number) => {
    if (spinning) spinning.rotation.y = -0.35 + Math.sin(t * 0.9) * 0.7;
  };
  return g;
}
