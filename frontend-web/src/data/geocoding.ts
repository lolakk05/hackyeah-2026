export interface GeocodedLocation {
  latitude: number
  longitude: number
  address: string
}

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
  address?: unknown
}

let nextRequestAt = 0

function isNominatimResult(value: unknown): value is NominatimResult {
  if (typeof value !== 'object' || value === null) return false
  const result = value as Record<string, unknown>
  return (
    typeof result.lat === 'string' &&
    typeof result.lon === 'string' &&
    typeof result.display_name === 'string'
  )
}

async function waitForRequestSlot(signal: AbortSignal): Promise<void> {
  const now = Date.now()
  const requestAt = Math.max(now, nextRequestAt)
  nextRequestAt = requestAt + 1000
  const delay = requestAt - now
  if (delay === 0) return

  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    }, delay)
    const abort = () => {
      window.clearTimeout(timer)
      reject(new DOMException('Geokodowanie anulowane.', 'AbortError'))
    }
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
  })
}

async function fetchNominatim(url: URL, signal: AbortSignal): Promise<unknown> {
  await waitForRequestSlot(signal)
  const response = await fetch(url, {
    headers: { 'Accept-Language': 'pl' },
    signal,
  })
  if (!response.ok) {
    throw new Error(
      response.status === 429
        ? 'Usługa wyszukiwania adresów jest chwilowo przeciążona. Spróbuj ponownie za chwilę.'
        : 'Nie udało się połączyć z usługą wyszukiwania adresów.',
    )
  }
  return response.json() as Promise<unknown>
}

function parseCoordinates(result: NominatimResult): { latitude: number; longitude: number } {
  const latitude = Number(result.lat)
  const longitude = Number(result.lon)
  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error('Usługa zwróciła nieprawidłowe współrzędne.')
  }
  return { latitude, longitude }
}

function reverseAddress(result: NominatimResult): string {
  if (typeof result.address !== 'object' || result.address === null) return result.display_name
  const address = result.address as Record<string, unknown>
  const street = [
    address.road,
    address.pedestrian,
    address.residential,
    address.footway,
  ].find((part): part is string => typeof part === 'string' && part.trim().length > 0)
  const houseNumber = typeof address.house_number === 'string' ? address.house_number.trim() : ''
  const city = [
    address.city,
    address.town,
    address.village,
    address.municipality,
    address.city_district,
  ].find((part): part is string => typeof part === 'string' && part.trim().length > 0)

  const shortenedAddress = [street, houseNumber, city]
    .filter((part): part is string => Boolean(part))
    .join(' ')
  return shortenedAddress || result.display_name
}

export async function geocodeAddress(address: string, signal: AbortSignal): Promise<GeocodedLocation> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.search = new URLSearchParams({
    q: `${address}, Kraków, Polska`,
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'pl',
    viewbox: '19.5,50.2,20.3,49.8',
    bounded: '1',
  }).toString()

  const result: unknown = await fetchNominatim(url, signal)
  if (!Array.isArray(result) || !isNominatimResult(result[0])) {
    throw new Error('Nie znaleziono tego adresu w Krakowie.')
  }
  return { ...parseCoordinates(result[0]), address: result[0].display_name }
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
  signal: AbortSignal,
): Promise<GeocodedLocation> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.search = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    format: 'jsonv2',
    zoom: '18',
    addressdetails: '1',
  }).toString()

  const result: unknown = await fetchNominatim(url, signal)
  if (!isNominatimResult(result)) {
    throw new Error('Nie znaleziono adresu dla tych współrzędnych.')
  }
  return { ...parseCoordinates(result), address: reverseAddress(result) }
}
