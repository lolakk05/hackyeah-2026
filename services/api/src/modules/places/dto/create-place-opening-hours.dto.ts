export class CreatePlaceDto {
  name: string;
  shortDescription: string;
  timeToVisit: number;
  photos: string[];
  descriptionPL: string;
  descriptionEN: string;

  hasStairs: boolean;
  wheelchairAccessible: boolean;
  hasAccessibleToilet: boolean;

  openingHours: string;
  price: string;
  address: string;

  latitude: number;
  longitude: number;

  sampleAiQuestions: string[];
}
