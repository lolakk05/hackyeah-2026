import { useEffect, useRef, useState } from 'react'
import { MAP_ORIGIN } from '../../../frontend/src/map/geo'
import type { AdminPlace, WheelchairAccess } from '../data/types'
import { Icon } from './Icon'

const TILE_SIZE = 256
const INITIAL_ZOOM = 14

const statusLabel: Record<WheelchairAccess, string> = {
  full: 'Dostępne',
  partial: 'Częściowo dostępne',
  none: 'Niedostępne',
}

function project(latitude: number, longitude: number, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom
  const latitudeRadians = (latitude * Math.PI) / 180

  return {
    x: ((longitude + 180) / 360) * scale,
    y:
      ((1 -
        Math.log(Math.tan(latitudeRadians) + 1 / Math.cos(latitudeRadians)) /
          Math.PI) /
        2) *
      scale,
  }
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
  const mapRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ width: 1024, height: 340 })
  const [zoom, setZoom] = useState(INITIAL_ZOOM)
  const origin = project(MAP_ORIGIN.latitude, MAP_ORIGIN.longitude, zoom)
  const centerTileX = Math.floor(origin.x / TILE_SIZE)
  const centerTileY = Math.floor(origin.y / TILE_SIZE)
  const tileCountX = Math.ceil(viewport.width / (2 * TILE_SIZE)) + 1
  const tileCountY = Math.ceil(viewport.height / (2 * TILE_SIZE)) + 1
  const maxTile = 2 ** zoom - 1
  const tiles = []

  for (let row = -tileCountY; row <= tileCountY; row += 1) {
    for (let column = -tileCountX; column <= tileCountX; column += 1) {
      const x = centerTileX + column
      const y = centerTileY + row
      if (x < 0 || x > maxTile || y < 0 || y > maxTile) continue
      tiles.push({
        key: `${zoom}/${x}/${y}`,
        src: `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`,
        left: viewport.width / 2 + x * TILE_SIZE - origin.x,
        top: viewport.height / 2 + y * TILE_SIZE - origin.y,
      })
    }
  }

  useEffect(() => {
    const element = mapRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      setViewport({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={mapRef}
      className="map-canvas"
      aria-label="Mapa Krakowa obejmująca Stare Miasto, Wawel i Kazimierz"
    >
      <div className="map-tiles" aria-hidden="true">
        {tiles.map((tile) => (
          <img
            alt=""
            className="map-tile"
            draggable={false}
            key={tile.key}
            src={tile.src}
            style={{ left: tile.left, top: tile.top }}
          />
        ))}
      </div>
      <div className="map-controls" aria-label="Przybliżenie mapy">
        <button
          aria-label="Przybliż mapę"
          disabled={zoom >= 18}
          onClick={() => setZoom((current) => Math.min(18, current + 1))}
          type="button"
        >
          +
        </button>
        <button
          aria-label="Oddal mapę"
          disabled={zoom <= 13}
          onClick={() => setZoom((current) => Math.max(13, current - 1))}
          type="button"
        >
          −
        </button>
      </div>
      {places.map((place) => {
        const point = project(place.coordinates.latitude, place.coordinates.longitude, zoom)
        const x = viewport.width / 2 + point.x - origin.x
        const y = viewport.height / 2 + point.y - origin.y
        return (
          <button
            aria-label={`${place.name}: ${statusLabel[place.accessibility.wheelchair]}`}
            className={`map-marker ${place.accessibility.wheelchair} ${selectedId === place.id ? 'selected' : ''}`}
            key={place.id}
            onClick={() => onSelect(place.id)}
            style={{ left: x, top: y }}
            title={`${place.name} · ${statusLabel[place.accessibility.wheelchair]}`}
            type="button"
          >
            <Icon name="pin" size={19} />
            {selectedId === place.id && <span className="marker-label">{place.name}</span>}
          </button>
        )
      })}
      <a
        className="map-attribution"
        href="https://www.openstreetmap.org/copyright"
        rel="noreferrer"
        target="_blank"
      >
        © OpenStreetMap contributors
      </a>
    </div>
  )
}
