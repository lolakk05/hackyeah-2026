import type { AdminPlace } from '../data/types'
import { Icon } from './Icon'

export function StatsGrid({ places }: { places: AdminPlace[] }) {
  const reports = places.reduce(
    (sum, place) => ({
      accessible: sum.accessible + place.reportCounts.accessible,
      inaccessible: sum.inaccessible + place.reportCounts.inaccessible,
    }),
    { accessible: 0, inaccessible: 0 },
  )
  const total = reports.accessible + reports.inaccessible
  const confirmedAccessible = places.filter(
    (place) => place.accessibility.wheelchair === 'full',
  ).length

  const stats = [
    {
      label: 'Miejsca na mapie',
      value: places.length,
      note: 'w bazie Krakowa',
      icon: 'map' as const,
      color: 'mint',
    },
    {
      label: 'Dostępne bez barier',
      value: confirmedAccessible,
      note: 'pełna dostępność',
      icon: 'wheelchair' as const,
      color: 'green',
    },
    {
      label: 'Zgłoszenia dostępności',
      value: total,
      note: `${reports.accessible} dostępne · ${reports.inaccessible} niedostępne`,
      icon: 'chart' as const,
      color: 'blue',
    },
    {
      label: 'Udział pozytywnych',
      value: total ? `${Math.round((reports.accessible / total) * 100)}%` : '—',
      note: 'na podstawie zgłoszeń',
      icon: 'check' as const,
      color: 'amber',
    },
  ]

  return (
    <section className="stats-grid" aria-label="Podsumowanie">
      {stats.map((stat) => (
        <article className="stat-card panel" key={stat.label}>
          <div className={`stat-icon ${stat.color}`}><Icon name={stat.icon} size={19} /></div>
          <span className="stat-label">{stat.label}</span>
          <strong className="stat-value">{stat.value}</strong>
          <span className="stat-note">{stat.note}</span>
        </article>
      ))}
    </section>
  )
}
