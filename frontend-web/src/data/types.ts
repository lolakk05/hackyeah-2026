export interface AdminPlace {
  id: string
  name: string
  descriptionPL: string
  descriptionEN: string
  timeToVisit: number
  photos: string[]
  hasStairs: boolean
  wheelchairAccessible: boolean
  hasAccessibleToilet: boolean
  price: string
  address: string
  latitude: number
  longitude: number
  openingHours: PlaceOpeningHour[]
}

export interface PlaceOpeningHour {
  id: string
  dayOfWeek: number
  openTime: string | null
  closeTime: string | null
  isClosed: boolean
}

export interface PlaceFormValues {
  name: string
  descriptionPL: string
  descriptionEN: string
  timeToVisit: number
  photos: string[]
  hasStairs: boolean
  wheelchairAccessible: boolean
  hasAccessibleToilet: boolean
  price: string
  address: string
  latitude: number
  longitude: number
}
