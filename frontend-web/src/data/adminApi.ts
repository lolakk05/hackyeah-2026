import type { AdminPlace, PlaceFormValues } from './types'

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '')

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    })
  } catch {
    throw new Error(`Nie można połączyć się z API (${API_URL}). Uruchom backend i spróbuj ponownie.`)
  }

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`API ${response.status}: ${body || response.statusText}`)
  }
  return (await response.json()) as T
}

export function fetchPlaces(): Promise<AdminPlace[]> {
  return request<AdminPlace[]>('/admin/landmarks')
}

export function updatePlace(id: string, values: PlaceFormValues): Promise<AdminPlace> {
  return request<AdminPlace>(`/admin/landmarks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: values.name,
      tagline: values.tagline,
      description: values.description,
      coordinates: { latitude: values.latitude, longitude: values.longitude },
      accessibility: {
        wheelchair: values.wheelchair,
        stepFree: values.stepFree,
        accessibleToilet: values.accessibleToilet,
        audioGuide: values.audioGuide,
        hearingSupport: values.hearingSupport,
        notes: values.notes,
      },
    }),
  })
}
