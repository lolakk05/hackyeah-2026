import type { Lang } from '@/i18n/strings';

import type { Landmark } from './types';

/**
 * Offline "Ask Pinek" answers, built from the place's own data. Used when
 * the AI service isn't set or can't be reached (see client.ts → askAboutLandmark).
 */
export function mockAnswer(landmark: Landmark, question: string, lang: Lang): string {
  const q = question.toLowerCase();
  const a = landmark.accessibility;
  const pl = lang === 'pl';

  if (/(wheelchair|accessib|stairs|ramp|lift|elevator|wózk|schod|dostęp|wind)/.test(q)) {
    const level = pl
      ? { full: 'jest w pełni dostępne dla wózków', partial: 'jest częściowo dostępne dla wózków', none: 'niestety nie jest dostępne dla wózków', unknown: 'nie ma jeszcze danych o dostępności dla wózków' }[a.wheelchair]
      : { full: 'is fully wheelchair accessible', partial: 'is partly wheelchair accessible', none: 'is unfortunately not wheelchair accessible', unknown: 'has no wheelchair information yet' }[a.wheelchair];
    return `${landmark.name} ${level}. ${a.notes}`;
  }
  if (/(kid|child|family|dzieci|dzieck|rodzin)/.test(q)) {
    return pl
      ? `Dzieciom zwykle bardzo się tu podoba! Zaplanuj ok. ${landmark.visitMinutes} minut i weź przekąski. 🧃`
      : `Kids usually love ${landmark.name}! Plan about ${landmark.visitMinutes} minutes and bring snacks. 🧃`;
  }
  if (/(eat|food|lunch|coffee|restaurant|jeś|jedzen|zjeść|kaw|restaurac|obiad)/.test(q)) {
    return pl
      ? 'W promieniu 5 minut pieszo jest mnóstwo kawiarni. Spróbuj świeżego obwarzanka z ulicznego wózka. 🥯'
      : `There are plenty of cafés within a 5-minute walk of ${landmark.name}. Try a fresh obwarzanek (Kraków's bagel) from a street stand. 🥯`;
  }
  if (/(time|long|hour|when|open|godzin|kiedy|otwar|ile czasu)/.test(q)) {
    const hours = landmark.facts.find((f) => /hour|godzin/i.test(f.label));
    return pl
      ? `Zaplanuj tu ok. ${landmark.visitMinutes} minut.${hours ? ` ${hours.label}: ${hours.value}.` : ''}`
      : `Plan about ${landmark.visitMinutes} minutes here.${hours ? ` ${hours.label}: ${hours.value}.` : ''}`;
  }
  // General question: share the most interesting bit of the description.
  const sentences = landmark.description.split(/(?<=\.)\s+/).filter(Boolean);
  const story = sentences.slice(0, 2).join(' ') || landmark.description;
  return pl
    ? `Dobre pytanie! ${story} Zaplanuj tu ok. ${landmark.visitMinutes} minut. 📍`
    : `Great question! ${story} Plan about ${landmark.visitMinutes} minutes here. 📍`;
}
