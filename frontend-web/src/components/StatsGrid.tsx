import type { AdminPlace } from '../data/types'
import { Icon } from './Icon'

export function StatsGrid({ places }: { places: AdminPlace[] }) {
  const confirmedAccessible = places.filter(
    (place) => place.accessibility.wheelchair === 'full',
  ).length
  const partiallyAccessible = places.filter(
    (place) => place.accessibility.wheelchair === 'partial',
  ).length
  const inaccessible = places.filter(
    (place) => place.accessibility.wheelchair === 'none',
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
      label: 'Częściowo dostępne',
      value: partiallyAccessible,
      note: 'ograniczona dostępność',
      icon: 'chart' as const,
      color: 'blue',
    },
    {
      label: 'Niedostępne',
      value: inaccessible,
      note: 'brak dostępu dla wózków',
      icon: 'close' as const,
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
