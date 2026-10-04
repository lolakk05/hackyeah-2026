/**
 * Pinek's answers: the AI service (services/ai-service, see its FRONTEND.md).
 *   POST EXPO_PUBLIC_AI_GUIDE_URL  { question } → { answer }
 * Only `question` may be sent (anything else → 422). The service doesn't remember
 * earlier questions, so the place's name and the last exchange go into the text.
 * Answers are plain text in Polish; show them as text (no Markdown/HTML).
 */
import type { ChatMessage } from './types';

export const AI_GUIDE_URL = process.env.EXPO_PUBLIC_AI_GUIDE_URL?.trim() || '';

const MAX_CHARS = 4000;
/** The local model can take up to ~2 minutes. */
const TIMEOUT_MS = 150_000;

const HTTP_MESSAGES: Record<number, string> = {
  404: 'Nie znaleziono endpointu AI. Sprawdź adres API.',
  422: 'Sprawdź pytanie: wymagany tekst od 1 do 4000 znaków.',
  502: 'AI nie mogło przygotować odpowiedzi. Spróbuj ponownie.',
  503: 'AI jest chwilowo niedostępne. Spróbuj później.',
  504: 'AI odpowiadało zbyt długo. Spróbuj ponownie.',
};

/** The question with the context the service needs (place + last exchange). */
export function buildQuestion(placeName: string, question: string, history: ChatMessage[]): string {
  const last = history.slice(-2).map((m) => `${m.role === 'user' ? 'Pytanie' : 'Odpowiedź'}: ${m.text}`);
  const text = [`Miejsce: ${placeName}.`, ...(last.length ? ['Wcześniej:', ...last] : []), `Pytanie: ${question.trim()}`].join('\n');
  // keep within the limit: drop the earlier exchange first
  return Array.from(text).length <= MAX_CHARS
    ? text
    : Array.from(`Miejsce: ${placeName}.\nPytanie: ${question.trim()}`).slice(0, MAX_CHARS).join('');
}

export async function askGuide(question: string, signal?: AbortSignal): Promise<string> {
  const text = question.trim();
  if (!text || Array.from(text).length > MAX_CHARS) throw new Error('Wpisz pytanie od 1 do 4000 znaków.');
  if (!AI_GUIDE_URL) throw new Error('Brak konfiguracji EXPO_PUBLIC_AI_GUIDE_URL.');

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  if (signal?.aborted) controller.abort();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);

  try {
    const res = await fetch(AI_GUIDE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({ question: text }),
      signal: controller.signal,
    });
    const payload: unknown = await res.json().catch(() => null);
    if (!res.ok) throw new Error(HTTP_MESSAGES[res.status] ?? `Nie udało się pobrać odpowiedzi (HTTP ${res.status}).`);
    const answer = (payload as { answer?: unknown } | null)?.answer;
    if (typeof answer !== 'string' || !answer.trim()) throw new Error('AI zwróciło nieprawidłową odpowiedź.');
    return answer;
  } catch (e) {
    if (timedOut) throw new Error('Przekroczono czas oczekiwania na AI. Spróbuj ponownie.');
    if (signal?.aborted) throw e;
    if (e instanceof TypeError) throw new Error('Nie można połączyć się z AI. Sprawdź sieć i adres API.');
    throw e;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
