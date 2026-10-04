import type { AdminPlace } from '../data/types'
import { Icon } from './Icon'

export function StatsGrid({
  places,
  loading,
}: {
  places: AdminPlace[]
  loading: boolean
}) {
  const accessiblePlaces = places.filter((place) => place.wheelchairAccessible).length
  const placesWithStairs = places.filter((place) => place.hasStairs).length
  const stats = [
    {
      label: 'Miejsca w panelu',
      value: loading ? '…' : places.length.toLocaleString('pl-PL'),
      note: 'lokalizacje w Krakowie',
      icon: 'map' as const,
      color: 'mint',
    },
    {
      label: 'Dostępne dla wózków',
      value: loading ? '…' : accessiblePlaces.toLocaleString('pl-PL'),
      note: 'według danych miejsca',
      icon: 'wheelchair' as const,
      color: 'blue',
    },
    {
      label: 'Z toaletą dostępną',
      value: loading ? '…' : places.filter((place) => place.hasAccessibleToilet).length.toLocaleString('pl-PL'),
      note: 'według danych miejsca',
      icon: 'pin' as const,
      color: 'green',
    },
    {
      label: 'Miejsca ze schodami',
      value: loading ? '…' : placesWithStairs.toLocaleString('pl-PL'),
      note: 'według danych miejsca',
      icon: 'stairs' as const,
      color: 'amber',
    },
  ]

  return (
    <section className="stats-grid" aria-label="Podsumowanie miejsc">
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
