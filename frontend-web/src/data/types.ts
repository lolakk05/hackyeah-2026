export type WheelchairAccess = 'full' | 'partial' | 'none'

export interface PlaceAccessibility {
  wheelchair: WheelchairAccess
  stepFree: boolean
  accessibleToilet: boolean
  audioGuide: boolean
  hearingSupport: boolean
  notes: string
}

export interface PlaceReportCounts {
  accessible: number
  inaccessible: number
  total: number
}

export interface AdminPlace {
  id: string
  name: string
  tagline: string
  description: string
  coordinates: { latitude: number; longitude: number }
  accessibility: PlaceAccessibility
  reportCounts: PlaceReportCounts
}

export interface PlaceFormValues {
  name: string
  tagline: string
  description: string
  latitude: number
  longitude: number
  wheelchair: WheelchairAccess
  stepFree: boolean
  accessibleToilet: boolean
  audioGuide: boolean
  hearingSupport: boolean
  notes: string
}
