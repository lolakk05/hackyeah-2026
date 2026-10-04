import { Icon } from './Icon'

type Section = 'places' | 'reports'

export function AdminSidebar({
  activeSection,
  onNavigate,
  onSignOut,
  signingOut,
}: {
  activeSection: Section
  onNavigate: (section: Section) => void
  onSignOut: () => void
  signingOut: boolean
}) {
  return (
    <aside className="sidebar">
      <a className="brand" href="#" aria-label="Dostępny Kraków, strona główna">
        <img className="brand-logo" src="/logo_spacerniak.svg" alt="Spacer.io" />
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
        <div className="sidebar-admin-info">
          <div className="admin-avatar">AD</div>
          <div className="admin-meta">
            <strong>Administrator</strong>
            <span>Zarządzanie miejscami</span>
          </div>
          <span className="online-indicator" aria-label="Aktywne połączenie" />
        </div>
        <button
          aria-label="Wyloguj się"
          className="sidebar-logout"
          disabled={signingOut}
          onClick={onSignOut}
          title="Wyloguj się"
          type="button"
        >
          <Icon name="logout" size={15} />
          <span>Wyloguj się</span>
        </button>
      </div>
    </aside>
  )
}
