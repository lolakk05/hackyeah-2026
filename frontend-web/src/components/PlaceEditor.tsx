import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { DEMO_PHOTO_CREDITS } from '../data/demoPlaces'
import { geocodeAddress, reverseGeocode } from '../data/geocoding'
import type { AdminPlace, PlaceFormValues } from '../data/types'
import { Icon } from './Icon'

const NEW_PLACE_VALUES: PlaceFormValues = {
  name: '',
  descriptionPL: '',
  descriptionEN: '',
  timeToVisit: 30,
  photos: [],
  hasStairs: false,
  wheelchairAccessible: false,
  hasAccessibleToilet: false,
  price: 'Bezpłatne',
  address: '',
  latitude: 50.0614,
  longitude: 19.9361,
}

function placeToForm(place: AdminPlace): PlaceFormValues {
  return {
    name: place.name,
    descriptionPL: place.descriptionPL,
    descriptionEN: place.descriptionEN,
    timeToVisit: place.timeToVisit,
    photos: place.photos,
    hasStairs: place.hasStairs,
    wheelchairAccessible: place.wheelchairAccessible,
    hasAccessibleToilet: place.hasAccessibleToilet,
    price: place.price,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
  }
}

export function PlaceEditor({
  place,
  onSave,
  saving,
  saveError,
  saveMessage,
  isCreating,
  onCancelCreate,
  onDelete,
  deleting,
  pickedCoordinates,
  onClearPickedCoordinates,
  onGeocodedCoordinates,
}: {
  place: AdminPlace | null
  onSave: (values: PlaceFormValues) => Promise<void>
  saving: boolean
  saveError: string
  saveMessage: string
  isCreating: boolean
  onCancelCreate: () => void
  onDelete: () => Promise<void>
  deleting: boolean
  pickedCoordinates: { latitude: number; longitude: number } | null
  onClearPickedCoordinates: () => void
  onGeocodedCoordinates: (latitude: number, longitude: number) => void
}) {
  if (!place && !isCreating) {
    return (
      <section className="panel editor-panel editor-empty">
        <div className="empty-editor-icon"><Icon name="edit" size={23} /></div>
        <h2>Edytuj miejsce</h2>
        <p>Wybierz miejsce z listy, aby zmienić jego dane.</p>
      </section>
    )
  }

  return (
    <PlaceEditorForm
      key={place?.id ?? 'new-place'}
      place={place}
      onSave={onSave}
      saving={saving}
      saveError={saveError}
      saveMessage={saveMessage}
      isCreating={isCreating}
      onCancelCreate={onCancelCreate}
      onDelete={onDelete}
      deleting={deleting}
      pickedCoordinates={pickedCoordinates}
      onClearPickedCoordinates={onClearPickedCoordinates}
      onGeocodedCoordinates={onGeocodedCoordinates}
    />
  )
}

function PlaceEditorForm({
  place,
  onSave,
  saving,
  saveError,
  saveMessage,
  isCreating,
  onCancelCreate,
  onDelete,
  deleting,
  pickedCoordinates,
  onClearPickedCoordinates,
  onGeocodedCoordinates,
}: {
  place: AdminPlace | null
  onSave: (values: PlaceFormValues) => Promise<void>
  saving: boolean
  saveError: string
  saveMessage: string
  isCreating: boolean
  onCancelCreate: () => void
  onDelete: () => Promise<void>
  deleting: boolean
  pickedCoordinates: { latitude: number; longitude: number } | null
  onClearPickedCoordinates: () => void
  onGeocodedCoordinates: (latitude: number, longitude: number) => void
}) {
  const [values, setValues] = useState(() => place ? placeToForm(place) : { ...NEW_PLACE_VALUES })
  const [photoUrl, setPhotoUrl] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [selectedPhotoIndexes, setSelectedPhotoIndexes] = useState<number[]>([])
  const [geocodingStatus, setGeocodingStatus] = useState<{ kind: 'loading' | 'success' | 'error'; message: string } | null>(null)
  const geocodingController = useRef<AbortController | null>(null)
  const formValues = pickedCoordinates
    ? { ...values, latitude: pickedCoordinates.latitude, longitude: pickedCoordinates.longitude }
    : values

  const runGeocoding = useCallback(async (
    source: 'address' | 'coordinates',
    address: string,
    latitude: number,
    longitude: number,
  ) => {
    geocodingController.current?.abort()
    const controller = new AbortController()
    geocodingController.current = controller
    setGeocodingStatus({
      kind: 'loading',
      message: source === 'address' ? 'Wyszukiwanie współrzędnych…' : 'Wyszukiwanie adresu…',
    })

    try {
      const location = source === 'address'
        ? await geocodeAddress(address.trim(), controller.signal)
        : await reverseGeocode(latitude, longitude, controller.signal)
      if (controller.signal.aborted) return

      setValues((current) =>
        source === 'address'
          ? { ...current, latitude: location.latitude, longitude: location.longitude }
          : { ...current, address: location.address },
      )
      if (source === 'address') {
        onGeocodedCoordinates(location.latitude, location.longitude)
      }
      setGeocodingStatus({
        kind: 'success',
        message: source === 'address' ? 'Współrzędne uzupełniono na podstawie adresu.' : 'Adres uzupełniono na podstawie współrzędnych.',
      })
    } catch (cause) {
      if (controller.signal.aborted) return
      setGeocodingStatus({
        kind: 'error',
        message: cause instanceof Error ? cause.message : 'Nie udało się wyszukać adresu.',
      })
    }
  }, [onGeocodedCoordinates])

  useEffect(() => {
    if (!pickedCoordinates) return
    const timer = window.setTimeout(() => {
      void runGeocoding('coordinates', '', pickedCoordinates.latitude, pickedCoordinates.longitude)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [pickedCoordinates, runGeocoding])

  useEffect(() => () => geocodingController.current?.abort(), [])

  const setField = <K extends keyof PlaceFormValues>(key: K, value: PlaceFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }))
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void onSave(formValues)
  }

  const addPhoto = () => {
    const url = photoUrl.trim()
    try {
      const parsedUrl = new URL(url)
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error('Nieobsługiwany protokół adresu URL.')
      }
    } catch {
      setPhotoError('Wpisz prawidłowy adres URL zdjęcia (http lub https).')
      return
    }
    if (values.photos.includes(url)) {
      setPhotoError('Ten adres zdjęcia jest już na liście.')
      return
    }
    setField('photos', [...values.photos, url])
    setPhotoUrl('')
    setPhotoError('')
  }

  const togglePhotoSelection = (index: number) => {
    setSelectedPhotoIndexes((current) =>
      current.includes(index) ? current.filter((photoIndex) => photoIndex !== index) : [...current, index],
    )
  }

  const removeSelectedPhotos = () => {
    setField('photos', values.photos.filter((_, index) => !selectedPhotoIndexes.includes(index)))
    setSelectedPhotoIndexes([])
  }

  const toggles: {
    key: 'hasStairs' | 'wheelchairAccessible' | 'hasAccessibleToilet'
    label: string
    detail: string
  }[] = [
    { key: 'wheelchairAccessible', label: 'Dostępne dla wózków', detail: 'Informacja o dostępności miejsca' },
    { key: 'hasStairs', label: 'Na miejscu są schody', detail: 'Schody w miejscu lub na trasie zwiedzania' },
    { key: 'hasAccessibleToilet', label: 'Dostępna toaleta', detail: 'Toaleta przystosowana dla osób z niepełnosprawnościami' },
  ]

  return (
    <section className="panel editor-panel">
      <div className="editor-heading">
        <div>
          <p className="eyebrow">{isCreating ? 'NOWE MIEJSCE' : 'SZCZEGÓŁY MIEJSCA'}</p>
          <h2>{isCreating ? 'Dodaj miejsce' : 'Edytuj miejsce'}</h2>
        </div>
        {place && (
          <span className="editor-id" title={`Identyfikator miejsca: ${place.id}`}>Miejsce z mapy</span>
        )}
      </div>
      <form className="editor-form" onSubmit={submit}>
        <label className="field-label">
          Nazwa miejsca
          <input
            maxLength={200}
            onChange={(event) => setField('name', event.target.value)}
            required
            value={values.name}
          />
        </label>
        <label className="field-label">
          Adres
          <input
            id="place-address"
            onBlur={() => {
              if (values.address.trim().length >= 3) {
                void runGeocoding('address', values.address, formValues.latitude, formValues.longitude)
              }
            }}
            onChange={(event) => {
              geocodingController.current?.abort()
              onClearPickedCoordinates()
              setGeocodingStatus(null)
              setField('address', event.target.value)
            }}
            required
            value={values.address}
          />
        </label>
        <label className="field-label">
          Opis po polsku
          <textarea
            onChange={(event) => setField('descriptionPL', event.target.value)}
            required
            rows={3}
            value={values.descriptionPL}
          />
        </label>
        <label className="field-label">
          Opis po angielsku
          <textarea
            onChange={(event) => setField('descriptionEN', event.target.value)}
            required
            rows={3}
            value={values.descriptionEN}
          />
        </label>
        <div className="coordinate-fields">
          <label className="field-label">
            Cena
            <input
              onChange={(event) => setField('price', event.target.value)}
              required
              value={values.price}
            />
          </label>
          <label className="field-label">
            Czas zwiedzania (minuty)
            <input
              min={0}
              onChange={(event) => setField('timeToVisit', Number(event.target.value))}
              required
              type="number"
              value={values.timeToVisit}
            />
          </label>
        </div>

        <div className="form-divider" />
        <div className="form-section-title">
          <Icon name="image" size={16} />
          <span>Zdjęcia</span>
        </div>
        <div className="photo-url-entry">
          <label className="field-label" htmlFor="place-photo-url">Adres URL zdjęcia</label>
          <div className="photo-url-controls">
            <input
              id="place-photo-url"
              onChange={(event) => {
                setPhotoUrl(event.target.value)
                setPhotoError('')
              }}
              placeholder="https://..."
              inputMode="url"
              type="text"
              value={photoUrl}
            />
            <button
              className="add-photo-button"
              disabled={!photoUrl.trim() || saving || deleting}
              onClick={addPhoto}
              type="button"
            >
              Dodaj
            </button>
          </div>
        </div>
        {photoError && <p className="form-error" role="alert">{photoError}</p>}
        {values.photos.length > 0 ? (
          <div className="photo-gallery" aria-label="Zdjęcia miejsca">
            {values.photos.map((url, index) => (
              <figure className="photo-tile-frame" key={`${url}-${index}`}>
                <button
                  aria-label={`Zdjęcie ${index + 1}${selectedPhotoIndexes.includes(index) ? ', zaznaczone do usunięcia' : ''}`}
                  aria-pressed={selectedPhotoIndexes.includes(index)}
                  className={`photo-tile ${selectedPhotoIndexes.includes(index) ? 'selected' : ''}`}
                  onClick={() => togglePhotoSelection(index)}
                  type="button"
                  disabled={saving || deleting}
                  title={selectedPhotoIndexes.includes(index) ? 'Odznacz zdjęcie' : 'Zaznacz zdjęcie do usunięcia'}
                >
                  <img alt={`Zdjęcie ${index + 1}`} loading="lazy" src={url} />
                  <span className="photo-selection-mark" aria-hidden="true">
                    {selectedPhotoIndexes.includes(index) ? '✓' : ''}
                  </span>
                </button>
                {DEMO_PHOTO_CREDITS[url] && (
                  <figcaption className="photo-attribution">
                    <a href={DEMO_PHOTO_CREDITS[url].page} rel="noreferrer" target="_blank">
                      {DEMO_PHOTO_CREDITS[url].attribution}
                    </a>
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        ) : (
          <p className="photo-empty">Nie dodano jeszcze zdjęć.</p>
        )}
        {selectedPhotoIndexes.length > 0 && (
          <button
            className="remove-selected-photos"
            disabled={saving || deleting}
            onClick={removeSelectedPhotos}
            type="button"
          >
            <Icon name="trash" size={15} />
            Usuń zaznaczone ({selectedPhotoIndexes.length})
          </button>
        )}

        <div className="form-divider" />
        <div className="form-section-title">
          <Icon name="wheelchair" size={17} />
          <span>Dostępność</span>
        </div>
        <div className="toggle-list">
          {toggles.map((toggle) => (
            <label className="toggle-row" key={toggle.key}>
              <span className="toggle-copy">
                <strong>{toggle.label}</strong>
                <small>{toggle.detail}</small>
              </span>
              <input
                checked={values[toggle.key]}
                onChange={(event) => setField(toggle.key, event.target.checked)}
                type="checkbox"
              />
              <span className="toggle-track" />
            </label>
          ))}
        </div>

        <div className="form-divider" />
        <div className="form-section-title">
          <Icon name="map" size={16} />
          <span>Położenie na mapie</span>
        </div>
        <div className="coordinate-fields">
          <label className="field-label">
            Szerokość geograficzna
            <input
              max={90}
              min={-90}
              onChange={(event) => {
                geocodingController.current?.abort()
                onClearPickedCoordinates()
                setGeocodingStatus(null)
                setField('latitude', Number(event.target.value))
              }}
              onBlur={() => void runGeocoding('coordinates', values.address, formValues.latitude, formValues.longitude)}
              required
              step="any"
              type="number"
              value={formValues.latitude}
            />
          </label>
          <label className="field-label">
            Długość geograficzna
            <input
              max={180}
              min={-180}
              onChange={(event) => {
                geocodingController.current?.abort()
                onClearPickedCoordinates()
                setGeocodingStatus(null)
                setField('longitude', Number(event.target.value))
              }}
              onBlur={() => void runGeocoding('coordinates', values.address, formValues.latitude, formValues.longitude)}
              required
              step="any"
              type="number"
              value={formValues.longitude}
            />
          </label>
        </div>
        {geocodingStatus && (
          <p
            className={`geocoding-status ${geocodingStatus.kind}`}
            role={geocodingStatus.kind === 'error' ? 'alert' : 'status'}
          >
            {geocodingStatus.message}
          </p>
        )}
        <p className="geocoding-attribution">
          Geokodowanie: <a href="https://www.openstreetmap.org/copyright" rel="noreferrer" target="_blank">© OpenStreetMap contributors</a>
        </p>

        {place && place.openingHours.length > 0 && (
          <>
            <div className="form-divider" />
            <div className="form-section-title">
              <Icon name="clock" size={16} />
              <span>Godziny otwarcia</span>
            </div>
            <p className="poi-no-tags">
              Dla tego miejsca zapisano {place.openingHours.length} wpisów godzin otwarcia.
            </p>
          </>
        )}

        {saveMessage && <p className="form-success" role="status">{saveMessage}</p>}
        {saveError && <p className="form-error" role="alert">{saveError}</p>}
        <div className="editor-actions">
          {place && (
            <button
              className="delete-button"
              disabled={saving || deleting}
              onClick={() => void onDelete()}
              type="button"
            >
              <Icon name="trash" size={16} />
              {deleting ? 'Usuwanie…' : 'Usuń miejsce'}
            </button>
          )}
          {isCreating && (
            <button className="cancel-button" disabled={saving} onClick={onCancelCreate} type="button">
              Anuluj
            </button>
          )}
          <button className="save-button" disabled={saving || !values.name.trim()} type="submit">
            <Icon name="check" size={17} />
            {saving ? 'Zapisywanie…' : isCreating ? 'Dodaj miejsce' : 'Zapisz zmiany'}
          </button>
        </div>
      </form>
    </section>
  )
}
