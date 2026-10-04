import type { Lang } from '@/i18n/strings';

import type { Landmark } from './types';

/**
 * Fake "AI guide" answers, used only while USE_MOCK_API is true.
 * Replace by your backend's /ask endpoint (see client.ts → askAboutLandmark).
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
  const first = landmark.description.split('. ')[0];
  return pl
    ? `Dobre pytanie! (To przykładowa odpowiedź AI.) ${first}. Podłącz prawdziwe API w src/api/config.ts, aby dostać pełne odpowiedzi. 🤖`
    : `Great question! (This is a sample AI answer.) ${first}. Connect the real API in src/api/config.ts to get full answers. 🤖`;
}
