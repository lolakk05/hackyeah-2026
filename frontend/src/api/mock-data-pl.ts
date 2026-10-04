import type { Landmark } from './types';

/**
 * PROP / SAMPLE DATA: Polish texts for the mock landmarks.
 * Only fields that differ from English are listed. Your real API should
 * return texts in the language given by `?lang=` / `Accept-Language`.
 */
type Override = Pick<Landmark, 'name' | 'tagline' | 'description' | 'facts' | 'suggestedQuestions'> & {
  accessibilityNotes: string;
};

export const MOCK_PL: Record<string, Override> = {
  barbican: {
    name: 'Barbakan',
    tagline: 'Średniowieczna okrągła twierdza',
    description:
      'Barbakan to okrągła ceglana budowla obronna z ok. 1498 roku, która strzegła głównego wejścia do Starego Miasta. To jeden z niewielu zachowanych barbakanów w Europie: ma siedem wieżyczek i mury grube na około 3 metry. Dawniej łączył się z Bramą Floriańską krytym przejściem nad fosą.',
    accessibilityNotes:
      'Teren wokół i park są bez schodów, ale bruk jest nierówny. Na górne galerie prowadzą wyłącznie schody.',
    facts: [
      { icon: '🕘', label: 'Godziny otwarcia', value: '10:00 – 18:00 (kwi – paź)' },
      { icon: '🎟️', label: 'Bilet', value: '18 zł' },
      { icon: '📍', label: 'Adres', value: 'ul. Basztowa, Kraków' },
    ],
    suggestedQuestions: ['Po co zbudowano Barbakan?', 'Czy to dobre miejsce dla dzieci?', 'Czym jest barbakan?'],
  },
  'st-marys': {
    name: 'Bazylika Mariacka',
    tagline: 'Dwie wieże i hejnał co godzinę',
    description:
      'Gotycki ceglany kościół góruje nad Rynkiem Głównym. Jego dwie wieże mają różną wysokość, a z wyższej co godzinę rozbrzmiewa hejnał mariacki. Melodia urywa się nagle, na pamiątkę legendarnego trębacza trafionego strzałą. W środku znajduje się ołtarz Wita Stwosza, jeden z największych gotyckich ołtarzy na świecie.',
    accessibilityNotes:
      'Przy wejściu dla zwiedzających jest stopień; obsługa może pomóc. Wejście na wieżę to 239 stopni i nie jest dostępne.',
    facts: [
      { icon: '🕘', label: 'Godziny otwarcia', value: '11:30 – 18:00' },
      { icon: '🎺', label: 'Hejnał', value: 'Co godzinę, z wyższej wieży' },
      { icon: '📍', label: 'Adres', value: 'Plac Mariacki 5, Kraków' },
    ],
    suggestedQuestions: ['Dlaczego hejnał urywa się nagle?', 'Opowiedz o ołtarzu', 'Czy można wejść na wieżę?'],
  },
  'cloth-hall': {
    name: 'Sukiennice',
    tagline: 'Renesansowa hala targowa na Rynku',
    description:
      'Sukiennice stoją na środku Rynku od średniowiecza, gdy kupcy handlowali tu suknem, przyprawami i solą. Dziś w krytej hali z arkadami są stragany z pamiątkami. Na piętrze mieści się galeria polskiej sztuki XIX wieku, a pod spodem muzeum Podziemia Rynku.',
    accessibilityNotes: 'Parter z kramami jest bez schodów. Do galerii i podziemi prowadzą windy.',
    facts: [
      { icon: '🕘', label: 'Godziny targu', value: '9:00 – 20:00' },
      { icon: '🛍️', label: 'Warto kupić', value: 'Bursztyn, drewniane zabawki, pamiątki' },
      { icon: '📍', label: 'Adres', value: 'Rynek Główny 1/3, Kraków' },
    ],
    suggestedQuestions: ['Co mogę tu kupić?', 'Co jest pod Rynkiem?', 'Ile lat mają Sukiennice?'],
  },
  'town-hall-tower': {
    name: 'Wieża Ratuszowa',
    tagline: 'Wszystko, co zostało z dawnego ratusza',
    description:
      'Ta przechylona gotycka wieża to jedyna pozostałość dawnego krakowskiego ratusza, rozebranego w latach 20. XIX wieku. Silny wiatr w 1703 roku przechylił ją o około 55 cm. Ze szczytu widać cały Rynek.',
    accessibilityNotes: 'Na górę prowadzą tylko wąskie, strome schody. Wieżę dobrze widać z Rynku.',
    facts: [
      { icon: '🕘', label: 'Godziny otwarcia', value: '10:30 – 18:00' },
      { icon: '📐', label: 'Ciekawostka', value: 'Wieża jest odchylona o ok. 55 cm' },
      { icon: '📍', label: 'Adres', value: 'Rynek Główny 1, Kraków' },
    ],
    suggestedQuestions: ['Dlaczego wieża jest krzywa?', 'Co stało się z ratuszem?', 'Czy widok jest wart wejścia?'],
  },
  'wawel-castle': {
    name: 'Zamek Królewski na Wawelu',
    tagline: 'Królewski zamek na wzgórzu',
    description:
      'Przez wieki Wzgórze Wawelskie było siedzibą polskich królów. Zamek ma renesansowy dziedziniec z krużgankami, komnaty pełne arrasów i skarbiec. Obok stoi Katedra Wawelska, miejsce koronacji i pochówku polskich królów. Zwróć uwagę na złotą kopułę Kaplicy Zygmuntowskiej.',
    accessibilityNotes:
      'Na wzgórze prowadzi droga bez schodów, ale stroma. Część wystaw ma windy, część nie. Wózki można wypożyczyć w centrum obsługi.',
    facts: [
      { icon: '🕘', label: 'Godziny otwarcia', value: '9:00 – 17:00' },
      { icon: '🎟️', label: 'Bilety', value: 'osobne bilety na każdą wystawę' },
      { icon: '📍', label: 'Adres', value: 'Wawel 5, Kraków' },
    ],
    suggestedQuestions: ['Którą wystawę wybrać?', 'Kto jest pochowany w katedrze?', 'Gdzie można odpocząć na wzgórzu?'],
  },
  dragon: {
    name: 'Smocza Jama',
    tagline: 'Jaskinia i ziejący ogniem smok',
    description:
      'Legenda mówi, że pod Wawelem mieszkał smok, aż sprytny szewc podrzucił mu owcę wypchaną siarką. Można zejść przez jaskinię i wyjść nad Wisłą, obok pomnika smoka z brązu, który co kilka minut naprawdę zieje ogniem.',
    accessibilityNotes:
      'Do jaskini prowadzą długie kręcone schody. Pomnik smoka nad rzeką jest dostępny bez schodów, więc ogień i tak zobaczysz!',
    facts: [
      { icon: '🔥', label: 'Ogień!', value: 'Smok zieje ogniem co kilka minut' },
      { icon: '🕘', label: 'Godziny jaskini', value: '10:00 – 18:00 (sezonowo)' },
      { icon: '📍', label: 'Miejsce', value: 'Bulwar Czerwieński, nad Wisłą' },
    ],
    suggestedQuestions: ['Opowiedz legendę o smoku', 'Kiedy smok zieje ogniem?', 'Czy jaskinia jest straszna dla dzieci?'],
  },
  'old-synagogue': {
    name: 'Stara Synagoga',
    tagline: 'Serce historycznego Kazimierza',
    description:
      'To najstarszy zachowany budynek synagogi w Polsce, pochodzący z XV wieku. Stoi przy ulicy Szerokiej na Kazimierzu, dawnej dzielnicy żydowskiej. Dziś mieści oddział Muzeum Krakowa poświęcony historii i kulturze krakowskich Żydów.',
    accessibilityNotes: 'Główna sala modlitewna jest kilka stopni poniżej poziomu ulicy. Na prośbę może być dostępna przenośna rampa.',
    facts: [
      { icon: '🕘', label: 'Godziny otwarcia', value: '10:00 – 17:00' },
      { icon: '🏘️', label: 'Dzielnica', value: 'Kazimierz' },
      { icon: '📍', label: 'Adres', value: 'ul. Szeroka 24, Kraków' },
    ],
    suggestedQuestions: ['Co jeszcze zobaczyć na Kazimierzu?', 'Gdzie zjeść w pobliżu?', 'Opowiedz o historii Kazimierza'],
  },
  'bernatek-bridge': {
    name: 'Kładka Ojca Bernatka',
    tagline: 'Kłódki zakochanych i unoszący się akrobaci',
    description:
      'Ta kładka nad Wisłą łączy Kazimierz z Podgórzem. Zakochani wieszają na niej kłódki, a rzeźby balansujących akrobatów Jerzego Kędziory zdają się unosić w powietrzu nad pomostem.',
    accessibilityNotes: 'Rampy po obu stronach i równy, szeroki pomost. Wzdłuż bulwarów są ławki.',
    facts: [
      { icon: '🔒', label: 'Tradycja', value: 'Kłódki zakochanych na barierkach' },
      { icon: '🌅', label: 'Najlepsza pora', value: 'Zachód słońca' },
      { icon: '📍', label: 'Łączy', value: 'Kazimierz ↔ Podgórze' },
    ],
    suggestedQuestions: ['Kim są akrobaci?', 'Co jest na Podgórzu?', 'Gdzie najlepsze miejsce na zdjęcie?'],
  },
};

/** English mock landmarks with Polish texts applied. */
export function localizeToPolish(landmarks: Landmark[]): Landmark[] {
  return landmarks.map((l) => {
    const o = MOCK_PL[l.id];
    if (!o) return l;
    const { accessibilityNotes, ...rest } = o;
    return { ...l, ...rest, accessibility: { ...l.accessibility, notes: accessibilityNotes } };
  });
}
