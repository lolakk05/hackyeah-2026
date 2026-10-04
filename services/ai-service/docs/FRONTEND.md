# Integracja frontendu Expo / React Native z AI

Serwis AI przyjmuje pytanie użytkownika i zwraca odpowiedź lokalnego modelu. Frontend wysyła **tylko `question`** i wyświetla **`answer`**. Przykłady są dopasowane do Expo, React Native i TypeScript używanych w `frontend/package.json`.

Ten dokument zawiera kod do przeniesienia do frontendu. Nie dodaje ekranu, proxy ani konfiguracji CORS do aplikacji.

## 1. Kontrakt API

| Parametr | Wartość |
|---|---|
| Metoda | `POST` |
| Endpoint AI | `/guide` |
| Port serwisu AI | `8001` |
| Content-Type | `application/json` |
| Body | Obiekt z jednym polem `question` |
| Odpowiedź | Obiekt z jednym polem `answer` |

Request:

```json
{
  "question": "Czym są Sukiennice? Odpowiedz krótko."
}
```

Przykładowy kształt odpowiedzi HTTP `200`; treść generuje model:

```json
{
  "answer": "Sukiennice to zabytkowa hala handlowa na Rynku Głównym w Krakowie..."
}
```

Zasady:

- `question`: tekst długości 1–4000 znaków, zawierający coś więcej niż białe znaki.
- Wysyłamy JSON przez `JSON.stringify`, kodowany w UTF-8.
- `place_id`, `messages`, `history`, `model` i inne dodatkowe pola są odrzucane (`422`).
- Serwer dodaje stałe instrukcje lokalnego przewodnika po Krakowie, a pytanie przesyła jako osobną wiadomość użytkownika. Frontend nie wysyła system promptu. Każdy request jest niezależny; API nie pamięta poprzednich pytań.
- Instrukcje wymagają krótkiej odpowiedzi po polsku, zwykłym tekstem, bez Markdowna. `answer` wyświetlamy bez renderera Markdown i bez interpretowania HTML. JSON jest opakowaniem odpowiedzi HTTP, a nie formatem opowieści modelu.
- API zwraca całą odpowiedź po zakończeniu generacji. Nie używamy SSE, WebSocketów ani streamingu tokenów.
- Model i adres Ollamy konfiguruje serwer. Frontend łączy się z portem `8001`, a nie bezpośrednio z portem Ollamy `11434`.

Jeżeli użytkownik wybiera miejsce na mapie, jego nazwę można wpisać w pytanie, np. `Opowiedz krótko o miejscu: Sukiennice`. Historia wiadomości wyświetlana na ekranie pozostaje lokalną historią interfejsu; kolejne pytanie powinno zawierać potrzebny kontekst.

## 2. Adres API: komputer, emulator, telefon i web

W `frontend/.env.local` ustaw **pełny adres endpointu**, łącznie z `/guide`:

```dotenv
EXPO_PUBLIC_AI_GUIDE_URL=http://127.0.0.1:8001/guide
```

Adres dobierz do urządzenia:

| Gdzie działa aplikacja | Przykładowa wartość `EXPO_PUBLIC_AI_GUIDE_URL` |
|---|---|
| Na komputerze, na którym działa AI | `http://127.0.0.1:8001/guide` |
| Standardowy emulator Android Studio | `http://10.0.2.2:8001/guide` |
| Fizyczny telefon w tej samej sieci | `http://192.168.1.50:8001/guide` — zastąp IP adresem komputera |
| Wdrożona aplikacja przez główny backend | Pełny adres HTTPS trasy proxy uzgodnionej z backendem |

Na telefonie `localhost` oznacza telefon. Emulator Android Studio udostępnia adres `10.0.2.2` do połączenia z loopbackiem komputera. [Dokumentacja emulatora](https://developer.android.com/studio/run/emulator-networking-address).

Serwis AI startuje lokalnie przez `uv run python main.py` na `127.0.0.1:8001`. Aby udostępnić go telefonowi w sieci lokalnej, w katalogu `services/ai-service` uruchom:

```powershell
uv run uvicorn main:app --host 0.0.0.0 --port 8001
```

Komputer i telefon muszą mieć połączenie w tej samej sieci, a zapora komputera pozwalać na ruch do portu 8001. `0.0.0.0` jest adresem nasłuchu serwera; w aplikacji wpisz rzeczywisty adres IP komputera. W kontenerach backend powinien użyć adresu usługi AI w sieci kontenerów.

Expo wczytuje zmienne `EXPO_PUBLIC_` z plików `.env`. W kodzie używaj dokładnie `process.env.EXPO_PUBLIC_AI_GUIDE_URL`; po zmianie wartości wykonaj pełne przeładowanie aplikacji. Te zmienne są publiczne w aplikacji, więc przechowujemy w nich adres URL, a nie sekrety. [Dokumentacja Expo](https://docs.expo.dev/guides/environment-variables/).

### Wersja webowa i proxy

Obecny serwis AI **nie konfiguruje CORS**. Przeglądarka nie będzie mogła wywołać go z innego originu bez konfiguracji CORS lub proxy. Natywne aplikacje React Native nie stosują przeglądarkowej kontroli CORS. Dostęp przez lokalne HTTP może być dodatkowo ograniczany konfiguracją systemu i builda aplikacji; przy wdrożeniu użyj HTTPS. [Sieć w React Native](https://reactnative.dev/docs/network).

Docelowy przepływ przez główny backend:

```text
Expo / przeglądarka → główny backend → AI:8001/guide → Ollama
```

Jeżeli zespół backendowy wybierze trasę `/api/guide`, musi ją zaimplementować jako proxy i przekazywać body, odpowiedź oraz status HTTP. **To proponowana trasa, nie endpoint utworzony przez serwis AI.** W Expo ustaw wówczas `EXPO_PUBLIC_AI_GUIDE_URL` na jej pełny adres. Proxy i brama HTTP powinny pozwalać na odpowiedź AI trwającą do 120 sekund; timeout frontendu w poniższym przykładzie wynosi 150 sekund.

## 3. Klient TypeScript

Przenieś poniższy kod np. do `frontend/lib/ai.ts`. URL pochodzi z konfiguracji, więc ten sam klient może wywoływać AI bezpośrednio na urządzeniu albo trasę proxy.

```ts
export type GuideRequest = { question: string };
export type GuideResponse = { answer: string };

const HTTP_MESSAGES: Record<number, string> = {
  404: 'Nie znaleziono endpointu AI. Sprawdź adres API.',
  422: 'Sprawdź pytanie: wymagany tekst od 1 do 4000 znaków.',
  502: 'AI nie mogło przygotować odpowiedzi. Spróbuj ponownie.',
  503: 'AI jest chwilowo niedostępne. Spróbuj później.',
  504: 'AI odpowiadało zbyt długo. Spróbuj ponownie.',
};

export async function askGuide(
  question: string,
  signal?: AbortSignal,
): Promise<GuideResponse> {
  const text = question.trim();
  if (!text || Array.from(text).length > 4000) {
    throw new Error('Wpisz pytanie od 1 do 4000 znaków.');
  }

  const endpoint = process.env.EXPO_PUBLIC_AI_GUIDE_URL?.trim();
  if (!endpoint) {
    throw new Error('Brak konfiguracji EXPO_PUBLIC_AI_GUIDE_URL.');
  }

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  if (signal?.aborted) controller.abort();

  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 150_000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: text } satisfies GuideRequest),
      signal: controller.signal,
    });
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        HTTP_MESSAGES[response.status] ??
          `Nie udało się pobrać odpowiedzi (HTTP ${response.status}).`,
      );
    }

    if (
      !payload ||
      typeof payload !== 'object' ||
      !('answer' in payload) ||
      typeof payload.answer !== 'string' ||
      !payload.answer.trim()
    ) {
      throw new Error('AI zwróciło nieprawidłową odpowiedź.');
    }

    return { answer: payload.answer };
  } catch (error) {
    if (timedOut) {
      throw new Error('Przekroczono czas oczekiwania na AI. Spróbuj ponownie.');
    }
    if (signal?.aborted) throw error;
    if (error instanceof TypeError) {
      throw new Error('Nie można połączyć się z AI. Sprawdź sieć i adres API.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  }
}
```

Klient nie robi automatycznych ponowień. Użytkownik może ponowić pytanie przyciskiem; automatyczne wysyłanie kolejnych requestów mogłoby uruchomić dodatkowe generacje na lokalnym modelu.

## 4. Przykładowy ekran React Native

Poniższy komponent można dopasować do istniejącego ekranu czatu. Import `./ai` zakłada, że plik klienta jest obok komponentu; przy przenoszeniu dostosuj ścieżkę.

```tsx
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { askGuide } from './ai';

export function GuideChat() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const active = useRef<AbortController | null>(null);

  useEffect(() => () => {
    active.current?.abort();
    active.current = null;
  }, []);

  async function send() {
    // Ref blokuje także dwa kliknięcia przed ponownym renderem.
    if (active.current || !question.trim()) return;
    const controller = new AbortController();
    active.current = controller;
    setLoading(true);
    setError(null);
    setAnswer('');

    try {
      const result = await askGuide(question, controller.signal);
      if (active.current === controller && !controller.signal.aborted) {
        setAnswer(result.answer);
      }
    } catch (cause) {
      if (active.current === controller && !controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'Nie udało się pobrać odpowiedzi.');
      }
    } finally {
      if (active.current === controller) {
        active.current = null;
        setLoading(false);
      }
    }
  }

  function cancel() {
    const controller = active.current;
    active.current = null;
    controller?.abort();
    setLoading(false);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <TextInput
        value={question}
        onChangeText={setQuestion}
        placeholder="Zapytaj AI o Kraków…"
        multiline
        maxLength={4000}
        editable={!loading}
        accessibilityLabel="Pytanie do AI"
        style={{ borderWidth: 1, borderColor: '#aaa', padding: 12, minHeight: 100 }}
      />
      <Button title="Wyślij" onPress={send} disabled={loading || !question.trim()} />
      {loading && (
        <View style={{ gap: 8 }}>
          <ActivityIndicator accessibilityLabel="AI przygotowuje odpowiedź" />
          <Text>AI przygotowuje odpowiedź…</Text>
          <Button title="Anuluj" onPress={cancel} />
        </View>
      )}
      {error && <Text accessibilityRole="alert">{error}</Text>}
      {answer !== '' && <Text selectable>{answer}</Text>}
    </ScrollView>
  );
}
```

`Text` wyświetla odpowiedź jako zwykły tekst i zachowuje podziały wierszy. Nie dodawaj renderera Markdown ani HTML. Serwer usuwa typowe znaczniki Markdown, również gdy model zignoruje instrukcję formatowania. Nie jest to pełny parser Markdown ani filtr bezpieczeństwa HTML, dlatego frontend zawsze traktuje wynik jako tekst. Anulowanie przerywa oczekiwanie aplikacji; obecny serwis nie gwarantuje zatrzymania generacji w Ollamie po rozłączeniu klienta.

## 5. Obsługa błędów

| HTTP / sytuacja | Co zrobić w interfejsie |
|---|---|
| `422` | Pokaż błąd pytania; nie wysyłaj `place_id` ani innych pól |
| `502` | Pokaż komunikat o nieudanej generacji i pozwól ponowić |
| `503` | Pokaż niedostępność AI; zespół serwerowy sprawdza Ollamę i model |
| `504` | Pokaż przekroczenie czasu oczekiwania |
| Timeout klienta 150 s | Zakończ stan oczekiwania i pozwól ponowić |
| Błąd sieci / CORS | Sprawdź URL, adres urządzenia, nasłuch API i konfigurację proxy |

Błąd modelu lub połączenia ma format:

```json
{"detail": "Nie można połączyć się z Ollamą."}
```

Przy walidacji `422`, `detail` jest **tablicą** błędów FastAPI, a nie tekstem. Powyższy klient mapuje statusy na czytelne komunikaty, więc nie zakłada jednego typu `detail` i nie wyświetla diagnostyki w interfejsie.

## 6. Sprawdzenie integracji

1. Uruchom Ollamę z modelem `llama3.2` oraz AI na porcie 8001. Instrukcja: [README.md](README.md).
2. Wywołaj `/guide` w [Swaggerze](http://127.0.0.1:8001/docs) i sprawdź, czy odpowiedź ma pole `answer`.
3. Ustaw `EXPO_PUBLIC_AI_GUIDE_URL` dla urządzenia i przeładuj aplikację.
4. Wyślij pytanie z ekranu; sprawdź stan oczekiwania, odpowiedź, nowe linie i blokadę podwójnego wysłania.
5. Wyłącz Ollamę i potwierdź, że interfejs kończy oczekiwanie oraz pokazuje błąd.
6. Anuluj request lub opuść ekran w trakcie odpowiedzi; wynik poprzedniego requestu nie powinien nadpisać nowego.

Specyfikacja pól i statusów: [openapi.json](openapi.json). API nie wymaga od frontendu instalowania klienta Ollamy ani biblioteki OpenAI.
