import type { AdminPlace, WheelchairAccess } from '../data/types'
import { Icon } from './Icon'

const statusLabel: Record<WheelchairAccess, string> = {
  full: 'Dostępne',
  partial: 'Częściowo dostępne',
  none: 'Niedostępne',
}

export function KrakowMap({
  places,
  selectedId,
  onSelect,
}: {
  places: AdminPlace[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const latitudes = places.map((place) => place.coordinates.latitude)
  const longitudes = places.map((place) => place.coordinates.longitude)
  const minLat = Math.min(...latitudes, 50.047) - 0.001
  const maxLat = Math.max(...latitudes, 50.066) + 0.001
  const minLon = Math.min(...longitudes, 19.933) - 0.001
  const maxLon = Math.max(...longitudes, 19.95) + 0.001

  return (
    <div className="map-canvas" aria-label="Schematyczna mapa lokalizacji w Krakowie">
      <div className="map-water" />
      <div className="map-park park-one" />
      <div className="map-park park-two" />
      <div className="map-street street-one" />
      <div className="map-street street-two" />
      <div className="map-street street-three" />
      <div className="map-street street-four" />
      <div className="map-street street-five" />
      <div className="map-district old-town">STARE MIASTO</div>
      <div className="map-district kazimierz">KAZIMIERZ</div>
      <div className="map-district wawel">WAWEL</div>
      {places.map((place) => {
        const x = 6 + ((place.coordinates.longitude - minLon) / (maxLon - minLon)) * 88
        const y = 8 + ((maxLat - place.coordinates.latitude) / (maxLat - minLat)) * 80
        return (
          <button
            aria-label={`${place.name}: ${statusLabel[place.accessibility.wheelchair]}`}
            className={`map-marker ${place.accessibility.wheelchair} ${selectedId === place.id ? 'selected' : ''}`}
            key={place.id}
            onClick={() => onSelect(place.id)}
            style={{ left: `${x}%`, top: `${y}%` }}
            title={`${place.name} · ${statusLabel[place.accessibility.wheelchair]}`}
            type="button"
          >
            <Icon name="pin" size={19} />
            {selectedId === place.id && <span className="marker-label">{place.name}</span>}
          </button>
        )
      })}
      <span className="map-attribution">Kraków · lokalizacje z bazy miejsc</span>
    </div>
  )
}
