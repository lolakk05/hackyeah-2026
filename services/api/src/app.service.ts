import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

type WheelchairAccess = 'full' | 'partial' | 'none';
type ReportCategory = 'wheelchair' | 'stepFree' | 'smoothSurface' | 'lowVision';

export interface Landmark {
  id: string;
  name: string;
  tagline: string;
  description: string;
  photos: string[];
  visitMinutes: number;
  walkMinutesFromPrevious: number;
  coordinates: { latitude: number; longitude: number };
  accessibility: {
    wheelchair: WheelchairAccess;
    stepFree: boolean;
    accessibleToilet: boolean;
    audioGuide: boolean;
    hearingSupport: boolean;
    notes: string;
  };
  facts: { icon: string; label: string; value: string }[];
  model: string;
  color: string;
  suggestedQuestions: string[];
}

interface StoredReport {
  category: ReportCategory;
  accessible: boolean;
  toStopId: string;
  createdAt: string;
}

const seedPlaces: Landmark[] = [
  {
    id: 'barbican',
    name: 'Barbakan',
    tagline: 'Średniowieczna okrągła twierdza',
    description: 'Okrągła ceglana budowla obronna z końca XV wieku, która strzegła głównego wejścia do Starego Miasta.',
    photos: [],
    visitMinutes: 20,
    walkMinutesFromPrevious: 0,
    coordinates: { latitude: 50.0655, longitude: 19.9418 },
    accessibility: { wheelchair: 'partial', stepFree: false, accessibleToilet: false, audioGuide: true, hearingSupport: false, notes: 'Teren wokół jest bez schodów, ale bruk jest nierówny. Na górne galerie prowadzą schody.' },
    facts: [{ icon: '📍', label: 'Adres', value: 'ul. Basztowa, Kraków' }],
    model: 'barbican',
    color: '#E2683C',
    suggestedQuestions: [],
  },
  {
    id: 'st-marys',
    name: 'Bazylika Mariacka',
    tagline: 'Dwie wieże i hejnał co godzinę',
    description: 'Gotycki kościół górujący nad Rynkiem Głównym, znany z ołtarza Wita Stwosza i hejnału mariackiego.',
    photos: [],
    visitMinutes: 30,
    walkMinutesFromPrevious: 6,
    coordinates: { latitude: 50.0617, longitude: 19.9393 },
    accessibility: { wheelchair: 'partial', stepFree: false, accessibleToilet: false, audioGuide: true, hearingSupport: true, notes: 'Przy wejściu dla zwiedzających jest stopień. Na wieżę prowadzą schody.' },
    facts: [{ icon: '📍', label: 'Adres', value: 'Plac Mariacki 5, Kraków' }],
    model: 'basilica',
    color: '#4C9EEB',
    suggestedQuestions: [],
  },
  {
    id: 'cloth-hall',
    name: 'Sukiennice',
    tagline: 'Renesansowa hala targowa na Rynku',
    description: 'Historyczna hala targowa na środku Rynku Głównego, mieszcząca kramy, galerię sztuki i muzeum.',
    photos: [],
    visitMinutes: 30,
    walkMinutesFromPrevious: 2,
    coordinates: { latitude: 50.0617, longitude: 19.9373 },
    accessibility: { wheelchair: 'full', stepFree: true, accessibleToilet: true, audioGuide: true, hearingSupport: true, notes: 'Parter z kramami jest bez schodów. Do galerii i podziemi prowadzą windy.' },
    facts: [{ icon: '📍', label: 'Adres', value: 'Rynek Główny 1/3, Kraków' }],
    model: 'clothhall',
    color: '#E9A23B',
    suggestedQuestions: [],
  },
  {
    id: 'town-hall-tower',
    name: 'Wieża Ratuszowa',
    tagline: 'Pozostałość dawnego krakowskiego ratusza',
    description: 'Gotycka, lekko pochylona wieża, jedyna pozostałość dawnego ratusza przy Rynku Głównym.',
    photos: [],
    visitMinutes: 20,
    walkMinutesFromPrevious: 2,
    coordinates: { latitude: 50.0614, longitude: 19.9364 },
    accessibility: { wheelchair: 'none', stepFree: false, accessibleToilet: false, audioGuide: false, hearingSupport: false, notes: 'Na górę prowadzą wyłącznie wąskie, strome schody.' },
    facts: [{ icon: '📍', label: 'Adres', value: 'Rynek Główny 1, Kraków' }],
    model: 'tower',
    color: '#9B7BEA',
    suggestedQuestions: [],
  },
  {
    id: 'wawel-castle', 
    name: 'Zamek Królewski na Wawelu',
    tagline: 'Królewski zamek na wzgórzu',
    description: 'Dawna siedziba polskich królów z renesansowym dziedzińcem, komnatami i skarbcem.',
    photos: [],
    visitMinutes: 60,
    walkMinutesFromPrevious: 15,
    coordinates: { latitude: 50.054, longitude: 19.9354 },
    accessibility: { wheelchair: 'partial', stepFree: true, accessibleToilet: true, audioGuide: true, hearingSupport: true, notes: 'Na wzgórze prowadzi droga bez schodów, ale stroma. Nie wszystkie wystawy mają windy.' },
    facts: [{ icon: '📍', label: 'Adres', value: 'Wawel 5, Kraków' }],
    model: 'castle',
    color: '#3DBE8B',
    suggestedQuestions: [],
  },
  {
    id: 'dragon',
    name: 'Smocza Jama',
    tagline: 'Jaskinia i ziejący ogniem smok',
    description: 'Jaskinia pod Wawelem związana z legendą o smoku wawelskim; obok znajduje się pomnik smoka.',
    photos: [],
    visitMinutes: 15,
    walkMinutesFromPrevious: 5,
    coordinates: { latitude: 50.0535, longitude: 19.9339 },
    accessibility: { wheelchair: 'none', stepFree: false, accessibleToilet: false, audioGuide: false, hearingSupport: false, notes: 'Do jaskini prowadzą długie, kręcone schody. Pomnik smoka nad Wisłą jest dostępny bez schodów.' },
    facts: [{ icon: '📍', label: 'Miejsce', value: 'Bulwar Czerwieński, Kraków' }],
    model: 'dragon',
    color: '#2BB5A3',
    suggestedQuestions: [],
  },
  {
    id: 'old-synagogue',
    name: 'Stara Synagoga',
    tagline: 'Serce historycznego Kazimierza',
    description: 'Najstarszy zachowany budynek synagogi w Polsce, dziś oddział Muzeum Krakowa.',
    photos: [],
    visitMinutes: 30,
    walkMinutesFromPrevious: 18,
    coordinates: { latitude: 50.0515, longitude: 19.9487 },
    accessibility: { wheelchair: 'partial', stepFree: false, accessibleToilet: true, audioGuide: true, hearingSupport: false, notes: 'Główna sala znajduje się kilka stopni poniżej poziomu ulicy. Może być dostępna rampa.' },
    facts: [{ icon: '📍', label: 'Adres', value: 'ul. Szeroka 24, Kraków' }],
    model: 'synagogue',
    color: '#D9B44A',
    suggestedQuestions: [],
  },
  {
    id: 'bernatek-bridge',
    name: 'Kładka Ojca Bernatka',
    tagline: 'Kłódki zakochanych i unoszący się akrobaci',
    description: 'Kładka nad Wisłą łącząca Kazimierz z Podgórzem, ozdobiona rzeźbami balansujących akrobatów.',
    photos: [],
    visitMinutes: 15,
    walkMinutesFromPrevious: 8,
    coordinates: { latitude: 50.0478, longitude: 19.9486 },
    accessibility: { wheelchair: 'full', stepFree: true, accessibleToilet: false, audioGuide: false, hearingSupport: false, notes: 'Rampy po obu stronach i równy, szeroki pomost.' },
    facts: [{ icon: '📍', label: 'Łączy', value: 'Kazimierz i Podgórze' }],
    model: 'bridge',
    color: '#E46FA8',
    suggestedQuestions: [],
  },
];

@Injectable()
export class AppService {
  private landmarks = seedPlaces.map((place) => structuredClone(place));
  private reports: StoredReport[] = [];

  getHello(): string {
    return 'Hello World!';
  }

  getLandmarks(): Landmark[] {
    return this.landmarks.map((place) => structuredClone(place));
  }

  getLandmark(id: string): Landmark {
    return structuredClone(this.findLandmark(id));
  }

  getAdminLandmarks() {
    return this.landmarks.map((place) => ({
      ...structuredClone(place),
      reportCounts: this.getReportCounts(place.id),
    }));
  }

  updateLandmark(id: string, changes: unknown) {
    const place = this.findLandmark(id);
    if (!this.isRecord(changes)) {
      throw new BadRequestException('Oczekiwano obiektu z aktualizowanymi danymi miejsca.');
    }

    const updated = structuredClone(place);
    if ('name' in changes) {
      updated.name = this.stringValue(changes.name, 'name', 120);
      if (!updated.name.trim()) throw new BadRequestException('Nazwa miejsca nie może być pusta.');
    }
    if ('tagline' in changes) updated.tagline = this.stringValue(changes.tagline, 'tagline', 200);
    if ('description' in changes) updated.description = this.stringValue(changes.description, 'description', 4000);

    if ('photos' in changes) {
      if (!Array.isArray(changes.photos) || changes.photos.length > 12) {
        throw new BadRequestException('photos musi być tablicą co najwyżej 12 adresów URL.');
      }
      updated.photos = changes.photos.map((url: unknown) => {
        const value = this.stringValue(url, 'photos', 2048).trim();
        if (!/^https:\/\//i.test(value)) {
          throw new BadRequestException('Każde zdjęcie musi być adresem https://.');
        }
        return value;
      });
    }

    if ('coordinates' in changes) {
      if (!this.isRecord(changes.coordinates)) {
        throw new BadRequestException('coordinates musi zawierać latitude i longitude.');
      }
      updated.coordinates = {
        latitude: this.coordinateValue(changes.coordinates.latitude, 'latitude', -90, 90),
        longitude: this.coordinateValue(changes.coordinates.longitude, 'longitude', -180, 180),
      };
    }

    if ('accessibility' in changes) {
      if (!this.isRecord(changes.accessibility)) {
        throw new BadRequestException('accessibility musi być obiektem.');
      }
      const access = changes.accessibility;
      if ('wheelchair' in access) {
        if (!['full', 'partial', 'none'].includes(String(access.wheelchair))) {
          throw new BadRequestException('Nieprawidłowa wartość wheelchair.');
        }
        updated.accessibility.wheelchair = access.wheelchair as WheelchairAccess;
      }
      for (const key of ['stepFree', 'accessibleToilet', 'audioGuide', 'hearingSupport'] as const) {
        if (key in access) {
          if (typeof access[key] !== 'boolean') {
            throw new BadRequestException(`${key} musi być wartością logiczną.`);
          }
          updated.accessibility[key] = access[key];
        }
      }
      if ('notes' in access) {
        updated.accessibility.notes = this.stringValue(access.notes, 'notes', 2000);
      }
    }

    this.landmarks = this.landmarks.map((item) => item.id === id ? updated : item);
    return { ...structuredClone(updated), reportCounts: this.getReportCounts(id) };
  }

  addAccessibilityReport(input: unknown): { accepted: true } {
    if (!this.isRecord(input) || !this.isRecord(input.segment)) {
      throw new BadRequestException('Nieprawidłowy format zgłoszenia dostępności.');
    }
    if (!['wheelchair', 'stepFree', 'smoothSurface', 'lowVision'].includes(String(input.category))) {
      throw new BadRequestException('Nieprawidłowa kategoria zgłoszenia.');
    }
    if (typeof input.accessible !== 'boolean') {
      throw new BadRequestException('accessible musi być wartością logiczną.');
    }
    const toStopId = input.segment.toStopId;
    if (typeof toStopId !== 'string' || !this.landmarks.some((place) => place.id === toStopId)) {
      throw new BadRequestException('Zgłoszenie musi wskazywać istniejące miejsce docelowe.');
    }
    this.reports.push({
      category: input.category as ReportCategory,
      accessible: input.accessible,
      toStopId,
      createdAt: typeof input.createdAt === 'string' ? input.createdAt : new Date().toISOString(),
    });
    return { accepted: true };
  }

  private getReportCounts(placeId: string) {
    const reports = this.reports.filter(
      (report) => report.toStopId === placeId && report.category === 'wheelchair',
    );
    const accessible = reports.filter((report) => report.accessible).length;
    const inaccessible = reports.length - accessible;
    return { accessible, inaccessible, total: reports.length };
  }

  private findLandmark(id: string): Landmark {
    const place = this.landmarks.find((item) => item.id === id);
    if (!place) throw new NotFoundException(`Nie znaleziono miejsca o identyfikatorze "${id}".`);
    return place;
  }

  private stringValue(value: unknown, field: string, maxLength: number): string {
    if (typeof value !== 'string' || value.length > maxLength) {
      throw new BadRequestException(`${field} musi być tekstem do ${maxLength} znaków.`);
    }
    return value;
  }

  private coordinateValue(value: unknown, field: string, min: number, max: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
      throw new BadRequestException(`${field} musi być liczbą od ${min} do ${max}.`);
    }
    return value;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
