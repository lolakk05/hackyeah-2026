import { Icon } from './Icon'

export function DashboardHeader({
  search,
  onSearch,
  onRefresh,
  loading,
}: {
  search: string
  onSearch: (value: string) => void
  onRefresh: () => void
  loading: boolean
}) {
  return (
    <header className="topbar">
      <div className="breadcrumb">
        <span>Panel</span><span className="crumb-divider">/</span><strong>Kraków</strong>
      </div>
      <div className="topbar-actions">
        <label className="search-field">
          <Icon name="search" size={17} />
          <input
            aria-label="Szukaj miejsca"
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Szukaj miejsca..."
            value={search}
          />
        </label>
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
