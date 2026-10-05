import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { useApp } from '../store/AppContext';
import { errorMessage } from '../lib/api';
import { Ranking } from '../lib/types';
import { Action } from './components';
import { C } from './theme';

export function useTask() {
  const { setNotice } = useApp();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function run(task: () => Promise<unknown>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setNotice('');
    try { await task(); } catch (error) { setNotice(errorMessage(error)); }
    finally { lock.current = false; setBusy(false); }
  }
  return { busy, run };
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const [focused, setFocused] = useState(false);
  return <View style={{ gap: 7, marginBottom: 18 }}><Text style={F.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={C.muted} selectionColor={C.accent} {...props} onFocus={(event) => { setFocused(true); props.onFocus?.(event); }} onBlur={(event) => { setFocused(false); props.onBlur?.(event); }} style={[F.input, focused && { borderColor: C.accent }, props.multiline && { minHeight: 90, textAlignVertical: 'top' }, props.style]} /></View>;
}
export function Visibility({ value, onChange }: { value: Ranking['visibility']; onChange: (value: Ranking['visibility']) => void }) {
  return <View style={{ gap: 12, marginVertical: 22 }}><Text style={F.label}>WHO CAN SEE IT?</Text><View style={F.row}>{(['public', 'followers', 'private'] as const).map((v) => <Pressable accessibilityRole="button" accessibilityState={{ selected: v === value }} key={v} onPress={() => onChange(v)} style={[F.pill, v === value && { backgroundColor: C.ink }]}><Text style={{ color: v === value ? C.white : C.ink, fontWeight: '800', textTransform: 'capitalize' }}>{v}</Text></Pressable>)}</View><Text style={F.note}>{value === 'public' ? 'Anyone can view this post.' : value === 'followers' ? 'Only your followers and you can view this post.' : 'Only you can view this post.'}</Text></View>;
}
export function Confirm({ visible, title, description, onCancel, onConfirm, busy = false, children }: { visible: boolean; title: string; description: string; onCancel: () => void; onConfirm: () => void; busy?: boolean; children?: React.ReactNode }) {
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}><View style={F.overlay}><View style={F.dialog}><Text style={F.title}>{title}</Text><Text style={F.note}>{description}</Text>{children}<Action label={busy ? 'Working…' : 'Confirm'} disabled={busy} onPress={onConfirm} /><Action label="Cancel" secondary disabled={busy} onPress={onCancel} /></View></View></Modal>;
}
export const F = StyleSheet.create({
  title: { fontSize: 32, fontWeight: '900', color: C.ink, letterSpacing: -1, marginVertical: 16 },
  label: { fontSize: 11, fontWeight: '900', color: C.ink, letterSpacing: 1 },
  input: { minHeight: 52, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, color: C.ink, padding: 14, fontSize: 15 },
  note: { color: C.muted, fontSize: 13, lineHeight: 20 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pill: { minHeight: 48, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  section: { marginTop: 28, marginBottom: 16, borderTopWidth: 2, borderColor: C.ink, paddingTop: 18, gap: 14 },
  overlay: { flex: 1, backgroundColor: '#0009', padding: 24, justifyContent: 'center', alignItems: 'center' },
  dialog: { backgroundColor: C.paper, padding: 22, width: '100%', maxWidth: 440, gap: 14 },
});
