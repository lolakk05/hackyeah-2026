import { useCallback, useEffect, useState } from 'react'
import './App.css'
import { AdminLogin } from './components/AdminLogin'
import { AdminSidebar } from './components/AdminSidebar'
import { DashboardHeader } from './components/DashboardHeader'
import { KrakowMap } from './components/KrakowMap'
import { PlaceEditor } from './components/PlaceEditor'
import { PlaceList } from './components/PlaceList'
import { ReportsPanel } from './components/ReportsPanel'
import { StatsGrid } from './components/StatsGrid'
import { ApiError, createPlace, deletePlace, fetchPlaces, signIn, signOut, updatePlace } from './data/adminApi'
import { DEMO_ACCESSIBILITY_REPORTS, DEMO_PLACES } from './data/demoPlaces'
import type { AdminPlace, PlaceFormValues } from './data/types'

const PAGE_SIZE = 8

function App() {
  const [places, setPlaces] = useState<AdminPlace[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pickedCoordinates, setPickedCoordinates] = useState<{ latitude: number; longitude: number } | null>(null)
  const [mapMarkerCoordinates, setMapMarkerCoordinates] = useState<{ latitude: number; longitude: number } | null>(null)
  const [isCreatingPlace, setIsCreatingPlace] = useState(false)
  const [page, setPage] = useState(1)
  const [section, setSection] = useState<'places' | 'reports'>('places')
  const [loading, setLoading] = useState(true)
  const [loginLoading, setLoginLoading] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [accessState, setAccessState] = useState<'checking' | 'authenticated' | 'required'>('checking')
  const [demoMode, setDemoMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let active = true
    fetchPlaces().then(
      (result) => {
        if (!active) return
        setPlaces(result)
        setSelectedId((current) =>
          current && result.some((place) => place.id === current)
            ? current
            : result[0]?.id ?? null,
        )
        setError('')
        setLoading(false)
        setAccessState('authenticated')
      },
      (cause: unknown) => {
        if (!active) return
        if (cause instanceof ApiError && cause.status === 401) {
          setAccessState('required')
          setError('')
          setLoading(false)
          return
        }
        setError(cause instanceof Error ? cause.message : 'Nie udało się pobrać miejsc.')
        setLoading(false)
        setAccessState('authenticated')
      },
    )
    return () => {
      active = false
    }
  }, [refreshKey])

  const pageCount = Math.max(1, Math.ceil(places.length / PAGE_SIZE))
  const pagePlaces = places.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const selectedPlace = places.find((place) => place.id === selectedId) ?? null
  const clearMapCoordinates = useCallback(() => {
    setPickedCoordinates(null)
    setMapMarkerCoordinates(null)
  }, [])
  const showMapCoordinates = useCallback((latitude: number, longitude: number) => {
    setMapMarkerCoordinates({ latitude, longitude })
  }, [])

  const refreshData = () => {
    if (demoMode) {
      setError('')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    setRefreshKey((key) => key + 1)
  }

  const savePlace = async (values: PlaceFormValues) => {
    if (!isCreatingPlace && !selectedPlace) return
    setSaving(true)
    setSaveError('')
    setSaveMessage('')
    try {
      if (isCreatingPlace) {
        const created: AdminPlace = demoMode
          ? { ...values, id: `demo-${crypto.randomUUID()}`, openingHours: [] }
          : await createPlace(values)
        setPlaces((current) => [...current, created])
        setPage(1)
        setSelectedId(created.id)
        setIsCreatingPlace(false)
      } else {
        if (!selectedPlace) return
        const updated: AdminPlace = demoMode
          ? { ...selectedPlace, ...values }
          : await updatePlace(selectedPlace.id, values)
        setPlaces((current) => current.map((place) => (place.id === updated.id ? updated : place)))
      }
      setPickedCoordinates(null)
      setMapMarkerCoordinates(null)
      setSaveMessage(isCreatingPlace ? '' : 'Zmiany zostały zapisane.')
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        setAccessState('required')
        setLoginError('Sesja wygasła. Zaloguj się ponownie.')
        return
      }
      setSaveError(cause instanceof Error ? cause.message : 'Nie udało się zapisać zmian.')
    } finally {
      setSaving(false)
    }
  }

  const removePlace = async () => {
    if (!selectedPlace || deleting) return
    const confirmed = window.confirm(`Czy na pewno chcesz usunąć miejsce „${selectedPlace.name}”? Tej operacji nie można cofnąć.`)
    if (!confirmed) return

    setDeleting(true)
    setSaveError('')
    setSaveMessage('')
    try {
      if (!demoMode) await deletePlace(selectedPlace.id)
      const remainingPlaces = places.filter((place) => place.id !== selectedPlace.id)
      setPlaces(remainingPlaces)
      setSelectedId(remainingPlaces[0]?.id ?? null)
      setPickedCoordinates(null)
      setMapMarkerCoordinates(null)
      setIsCreatingPlace(false)
      setSaveMessage('')
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        setAccessState('required')
        setLoginError('Sesja wygasła. Zaloguj się ponownie.')
        return
      }
      setSaveError(cause instanceof Error ? cause.message : 'Nie udało się usunąć miejsca.')
    } finally {
      setDeleting(false)
    }
  }

  const selectPage = (value: number) => {
    setPage(Math.max(1, Math.min(pageCount, value)))
  }

  const startCreatingPlace = () => {
    if (isCreatingPlace) {
      cancelCreatingPlace()
      return
    }
    setIsCreatingPlace(true)
    setPickedCoordinates(null)
    setMapMarkerCoordinates(null)
    setSaveError('')
    setSaveMessage('')
    setSelectedId(null)
  }

  const cancelCreatingPlace = () => {
    setIsCreatingPlace(false)
    setPickedCoordinates(null)
    setMapMarkerCoordinates(null)
    setSaveError('')
    setSaveMessage('')
    setSelectedId(places[0]?.id ?? null)
  }

  const login = async (email: string, password: string) => {
    setLoginLoading(true)
    setLoginError('')
    try {
      await signIn(email, password)
      const result = await fetchPlaces()
      setPlaces(result)
      setDemoMode(false)
      setSelectedId(result[0]?.id ?? null)
      setError('')
      setAccessState('authenticated')
      setLoading(false)
    } catch (cause) {
      setLoginError(cause instanceof Error ? cause.message : 'Nie udało się zalogować.')
      setAccessState('required')
    } finally {
      setLoginLoading(false)
    }
  }

  const continueInDemo = () => {
    setDemoMode(true)
    setPlaces(DEMO_PLACES.map((place) => ({ ...place })))
    setSelectedId(DEMO_PLACES[0]?.id ?? null)
    setPickedCoordinates(null)
    setMapMarkerCoordinates(null)
    setIsCreatingPlace(false)
    setPage(1)
    setError('')
    setLoginError('')
    setLoading(false)
    setAccessState('authenticated')
  }

  const logout = async () => {
    if (signingOut) return
    setSigningOut(true)
    setError('')
    try {
      if (!demoMode) await signOut()
      setPlaces([])
      setSelectedId(null)
      setPickedCoordinates(null)
      setMapMarkerCoordinates(null)
      setIsCreatingPlace(false)
      setDemoMode(false)
      setLoginError('')
      setAccessState('required')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się wylogować.')
    } finally {
      setSigningOut(false)
    }
  }

  if (accessState === 'checking') {
    return (
      <main className="login-screen">
        <section className="panel login-panel login-checking" role="status">
          <span className="live-dot" />
          Sprawdzanie połączenia z usługą…
        </section>
      </main>
    )
  }

  if (accessState === 'required') {
    return <AdminLogin onLogin={login} onDemo={continueInDemo} loading={loginLoading} error={loginError} />
  }

  return (
    <div className="app-shell">
      <AdminSidebar
        activeSection={section}
        onNavigate={setSection}
        onSignOut={() => void logout()}
        signingOut={signingOut}
      />
      <main className="main-content">
        {demoMode && (
          <div className="demo-banner" role="status">
            Tryb DEMO — zmiany są tymczasowe i nie są wysyłane do backendu.
          </div>
        )}
        <DashboardHeader
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

        {section === 'places' ? (
          <>
            <section className="welcome-row">
              <div>
                <p className="eyebrow">SPACER.IO · KRAKÓW</p>
                <h1>Miejsca na mapie</h1>
                <p className="welcome-copy">
                  Przeglądaj miejsca w Krakowie, zmieniaj ich dane i sprawdzaj zgłoszenia.
                </p>
              </div>
              <div className="last-updated">
                <span className="live-dot" />
                {loading ? 'Łączenie z usługą' : 'Dane z usługi miejsc'}
              </div>
            </section>

            <StatsGrid places={places} loading={loading} />

            <section className="map-section panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">WIDOK MIASTA</p>
                  <h2>Miejsca · okolice Rynku</h2>
                </div>
                <div className="map-legend">
                  <span><i className="legend-dot poi" /> Miejsce w usłudze</span>
                  {(isCreatingPlace || selectedPlace) && (
                    <span className="map-pick-hint">Kliknij mapę, aby ustawić współrzędne</span>
                  )}
                </div>
              </div>
              <KrakowMap
                places={places}
                selectedId={selectedId}
                onSelect={(id) => {
                  setIsCreatingPlace(false)
                  clearMapCoordinates()
                  setSaveError('')
                  setSaveMessage('')
                  setSelectedId(id)
                }}
                coordinatePicking={isCreatingPlace || selectedPlace !== null}
                pickedCoordinates={mapMarkerCoordinates}
                onPickCoordinates={(latitude, longitude) => {
                  const coordinates = { latitude, longitude }
                  setPickedCoordinates(coordinates)
                  setMapMarkerCoordinates(coordinates)
                }}
              />
            </section>

            <section className="workspace-grid">
              <PlaceList
                places={pagePlaces}
                total={places.length}
                selectedId={selectedId}
                page={page}
                pageSize={PAGE_SIZE}
                onPage={selectPage}
                onSelect={(id) => {
                  setIsCreatingPlace(false)
                  clearMapCoordinates()
                  setSaveError('')
                  setSaveMessage('')
                  setSelectedId(id)
                }}
                onCreate={startCreatingPlace}
                creating={isCreatingPlace}
                loading={loading}
              />
              <PlaceEditor
                place={isCreatingPlace ? null : selectedPlace}
                onSave={savePlace}
                saving={saving}
                saveError={saveError}
                saveMessage={saveMessage}
                isCreating={isCreatingPlace}
                onCancelCreate={cancelCreatingPlace}
                onDelete={removePlace}
                deleting={deleting}
                pickedCoordinates={pickedCoordinates}
                onClearPickedCoordinates={clearMapCoordinates}
                onGeocodedCoordinates={showMapCoordinates}
              />
            </section>
          </>
        ) : (
          <section className="reports-page">
            <section className="welcome-row">
              <div>
                <p className="eyebrow">INFORMACJE</p>
                <h1>Zgłoszenia dostępności</h1>
                <p className="welcome-copy">
                  {demoMode
                    ? 'Przykładowe głosy o dostępności miejsc — widoczne tylko w trybie DEMO.'
                    : 'Dane o zgłoszeniach pojawią się, gdy usługa zacznie udostępniać ich zestawienie.'}
                </p>
              </div>
              <button className="secondary-button" onClick={refreshData} type="button">
                Odśwież dane
              </button>
            </section>
            <ReportsPanel
              demoMode={demoMode}
              places={places}
              reports={DEMO_ACCESSIBILITY_REPORTS}
            />
          </section>
        )}
        <footer className="page-footer">
          <span>Spacer.io · Kraków</span>
          <span>Przeglądanie i edycja miejsc</span>
        </footer>
      </main>
    </div>
  )
}

export default App
