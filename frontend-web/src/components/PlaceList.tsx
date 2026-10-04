import type { AdminPlace } from '../data/types'

export function PlaceList({
  places,
  total,
  selectedId,
  page,
  pageSize,
  onPage,
  onSelect,
  onCreate,
  creating,
  loading,
}: {
  places: AdminPlace[]
  total: number
  selectedId: string | null
  page: number
  pageSize: number
  onPage: (value: number) => void
  onSelect: (id: string) => void
  onCreate: () => void
  creating: boolean
  loading: boolean
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const firstItem = total === 0 ? 0 : (page - 1) * pageSize + 1
  const lastItem = Math.min(page * pageSize, total)

  return (
    <section className="panel place-list-panel">
      <div className="section-heading list-heading">
        <div>
          <p className="eyebrow">MIEJSCA W KRAKOWIE</p>
          <h2>Miejsca w Krakowie <span className="count-badge">{total.toLocaleString('pl-PL')}</span></h2>
        </div>
        <button className="secondary-button add-place-button" onClick={onCreate} type="button">
          {creating ? 'Anuluj dodawanie' : 'Dodaj miejsce'}
        </button>
      </div>
      <div className="place-list">
        {loading && places.length === 0 ? (
          <div className="empty-state">Pobieranie listy miejsc…</div>
        ) : places.length === 0 ? (
          <div className="empty-state">Nie znaleziono miejsc.</div>
        ) : (
          places.map((place, index) => {
            return (
              <button
                aria-pressed={selectedId === place.id}
                className={`place-row ${selectedId === place.id ? 'selected' : ''}`}
                key={place.id}
                onClick={() => onSelect(place.id)}
                type="button"
              >
                <span className="place-number poi-number">
                  {String((page - 1) * pageSize + index + 1).padStart(2, '0')}
                </span>
                <span className="place-row-main">
                  <strong>{place.name}</strong>
                  <span>{place.address || place.descriptionPL}</span>
                </span>
                <span className={`access-badge ${place.wheelchairAccessible ? 'full' : 'none'}`}>
                  <i />
                  {place.wheelchairAccessible ? 'Dostępne' : 'Niedostępne'}
                </span>
              </button>
            )
          })
        )}
      </div>
      <div className="pagination">
        <span>{firstItem}–{lastItem} z {total.toLocaleString('pl-PL')}</span>
        <div>
          <button
            aria-label="Poprzednia strona"
            disabled={page <= 1 || loading}
            onClick={() => onPage(page - 1)}
            type="button"
          >
            ‹
          </button>
          <span>Strona {page} / {pageCount}</span>
          <button
            aria-label="Następna strona"
            disabled={page >= pageCount || loading}
            onClick={() => onPage(page + 1)}
            type="button"
          >
            ›
          </button>
        </div>
      </div>
    </section>
  )
}
