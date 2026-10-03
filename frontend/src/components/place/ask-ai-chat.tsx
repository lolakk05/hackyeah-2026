import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { askAboutLandmark } from '@/api/client';
import type { ChatMessage, Landmark } from '@/api/types';
import { DuoText } from '@/components/duo/duo-text';
import { tapFeedback } from '@/components/duo/haptics';
import { Brand, DuoFonts } from '@/constants/duo-theme';
import { themedStyles, useDuo } from '@/state/theme-context';

import { SectionCard } from './section-card';

let nextId = 0;
const newId = () => `m${Date.now()}-${nextId++}`;

/** "Ask the guide" chat: question chips, message bubbles and a text box. Calls askAboutLandmark(). */
export function AskAiChat({ landmark }: { landmark: Landmark }) {
  const t = useDuo();
  const styles = useStyles();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || thinking) return;
    tapFeedback();
    const userMsg: ChatMessage = { id: newId(), role: 'user', text: question };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setThinking(true);
    try {
      const answer = await askAboutLandmark(landmark, question, messages);
      setMessages([...history, { id: newId(), role: 'assistant', text: answer }]);
    } catch {
      setMessages([
        ...history,
        { id: newId(), role: 'assistant', text: "Oops, I couldn't reach the guide. Please try again. 🙈" },
      ]);
    } finally {
      setThinking(false);
    }
  };

  const unused = landmark.suggestedQuestions.filter((q) => !messages.some((m) => m.text === q));

  return (
    <SectionCard title="Ask the guide" icon="🐉">
      <DuoText variant="body" color={t.textMuted}>
        Ask anything about {landmark.name}: history, tickets, food nearby, accessibility…
      </DuoText>

      {messages.map((m) => (
        <View key={m.id} style={[styles.msgRow, m.role === 'user' && styles.msgRowUser]}>
          {m.role === 'assistant' ? <DuoText style={styles.avatar}>🐉</DuoText> : null}
          <View
            style={[
              styles.bubble,
              m.role === 'user'
                ? { backgroundColor: Brand.blue, borderColor: Brand.blueDark }
                : { backgroundColor: t.card, borderColor: t.border },
            ]}
            accessibilityLabel={`${m.role === 'user' ? 'You' : 'Guide'}: ${m.text}`}>
            <DuoText variant="body" color={m.role === 'user' ? Brand.onColor : t.text}>
              {m.text}
            </DuoText>
          </View>
        </View>
      ))}
      {thinking ? (
        <View style={styles.msgRow} accessibilityLabel="Guide is typing">
          <DuoText style={styles.avatar}>🐉</DuoText>
          <View style={[styles.bubble, { backgroundColor: t.card, borderColor: t.border }]}>
            <DuoText variant="heading" color={t.textMuted}>
              • • •
            </DuoText>
          </View>
        </View>
      ) : null}

      {unused.length > 0 ? (
        <View style={styles.chips}>
          {unused.map((q) => (
            <Pressable key={q} onPress={() => send(q)} accessibilityRole="button" accessibilityLabel={`Ask: ${q}`}>
              {({ pressed }) => (
                <View style={[styles.chip, pressed && { borderBottomWidth: 2, marginTop: 2 }]}>
                  <DuoText variant="caption" color={t.blueText}>
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
          placeholder="Type your question…"
          placeholderTextColor={t.lockedText}
          style={styles.input}
          onSubmitEditing={() => send(input)}
          returnKeyType="send"
          accessibilityLabel="Your question"
          multiline={false}
        />
        <Pressable
          onPress={() => send(input)}
          disabled={!input.trim() || thinking}
          accessibilityRole="button"
          accessibilityLabel="Send question">
          {({ pressed }) => (
            <View
              style={[
                styles.send,
                {
                  backgroundColor: input.trim() ? Brand.blue : t.locked,
                  borderBottomColor: input.trim() ? Brand.blueDark : t.lockedDark,
                  borderBottomWidth: pressed ? 0 : 4,
                  marginTop: pressed ? 4 : 0,
                },
              ]}>
              <DuoText variant="heading" color={Brand.onColor}>
                ➤
              </DuoText>
            </View>
          )}
        </Pressable>
      </View>
    </SectionCard>
  );
}

const useStyles = themedStyles((t) => ({
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowUser: { justifyContent: 'flex-end' },
  avatar: { fontSize: 26, lineHeight: 32 },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 2,
    borderBottomWidth: 4,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: t.soft(Brand.blue, 0.5),
    backgroundColor: t.soft(Brand.blue),
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: {
    flex: 1,
    minHeight: 52,
    borderRadius: t.radius.md,
    borderWidth: 2,
    borderColor: t.border,
    backgroundColor: t.surface,
    paddingHorizontal: 14,
    fontFamily: DuoFonts.bold,
    fontSize: 17,
    color: t.text,
  },
  send: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
