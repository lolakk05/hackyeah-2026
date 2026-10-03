import type { Landmark } from './types';

/**
 * PROP / SAMPLE DATA for Kraków.
 *
 * Only used while USE_MOCK_API is true (see config.ts). Texts are short
 * summaries for demo purposes; opening hours, prices and accessibility
 * details are placeholders and should come from your backend.
 * Photos are random placeholder images from picsum.photos.
 */

const photo = (seed: string, n: number) =>
  Array.from({ length: n }, (_, i) => `https://picsum.photos/seed/krakow-${seed}-${i}/900/600`);

export const MOCK_LANDMARKS: Landmark[] = [
  {
    id: 'barbican',
    name: 'Barbican',
    tagline: 'Medieval round fortress',
    description:
      "The Kraków Barbican is a round brick fortification built around 1498 to guard the main entrance to the Old Town. It's one of the few surviving barbicans in Europe, with seven little turrets and walls about 3 metres thick. It once linked to St. Florian's Gate by a covered bridge over the moat.",
    photos: photo('barbican', 3),
    visitMinutes: 20,
    walkMinutesFromPrevious: 0,
    coordinates: { latitude: 50.0655, longitude: 19.9418 },
    accessibility: {
      wheelchair: 'partial',
      stepFree: false,
      accessibleToilet: false,
      audioGuide: true,
      hearingSupport: false,
      notes:
        'The outside and the park around it are step-free, but the cobblestones are uneven. The upper galleries are reached by stairs only.',
    },
    facts: [
      { icon: '🕘', label: 'Opening hours', value: 'Sample: 10:00 – 18:00 (Apr – Oct)' },
      { icon: '🎟️', label: 'Ticket', value: 'Sample: 18 PLN' },
      { icon: '📍', label: 'Address', value: 'ul. Basztowa, Kraków' },
    ],
    model: 'barbican',
    color: '#FF4B4B',
    suggestedQuestions: [
      'Why was the Barbican built?',
      'Is it good for kids?',
      'What is a barbican?',
    ],
  },
  {
    id: 'st-marys',
    name: "St. Mary's Basilica",
    tagline: 'Two towers & the hourly bugle call',
    description:
      "This Gothic brick church towers over the Main Square. Its two towers are different heights, and every hour a trumpeter plays the Hejnał mariacki from the taller one. The melody stops abruptly, in memory of a legendary trumpeter shot by an arrow. Inside is Veit Stoss's carved wooden altarpiece, one of the largest Gothic altarpieces in the world.",
    photos: photo('stmarys', 3),
    visitMinutes: 30,
    walkMinutesFromPrevious: 6,
    coordinates: { latitude: 50.0617, longitude: 19.9393 },
    accessibility: {
      wheelchair: 'partial',
      stepFree: false,
      accessibleToilet: false,
      audioGuide: true,
      hearingSupport: true,
      notes:
        'There is a step at the visitor entrance; staff can help. The tower climb has 239 steps and is not accessible.',
    },
    facts: [
      { icon: '🕘', label: 'Opening hours', value: 'Sample: 11:30 – 18:00' },
      { icon: '🎺', label: 'Bugle call', value: 'Every hour, from the taller tower' },
      { icon: '📍', label: 'Address', value: 'Plac Mariacki 5, Kraków' },
    ],
    model: 'basilica',
    color: '#1CB0F6',
    suggestedQuestions: [
      'Why does the bugle call stop suddenly?',
      'Tell me about the altarpiece',
      'Can I climb the tower?',
    ],
  },
  {
    id: 'cloth-hall',
    name: 'Cloth Hall',
    tagline: 'Renaissance market in the Main Square',
    description:
      "The Sukiennice has stood in the middle of the Main Square since the Middle Ages, when merchants traded cloth, spices and salt here. Today the arcaded hall is full of souvenir stalls. Upstairs is a gallery of 19th-century Polish art, and underneath is the Rynek Underground museum.",
    photos: photo('clothhall', 3),
    visitMinutes: 30,
    walkMinutesFromPrevious: 2,
    coordinates: { latitude: 50.0617, longitude: 19.9373 },
    accessibility: {
      wheelchair: 'full',
      stepFree: true,
      accessibleToilet: true,
      audioGuide: true,
      hearingSupport: true,
      notes:
        'The ground-floor market is step-free. The gallery and the underground museum have lifts.',
    },
    facts: [
      { icon: '🕘', label: 'Market hours', value: 'Sample: 9:00 – 20:00' },
      { icon: '🛍️', label: 'Good for', value: 'Amber, wooden toys, souvenirs' },
      { icon: '📍', label: 'Address', value: 'Rynek Główny 1/3, Kraków' },
    ],
    model: 'clothhall',
    color: '#FF9600',
    suggestedQuestions: [
      'What can I buy here?',
      'What is under the square?',
      'How old is the Cloth Hall?',
    ],
  },
  {
    id: 'town-hall-tower',
    name: 'Town Hall Tower',
    tagline: 'All that is left of the old town hall',
    description:
      'This leaning Gothic tower is all that remains of Kraków\'s old town hall, which was taken down in the 1820s. A strong wind in 1703 left it tilted by about 55 cm. From the top you can see across the whole Main Square.',
    photos: photo('townhall', 3),
    visitMinutes: 20,
    walkMinutesFromPrevious: 2,
    coordinates: { latitude: 50.0614, longitude: 19.9364 },
    accessibility: {
      wheelchair: 'none',
      stepFree: false,
      accessibleToilet: false,
      audioGuide: false,
      hearingSupport: false,
      notes: 'Only narrow, steep stairs lead to the top. You can still see the tower well from the square.',
    },
    facts: [
      { icon: '🕘', label: 'Opening hours', value: 'Sample: 10:30 – 18:00' },
      { icon: '📐', label: 'Fun fact', value: 'It leans about 55 cm' },
      { icon: '📍', label: 'Address', value: 'Rynek Główny 1, Kraków' },
    ],
    model: 'tower',
    color: '#CE82FF',
    suggestedQuestions: ['Why does the tower lean?', 'What happened to the town hall?', 'Is the view worth it?'],
  },
  {
    id: 'wawel-castle',
    name: 'Wawel Castle',
    tagline: 'Royal castle on the hill',
    description:
      "For centuries Wawel Hill was home to the kings of Poland. The castle has a Renaissance courtyard with arcades, royal chambers full of tapestries, and a treasury. Next to it, Wawel Cathedral is where Polish kings were crowned and buried. Look for the golden dome of the Sigismund Chapel.",
    photos: photo('wawel', 3),
    visitMinutes: 60,
    walkMinutesFromPrevious: 15,
    coordinates: { latitude: 50.054, longitude: 19.9354 },
    accessibility: {
      wheelchair: 'partial',
      stepFree: true,
      accessibleToilet: true,
      audioGuide: true,
      hearingSupport: true,
      notes:
        'A step-free route leads up the hill, but it is steep. Some exhibitions have lifts and some do not. Wheelchairs can be borrowed at the visitor centre.',
    },
    facts: [
      { icon: '🕘', label: 'Opening hours', value: 'Sample: 9:00 – 17:00' },
      { icon: '🎟️', label: 'Tickets', value: 'Sample: separate tickets for each exhibition' },
      { icon: '📍', label: 'Address', value: 'Wawel 5, Kraków' },
    ],
    model: 'castle',
    color: '#58CC02',
    suggestedQuestions: [
      'Which exhibition should I pick?',
      'Who is buried in the cathedral?',
      'Where can I rest on the hill?',
    ],
  },
  {
    id: 'dragon',
    name: "Wawel Dragon's Den",
    tagline: 'A cave and a fire-breathing dragon',
    description:
      "Legend says a dragon lived in a cave under Wawel Hill until a clever shoemaker tricked it with a sheep stuffed with sulphur. You can walk down through the cave and come out by the river, next to a bronze dragon statue that really breathes fire every few minutes.",
    photos: photo('dragon', 3),
    visitMinutes: 15,
    walkMinutesFromPrevious: 5,
    coordinates: { latitude: 50.0535, longitude: 19.9339 },
    accessibility: {
      wheelchair: 'none',
      stepFree: false,
      accessibleToilet: false,
      audioGuide: false,
      hearingSupport: false,
      notes:
        'The cave is reached by a long spiral staircase. The dragon statue by the river is step-free, so you can still see the fire!',
    },
    facts: [
      { icon: '🔥', label: 'Fire!', value: 'The statue breathes fire every few minutes' },
      { icon: '🕘', label: 'Cave hours', value: 'Sample: 10:00 – 18:00 (seasonal)' },
      { icon: '📍', label: 'Location', value: 'Bulwar Czerwieński, by the Vistula' },
    ],
    model: 'dragon',
    color: '#2BDCB0',
    suggestedQuestions: ['Tell me the dragon legend', 'When does it breathe fire?', 'Is the cave scary for kids?'],
  },
  {
    id: 'old-synagogue',
    name: 'Old Synagogue',
    tagline: 'Heart of historic Kazimierz',
    description:
      'Dating from the 15th century, this is the oldest surviving synagogue building in Poland. It stands on Szeroka Street in Kazimierz, the historic Jewish district. Today it houses a branch of the Museum of Kraków about the history and culture of Kraków\'s Jews.',
    photos: photo('synagogue', 3),
    visitMinutes: 30,
    walkMinutesFromPrevious: 18,
    coordinates: { latitude: 50.0515, longitude: 19.9487 },
    accessibility: {
      wheelchair: 'partial',
      stepFree: false,
      accessibleToilet: true,
      audioGuide: true,
      hearingSupport: false,
      notes: 'The main prayer hall is a few steps below street level. A portable ramp may be available on request.',
    },
    facts: [
      { icon: '🕘', label: 'Opening hours', value: 'Sample: 10:00 – 17:00' },
      { icon: '🏘️', label: 'District', value: 'Kazimierz' },
      { icon: '📍', label: 'Address', value: 'ul. Szeroka 24, Kraków' },
    ],
    model: 'synagogue',
    color: '#FFC800',
    suggestedQuestions: [
      'What else is there to see in Kazimierz?',
      'Where can I eat nearby?',
      'Tell me about the history of Kazimierz',
    ],
  },
  {
    id: 'bernatek-bridge',
    name: 'Father Bernatek Footbridge',
    tagline: 'Love locks & floating acrobats',
    description:
      "This footbridge over the Vistula joins Kazimierz with Podgórze. Couples hang love padlocks on its railings, and Jerzy Kędziora's balancing acrobat sculptures seem to float in the air above the deck.",
    photos: photo('bernatek', 3),
    visitMinutes: 15,
    walkMinutesFromPrevious: 8,
    coordinates: { latitude: 50.0478, longitude: 19.9486 },
    accessibility: {
      wheelchair: 'full',
      stepFree: true,
      accessibleToilet: false,
      audioGuide: false,
      hearingSupport: false,
      notes: 'Ramps on both sides and a smooth, wide deck. There are benches along the riverbank.',
    },
    facts: [
      { icon: '🔒', label: 'Tradition', value: 'Love padlocks on the railings' },
      { icon: '🌅', label: 'Best time', value: 'Sunset' },
      { icon: '📍', label: 'Connects', value: 'Kazimierz ↔ Podgórze' },
    ],
    model: 'bridge',
    color: '#FF86D0',
    suggestedQuestions: ['Who are the acrobats?', 'What is in Podgórze?', 'Best photo spot?'],
  },
];
