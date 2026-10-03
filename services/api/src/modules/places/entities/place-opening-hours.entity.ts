export class PlaceOpeningHour {
  id: string;
  placeId: string;
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
}
