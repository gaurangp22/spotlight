import { CameraType, CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';
import { compose, isAvailable } from '../../modules/video-overlay';
import { allKinds, categories, formatScore, scoreColor } from '../lib/categories';
import { errorMessage } from '../lib/api';
import { PickedMedia, pickMedia } from '../lib/pickMedia';
import { saveVideoToLibrary } from '../lib/saveVideo';
import { MusicItem } from '../lib/types';
import { useApp } from '../store/AppContext';
import { goBack, Loading, Screen } from '../ui/components';
import { useTask } from '../ui/forms';
import { haptic } from '../ui/haptics';
import { MusicPicker } from '../ui/MusicPicker';
import { ReviewCard } from '../ui/reelCards';
import { Backdrop } from '../ui/reelMedia';
import { LayoutControls, LayoutGestures, useCardLayout } from '../ui/videoLayout';
import { Artwork, Button, Card, EmptyState, IconButton, Ionicons, SectionHeader, Segmented, T, Tap, TextField } from '../ui/primitives';
import { curve, font, radius, space, useTheme } from '../ui/theme';

const MAX_SECONDS = 60;
const quickScores = [10, 9, 8, 7, 6, 5];
type Stage = 'setup' | 'camera' | 'preview';

const seconds = (value: number) => `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;

export default function VideoReviewScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const screen = useWindowDimensions();
  const params = useLocalSearchParams<{ itemId?: string; reactTo?: string }>();
  const { user, itemFor, ratingFor, spotifyConnected, setNotice, allRankings, loadPost } = useApp();
  const { busy, run } = useTask();
  // Reacting to someone else's public review: their card goes in the video, with your score under it.
  const original = params.reactTo ? allRankings.find((post) => post.id === params.reactTo) : undefined;
  const reacting = !!params.reactTo;
  const start = original?.items[0] ?? (params.itemId ? itemFor(params.itemId) : undefined);
  const [picked, setItem] = useState<MusicItem | undefined>(start);
  const item = original?.items[0] ?? picked;
  const [score, setScore] = useState(() => (start ? ratingFor(start.id)?.score : undefined) ?? 8);
  const [showMine, setShowMine] = useState(true);
  const [caption, setCaption] = useState('');
  const [layout, setLayout] = useCardLayout('review');
  const [picking, setPicking] = useState(false);
  const [stage, setStage] = useState<Stage>('setup');
  const [facing, setFacing] = useState<CameraType>('front');
  const [sound, setSound] = useState(false);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [clip, setClip] = useState<PickedMedia | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [cameraPermission, requestCamera] = useCameraPermissions();
  const [, requestMicrophone] = useMicrophonePermissions();
  const camera = useRef<CameraView>(null);
  const overlay = useRef<React.ComponentRef<typeof ViewShot>>(null);
  // The photo and card together, captured as one image when a photo is picked instead of a video.
  const still = useRef<React.ComponentRef<typeof ViewShot>>(null);
  // Set when the camera is closed mid-recording, so the clip that finishes saving is thrown away.
  const discard = useRef(false);

  // The recording is 9:16, so the stage is too: what's on screen is exactly what gets saved.
  const stageWidth = Math.floor(Math.min(screen.width, (screen.height - insets.top - insets.bottom - 132) * 9 / 16));
  const stageHeight = Math.round(stageWidth * 16 / 9);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setElapsed((v) => Math.min(MAX_SECONDS, v + 1)), 1000);
    return () => clearInterval(timer);
  }, [recording]);
  // Opened from a link before the review was in memory: fetch it.
  const reactTo = params.reactTo;
  useEffect(() => { if (reactTo && !original) loadPost(reactTo).catch((e) => setNotice(errorMessage(e))); }, [reactTo, original, loadPost, setNotice]);

  if (Platform.OS === 'web' || !isAvailable) return <Screen back title="Video review">
    <Card style={{ marginTop: space.xl }}><EmptyState icon="videocam-outline" title="Video reviews are recorded in the Riffs app on your phone"
      text={Platform.OS === 'web' ? 'Open Riffs on your phone to film yourself with your rating and caption, then post it to Instagram.' : 'Update to the latest version of Riffs to record video reviews.'}
      action={<Button label="Back" variant="secondary" inline onPress={goBack} />} /></Card>
  </Screen>;
  // Other people only end up in a video when their review is already public.
  if (reacting && (!original || original.visibility !== 'public')) return <Screen back title="React on video">
    {original ? <Card style={{ marginTop: space.xl }}><EmptyState icon="lock-closed-outline" title="This review isn’t public"
      text="You can only film a reaction to a review everyone can see." action={<Button label="Back" variant="secondary" inline onPress={goBack} />} /></Card>
      : <Loading label="Loading review…" />}
  </Screen>;

  /** The card in the video: your own review, or theirs with your score under it. */
  const reelCard = (target: MusicItem, width: number) => original
    ? <ReviewCard item={target} score={original.score ?? 0} take={original.subtitle || ''} name={original.author} handle={original.handle} avatar={original.avatar} width={width} layout={layout}
      reply={showMine ? { name: user?.name || 'You', handle: user?.handle || '@you', avatar: user?.avatar, score } : undefined} />
    : <ReviewCard item={target} score={score} take={caption} name={user?.name || 'You'} handle={user?.handle || '@you'} avatar={user?.avatar} width={width} layout={layout} />;

  const openCamera = () => run(async () => {
    const permission = cameraPermission?.granted ? cameraPermission : await requestCamera();
    if (!permission.granted) {
      if (!permission.canAskAgain) { setNotice('Camera access is off for Riffs. Turn it on in Settings to record.'); await Linking.openSettings(); }
      return;
    }
    setOutput(null); setClip(null); setReady(false); setStage('camera');
  });

  const toggleSound = () => run(async () => {
    if (sound) { setSound(false); return; }
    // The microphone is only requested when someone actually wants sound.
    const permission = await requestMicrophone();
    if (!permission.granted) { setNotice('Microphone access is off. Your video will record without sound — add music in Instagram instead.'); return; }
    setSound(true); haptic.select();
  });

  const record = async () => {
    if (!camera.current || !ready || recording) return;
    haptic.press(); setElapsed(0); setRecording(true); discard.current = false;
    try {
      const result = await camera.current.recordAsync({ maxDuration: MAX_SECONDS });
      if (result?.uri && !discard.current) { setClip({ uri: result.uri, kind: 'video' }); setOutput(null); setStage('preview'); haptic.success(); }
    } catch (error) {
      haptic.warn();
      setNotice(/no valid data|too short|stopped before/i.test(errorMessage(error)) ? 'That was too quick to save. Hold on for at least a second.' : errorMessage(error));
    } finally { setRecording(false); }
  };
  const stop = () => { haptic.press(); camera.current?.stopRecording(); };
  const fromGallery = () => run(async () => {
    const picked = await pickMedia(MAX_SECONDS);
    if (!picked) return;
    setClip(picked); setOutput(null); setStage('preview');
  });

  /** Burns the card onto the clip once (or captures photo and card together), then reuses the file for both Save and Share. */
  const produce = async () => {
    if (output) return output;
    if (clip?.kind === 'photo') {
      if (!still.current?.capture) throw new Error('Pick a photo first.');
      const image = await still.current.capture();
      setOutput(image);
      return image;
    }
    if (!clip || !overlay.current?.capture) throw new Error('Record your review first.');
    const card = await overlay.current.capture();
    const video = await compose(clip.uri, card);
    setOutput(video);
    return video;
  };
  const save = () => run(async () => {
    const file = await produce();
    await saveVideoToLibrary(file, clip?.kind === 'photo' ? 'photo' : 'video');
    haptic.success();
    setNotice(clip?.kind === 'photo' ? 'Saved to your photos.' : 'Saved to your photos. In Instagram, tap Add audio to put music on it.');
  });
  const share = () => run(async () => {
    const file = await produce();
    if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable on this device.');
    await Sharing.shareAsync(file, clip?.kind === 'photo'
      ? { mimeType: 'image/jpeg', UTI: 'public.jpeg', dialogTitle: 'Post your review' }
      : { mimeType: 'video/mp4', UTI: 'public.mpeg-4', dialogTitle: 'Post your video review' });
  });

  if (stage === 'setup') return <Screen back title={original ? 'React on video' : 'Video review'}
    footer={<View style={{ gap: space.sm }}>
      {!item && <T v="footnote" tone="secondary" center>Choose what you’re reviewing to start recording.</T>}
      <Button label="Open camera" icon="videocam" disabled={!item} loading={busy} onPress={() => void openCamera()} />
      <Button label="Use a photo or video you have" icon="images-outline" variant="secondary" disabled={!item || busy} onPress={() => void fromGallery()} />
    </View>}>
    <T v="title1" style={{ marginTop: space.sm }}>{original ? `React to ${original.author}` : 'Film your take'}</T>
    <T v="subhead" tone="secondary" style={{ marginTop: space.xs }}>{original
      ? `${original.handle}’s review sits on a card in the video while you react to it. Add the score you’d give it, then post it anywhere.`
      : 'Flip the camera and record your reaction. Your score and your take sit on a card in the video — post it anywhere.'}</T>

    <SectionHeader title={original ? 'Their review' : 'Reviewing'} />
    {item ? <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <Artwork item={item} size={56} />
      <View style={{ flex: 1, gap: 2 }}>
        <T v="caption" tone="secondary">{original ? original.score === undefined ? `${original.handle}’s review` : `${original.handle} gave it ${formatScore(original.score)}` : categories[item.kind].label}</T>
        <T v="headline" numberOfLines={2}>{item.title}</T>
        <T v="footnote" tone="secondary" numberOfLines={1}>{original?.subtitle ? `“${original.subtitle}”` : item.artist}</T>
      </View>
      {!original && <Button label="Change" size="sm" variant="secondary" inline onPress={() => setPicking(true)} />}
    </Card> : <Card onPress={() => setPicking(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <View style={{ width: 56, height: 56, borderRadius: radius.md, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center', ...curve }}><Ionicons name="search" size={24} color={c.accent} /></View>
      <View style={{ flex: 1 }}><T v="headline">Choose a song, album, or artist</T><T v="footnote" tone="secondary">Anything you can rate</T></View>
      <Ionicons name="chevron-forward" size={18} color={c.tertiary} />
    </Card>}

    <SectionHeader title={original ? 'Your score' : 'Your rating'} detail={item && ratingFor(item.id) ? `You rated it ${formatScore(ratingFor(item.id)!.score)}` : undefined} />
    {original && <Segmented value={showMine ? 'mine' : 'theirs'} style={{ marginBottom: space.md }} onChange={(v) => setShowMine(v === 'mine')}
      options={[{ value: 'mine', label: 'Add my score', icon: 'add-circle-outline' }, { value: 'theirs', label: 'Just theirs', icon: 'person-outline' }]} />}
    {(!original || showMine) && <Card style={{ gap: space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon="remove" label="Lower score by half a point" size={48} disabled={score <= 0} onPress={() => { haptic.select(); setScore((v) => Math.max(0, v - 0.5)); }} />
        <View accessible accessibilityLabel={`Score ${formatScore(score)} out of 10`} style={{ alignItems: 'center' }}>
          <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: font.heavy, fontSize: 64, lineHeight: 70, letterSpacing: -2.5, color: scoreColor(score), fontVariant: ['tabular-nums'] }}>{formatScore(score)}</Text>
          <T v="footnote" tone="secondary">out of 10</T>
        </View>
        <IconButton icon="add" label="Raise score by half a point" size={48} disabled={score >= 10} onPress={() => { haptic.select(); setScore((v) => Math.min(10, v + 0.5)); }} />
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm, justifyContent: 'center', flexWrap: 'wrap' }}>
        {quickScores.map((value) => <Tap key={value} onPress={() => setScore(value)} feedback="select" accessibilityLabel={`Set score to ${value}`}
          style={{ minWidth: 44, minHeight: 36, paddingHorizontal: 12, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: score === value ? scoreColor(value) : c.fill }}>
          <T v="callout" weight="semibold" style={{ color: score === value ? '#FFFFFF' : c.text }}>{value}</T>
        </Tap>)}
      </View>
    </Card>}

    {!original && <>
      <SectionHeader title="Your take" />
      <TextField label="Shown inside the card" value={caption} onChangeText={setCaption} maxLength={80} placeholder="perfection" hint={`${caption.length}/80`} />
    </>}

    {item && <>
      <SectionHeader title="Preview" />
      <View style={{ alignSelf: 'center', width: 180, height: 320, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#1E1D1B', ...curve }}>
        {reelCard(item, 180)}
      </View>
    </>}
    <T v="footnote" tone="secondary" center style={{ marginTop: space.xl }}>Recorded and made on your phone. Nothing is uploaded unless you share it.</T>

    <MusicPicker visible={picking} onClose={() => setPicking(false)} kinds={allKinds} title="What are you reviewing?" spotifyConnected={spotifyConnected}
      onPick={(picked) => { setItem(picked); const mine = ratingFor(picked.id); if (mine) setScore(mine.score); setPicking(false); }} />
  </Screen>;

  // Camera and preview share one dark stage with the overlay drawn on top of it.
  const overlayLayer = item && <ViewShot ref={overlay} options={{ format: 'png', quality: 1, result: 'tmpfile', width: 1080, height: 1920 }}
    style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]}>
    <View collapsable={false} style={StyleSheet.absoluteFill}>{reelCard(item, stageWidth)}</View>
  </ViewShot>;

  return <View style={{ flex: 1, backgroundColor: '#000000', paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, space.md) }}>
    <StatusBar style="light" />
    <View style={{ width: stageWidth, height: stageHeight, alignSelf: 'center', borderRadius: stageWidth < screen.width ? radius.lg : 0, overflow: 'hidden', backgroundColor: '#111111' }}>
      <ViewShot ref={still} options={{ format: 'jpg', quality: 0.92, result: 'tmpfile', width: 1080, height: 1920 }} style={StyleSheet.absoluteFill}>
        <View collapsable={false} style={StyleSheet.absoluteFill}>
          {/* Front-camera clips are saved mirrored, the way the preview showed them, so nothing flips after recording. */}
          {stage === 'camera' ? <CameraView ref={camera} style={StyleSheet.absoluteFill} facing={facing} mirror={facing === 'front'} mode="video" mute={!sound} videoQuality="1080p"
            onCameraReady={() => setReady(true)} onMountError={(e) => setNotice(e.message)} />
            : clip ? <Backdrop media={clip} /> : null}
          {overlayLayer}
        </View>
      </ViewShot>
      <LayoutGestures layout={layout} onChange={setLayout} width={stageWidth} height={stageHeight} enabled={!recording && !busy} />
      <View style={styles.topBar}>
        <IconButton icon="close" label="Close" onPress={() => { if (recording) { discard.current = true; stop(); } setStage('setup'); }} size={40} tone="white" filled={false} />
        {recording ? <View style={styles.timer}><View style={styles.dot} /><Text style={styles.timerText}>{seconds(elapsed)} / {seconds(MAX_SECONDS)}</Text></View> : <View />}
        {stage === 'camera' && !recording ? <View style={{ flexDirection: 'row', gap: space.xs }}>
          <Pressable accessibilityRole="switch" accessibilityState={{ checked: sound }} accessibilityLabel="Record sound" onPress={() => void toggleSound()} style={styles.pill}>
            <Ionicons name={sound ? 'mic' : 'mic-off'} size={16} color="#FFFFFF" /><Text style={styles.pillText}>{sound ? 'Sound on' : 'Sound off'}</Text>
          </Pressable>
          <IconButton icon="camera-reverse-outline" label="Flip camera" size={40} tone="white" filled={false} onPress={() => { setReady(false); setFacing((v) => (v === 'front' ? 'back' : 'front')); }} />
        </View> : <View />}
      </View>
      {busy && stage === 'preview' && <View style={styles.busy}><ActivityIndicator color="#FFFFFF" /><Text style={styles.busyText}>Making your video…</Text></View>}
    </View>

    <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space.xl }}>
      {stage === 'camera' ? <View style={{ alignItems: 'center', gap: space.sm }}>
        {!recording && <LayoutControls layout={layout} onChange={setLayout} />}
        <View style={styles.shutterRow}>
          {recording ? <View style={[styles.side, { backgroundColor: 'transparent' }]} /> : <Pressable accessibilityRole="button" accessibilityLabel="Use a photo or video from your gallery" disabled={busy}
            onPress={() => void fromGallery()} style={styles.side}>
            <Ionicons name="images-outline" size={22} color="#FFFFFF" />
          </Pressable>}
          <Pressable accessibilityRole="button" accessibilityLabel={recording ? 'Stop recording' : 'Start recording'} disabled={!ready}
            onPress={() => (recording ? stop() : void record())} style={[styles.shutter, !ready && { opacity: 0.4 }]}>
            <View style={recording ? styles.stopSquare : styles.recordDot} />
          </Pressable>
          <View style={[styles.side, { backgroundColor: 'transparent' }]} />
        </View>
        <Text style={styles.hint}>{recording ? 'Tap to stop' : ready ? 'Drag or pinch the card to place it, then record' : 'Starting camera…'}</Text>
      </View> : <View style={{ gap: space.sm }}>
        {!busy && <LayoutControls layout={layout} onChange={setLayout} />}
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label="Retake" icon="refresh" variant="secondary" size="md" style={{ flex: 1 }} disabled={busy} onPress={() => { setOutput(null); setReady(false); setStage('camera'); }} />
          <Button label="Save" icon="download-outline" size="md" style={{ flex: 1 }} disabled={busy} onPress={() => void save()} />
          <Button label="Share" icon="logo-instagram" variant="inverse" size="md" style={{ flex: 1 }} disabled={busy} onPress={() => void share()} />
        </View>
        <Text style={styles.hint}>Add music in Instagram with Add audio.</Text>
      </View>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space.sm },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 36, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.45)' },
  pillText: { fontFamily: font.semibold, fontSize: 12, color: '#FFFFFF' },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 30, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.55)' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30' },
  timerText: { fontFamily: font.semibold, fontSize: 13, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  shutterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xl },
  side: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  recordDot: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FF3B30' },
  stopSquare: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#FF3B30' },
  hint: { fontFamily: font.medium, fontSize: 13, color: '#FFFFFFB3', textAlign: 'center' },
  busy: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  busyText: { fontFamily: font.semibold, fontSize: 15, color: '#FFFFFF' },
});
