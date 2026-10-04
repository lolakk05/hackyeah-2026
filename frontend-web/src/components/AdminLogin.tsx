import { useState, type FormEvent } from 'react'

export function AdminLogin({
  onLogin,
  onDemo,
  loading,
  error,
}: {
  onLogin: (email: string, password: string) => Promise<void>
  onDemo: () => void
  loading: boolean
  error: string
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void onLogin(email.trim(), password)
  }

  return (
    <main className="login-screen">
      <section className="panel login-panel">
        <a className="brand login-brand" href="#" aria-label="Spacer.io">
          <img className="brand-logo" src="/logo_spacerniak.svg" alt="Spacer.io" />
        </a>
        <p className="eyebrow">PANEL ADMINISTRATORA · KRAKÓW</p>
        <h1>Zaloguj się</h1>
        <p className="login-copy">Zaloguj się na swoje konto, aby zarządzać miejscami.</p>
        <form className="editor-form login-form" onSubmit={submit}>
          <label className="field-label">
            Adres e-mail
            <input
              autoComplete="username"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label className="field-label">
            Hasło
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="save-button" disabled={loading || !email.trim() || !password} type="submit">
            {loading ? 'Logowanie…' : 'Zaloguj się'}
          </button>
        </form>
        <button className="demo-login-button" disabled={loading} onClick={onDemo} type="button">
          Kontynuuj w DEMO
        </button>
      </section>
    </main>
  )
}
