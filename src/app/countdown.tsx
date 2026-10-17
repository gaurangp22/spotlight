import { CameraType, CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';
import { canComposeTimed, composeTimed } from '../../modules/video-overlay';
import { formatScore } from '../lib/categories';
import { errorMessage } from '../lib/api';
import { saveVideoToLibrary } from '../lib/saveVideo';
import { MusicItem } from '../lib/types';
import { useApp } from '../store/AppContext';
import { goBack, MusicRow, Screen } from '../ui/components';
import { useTask } from '../ui/forms';
import { haptic } from '../ui/haptics';
import { MusicPicker } from '../ui/MusicPicker';
import { Button, Card, EmptyState, IconButton, Ionicons, SectionHeader, T, TextField } from '../ui/primitives';
import { CountdownCard } from '../ui/reelCards';
import { LayoutControls, LayoutGestures, useCardLayout } from '../ui/videoLayout';
import { font, noOutline, radius, space, useTheme } from '../ui/theme';

const MAX_SECONDS = 90, MAX_ITEMS = 10;
type Stage = 'setup' | 'camera' | 'preview';

function Clip({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = true; p.play(); });
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />;
}

const seconds = (value: number) => `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 60))));

export default function CountdownScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const screen = useWindowDimensions();
  const { postId } = useLocalSearchParams<{ postId?: string }>();
  const { user, allRankings, draft, ratingFor, setNotice } = useApp();
  const { busy, run } = useTask();
  const source = postId ? allRankings.find((p) => p.id === postId) : undefined;
  const [items, setItems] = useState<MusicItem[]>(() => (source?.items || draft.items).slice(0, MAX_ITEMS));
  const [title, setTitle] = useState(() => source?.title || draft.title || '');
  const [picking, setPicking] = useState(false);
  const [layout, setLayout] = useCardLayout('countdown');
  // A one-liner and a score per pick, shown when that pick is revealed. Scores start from your ratings.
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [stage, setStage] = useState<Stage>('setup');
  const [facing, setFacing] = useState<CameraType>('front');
  const [sound, setSound] = useState(true);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [reveals, setReveals] = useState<number[]>([]);
  const [shown, setShown] = useState(0);
  const [clip, setClip] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [cameraPermission, requestCamera] = useCameraPermissions();
  const [, requestMicrophone] = useMicrophonePermissions();
  const camera = useRef<CameraView>(null);
  const overlay = useRef<React.ComponentRef<typeof ViewShot>>(null);
  const startedAt = useRef(0);
  const discard = useRef(false);

  const scoreOf = (item: MusicItem) => { const typed = overrides[item.id]; if (typed !== undefined) { const v = Number(typed.replace(',', '.')); return typed.trim() && Number.isFinite(v) ? Math.max(0, Math.min(10, Math.round(v * 10) / 10)) : undefined; } return ratingFor(item.id)?.score; };
  const scores = items.map(scoreOf);
  const lines = items.map((item) => notes[item.id] || '');
  const stageWidth = Math.floor(Math.min(screen.width, (screen.height - insets.top - insets.bottom - 150) * 9 / 16));
  const stageHeight = Math.round(stageWidth * 16 / 9);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setElapsed((v) => Math.min(MAX_SECONDS, v + 1)), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  if (Platform.OS === 'web' || !canComposeTimed) return <Screen back title="Ranking video">
    <Card style={{ marginTop: space.xl }}><EmptyState icon="videocam-outline" title="Ranking videos are filmed in the Riffs app"
      text={Platform.OS === 'web' ? 'Open Riffs on your phone to film your reaction while your ranking counts down to #1.' : 'Update to the latest version of Riffs to film ranking videos.'}
      action={<Button label="Back" variant="secondary" inline onPress={goBack} />} /></Card>
  </Screen>;

  const openCamera = () => run(async () => {
    const permission = cameraPermission?.granted ? cameraPermission : await requestCamera();
    if (!permission.granted) {
      if (!permission.canAskAgain) { setNotice('Camera access is off for Riffs. Turn it on in Settings to record.'); await Linking.openSettings(); }
      return;
    }
    if (sound) { const mic = await requestMicrophone(); if (!mic.granted) setSound(false); }
    setOutput(null); setClip(null); setReady(false); setReveals([]); setShown(0); setStage('camera');
  });

  const record = async () => {
    if (!camera.current || !ready || recording) return;
    haptic.press(); setElapsed(0); setReveals([]); setShown(0); setRecording(true); discard.current = false; startedAt.current = Date.now();
    try {
      const result = await camera.current.recordAsync({ maxDuration: MAX_SECONDS });
      if (result?.uri && !discard.current) { setClip(result.uri); setOutput(null); setStage('preview'); haptic.success(); }
    } catch (error) {
      haptic.warn();
      setNotice(/no valid data|too short|stopped before/i.test(errorMessage(error)) ? 'That was too quick to save. Hold on for at least a second.' : errorMessage(error));
    } finally { setRecording(false); }
  };
  const stop = () => { haptic.press(); camera.current?.stopRecording(); };
  const reveal = () => {
    if (!recording || shown >= items.length) return;
    haptic.select();
    setReveals((list) => [...list, (Date.now() - startedAt.current) / 1000]);
    setShown((v) => v + 1);
  };

  /** Captures one card per reveal, then burns them in so each appears at the moment it was revealed. */
  const produce = async () => {
    if (output) return output;
    if (!clip || !overlay.current?.capture) throw new Error('Record your video first.');
    const frames: { uri: string; start: number }[] = [];
    for (let count = 0; count <= reveals.length; count++) {
      setShown(count); await nextFrame();
      frames.push({ uri: await overlay.current.capture(), start: count === 0 ? 0 : reveals[count - 1] });
    }
    const video = await composeTimed(clip, frames);
    setOutput(video);
    return video;
  };
  const save = () => run(async () => { const video = await produce(); await saveVideoToLibrary(video); haptic.success(); setNotice('Saved to your photos.'); });
  const share = () => run(async () => {
    const video = await produce();
    if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable on this device.');
    await Sharing.shareAsync(video, { mimeType: 'video/mp4', UTI: 'public.mpeg-4', dialogTitle: 'Post your ranking video' });
  });

  const name = user?.name || 'You', handle = user?.handle || '@you';

  if (stage === 'setup') return <Screen back title="Ranking video"
    footer={<View style={{ gap: space.sm }}>
      {items.length < 2 && <T v="footnote" tone="secondary" center>Add at least two songs to film a countdown.</T>}
      <Button label="Open camera" icon="videocam" disabled={items.length < 2} loading={busy} onPress={() => void openCamera()} />
    </View>}>
    <T v="title1" style={{ marginTop: space.sm }}>Count it down on camera</T>
    <T v="subhead" tone="secondary" style={{ marginTop: space.xs }}>Film your reaction and tap to reveal each pick, from #{Math.max(items.length, 2)} up to #1. Add a score and a line for each — they appear as you reveal.</T>
    <SectionHeader title="Title" />
    <TextField label="Shown at the top of the video" value={title} onChangeText={setTitle} maxLength={60} placeholder="My Discovery ranking" />
    <SectionHeader title={`Your order · ${items.length}/${MAX_ITEMS}`} detail="#1 is revealed last" />
    {items.length ? <Card padded={false} style={{ paddingHorizontal: space.md }}>
      {items.map((item, index) => <View key={item.id} style={{ paddingBottom: space.sm, borderBottomWidth: index < items.length - 1 ? StyleSheet.hairlineWidth : 0, borderColor: c.hairline }}><MusicRow item={item} index={index} size={40} separator={false}
        trailing={<View style={{ flexDirection: 'row' }}>
          <IconButton icon="chevron-up" label={`Move ${item.title} up`} size={32} filled={false} tone="secondary" disabled={index === 0} onPress={() => setItems((list) => { const next = [...list]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })} />
          <IconButton icon="close" label={`Remove ${item.title}`} size={32} filled={false} tone="secondary" onPress={() => setItems((list) => list.filter((x) => x.id !== item.id))} />
        </View>} />
        <View style={{ flexDirection: 'row', gap: space.sm, marginLeft: 38 }}>
          <TextInput value={notes[item.id] || ''} onChangeText={(v) => setNotes((m) => ({ ...m, [item.id]: v }))} maxLength={60} placeholder="Say something (optional)" placeholderTextColor={c.tertiary} accessibilityLabel={`What you say about ${item.title}`}
            style={[styles.input, { flex: 1, backgroundColor: c.fill, color: c.text }]} />
          <TextInput value={overrides[item.id] ?? (ratingFor(item.id) ? formatScore(ratingFor(item.id)!.score) : '')} onChangeText={(v) => setOverrides((m) => ({ ...m, [item.id]: v.replace(/[^0-9.,]/g, '').slice(0, 4) }))} keyboardType="decimal-pad" placeholder="Score" placeholderTextColor={c.tertiary} accessibilityLabel={`Score for ${item.title}`}
            style={[styles.input, { width: 64, textAlign: 'center', backgroundColor: c.fill, color: c.text }]} />
        </View>
      </View>)}
    </Card> : <Card><EmptyState icon="podium-outline" title="Pick what you’re ranking" text="Add up to 10 songs or albums, best first." /></Card>}
    <Button label="Add songs" icon="add" variant="secondary" disabled={items.length >= MAX_ITEMS} onPress={() => setPicking(true)} style={{ marginTop: space.md }} />
    {items.length >= 2 && <>
      <SectionHeader title="Preview" />
      <View style={{ alignSelf: 'center', width: 200, height: 356, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#1E1D1B' }}>
        <CountdownCard items={items} scores={scores} notes={lines} title={title} name={name} handle={handle} avatar={user?.avatar} revealed={Math.min(3, items.length)} width={200} layout={layout} />
      </View>
    </>}
    <T v="footnote" tone="secondary" center style={{ marginTop: space.xl }}>Made on your phone. Nothing is uploaded unless you share it.</T>
    <MusicPicker visible={picking} onClose={() => setPicking(false)} selected={items} limit={MAX_ITEMS} title="Add to your countdown" spotifyConnected={false}
      onToggle={(item) => setItems((list) => list.some((x) => x.id === item.id) ? list.filter((x) => x.id !== item.id) : [...list, item].slice(0, MAX_ITEMS))} />
  </Screen>;

  const done = shown >= items.length;
  return <View style={{ flex: 1, backgroundColor: '#000000', paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, space.md) }}>
    <StatusBar style="light" />
    <View style={{ width: stageWidth, height: stageHeight, alignSelf: 'center', borderRadius: stageWidth < screen.width ? radius.lg : 0, overflow: 'hidden', backgroundColor: '#111111' }}>
      {stage === 'camera' ? <CameraView ref={camera} style={StyleSheet.absoluteFill} facing={facing} mode="video" mute={!sound} videoQuality="1080p"
        onCameraReady={() => setReady(true)} onMountError={(e) => setNotice(e.message)} />
        : clip ? <Clip uri={clip} /> : null}
      <ViewShot ref={overlay} options={{ format: 'png', quality: 1, result: 'tmpfile', width: 1080, height: 1920 }} style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]}>
        <View collapsable={false} style={StyleSheet.absoluteFill}>
          <CountdownCard items={items} scores={scores} notes={lines} title={title} name={name} handle={handle} avatar={user?.avatar} revealed={stage === 'preview' && !busy ? reveals.length : shown} width={stageWidth} layout={layout} />
        </View>
      </ViewShot>
      <LayoutGestures layout={layout} onChange={setLayout} width={stageWidth} height={stageHeight} enabled={!recording && !busy} />
      <View style={styles.topBar}>
        <IconButton icon="close" label="Close" onPress={() => { if (recording) { discard.current = true; stop(); } setStage('setup'); }} size={40} tone="white" filled={false} />
        {recording ? <View style={styles.timer}><View style={styles.dot} /><Text style={styles.timerText}>{seconds(elapsed)}</Text></View> : <View />}
        {stage === 'camera' && !recording ? <IconButton icon="camera-reverse-outline" label="Flip camera" size={40} tone="white" filled={false} onPress={() => { setReady(false); setFacing((v) => (v === 'front' ? 'back' : 'front')); }} /> : <View />}
      </View>
      {busy && stage === 'preview' && <View style={styles.busy}><ActivityIndicator color="#FFFFFF" /><Text style={styles.busyText}>Making your video…</Text></View>}
    </View>

    <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space.xl }}>
      {stage === 'camera' ? <View style={{ gap: space.md }}>
        {!recording && <LayoutControls layout={layout} onChange={setLayout} />}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xl }}>
        <Pressable accessibilityRole="button" accessibilityLabel={recording ? 'Stop recording' : 'Start recording'} disabled={!ready}
          onPress={() => (recording ? stop() : void record())} style={[styles.shutter, !ready && { opacity: 0.4 }]}>
          <View style={recording ? styles.stopSquare : styles.recordDot} />
        </Pressable>
        {recording && <Pressable accessibilityRole="button" accessibilityLabel={done ? 'All picks revealed' : `Reveal number ${items.length - shown}`} disabled={done} onPress={reveal}
          style={[styles.reveal, { backgroundColor: done ? 'rgba(255,255,255,0.15)' : c.accentFill }]}>
          <Ionicons name={done ? 'checkmark' : 'eye'} size={20} color={done ? '#FFFFFF' : c.onAccent} />
          <Text style={[styles.revealText, { color: done ? '#FFFFFF' : c.onAccent }]}>{done ? 'All in' : `Reveal #${items.length - shown}`}</Text>
        </Pressable>}
        </View>
      </View> : <View style={{ gap: space.sm }}>
        {!busy && <LayoutControls layout={layout} onChange={setLayout} />}
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label="Retake" icon="refresh" variant="secondary" size="md" style={{ flex: 1 }} disabled={busy} onPress={() => { setOutput(null); setReady(false); setReveals([]); setShown(0); setStage('camera'); }} />
          <Button label="Save" icon="download-outline" size="md" style={{ flex: 1 }} disabled={busy} onPress={() => void save()} />
          <Button label="Share" icon="logo-instagram" variant="inverse" size="md" style={{ flex: 1 }} disabled={busy} onPress={() => void share()} />
        </View>
      </View>}
      <Text style={[styles.hint, { marginTop: space.sm }]}>{stage === 'preview' ? `${reveals.length} of ${items.length} picks revealed` : recording ? 'Talk it through, then tap Reveal' : ready ? 'Drag or pinch the card to place it, then record' : 'Starting camera…'}</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space.sm },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 30, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.55)' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30' },
  timerText: { fontFamily: font.semibold, fontSize: 13, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  shutter: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  recordDot: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FF3B30' },
  stopSquare: { width: 26, height: 26, borderRadius: 6, backgroundColor: '#FF3B30' },
  reveal: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 56, paddingHorizontal: 22, borderRadius: radius.pill },
  revealText: { fontFamily: font.bold, fontSize: 17, color: '#FFFFFF' },
  hint: { fontFamily: font.medium, fontSize: 13, color: '#FFFFFFB3', textAlign: 'center' },
  busy: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  busyText: { fontFamily: font.semibold, fontSize: 15, color: '#FFFFFF' },
  input: { minHeight: 36, borderRadius: radius.sm, paddingHorizontal: 10, fontFamily: font.regular, fontSize: 14, ...noOutline },
});
