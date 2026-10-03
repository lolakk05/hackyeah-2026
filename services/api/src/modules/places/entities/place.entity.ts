import { PlaceOpeningHour } from './place-opening-hours.entity';

export class Place {
  placeId: string;
  name: string;
  shortDescription: string;
  timeToVisit: number;
  photos: string[];

  descriptionPL: string;
  descriptionEN: string;

  hasStairs: boolean;
  wheelchairAccessible: boolean;
  hasAccessibleToilet: boolean;

  price: string;
  address: string;
  latitude: number;
  longitude: number;

  openingHours?: PlaceOpeningHour[];
}
