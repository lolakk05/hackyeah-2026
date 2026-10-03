import { useState, type FormEvent } from 'react'
import type { AdminPlace, PlaceFormValues } from '../data/types'
import { Icon } from './Icon'

function placeToForm(place: AdminPlace): PlaceFormValues {
  return {
    name: place.name,
    tagline: place.tagline,
    description: place.description,
    latitude: place.coordinates.latitude,
    longitude: place.coordinates.longitude,
    wheelchair: place.accessibility.wheelchair,
    stepFree: place.accessibility.stepFree,
    accessibleToilet: place.accessibility.accessibleToilet,
    audioGuide: place.accessibility.audioGuide,
    hearingSupport: place.accessibility.hearingSupport,
    notes: place.accessibility.notes,
  }
}

export function PlaceEditor({
  place,
  onSave,
  saving,
}: {
  place: AdminPlace | null
  onSave: (values: PlaceFormValues) => Promise<void>
  saving: boolean
}) {
  const [values, setValues] = useState<PlaceFormValues | null>(place ? placeToForm(place) : null)

  if (!place || !values) {
    return (
      <section className="panel editor-panel editor-empty">
        <div className="empty-editor-icon"><Icon name="edit" size={23} /></div>
        <h2>Edytuj miejsce</h2>
        <p>Wybierz lokalizację z listy, aby zmienić jej dane.</p>
      </section>
    )
  }

  const setField = <K extends keyof PlaceFormValues>(key: K, value: PlaceFormValues[K]) => {
    setValues((current) => current ? { ...current, [key]: value } : current)
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void onSave(values)
  }

  const toggles: { key: 'stepFree' | 'accessibleToilet' | 'audioGuide' | 'hearingSupport'; label: string; detail: string }[] = [
    { key: 'stepFree', label: 'Trasa bez schodów', detail: 'Wejście i główna trasa zwiedzania' },
    { key: 'accessibleToilet', label: 'Toaleta dostępna', detail: 'W obiekcie lub bezpośrednim sąsiedztwie' },
    { key: 'audioGuide', label: 'Audioprzewodnik', detail: 'Opis audio lub audiodeskrypcja' },
    { key: 'hearingSupport', label: 'Wsparcie dla osób niesłyszących', detail: 'Pętla indukcyjna, napisy lub przewodnik' },
  ]

  return (
    <section className="panel editor-panel">
      <div className="editor-heading">
        <div>
          <p className="eyebrow">SZCZEGÓŁY LOKALIZACJI</p>
          <h2>Edytuj miejsce</h2>
        </div>
        <span className="editor-id">ID · {place.id}</span>
      </div>
      <form className="editor-form" onSubmit={submit}>
        <label className="field-label">
          Nazwa miejsca
          <input
            maxLength={120}
            onChange={(event) => setField('name', event.target.value)}
            required
            value={values.name}
          />
        </label>
        <label className="field-label">
          Krótki opis
          <input
            maxLength={200}
            onChange={(event) => setField('tagline', event.target.value)}
            value={values.tagline}
          />
        </label>
        <label className="field-label">
          Opis
          <textarea
            maxLength={4000}
            onChange={(event) => setField('description', event.target.value)}
            rows={3}
            value={values.description}
          />
        </label>

        <div className="form-divider" />
        <div className="form-section-title">
          <Icon name="wheelchair" size={17} />
          <span>Dostępność</span>
        </div>
        <label className="field-label">
          Dostępność dla wózków
          <select
            onChange={(event) => setField('wheelchair', event.target.value as PlaceFormValues['wheelchair'])}
            value={values.wheelchair}
          >
            <option value="full">W pełni dostępne</option>
            <option value="partial">Częściowo dostępne</option>
            <option value="none">Niedostępne</option>
          </select>
        </label>

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
        <label className="field-label">
          Dodatkowe informacje o dostępności
          <textarea
            maxLength={2000}
            onChange={(event) => setField('notes', event.target.value)}
            placeholder="Opisz udogodnienia, ograniczenia lub praktyczne wskazówki…"
            rows={3}
            value={values.notes}
          />
        </label>

        <div className="form-divider" />
        <div className="form-section-title">
          <Icon name="map" size={16} />
          <span>Położenie na mapie</span>
        </div>
        <div className="coordinate-fields">
          <label className="field-label">
            Szerokość
            <input
              max={90}
              min={-90}
              onChange={(event) => setField('latitude', Number(event.target.value))}
              required
              step="any"
              type="number"
              value={values.latitude}
            />
          </label>
          <label className="field-label">
            Długość
            <input
              max={180}
              min={-180}
              onChange={(event) => setField('longitude', Number(event.target.value))}
              required
              step="any"
              type="number"
              value={values.longitude}
            />
          </label>
        </div>

        <button className="save-button" disabled={saving || !values.name.trim()} type="submit">
          <Icon name="check" size={17} />
          {saving ? 'Zapisywanie…' : 'Zapisz zmiany'}
        </button>
      </form>
    </section>
  )
}
