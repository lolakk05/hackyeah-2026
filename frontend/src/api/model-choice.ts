/**
 * Which 3D mini-model a place gets.
 *
 * Famous landmarks have their own model (Barbican, Cloth Hall, Wawel…).
 * Every other place gets a model for its kind (church, synagogue, museum,
 * palace, gate, monument, theatre, cave). Most kinds have several variants:
 * a variant is picked from the name, and along a route the variants are
 * spread out so two stops next to each other never look the same.
 */
import { KIND_CONFIG } from '@/map/landmark-placement';

import type { ModelKind } from './types';

/** Interchangeable variants for one kind of place. */
export const MODEL_FAMILIES: ModelKind[][] = [
  ['church', 'twintower', 'domechurch', 'chapel'],
  ['synagogue2', 'synagogue3', 'synagogue'],
  ['museum', 'gallery', 'townhouse'],
  ['palace', 'college'],
  ['gate', 'wallgate'],
  ['statue', 'rider', 'bust'],
  ['theatre', 'theatre2'],
];

const familyOf = (kind: ModelKind) => MODEL_FAMILIES.find((f) => f.includes(kind));

/** Kinds that stand for one specific, famous place (never swapped for variety). */
const NAMED_KINDS: ModelKind[] = ['barbican', 'basilica', 'clothhall', 'tower', 'castle', 'dragon', 'synagogue', 'bridge', 'cave'];

function namedKind(names: string[]): ModelKind | null {
  for (const kind of NAMED_KINDS) {
    if (KIND_CONFIG[kind].names.some((p) => names.some((n) => n.includes(p.toLowerCase())))) return kind;
  }
  return null;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A variant of a family, chosen by the name (the same place always looks the same). */
const pick = (family: ModelKind[], name: string) => family[hash(name) % family.length];
const fam = (first: ModelKind) => familyOf(first)!;

/** Model for a place, from its names (any language) and its category. */
export function chooseModel(names: (string | undefined)[], category = ''): ModelKind {
  const list = names.filter((n): n is string => !!n).map((n) => n.toLowerCase());
  const key = list[0] ?? category;
  const has = (re: RegExp) => list.some((n) => re.test(n));

  const named = namedKind(list);
  if (named) return named;

  if (has(/cerkiew|orthodox/)) return 'orthodox';
  if (has(/synagog/)) return pick(['synagogue2', 'synagogue3', 'synagogue'], key);
  if (has(/kaplica|chapel|loreta/)) return 'chapel';
  if (has(/bazylika|katedr|basilica|cathedral/)) return pick(['twintower', 'domechurch'], key);
  // (the small chapel model is kept for real chapels; it still appears as a variant along routes)
  if (has(/kości[oó]ł|church|klasztor|monastery/)) return pick(['church', 'twintower', 'domechurch'], key);
  if (has(/teatr|theat/)) return pick(fam('theatre'), key);
  if (has(/jama|cave/)) return 'cave';
  if (has(/arsenał|arsenal|mury|wall/)) return 'wallgate';
  if (has(/brama|gate|wieża|tower|baszta/)) return has(/floria|wieża|tower/) ? 'gate' : pick(fam('gate'), key);
  if (has(/collegium|college/)) return 'college';
  if (has(/pałac sztuki|palace of art/)) return 'museum';
  if (has(/pałac|palace/)) return pick(fam('palace'), key);
  if (has(/kamienica|^dom |house|hotel|celestat|ulica/)) return 'townhouse';
  if (has(/grunwald|kościuszk|kosciuszk|piłsudsk|pilsudsk/)) return 'rider';
  if (has(/eros/)) return 'bust';
  if (has(/galeria|gallery|bunkier|manggha|fotografi|witraż|sztuki|art/)) return 'gallery';
  if (has(/muzeum|museum/)) return pick(fam('museum'), key);

  switch (category) {
    case 'museum':
      return pick(fam('museum'), key);
    case 'gallery':
      return 'gallery';
    case 'place_of_worship':
    case 'church':
      return pick(['church', 'twintower', 'domechurch'], key);
    case 'theatre':
      return pick(fam('theatre'), key);
    case 'cave_entrance':
      return 'cave';
    case 'castle':
      return 'palace';
    case 'historic':
    case 'monument':
    case 'memorial':
    case 'artwork':
      // in this data mostly statues of people (Mickiewicz, Matejko, Kopernik…)
      return pick(['statue', 'bust'], key);
    default:
      return 'generic';
  }
}

/**
 * Spread the variants along a route: a stop never gets the same model as the
 * stop before it, and models already used on the route are avoided while the
 * family still has unused variants. Famous landmarks keep their own model.
 */
export function diversifyModels<T extends { model: ModelKind; name: string }>(stops: T[]): T[] {
  const famous = stops.map((s) => NAMED_KINDS.includes(s.model) && namedKind([s.name.toLowerCase()]) === s.model);
  // Famous landmarks never change, so reserve their models first.
  const used = new Set<ModelKind>(stops.filter((_, i) => famous[i]).map((s) => s.model));
  const out: T[] = [];
  stops.forEach((stop, i) => {
    const family = familyOf(stop.model);
    const prev = out.at(-1)?.model;
    const nextFixed = famous[i + 1] ? stops[i + 1].model : undefined;
    let model = stop.model;
    const clashes = model === prev || model === nextFixed;
    if (family && !famous[i] && (clashes || used.has(model))) {
      const start = family.indexOf(model);
      const options = family.map((_, k) => family[(start + 1 + k) % family.length]);
      const allowed = options.filter((k) => k !== prev && k !== nextFixed);
      model = allowed.find((k) => !used.has(k)) ?? (clashes ? (allowed[0] ?? model) : model);
    }
    used.add(model);
    out.push(model === stop.model ? stop : { ...stop, model });
  });
  return out;
}
