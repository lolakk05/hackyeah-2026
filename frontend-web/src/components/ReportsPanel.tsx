import type { AdminPlace } from '../data/types'

export function ReportsPanel({
  places,
  expanded = false,
}: {
  places: AdminPlace[]
  expanded?: boolean
}) {
  const sortedPlaces = [...places]
    .filter((place) => place.reportCounts.total > 0)
    .sort((left, right) => right.reportCounts.total - left.reportCounts.total)
  const totalAccessible = places.reduce((sum, place) => sum + place.reportCounts.accessible, 0)
  const totalInaccessible = places.reduce((sum, place) => sum + place.reportCounts.inaccessible, 0)

  return (
    <section className={`panel reports-panel ${expanded ? 'expanded' : ''}`}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">GŁOS ODWIEDZAJĄCYCH</p>
          <h2>Zgłoszenia dostępności</h2>
          <p className="reports-description">
            Odpowiedzi o dostępności dla wózków, przypisane do miejsca docelowego.
          </p>
        </div>
        <div className="report-totals">
          <span className="report-total positive"><i /> {totalAccessible} dostępne</span>
          <span className="report-total negative"><i /> {totalInaccessible} niedostępne</span>
        </div>
      </div>
      {sortedPlaces.length ? (
        <div className="report-list">
          {sortedPlaces.map((place) => {
            const total = place.reportCounts.total
            const positivePercent = total ? (place.reportCounts.accessible / total) * 100 : 0
            return (
              <div className="report-row" key={place.id}>
                <div className="report-place-name">
                  <strong>{place.name}</strong>
                  <span>{total} {total === 1 ? 'zgłoszenie' : 'zgłoszeń'}</span>
                </div>
                <div
                  aria-label={`${Math.round(positivePercent)}% zgłoszeń pozytywnych`}
                  className="report-bar"
                  role="img"
                >
                  <span className="report-bar-positive" style={{ width: `${positivePercent}%` }} />
                </div>
                <div className="report-numbers">
                  <span className="positive-text">+{place.reportCounts.accessible}</span>
                  <span className="negative-text">−{place.reportCounts.inaccessible}</span>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="reports-empty">
          <span className="empty-report-mark">↗</span>
          <div>
            <strong>Brak zgłoszeń o dostępności miejsc</strong>
            <p>Odpowiedzi odwiedzających pojawią się tutaj po przesłaniu ich z aplikacji.</p>
          </div>
        </div>
      )}
    </section>
  )
}
