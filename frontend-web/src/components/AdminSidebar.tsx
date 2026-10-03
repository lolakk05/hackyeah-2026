import { Icon } from './Icon'

type Section = 'places' | 'reports'

export function AdminSidebar({
  activeSection,
  onNavigate,
}: {
  activeSection: Section
  onNavigate: (section: Section) => void
}) {
  return (
    <aside className="sidebar">
      <a className="brand" href="#" aria-label="Dostępny Kraków, strona główna">
        <span className="brand-mark"><Icon name="wheelchair" size={21} /></span>
        <span className="brand-name">otwarty<span>Kraków</span></span>
      </a>

      <div className="sidebar-caption">ZARZĄDZANIE</div>
      <nav className="side-nav" aria-label="Nawigacja panelu">
        <button
          className={`nav-item ${activeSection === 'places' ? 'active' : ''}`}
          onClick={() => onNavigate('places')}
          type="button"
        >
          <Icon name="map" />
          <span>Miejsca na mapie</span>
        </button>
        <button
          className={`nav-item ${activeSection === 'reports' ? 'active' : ''}`}
          onClick={() => onNavigate('reports')}
          type="button"
        >
          <Icon name="chart" />
          <span>Zgłoszenia</span>
        </button>
      </nav>

      <div className="sidebar-bottom">
        <div className="admin-avatar">AK</div>
        <div className="admin-meta">
          <strong>Administrator</strong>
          <span>Panel miasta</span>
        </div>
        <span className="online-indicator" aria-label="Aktywne połączenie" />
      </div>
    </aside>
  )
}
