import type { AdminPlace } from './types'

export const DEMO_PHOTO_CREDITS: Record<string, { page: string; attribution: string }> = {
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/aa/Rynek-podziemia_1_-_panoramio.jpg/1280px-Rynek-podziemia_1_-_panoramio.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail': {
    page: 'https://commons.wikimedia.org/wiki/File:Rynek-podziemia_1_-_panoramio.jpg',
    attribution: 'marek7400, CC BY 3.0, Wikimedia Commons',
  },
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/98/Smocza_Jama-wn%C4%99trze.jpg/1280px-Smocza_Jama-wn%C4%99trze.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail': {
    page: 'https://commons.wikimedia.org/wiki/File:Smocza_Jama-wn%C4%99trze.jpg',
    attribution: 'EMeczKa, CC BY-SA 4.0, Wikimedia Commons',
  },
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/46/Smok_Wawelski%2C_Krak%C3%B3w.jpg/1280px-Smok_Wawelski%2C_Krak%C3%B3w.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail': {
    page: 'https://commons.wikimedia.org/wiki/File:Smok_Wawelski,_Krak%C3%B3w.jpg',
    attribution: 'Milena Bielecka-Sujak, CC BY-SA 4.0, Wikimedia Commons',
  },
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c2/Krak%C3%B3w_-_Barbakan_Krakowski.jpg/1280px-Krak%C3%B3w_-_Barbakan_Krakowski.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail': {
    page: 'https://commons.wikimedia.org/wiki/File:Krak%C3%B3w_-_Barbakan_Krakowski.jpg',
    attribution: 'Fred Romero, CC BY 2.0, Wikimedia Commons',
  },
}

export const DEMO_PLACES: AdminPlace[] = [
  {
    id: 'demo-rynek-podziemny',
    name: 'Rynek Podziemny',
    descriptionPL: 'Muzeum prezentujące historię i archeologiczne pozostałości średniowiecznego Krakowa.',
    descriptionEN: 'A museum presenting the history and archaeological remains of medieval Krakow.',
    timeToVisit: 60,
    photos: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/a/aa/Rynek-podziemia_1_-_panoramio.jpg/1280px-Rynek-podziemia_1_-_panoramio.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail'],
    hasStairs: true,
    wheelchairAccessible: false,
    hasAccessibleToilet: true,
    price: '45 zł (bilet normalny)',
    address: 'Rynek Główny 1, Kraków',
    latitude: 50.062005,
    longitude: 19.937777,
    openingHours: [],
  },
  {
    id: 'demo-smocza-jama',
    name: 'Smocza Jama',
    descriptionPL: 'Jaskinia krasowa pod wzgórzem wawelskim, związana z legendą o smoku wawelskim.',
    descriptionEN: 'A karst cave beneath Wawel Hill, associated with the legend of the Wawel Dragon.',
    timeToVisit: 20,
    photos: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/9/98/Smocza_Jama-wn%C4%99trze.jpg/1280px-Smocza_Jama-wn%C4%99trze.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail'],
    hasStairs: true,
    wheelchairAccessible: false,
    hasAccessibleToilet: false,
    price: '9 zł (bilet normalny)',
    address: 'Wawel 5, Kraków',
    latitude: 50.053422,
    longitude: 19.933583,
    openingHours: [],
  },
  {
    id: 'demo-smok-wawelski',
    name: 'Smok Wawelski',
    descriptionPL: 'Pomnik legendarnego smoka u stóp Wawelu.',
    descriptionEN: 'A statue of the legendary dragon at the foot of Wawel Hill.',
    timeToVisit: 15,
    photos: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/4/46/Smok_Wawelski%2C_Krak%C3%B3w.jpg/1280px-Smok_Wawelski%2C_Krak%C3%B3w.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail'],
    hasStairs: false,
    wheelchairAccessible: true,
    hasAccessibleToilet: false,
    price: 'Bezpłatne',
    address: 'Smocza, Kraków',
    latitude: 50.053016,
    longitude: 19.933588,
    openingHours: [],
  },
  {
    id: 'demo-barbakan',
    name: 'Barbakan',
    descriptionPL: 'Średniowieczna, cylindryczna budowla obronna przy dawnych murach miejskich.',
    descriptionEN: 'A medieval circular defensive structure by the former city walls.',
    timeToVisit: 30,
    photos: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c2/Krak%C3%B3w_-_Barbakan_Krakowski.jpg/1280px-Krak%C3%B3w_-_Barbakan_Krakowski.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail'],
    hasStairs: true,
    wheelchairAccessible: false,
    hasAccessibleToilet: false,
    price: '18 zł (bilet normalny)',
    address: 'Basztowa 30, Kraków',
    latitude: 50.065458,
    longitude: 19.941451,
    openingHours: [],
  },
]

export interface DemoAccessibilityReport {
  placeId: string
  positive: number
  negative: number
}

export const DEMO_ACCESSIBILITY_REPORTS: DemoAccessibilityReport[] = [
  { placeId: 'demo-rynek-podziemny', positive: 18, negative: 7 },
  { placeId: 'demo-smocza-jama', positive: 5, negative: 14 },
  { placeId: 'demo-smok-wawelski', positive: 22, negative: 2 },
  { placeId: 'demo-barbakan', positive: 8, negative: 11 },
]
