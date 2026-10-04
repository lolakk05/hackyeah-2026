import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { askAboutLandmark } from '@/api/client';
import type { ChatMessage, Landmark } from '@/api/types';
import { DuoText } from '@/components/duo/duo-text';
import { Pinek } from '@/components/pinek';
import { tapFeedback } from '@/components/duo/haptics';
import { Brand } from '@/constants/duo-theme';
import { useI18n } from '@/i18n/language-context';
import { themedStyles, useDuo } from '@/state/theme-context';

import { SectionCard } from './section-card';

let nextId = 0;
const newId = () => `m${Date.now()}-${nextId++}`;

/** "Ask the guide" chat: question chips, message bubbles and a text box. Calls askAboutLandmark(). */
export function AskAiChat({ landmark }: { landmark: Landmark }) {
  const t = useDuo();
  const styles = useStyles();
  const { s, fmt } = useI18n();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  /** The request in flight (also blocks a double send); cancelled when the page closes. */
  const active = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      active.current?.abort();
      active.current = null;
    },
    [],
  );

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || thinking || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    tapFeedback();
    const userMsg: ChatMessage = { id: newId(), role: 'user', text: question };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setThinking(true);
    try {
      const answer = await askAboutLandmark(landmark, question, messages, controller.signal);
      if (!controller.signal.aborted) setMessages([...history, { id: newId(), role: 'assistant', text: answer }]);
    } catch (e) {
      if (controller.signal.aborted) return;
      const msg = e instanceof Error && e.message ? `${s.guide.error}\n${e.message}` : s.guide.error;
      setMessages([...history, { id: newId(), role: 'assistant', text: msg }]);
    } finally {
      if (active.current === controller) {
        active.current = null;
        setThinking(false);
      }
    }
  };

  const unused = landmark.suggestedQuestions.filter((q) => !messages.some((m) => m.text === q));
  const canSend = !!input.trim() && !thinking;

  return (
    <SectionCard title={s.guide.title} icon="📍">
      <View style={styles.introRow}>
        <Pinek pose="sign" size={64} />
        <DuoText variant="body" color={t.textMuted} style={styles.introText}>
          {fmt(s.guide.intro, { name: landmark.name })}
        </DuoText>
      </View>

      {messages.map((m) => (
        <View key={m.id} style={[styles.msgRow, m.role === 'user' && styles.msgRowUser]}>
          <View
            style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleGuide]}
            accessibilityLabel={`${m.role === 'user' ? s.guide.you : s.guide.guide}: ${m.text}`}>
            <DuoText variant="body" color={m.role === 'user' ? Brand.onPrimary : t.text}>
              {m.text}
            </DuoText>
          </View>
        </View>
      ))}
      {thinking ? (
        <View style={styles.msgRow} accessibilityLabel={s.guide.typing}>
          <View style={[styles.bubble, styles.bubbleGuide]}>
            <DuoText variant="heading" color={t.textMuted}>
              • • •
            </DuoText>
          </View>
        </View>
      ) : null}

      {unused.length > 0 ? (
        <View style={styles.chips}>
          {unused.map((q) => (
            <Pressable
              key={q}
              onPress={() => send(q)}
              accessibilityRole="button"
              accessibilityLabel={fmt(s.guide.ask, { q })}>
              {({ pressed }) => (
                <View style={[styles.chip, pressed && styles.chipPressed]}>
                  <DuoText variant="caption" color={Brand.primary} style={styles.chipText}>
                    {q}
                  </DuoText>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={s.guide.placeholder}
          placeholderTextColor={t.lockedText}
          style={styles.input}
          onSubmitEditing={() => send(input)}
          returnKeyType="send"
          accessibilityLabel={s.guide.placeholder}
          multiline={false}
        />
        <Pressable onPress={() => send(input)} disabled={!canSend} accessibilityRole="button" accessibilityLabel={s.guide.send}>
          {({ pressed }) => (
            <View
              style={[
                styles.send,
                { backgroundColor: canSend ? (pressed ? Brand.primaryPressed : Brand.primary) : t.locked },
              ]}>
              <DuoText variant="heading" color={canSend ? Brand.onPrimary : t.lockedText}>
                ↑
              </DuoText>
            </View>
          )}
        </Pressable>
      </View>
    </SectionCard>
  );
}

const useStyles = themedStyles((t) => ({
  introRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  introText: { flex: 1 },
  msgRow: { flexDirection: 'row' },
  msgRowUser: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  bubbleUser: { backgroundColor: Brand.primary, borderBottomRightRadius: 6 },
  bubbleGuide: { backgroundColor: t.cardRaised, borderBottomLeftRadius: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: t.soft(Brand.primary, 0.5),
  },
  chipPressed: { backgroundColor: t.soft(Brand.primary, 0.85) },
  chipText: { fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: {
    flex: 1,
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: t.surface,
    paddingHorizontal: 18,
    fontSize: 17,
    color: t.text,
  },
  send: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
