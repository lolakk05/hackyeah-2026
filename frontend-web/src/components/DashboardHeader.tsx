import { Icon } from './Icon'

export function DashboardHeader({
  onRefresh,
  loading,
}: {
  onRefresh: () => void
  loading: boolean
}) {
  return (
    <header className="topbar">
      <div className="breadcrumb">
        <span>Panel</span><span className="crumb-divider">/</span><strong>Kraków</strong>
      </div>
      <div className="topbar-actions">
        <button
          aria-label="Odśwież dane"
          className={`icon-button ${loading ? 'is-loading' : ''}`}
          disabled={loading}
          onClick={onRefresh}
          title="Odśwież dane"
          type="button"
        >
          <Icon name="refresh" size={17} />
        </button>
      </div>
    </header>
  )
}
