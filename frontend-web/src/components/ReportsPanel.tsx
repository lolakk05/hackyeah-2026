import { Icon } from './Icon'
import type { AdminPlace } from '../data/types'
import type { DemoAccessibilityReport } from '../data/demoPlaces'

export function ReportsPanel({
  demoMode,
  places,
  reports,
}: {
  demoMode: boolean
  places: AdminPlace[]
  reports: DemoAccessibilityReport[]
}) {
  const visibleReports = reports.filter((report) => places.some((place) => place.id === report.placeId))
  const positiveTotal = visibleReports.reduce((total, report) => total + report.positive, 0)
  const negativeTotal = visibleReports.reduce((total, report) => total + report.negative, 0)
  const totalVotes = positiveTotal + negativeTotal

  return (
    <section className="panel reports-panel expanded">
      <div className="section-heading">
        <div>
          <p className="eyebrow">GŁOS ODWIEDZAJĄCYCH</p>
          <h2>Zgłoszenia dostępności</h2>
        </div>
      </div>
      {demoMode ? (
        <>
          <p className="reports-description">
            Przykładowe głosy o tym, czy dane miejsce jest przystosowane dla osób z niepełnosprawnościami.
          </p>
          <div className="demo-report-summary">
            <article className="demo-report-card positive">
              <span className="demo-report-icon"><Icon name="check" size={18} /></span>
              <span className="demo-report-label">Pozytywne zgłoszenia</span>
              <strong>{positiveTotal.toLocaleString('pl-PL')}</strong>
              <span className="demo-report-share">
                {totalVotes ? Math.round((positiveTotal / totalVotes) * 100) : 0}% wszystkich głosów
              </span>
            </article>
            <article className="demo-report-card negative">
              <span className="demo-report-icon"><Icon name="close" size={18} /></span>
              <span className="demo-report-label">Negatywne zgłoszenia</span>
              <strong>{negativeTotal.toLocaleString('pl-PL')}</strong>
              <span className="demo-report-share">
                {totalVotes ? Math.round((negativeTotal / totalVotes) * 100) : 0}% wszystkich głosów
              </span>
            </article>
            <article className="demo-report-card total">
              <span className="demo-report-icon"><Icon name="chart" size={18} /></span>
              <span className="demo-report-label">Wszystkie głosy</span>
              <strong>{totalVotes.toLocaleString('pl-PL')}</strong>
              <span className="demo-report-share">{visibleReports.length} miejsc w zestawieniu</span>
            </article>
          </div>
          <div className="demo-reports-heading">
            <h3>Głosy według miejsca</h3>
            <span>Pozytywne i negatywne</span>
          </div>
          <div className="demo-report-list">
            {visibleReports.map((report) => {
              const placeName = places.find((place) => place.id === report.placeId)?.name ?? ''
              const total = report.positive + report.negative
              const positiveShare = total ? (report.positive / total) * 100 : 0
              return (
                <article className="demo-report-row" key={report.placeId}>
                  <div className="demo-report-place">
                    <strong>{placeName}</strong>
                    <span>{total.toLocaleString('pl-PL')} {total === 1 ? 'głos' : 'głosów'}</span>
                  </div>
                  <div
                    aria-label={`${report.positive} pozytywnych, ${report.negative} negatywnych`}
                    className="demo-report-bar"
                    role="img"
                  >
                    <span className="demo-report-bar-positive" style={{ width: `${positiveShare}%` }} />
                  </div>
                  <div className="demo-report-numbers">
                    <span className="positive-text">+{report.positive}</span>
                    <span className="negative-text">−{report.negative}</span>
                  </div>
                </article>
              )
            })}
          </div>
          <p className="demo-report-disclaimer">Dane przykładowe — nie pochodzą z backendu.</p>
        </>
      ) : (
        <div className="api-limitation reports-limitation">
          <span className="empty-editor-icon"><Icon name="chart" size={20} /></span>
          <div>
            <strong>Brak zestawienia zgłoszeń</strong>
            <p>
              Usługa miejsc nie udostępnia podsumowań zgłoszeń. Informacje o dostępności
              widoczne w szczegółach pochodzą z danych miejsca, a nie z głosów odwiedzających.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
