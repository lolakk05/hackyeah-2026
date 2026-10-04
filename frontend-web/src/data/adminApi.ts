import type { AdminPlace, PlaceFormValues, PlaceOpeningHour } from './types'

const PLACES_PATH = '/places'
const AUTH_PATH = '/api/auth'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(basePath: string, path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${basePath}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    })
  } catch {
    throw new Error('Nie można połączyć się z usługą miejsc. Sprawdź, czy jest uruchomiona.')
  }

  if (!response.ok) {
    if (
      response.status === 502 &&
      response.headers.get('ngrok-error-code') === 'ERR_NGROK_8012'
    ) {
      throw new ApiError(
        'Usługa miejsc nie odpowiada: ngrok nie może połączyć się z API pod adresem localhost:3000. Uruchom API i tunel ngrok, a potem spróbuj ponownie.',
        response.status,
      )
    }

    if (response.status === 502) {
      throw new ApiError(
        'Usługa miejsc jest chwilowo niedostępna. Sprawdź, czy API i połączenie z nim są uruchomione.',
        response.status,
      )
    }

    if (response.status === 403) {
      throw new ApiError(
        'Twoje konto nie ma uprawnień administratora do zarządzania miejscami. Zaloguj się na konto administratora lub poproś o nadanie tej roli.',
        response.status,
      )
    }

    let message = 'Nie udało się wykonać operacji. Spróbuj ponownie.'
    try {
      const body: unknown = await response.json()
      if (typeof body === 'object' && body !== null && 'message' in body) {
        const detail = body.message
        if (typeof detail === 'string') message = detail
        else if (Array.isArray(detail) && detail.every((item) => typeof item === 'string')) {
          message = detail.join(', ')
        }
      }
    } catch {
      message = response.statusText || message
    }
    throw new ApiError(message, response.status)
  }

  return (await response.json()) as T
}

export function signIn(email: string, password: string): Promise<unknown> {
  return request<unknown>(AUTH_PATH, '/sign-in/email', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function signOut(): Promise<unknown> {
  return request<unknown>(AUTH_PATH, '/sign-out', {
    method: 'POST',
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isPlaceOpeningHour(value: unknown): value is PlaceOpeningHour {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isNonnegativeInteger(value.dayOfWeek) &&
    value.dayOfWeek <= 6 &&
    (typeof value.openTime === 'string' || value.openTime === null) &&
    (typeof value.closeTime === 'string' || value.closeTime === null) &&
    typeof value.isClosed === 'boolean'
  )
}

function toAdminPlace(value: unknown): AdminPlace | null {
  if (!isRecord(value)) return null
  const placeId = value.placeId
  const descriptionPL = value.descriptionPL
  const descriptionEN = value.descriptionEN
  const openingHours = value.openingHours ?? []
  if (
    typeof placeId !== 'string' ||
    typeof value.name !== 'string' ||
    typeof descriptionPL !== 'string' ||
    typeof descriptionEN !== 'string' ||
    !isNonnegativeInteger(value.timeToVisit) ||
    !isStringArray(value.photos) ||
    typeof value.hasStairs !== 'boolean' ||
    typeof value.wheelchairAccessible !== 'boolean' ||
    typeof value.hasAccessibleToilet !== 'boolean' ||
    typeof value.price !== 'string' ||
    typeof value.address !== 'string' ||
    !isNumber(value.latitude) ||
    value.latitude < -90 ||
    value.latitude > 90 ||
    !isNumber(value.longitude) ||
    value.longitude < -180 ||
    value.longitude > 180 ||
    !Array.isArray(openingHours) ||
    !openingHours.every(isPlaceOpeningHour)
  ) {
    return null
  }

  return {
    id: placeId,
    name: value.name,
    descriptionPL,
    descriptionEN,
    timeToVisit: value.timeToVisit,
    photos: value.photos,
    hasStairs: value.hasStairs,
    wheelchairAccessible: value.wheelchairAccessible,
    hasAccessibleToilet: value.hasAccessibleToilet,
    price: value.price,
    address: value.address,
    latitude: value.latitude,
    longitude: value.longitude,
    openingHours,
  }
}

export async function fetchPlaces(): Promise<AdminPlace[]> {
  const result: unknown = await request('', PLACES_PATH)
  if (!Array.isArray(result)) {
    throw new Error('Usługa zwróciła listę miejsc w nieoczekiwanym formacie.')
  }
  const places = result.map(toAdminPlace)
  const validPlaces = places.filter((place): place is AdminPlace => place !== null)
  if (validPlaces.length !== places.length) {
    throw new Error('Dane jednego lub kilku miejsc są niekompletne.')
  }
  return validPlaces
}

export async function createPlace(values: PlaceFormValues): Promise<AdminPlace> {
  const result: unknown = await request('', PLACES_PATH, {
    method: 'POST',
    body: JSON.stringify({
      name: values.name,
      descriptionPL: values.descriptionPL,
      descriptionEN: values.descriptionEN,
      timeToVisit: values.timeToVisit,
      photos: values.photos,
      hasStairs: values.hasStairs,
      wheelchairAccessible: values.wheelchairAccessible,
      hasAccessibleToilet: values.hasAccessibleToilet,
      price: values.price,
      address: values.address,
      latitude: values.latitude,
      longitude: values.longitude,
    }),
  })
  const place = toAdminPlace(result)
  if (!place) {
    throw new Error('Dodano miejsce, ale otrzymane dane są niekompletne.')
  }
  return place
}

export async function updatePlace(id: string, values: PlaceFormValues): Promise<AdminPlace> {
  const result: unknown = await request('', `${PLACES_PATH}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: values.name,
      descriptionPL: values.descriptionPL,
      descriptionEN: values.descriptionEN,
      timeToVisit: values.timeToVisit,
      photos: values.photos,
      hasStairs: values.hasStairs,
      wheelchairAccessible: values.wheelchairAccessible,
      hasAccessibleToilet: values.hasAccessibleToilet,
      price: values.price,
      address: values.address,
      latitude: values.latitude,
      longitude: values.longitude,
    }),
  })
  const place = toAdminPlace(result)
  if (!place) {
    throw new Error('Zapisano miejsce, ale otrzymane dane są niekompletne.')
  }
  return place
}

export async function deletePlace(id: string): Promise<void> {
  await request('', `${PLACES_PATH}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}
