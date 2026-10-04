# Pytania do lokalnego modelu przez FastAPI

Endpoint jest w `main.py`: **POST /guide**. Przyjmuje samo `question`, przekazuje je do lokalnego modelu `llama3.2` przez `ollama.AsyncClient` i zwraca tekst w `answer`.

To klient Ollamy zgodny z podanym przykładem. Nie wymaga biblioteki `openai`, klucza OpenAI ani połączenia z API OpenAI. Dokumentacja klienta: [oficjalne ollama-python](https://github.com/ollama/ollama-python).

## Uruchomienie

W folderze `services/ai-service`:

```powershell
ollama pull llama3.2
uv sync
uv run python main.py
```

Ollama musi działać. Aplikacja desktopowa zwykle uruchamia serwer; jeśli potrzebujesz uruchomić go ręcznie, wykonaj `ollama serve` w drugim terminalu. `ollama run llama3.2` nie musi być otwarte podczas działania API.

`uv run python main.py` uruchamia serwis domyślnie na **127.0.0.1:8001**, także przy bezpośrednim uruchomieniu pliku w IDE. Swagger: [http://127.0.0.1:8001/docs](http://127.0.0.1:8001/docs).

Przy uruchomieniu przez CLI Uvicorna podaj port jawnie:

```powershell
uv run uvicorn main:app --host 127.0.0.1 --port 8001
```

Zapisana specyfikacja: [openapi.json](openapi.json).

## Request i odpowiedź

```http
POST http://127.0.0.1:8001/guide
Content-Type: application/json
```

Body, zakodowane w UTF-8:

```json
{
  "question": "Wymień 3 ciekawe miejsca do zobaczenia na Wawelu w Krakowie. Odpowiedz krótko."
}
```

Przykładowy kształt odpowiedzi; tekst generuje model:

```json
{
  "answer": "Na Wawelu warto zobaczyć katedrę, Zamek Królewski i Smoczą Jamę."
}
```

`question` musi być tekstem długości 1–4000 znaków i zawierać coś więcej niż białe znaki. Dodatkowe pola, w tym `place_id`, `system` i `messages`, są odrzucane. Model i adres Ollamy ustawia serwer. Do modelu trafiają dwie wiadomości: stałe instrukcje `system` z serwera i pytanie `user`. Każdy request jest niezależny, bez historii rozmowy ani katalogu POI.

## Zasady przewodnika

Stałe instrukcje są w `GUIDE_SYSTEM_PROMPT` w `main.py`. Model ma odpowiadać po polsku jako lokalny przewodnik po Krakowie, przyjaźnie i krótko, zwykle w 3–6 zdaniach. Przy pytaniu o obiekt powinien uwzględnić pochodzenie nazwy, historię, ciekawostki i współczesne zastosowanie, jeśli zna te informacje. Ma odróżniać legendy od faktów i przyznawać się do niewiedzy.

Instrukcje wymagają wyłącznie polskich słów, poprawnej polskiej gramatyki i polskich nazw miejsc, bez obcojęzycznych wtrąceń, również gdy użytkownik pyta w innym języku. Przed odpowiedzią model ma sprawdzić język i zastąpić obce wtrącenia polskimi odpowiednikami.

Instrukcje wymagają zwykłego tekstu w zdaniach lub krótkich akapitach: bez Markdowna, nagłówków, list, pogrubień, tabel, kodu, HTML i JSON w treści odpowiedzi. Transport HTTP nadal używa `application/json`, z tekstem w polu `answer`. Frontend nie musi dodawać tych zasad do pytania.

Pytanie użytkownika pozostaje osobną wiadomością `user`, również gdy zawiera żądanie zmiany roli lub udaje instrukcję systemową. Prompt zabrania zmiany roli i formatu oraz ujawniania instrukcji. To instrukcje dla modelu, nie gwarancja odporności na prompt injection ani bezbłędnych faktów. Model nie ma narzędzi ani dostępu do bieżących danych.

Ponieważ model może zignorować instrukcję formatowania, serwer dodatkowo usuwa typowe znaczniki Markdown: nagłówki, numerację i punktory list, pogrubienia, kursywę, backticki oraz znaczniki cytatów i bloków kodu. Linki zamienia na nazwę z adresem w nawiasie. Zachowuje treść i podziały wierszy. To konwersja typowych formatów, a nie pełny parser Markdown ani filtr bezpieczeństwa HTML. Frontend nadal wyświetla `answer` jako tekst. Gdy po konwersji odpowiedź jest pusta, API zwraca `502`.

W Postmanie wybierz **Body → raw → JSON**, a w Swaggerze **Try it out → Execute**. Wklej sam JSON, bez znaczników Markdown.

PowerShell:

```powershell
$body = @{ question = 'Czym są Sukiennice? Odpowiedz krótko.' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8001/guide' `
  -ContentType 'application/json; charset=utf-8' `
  -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
```

## Frontend

Kompletna instrukcja dla zespołu Expo / React Native, z klientem TypeScript, przykładem ekranu, konfiguracją adresów i obsługą błędów: [FRONTEND.md](FRONTEND.md).

Frontend wysyła tylko pytanie i wyświetla `answer`. Przy integracji przez główny backend:

```javascript
// /api/guide to trasa, którą trzeba dodać w głównym backendzie jako proxy.
const response = await fetch('/api/guide', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ question: userQuestion }),
});
const result = await response.json();
if (!response.ok) throw new Error(JSON.stringify(result.detail));
console.log(result.answer);
```

Główny backend przekazuje ten JSON do `http://127.0.0.1:8001/guide`, jeśli oba procesy są na tej samej maszynie. Trasa `/api/guide` nie jest dodana przez ten serwis. API nie konfiguruje CORS; bezpośrednie wywołania z przeglądarki o innym originie wymagałyby konfiguracji CORS. `127.0.0.1` na telefonie lub w kontenerze wskazuje urządzenie lub kontener, na którym wykonano request.

Treść `answer` wyświetlaj jako zwykły tekst: w React Native przez `Text`, a w przeglądarce jako tekst komponentu lub przez `textContent`. Endpoint nie wykonuje wygenerowanego kodu. Odpowiedzi są swobodnie generowane i nie są wybierane z katalogu zatwierdzonych faktów.

## Konfiguracja

| Zmienna | Domyślnie | Znaczenie |
|---|---|---|
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Adres serwera Ollama |
| `OLLAMA_MODEL` | `llama3.2` | Zainstalowany model |
| `OLLAMA_TIMEOUT_SECONDS` | `120` | Całkowity limit czasu wywołania modelu |

Zmienne są odczytywane przy starcie serwisu. Przykład:

```powershell
$env:OLLAMA_MODEL = 'llama3.2'
$env:OLLAMA_URL = 'http://127.0.0.1:11434'
uv run uvicorn main:app --host 127.0.0.1 --port 8001
```

`.env.example` opisuje zmienne; plik `.env` nie jest automatycznie wczytywany. Klient jest współdzielony przez requesty i zamykany przy wyłączeniu API. Wywołanie jest asynchroniczne, bez streamingu. Pierwsza odpowiedź może potrwać dłużej ze względu na ładowanie modelu.

## Błędy i testy

| HTTP | Przyczyna |
|---|---|
| `422` | Niepoprawny JSON, brak `question`, zły typ, długość albo dodatkowe pola |
| `502` | Błąd serwera Ollama, komunikacji lub pusta odpowiedź modelu |
| `503` | Ollama nie działa albo model nie jest zainstalowany |
| `504` | Model nie odpowiedział w limicie czasu |

Błędy mają standardowy format FastAPI z polem `detail`. Błędy połączenia nie zwracają szczegółów diagnostycznych Ollamy. Dla `503` sprawdź `ollama list` i działanie serwera na porcie 11434.

```powershell
uv run pytest -q
```

Testy używają rzeczywistego SDK Ollamy z symulowanym transportem HTTP. Sprawdzają oddzielenie instrukcji systemowych od pytania, kontrakt odpowiedzi, walidację i błędy transportu. Nie dowodzą odporności samego modelu na wszystkie próby zmiany zasad. Do testu z prawdziwym modelem użyj requestu z `test_main.http` lub uruchom `uv run python scripts/smoke_ollama.py` (skrypt wywołuje endpoint w procesie, komunikując się z lokalnym serwerem Ollama).
