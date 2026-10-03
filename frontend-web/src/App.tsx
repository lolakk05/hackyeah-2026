import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { AdminSidebar } from './components/AdminSidebar'
import { DashboardHeader } from './components/DashboardHeader'
import { KrakowMap } from './components/KrakowMap'
import { PlaceEditor } from './components/PlaceEditor'
import { PlaceList } from './components/PlaceList'
import { ReportsPanel } from './components/ReportsPanel'
import { StatsGrid } from './components/StatsGrid'
import { fetchPlaces, updatePlace } from './data/adminApi'
import type { AdminPlace, PlaceFormValues } from './data/types'

function App() {
  const [places, setPlaces] = useState<AdminPlace[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [section, setSection] = useState<'places' | 'reports'>('places')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  const loadPlaces = useCallback(async () => {
    try {
      const nextPlaces = await fetchPlaces()
      setPlaces(nextPlaces)
      setSelectedId((current) =>
        current && nextPlaces.some((place) => place.id === current)
          ? current
          : nextPlaces[0]?.id ?? null,
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się pobrać miejsc.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchPlaces().then(
      (nextPlaces) => {
        if (cancelled) return
        setPlaces(nextPlaces)
        setSelectedId(nextPlaces[0]?.id ?? null)
        setLoading(false)
      },
      (cause: unknown) => {
        if (cancelled) return
        setError(cause instanceof Error ? cause.message : 'Nie udało się pobrać miejsc.')
        setLoading(false)
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  const selectedPlace = places.find((place) => place.id === selectedId) ?? null
  const visiblePlaces = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pl')
    return places.filter((place) => {
      const matchesSearch =
        !query ||
        place.name.toLocaleLowerCase('pl').includes(query) ||
        place.id.toLocaleLowerCase('pl').includes(query)
      const matchesFilter =
        filter === 'all' ||
        (filter === 'full' && place.accessibility.wheelchair === 'full') ||
        (filter === 'partial' && place.accessibility.wheelchair === 'partial') ||
        (filter === 'none' && place.accessibility.wheelchair === 'none')
      return matchesSearch && matchesFilter
    })
  }, [filter, places, search])

  const savePlace = async (values: PlaceFormValues) => {
    if (!selectedPlace) return
    setSaving(true)
    setNotice('')
    setError('')
    try {
      const updatedPlace = await updatePlace(selectedPlace.id, values)
      setPlaces((current) =>
        current.map((place) =>
          place.id === updatedPlace.id ? updatedPlace : place,
        ),
      )
      setNotice('Zmiany zostały zapisane.')
      window.setTimeout(() => setNotice(''), 3500)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się zapisać zmian.')
    } finally {
      setSaving(false)
    }
  }

  const refreshData = () => {
    setLoading(true)
    setError('')
    void loadPlaces()
  }

  return (
    <div className="app-shell">
      <AdminSidebar activeSection={section} onNavigate={setSection} />
      <main className="main-content">
        <DashboardHeader
          search={search}
          onSearch={setSearch}
          onRefresh={refreshData}
          loading={loading}
        />

        {error && (
          <div className="alert-banner" role="alert">
            <span className="alert-dot" />
            <span>{error}</span>
            <button className="text-button" onClick={refreshData} type="button">
              Spróbuj ponownie
            </button>
          </div>
        )}
        {notice && <div className="success-banner" role="status">{notice}</div>}

        {section === 'places' ? (
          <>
            <section className="welcome-row">
              <div>
                <p className="eyebrow">PANEL ZARZĄDZANIA · KRAKÓW</p>
                <h1>Miejsca na mapie</h1>
                <p className="welcome-copy">
                  Zarządzaj informacjami o miejscach i monitoruj ich dostępność.
                </p>
              </div>
              <div className="last-updated">
                <span className="live-dot" />
                Dane z API
              </div>
            </section>

            <StatsGrid places={places} />

            <section className="map-section panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">WIDOK MIASTA</p>
                  <h2>Mapa dostępności</h2>
                </div>
                <div className="map-legend">
                  <span><i className="legend-dot full" /> Dostępne</span>
                  <span><i className="legend-dot partial" /> Częściowo</span>
                  <span><i className="legend-dot none" /> Niedostępne</span>
                </div>
              </div>
              <KrakowMap
                places={places}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </section>

            <section className="workspace-grid">
              <PlaceList
                places={visiblePlaces}
                selectedId={selectedId}
                filter={filter}
                onFilter={setFilter}
                onSelect={setSelectedId}
                loading={loading}
              />
              <PlaceEditor
                key={selectedId ?? 'empty'}
                place={selectedPlace}
                onSave={savePlace}
                saving={saving}
              />
            </section>

          </>
        ) : (
          <section className="reports-page">
            <section className="welcome-row">
              <div>
                <p className="eyebrow">OPINIE O DOSTĘPNOŚCI</p>
                <h1>Zgłoszenia odwiedzających</h1>
                <p className="welcome-copy">
                  Odpowiedzi dotyczące dostępności miejsc docelowych zebrane w aplikacji.
                </p>
              </div>
              <button className="secondary-button" onClick={refreshData} type="button">
                Odśwież dane
              </button>
            </section>
            <ReportsPanel places={places} expanded />
          </section>
        )}
        <footer className="page-footer">
          <span>Panel administratora · Kraków</span>
          <span>Zmiany są zapisywane w API</span>
        </footer>
      </main>
    </div>
  )
}

export default App
