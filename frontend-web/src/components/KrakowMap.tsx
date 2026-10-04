import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { MAP_ORIGIN } from '../../../frontend/src/map/geo'
import type { AdminPlace } from '../data/types'
import { Icon } from './Icon'

const TILE_SIZE = 256
const INITIAL_ZOOM = 14

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

function unproject(x: number, y: number, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom
  const longitude = (x / scale) * 360 - 180
  const latitude = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / scale))) * 180) / Math.PI
  return {
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
  }
}

export function KrakowMap({
  places,
  selectedId,
  onSelect,
  coordinatePicking,
  pickedCoordinates,
  onPickCoordinates,
}: {
  places: AdminPlace[]
  selectedId: string | null
  onSelect: (id: string) => void
  coordinatePicking: boolean
  pickedCoordinates: { latitude: number; longitude: number } | null
  onPickCoordinates: (latitude: number, longitude: number) => void
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    pointerId: number
    clientX: number
    clientY: number
    panX: number
    panY: number
  } | null>(null)
  const [viewport, setViewport] = useState({ width: 1024, height: 340 })
  const [zoom, setZoom] = useState(INITIAL_ZOOM)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const origin = project(MAP_ORIGIN.latitude, MAP_ORIGIN.longitude, zoom)
  const centerTileX = Math.floor((origin.x - pan.x) / TILE_SIZE)
  const centerTileY = Math.floor((origin.y - pan.y) / TILE_SIZE)
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
        left: viewport.width / 2 + x * TILE_SIZE - origin.x + pan.x,
        top: viewport.height / 2 + y * TILE_SIZE - origin.y + pan.y,
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

  function startPan(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest('button, a'))) return
    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsPanning(true)
  }

  function movePan(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setPan({
      x: drag.panX + event.clientX - drag.clientX,
      y: drag.panY + event.clientY - drag.clientY,
    })
  }

  function stopPan(event: PointerEvent<HTMLDivElement>, allowCoordinatePick = true) {
    const drag = dragRef.current
    if (drag?.pointerId !== event.pointerId) return
    dragRef.current = null
    setIsPanning(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (allowCoordinatePick && coordinatePicking && Math.hypot(event.clientX - drag.clientX, event.clientY - drag.clientY) < 5) {
      const bounds = event.currentTarget.getBoundingClientRect()
      const coordinates = unproject(
        origin.x + event.clientX - bounds.left - viewport.width / 2 - pan.x,
        origin.y + event.clientY - bounds.top - viewport.height / 2 - pan.y,
        zoom,
      )
      onPickCoordinates(coordinates.latitude, coordinates.longitude)
    }
  }

  return (
    <div
      ref={mapRef}
      className={`map-canvas ${isPanning ? 'is-panning' : ''} ${coordinatePicking ? 'is-coordinate-picking' : ''}`}
      aria-label={`Mapa Krakowa obejmująca Stare Miasto, Wawel i Kazimierz. Przeciągnij mapę, aby ją przesunąć.${coordinatePicking ? ' Kliknij mapę, aby ustawić współrzędne miejsca.' : ''}`}
      onPointerCancel={(event) => stopPan(event, false)}
      onPointerDown={startPan}
      onPointerMove={movePan}
      onPointerUp={stopPan}
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
        const point = project(place.latitude, place.longitude, zoom)
        const x = viewport.width / 2 + point.x - origin.x + pan.x
        const y = viewport.height / 2 + point.y - origin.y + pan.y
        return (
          <button
            aria-label={place.name}
            className={`map-marker poi ${selectedId === place.id ? 'selected' : ''}`}
            key={place.id}
            onClick={() => onSelect(place.id)}
            style={{ left: x, top: y }}
            title={place.name}
            type="button"
          >
            <Icon name="pin" size={19} />
            {selectedId === place.id && <span className="marker-label">{place.name}</span>}
          </button>
        )
      })}
      {pickedCoordinates && coordinatePicking && (() => {
        const point = project(pickedCoordinates.latitude, pickedCoordinates.longitude, zoom)
        const x = viewport.width / 2 + point.x - origin.x + pan.x
        const y = viewport.height / 2 + point.y - origin.y + pan.y
        return <span aria-hidden="true" className="map-picked-coordinate" style={{ left: x, top: y }} />
      })()}
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
