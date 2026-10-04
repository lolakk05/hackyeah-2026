/**
 * Pinek's prepared answers to the suggested questions (same order as
 * `suggestedQuestions` of each place). Custom questions get a fixed reply
 * (see guide.customReply in strings.ts).
 */
import type { Lang } from '@/i18n/strings';

import { nearbyLandmarks } from './photos';
import type { Landmark } from './types';

const ANSWERS: Record<string, Record<Lang, [string, string, string]>> = {
  barbican: {
    en: [
      'It was built around 1498–99, when Kraków feared an attack by the Turks and Tatars after a lost battle in 1497. It guarded St. Florian’s Gate, the main way into the city, and was linked to it by a covered passage over the moat. 🛡️',
      'Yes! Kids love the round walls, the seven little turrets and the arrow slits. In summer there are often knights and sword-fighting shows inside. ⚔️',
      'A barbican is a small fortress built in front of a city gate, so attackers had to get through it before reaching the gate. Kraków’s is one of the best preserved in Europe.',
    ],
    pl: [
      'Zbudowano go około 1498–99 roku, gdy po przegranej bitwie z 1497 roku Kraków obawiał się najazdu Turków i Tatarów. Strzegł Bramy Floriańskiej, głównego wjazdu do miasta, i był z nią połączony krytym przejściem nad fosą. 🛡️',
      'Tak! Dzieci uwielbiają okrągłe mury, siedem wieżyczek i otwory strzelnicze. Latem w środku często odbywają się pokazy rycerzy i walk na miecze. ⚔️',
      'Barbakan to mała twierdza przed bramą miejską: napastnicy musieli ją zdobyć, zanim dotarli do bramy. Krakowski jest jednym z najlepiej zachowanych w Europie.',
    ],
  },
  'st-marys': {
    en: [
      'Legend says a watchman playing the bugle call was hit in the throat by a Tatar arrow in the middle of the tune. Since then the hejnał stops suddenly, every hour, from the taller tower. 🎺',
      'The altarpiece was carved by Veit Stoss (Wit Stwosz) in 1477–1489 from lime wood. It is about 13 m tall – the largest Gothic altarpiece in Europe – and it is opened every day at 11:50.',
      'Yes, the taller bugle tower can be climbed in the warmer months, in small groups. There are a lot of steps, but you get a close look at the bugler’s window and the Main Square below.',
    ],
    pl: [
      'Według legendy trębacza grającego hejnał trafiła w gardło tatarska strzała w połowie melodii. Od tamtej pory hejnał co godzinę urywa się nagle na wyższej wieży. 🎺',
      'Ołtarz wyrzeźbił Wit Stwosz w latach 1477–1489 z drewna lipowego. Ma około 13 m wysokości – to największy gotycki ołtarz w Europie – i otwiera się codziennie o 11:50.',
      'Tak, na wyższą wieżę hejnałową można wejść w cieplejszych miesiącach, w małych grupach. Schodów jest sporo, ale z bliska zobaczysz okienko trębacza i Rynek z góry.',
    ],
  },
  'cloth-hall': {
    en: [
      'Amber jewellery, wooden toys, lace, leather goods, Polish pottery and classic Kraków souvenirs. The stalls inside have been selling to visitors for centuries. 🛍️',
      'The Rynek Underground museum: about 4 m below the square you walk among the remains of medieval market stalls and roads, with films and holograms about old Kraków.',
      'Cloth was traded here from the 13th century. The Gothic hall was built in the 14th century and rebuilt in Renaissance style after a fire in 1555. Upstairs is a gallery of 19th-century Polish paintings.',
    ],
    pl: [
      'Bursztynową biżuterię, drewniane zabawki, koronki, wyroby ze skóry, ceramikę i klasyczne krakowskie pamiątki. Stragany w środku handlują z odwiedzającymi od stuleci. 🛍️',
      'Muzeum Podziemia Rynku: około 4 m pod płytą Rynku chodzisz wśród pozostałości średniowiecznych kramów i dróg, z filmami i hologramami o dawnym Krakowie.',
      'Suknem handlowano tu od XIII wieku. Gotycką halę zbudowano w XIV wieku, a po pożarze w 1555 roku przebudowano ją w stylu renesansowym. Na piętrze jest galeria polskiego malarstwa XIX wieku.',
    ],
  },
  'town-hall-tower': {
    en: [
      'A very strong wind in 1703 pushed the tower so that it now leans by about half a metre. You can see it best from the corner of the Main Square. 🌬️',
      'The old town hall was falling apart, so the city knocked it down in 1820. Only the Gothic tower was kept – that’s why it stands alone on the square.',
      'Yes – from the top you look straight down on the Cloth Hall and St. Mary’s. The stairs are narrow and steep, so take your time.',
    ],
    pl: [
      'Bardzo silny wiatr w 1703 roku przechylił wieżę o około pół metra. Najlepiej widać to z narożnika Rynku. 🌬️',
      'Stary ratusz popadał w ruinę, więc w 1820 roku miasto go rozebrało. Zostawiono tylko gotycką wieżę – dlatego stoi samotnie na Rynku.',
      'Tak – z góry patrzysz prosto na Sukiennice i Mariacki. Schody są wąskie i strome, więc idź spokojnie.',
    ],
  },
  'wawel-castle': {
    en: [
      'For a first visit pick the State Rooms with the royal tapestries, plus the Crown Treasury and Armoury. If you love archaeology, add “Lost Wawel” with the oldest remains on the hill. 👑',
      'Most Polish kings – including Casimir the Great, Władysław Jagiełło and the Sigismunds – and national heroes like Tadeusz Kościuszko, Józef Piłsudski and the poets Adam Mickiewicz and Juliusz Słowacki.',
      'The castle courtyards have benches in the shade, and from the terrace by the walls there is a lovely view over the Vistula. A calm spot after the exhibitions. 🌳',
    ],
    pl: [
      'Na pierwszą wizytę wybierz Reprezentacyjne Komnaty Królewskie z arrasami oraz Skarbiec Koronny i Zbrojownię. Jeśli lubisz archeologię, dodaj „Wawel Zaginiony” z najstarszymi śladami na wzgórzu. 👑',
      'Większość polskich królów – m.in. Kazimierz Wielki, Władysław Jagiełło i Zygmuntowie – oraz bohaterowie narodowi: Tadeusz Kościuszko, Józef Piłsudski i poeci Adam Mickiewicz i Juliusz Słowacki.',
      'Na dziedzińcach zamku są ławki w cieniu, a z tarasu przy murach rozciąga się piękny widok na Wisłę. Spokojne miejsce po zwiedzaniu wystaw. 🌳',
    ],
  },
  dragon: {
    en: [
      'A dragon lived in the cave under Wawel and ate the townspeople’s sheep. A clever shoemaker, Skuba, fed it a sheep stuffed with sulphur. The dragon drank so much of the Vistula that it burst! 🐉',
      'The bronze dragon by the river, made by Bronisław Chromy, breathes real fire every few minutes. Wait a moment in front of it and keep your camera ready. 🔥',
      'Not really – it’s a short walk through a dim, damp cave, and you come out right next to the fire-breathing dragon, which kids love. There is a spiral staircase on the way down.',
    ],
    pl: [
      'W jaskini pod Wawelem mieszkał smok, który pożerał owce mieszczan. Sprytny szewc Skuba podrzucił mu owcę wypchaną siarką. Smok wypił tyle wody z Wisły, że pękł! 🐉',
      'Brązowy smok nad Wisłą, autorstwa Bronisława Chromego, zieje prawdziwym ogniem co kilka minut. Poczekaj chwilę przed nim i miej aparat w gotowości. 🔥',
      'Raczej nie – to krótki spacer przez ciemnawą, wilgotną jaskinię, a wychodzi się tuż przy ziejącym ogniem smoku, którego dzieci uwielbiają. Po drodze w dół są kręcone schody.',
    ],
  },
  'old-synagogue': {
    en: [
      'Walk along Szeroka Street to the Remuh Synagogue and its old cemetery, then see the Tempel Synagogue, Plac Nowy with its round market hall and the Corpus Christi Basilica. ✡️',
      'Go to Plac Nowy for a zapiekanka – a long open toasted baguette from the round hall in the middle. Szeroka Street has restaurants with Jewish cuisine. 🥖',
      'Kazimierz was founded in 1335 by King Casimir the Great as a separate town. From the late 15th century it was home to a large Jewish community, joined Kraków in 1800, and today it is full of cafés, galleries and history.',
    ],
    pl: [
      'Przejdź ulicą Szeroką do Synagogi Remuh i starego cmentarza, potem zobacz Synagogę Tempel, Plac Nowy z okrągłą halą i Bazylikę Bożego Ciała. ✡️',
      'Idź na Plac Nowy na zapiekankę z okrągłej hali na środku placu. Przy ulicy Szerokiej są restauracje z kuchnią żydowską. 🥖',
      'Kazimierz założył w 1335 roku król Kazimierz Wielki jako osobne miasto. Od końca XV wieku mieszkała tu duża społeczność żydowska, w 1800 roku Kazimierz włączono do Krakowa, a dziś pełen jest kawiarni, galerii i historii.',
    ],
  },
  'bernatek-bridge': {
    en: [
      'They are sculptures by Jerzy Kędziora: figures that seem to balance in the air between the water and the sky, holding on to nothing but a thin line. 🤸',
      'Across the bridge is Podgórze: Oskar Schindler’s Factory museum, Ghetto Heroes Square, the Liban quarry and the Krakus Mound with a great view over the city.',
      'Stand in the middle of the bridge so the acrobats and the Vistula are in the frame – best at sunset, when the city lights come on. 📸',
    ],
    pl: [
      'To rzeźby Jerzego Kędziory: postaci, które zdają się balansować w powietrzu między wodą a niebem, trzymając się tylko cienkiej linki. 🤸',
      'Po drugiej stronie kładki jest Podgórze: Fabryka Emalia Oskara Schindlera, Plac Bohaterów Getta, kamieniołom Liban i Kopiec Krakusa z pięknym widokiem na miasto.',
      'Stań na środku kładki, tak żeby akrobaci i Wisła były w kadrze – najlepiej o zachodzie słońca, gdy zapalają się światła miasta. 📸',
    ],
  },
};

/** Prepared answer for one of the suggested questions, or null for a custom question. */
export function preparedAnswer(landmark: Landmark, question: string, lang: Lang): string | null {
  const index = landmark.suggestedQuestions.indexOf(question);
  if (index < 0) return null;
  return landmark.suggestedAnswers?.[index] ?? ANSWERS[landmark.id]?.[lang][index] ?? null;
}

// ─── Answers for places from the API (generic questions) ─────

const AREAS: { name: Record<Lang, string>; lat: number; lon: number; food: Record<Lang, string> }[] = [
  {
    name: { en: 'the Old Town', pl: 'Stare Miasto' },
    lat: 50.0617,
    lon: 19.9373,
    food: {
      en: 'Grab an obwarzanek from a blue street cart, try pierogi in one of the restaurants on Grodzka or Floriańska Street, or have cake in a café around the Main Square. 🥯',
      pl: 'Weź obwarzanka z niebieskiego wózka, spróbuj pierogów w jednej z restauracji przy Grodzkiej lub Floriańskiej albo zjedz ciasto w kawiarni przy Rynku. 🥯',
    },
  },
  {
    name: { en: 'Kazimierz', pl: 'Kazimierz' },
    lat: 50.0515,
    lon: 19.9445,
    food: {
      en: 'Head to Plac Nowy for a zapiekanka from the round hall, or try Jewish cuisine on Szeroka Street. Józefa Street is full of cosy cafés. 🥖',
      pl: 'Idź na Plac Nowy na zapiekankę z okrągłej hali albo spróbuj kuchni żydowskiej przy ulicy Szerokiej. Ulica Józefa jest pełna przytulnych kawiarni. 🥖',
    },
  },
  {
    name: { en: 'Podgórze', pl: 'Podgórze' },
    lat: 50.0445,
    lon: 19.9545,
    food: {
      en: 'Around Rynek Podgórski and Józefińska Street you’ll find bistros, bakeries and cafés – quieter and cheaper than in the Old Town. ☕',
      pl: 'Przy Rynku Podgórskim i ulicy Józefińskiej znajdziesz bistra, piekarnie i kawiarnie – spokojniej i taniej niż na Starym Mieście. ☕',
    },
  },
];

const meters = (lat1: number, lon1: number, lat2: number, lon2: number) =>
  Math.hypot((lat1 - lat2) * 111_000, (lon1 - lon2) * 71_500);

function areaOf(lat: number, lon: number) {
  let best = AREAS[0];
  for (const a of AREAS) if (meters(lat, lon, a.lat, a.lon) < meters(lat, lon, best.lat, best.lon)) best = a;
  return best;
}

/**
 * Answers to the three generic questions of an API place:
 * "What is this place?", "What else is worth seeing nearby?", "Where can I eat nearby?".
 */
export function genericAnswers(
  place: { name: string; label: string; description: string; latitude: number; longitude: number; facts: Landmark['facts'] },
  lang: Lang,
): [string, string, string] {
  const pl = lang === 'pl';
  const hours = place.facts.find((f) => f.icon === '🕘')?.value;
  const what = `${place.description}${hours ? (pl ? ` Godziny otwarcia: ${hours}.` : ` Opening hours: ${hours}.`) : ''}`;

  const near = nearbyLandmarks(place.latitude, place.longitude, place.name, 3);
  const area = areaOf(place.latitude, place.longitude);
  const nearby = near.length
    ? (pl ? 'Niedaleko stąd: ' : 'A short walk from here: ') +
      near.map((n) => `${n.name} (${Math.max(50, Math.round(n.meters / 50) * 50)} m)`).join(', ') +
      '. 🚶'
    : pl
      ? `Rozejrzyj się po okolicy – ${area.name.pl} ma wiele ciekawych zakątków. 🚶`
      : `Take a look around – ${area.name.en} has lots of interesting corners. 🚶`;

  return [what, nearby, area.food[lang]];
}
