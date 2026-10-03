import type { AdminPlace, WheelchairAccess } from '../data/types'

const accessCopy: Record<WheelchairAccess, string> = {
  full: 'Dostępne',
  partial: 'Częściowo',
  none: 'Niedostępne',
}

export function PlaceList({
  places,
  selectedId,
  filter,
  onFilter,
  onSelect,
  loading,
}: {
  places: AdminPlace[]
  selectedId: string | null
  filter: string
  onFilter: (value: string) => void
  onSelect: (id: string) => void
  loading: boolean
}) {
  return (
    <section className="panel place-list-panel">
      <div className="section-heading list-heading">
        <div>
          <p className="eyebrow">BAZA LOKALIZACJI</p>
          <h2>Wszystkie miejsca <span className="count-badge">{places.length}</span></h2>
        </div>
        <select
          aria-label="Filtruj według dostępności"
          className="filter-select"
          onChange={(event) => onFilter(event.target.value)}
          value={filter}
        >
          <option value="all">Wszystkie</option>
          <option value="full">Dostępne</option>
          <option value="partial">Częściowo</option>
          <option value="none">Niedostępne</option>
        </select>
      </div>
      <div className="place-list">
        {loading && places.length === 0 ? (
          <div className="empty-state">Pobieranie miejsc…</div>
        ) : places.length === 0 ? (
          <div className="empty-state">Nie znaleziono miejsc dla tego filtra.</div>
        ) : (
          places.map((place, index) => (
            <button
              aria-pressed={selectedId === place.id}
              className={`place-row ${selectedId === place.id ? 'selected' : ''}`}
              key={place.id}
              onClick={() => onSelect(place.id)}
              type="button"
            >
              <span className={`place-number ${place.accessibility.wheelchair}`}>{String(index + 1).padStart(2, '0')}</span>
              <span className="place-row-main">
                <strong>{place.name}</strong>
                <span>{place.tagline || place.id}</span>
              </span>
              <span className={`access-badge ${place.accessibility.wheelchair}`}>
                <i />{accessCopy[place.accessibility.wheelchair]}
              </span>
              <span className="place-report-count">{place.reportCounts.total} zgł.</span>
            </button>
          ))
        )}
      </div>
    </section>
  )
}
