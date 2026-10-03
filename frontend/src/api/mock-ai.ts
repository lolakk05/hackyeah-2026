import type { Landmark } from './types';

/**
 * Fake "AI guide" answers, used only while USE_MOCK_API is true.
 * Replace by your backend's /ask endpoint (see client.ts → askAboutLandmark).
 */
export function mockAnswer(landmark: Landmark, question: string): string {
  const q = question.toLowerCase();
  const a = landmark.accessibility;

  if (/(wheelchair|accessib|stairs|ramp|lift|elevator)/.test(q)) {
    const level =
      a.wheelchair === 'full'
        ? 'is fully wheelchair accessible'
        : a.wheelchair === 'partial'
          ? 'is partly wheelchair accessible'
          : 'is unfortunately not wheelchair accessible';
    return `${landmark.name} ${level}. ${a.notes}`;
  }
  if (/(kid|child|family)/.test(q)) {
    return `Kids usually love ${landmark.name}! Plan about ${landmark.visitMinutes} minutes and bring snacks. 🧃`;
  }
  if (/(eat|food|lunch|coffee|restaurant)/.test(q)) {
    return `There are plenty of cafés within a 5-minute walk of ${landmark.name}. Try a fresh obwarzanek (Kraków's bagel) from a street stand. 🥯`;
  }
  if (/(time|long|hour|when|open)/.test(q)) {
    const hours = landmark.facts.find((f) => /hour/i.test(f.label));
    return `Plan about ${landmark.visitMinutes} minutes here.${hours ? ` ${hours.label}: ${hours.value}.` : ''}`;
  }
  return `Great question! (This is a sample AI answer.) ${landmark.description.split('. ')[0]}. Connect the real API in src/api/config.ts to get full answers. 🤖`;
}
