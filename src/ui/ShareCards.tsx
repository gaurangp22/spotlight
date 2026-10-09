import * as Sharing from 'expo-sharing';
import React, { useRef, useState } from 'react';
import { Platform, Text, useWindowDimensions, View } from 'react-native';
import { shareLink } from '../lib/links';
import ViewShot from 'react-native-view-shot';
import { categories } from '../lib/categories';
import { errorMessage } from '../lib/api';
import { MusicItem, Ranking, Rating } from '../lib/types';
import { useApp } from '../store/AppContext';
import { ScoreBadge } from './components';
import { haptic } from './haptics';
import { MoodGrid } from './mood';
import { Artwork, Button, Segmented, T } from './primitives';
import { curve, font, radius, shadow, space, useTheme } from './theme';

export const templates = {
  night: { bg: '#141413', fg: '#FFFFFF', muted: '#FFFFFF99', rule: '#FFFFFF1F', accent: '#FF6B4A' },
  paper: { bg: '#F7F3EA', fg: '#141413', muted: '#14141399', rule: '#1414131A', accent: '#C63A22' },
  red: { bg: '#C63A22', fg: '#FFFFFF', muted: '#FFFFFFB3', rule: '#FFFFFF33', accent: '#FFFFFF' },
};
export type Template = keyof typeof templates;
type Colors = (typeof templates)[Template];
/** Post is Instagram's 4:5 feed shape; Story fills a 9:16 phone screen. */
export type Format = 'post' | 'story';
const aspect: Record<Format, number> = { post: 1.25, story: 16 / 9 };
const exportSize: Record<Format, { width: number; height: number }> = { post: { width: 1080, height: 1350 }, story: { width: 1080, height: 1920 } };

export function Wordmark({ color, accent, size = 15 }: { color: string; accent: string; size?: number }) {
  return <Text style={{ fontFamily: font.heavy, fontSize: size, letterSpacing: -0.4, color }}>Riffs<Text style={{ color: accent }}>.</Text></Text>;
}

function Overline({ t, children }: { t: Colors; children: React.ReactNode }) {
  return <Text style={{ fontFamily: font.semibold, fontSize: 10, letterSpacing: 1.2, color: t.accent }}>{children}</Text>;
}

function Row({ item, index, t, width, score, first }: { item: MusicItem; index: number; t: Colors; width: number; score?: number; first: boolean }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 7, borderTopWidth: first ? 0 : 1, borderColor: t.rule }}>
    <Text style={{ fontFamily: font.bold, fontSize: 15, color: index === 0 ? t.accent : t.fg, width: 16, fontVariant: ['tabular-nums'] }}>{index + 1}</Text>
    <Artwork item={item} size={width * 0.12} rounded={6} />
    <View style={{ flex: 1 }}>
      <Text numberOfLines={1} style={{ fontFamily: font.semibold, fontSize: 13, color: t.fg, letterSpacing: -0.2 }}>{item.title}</Text>
      <Text numberOfLines={1} style={{ fontFamily: font.regular, fontSize: 11, color: t.muted, marginTop: 1 }}>{item.artist}</Text>
    </View>
    {score !== undefined && <ScoreBadge score={score} size={28} />}
  </View>;
}

/** The body of a post's share card; the frame (wordmark, handle, footer) is added by ShareStudio. */
export function PostCardBody({ post, t, width, format }: { post: Ranking; t: Colors; width: number; format: Format }) {
  const story = format === 'story';
  if (post.kind === 'take') {
    return <TakeShareBody key={`${width}:${format}:${post.title}`} post={post} t={t} width={width} format={format} />;
  }
  if (post.kind === 'review') {
    const item = post.items[0];
    const art = width * (story ? 0.62 : 0.44);
    return <View style={{ alignItems: 'center', gap: story ? 16 : 10 }}>
      <Overline t={t}>{`${categories[item.kind].label.toUpperCase()} REVIEW`}</Overline>
      <View>
        <Artwork item={item} size={art} rounded={12} />
        {post.score !== undefined && <View style={{ position: 'absolute', right: -14, bottom: -14 }}><ScoreBadge score={post.score} size={story ? 64 : 52} ring /></View>}
      </View>
      <View style={{ alignItems: 'center', marginTop: 6, paddingHorizontal: 8 }}>
        <Text numberOfLines={2} style={{ fontFamily: font.bold, fontSize: story ? 24 : 20, lineHeight: story ? 28 : 24, letterSpacing: -0.7, color: t.fg, textAlign: 'center' }}>{item.title}</Text>
        <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 12, color: t.muted, marginTop: 3 }}>{item.artist}</Text>
      </View>
      {!!post.subtitle && <Text numberOfLines={story ? 6 : 3} style={{ fontFamily: font.medium, fontSize: story ? 16 : 13, lineHeight: story ? 22 : 18, color: t.fg, textAlign: 'center', paddingHorizontal: 6 }}>“{post.subtitle}”</Text>}
    </View>;
  }
  if (post.kind === 'pod') {
    const tile = width * (story ? 0.36 : 0.27);
    const covers = post.items.slice(0, 4);
    const people = new Set(post.items.map((i) => i.addedBy).filter(Boolean)).size;
    return <View style={{ gap: story ? 18 : 12 }}>
      <Overline t={t}>{post.open ? 'OPEN POD' : 'POD'}</Overline>
      <Text numberOfLines={2} style={{ fontFamily: font.bold, fontSize: story ? 28 : 24, lineHeight: story ? 32 : 28, letterSpacing: -0.9, color: t.fg }}>{post.title}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, width: tile * 2 + 6, alignSelf: 'center' }}>
        {Array.from({ length: 4 }, (_, i) => covers[i]
          ? <Artwork key={covers[i].id} item={covers[i]} size={tile} rounded={8} />
          : <View key={i} style={{ width: tile, height: tile, borderRadius: 8, backgroundColor: t.rule }} />)}
      </View>
      <Text style={{ fontFamily: font.medium, fontSize: 12, color: t.muted, textAlign: 'center' }}>
        {post.items.length} {post.items.length === 1 ? 'pick' : 'picks'}{people ? ` · ${people + 1} people` : ''}
      </Text>
    </View>;
  }
  const rows = post.items.slice(0, story ? 7 : 5);
  return <View>
    <Overline t={t}>{post.kind === 'moodboard' ? 'MOOD BOARD' : `TOP ${Math.min(rows.length, post.items.length)}`}</Overline>
    <Text numberOfLines={3} style={{ fontFamily: font.bold, fontSize: 24, lineHeight: 28, letterSpacing: -0.9, color: t.fg, marginTop: 6 }}>{post.title}</Text>
    {post.kind === 'moodboard' ? <View style={{ marginTop: 14 }}><MoodGrid post={post} compact /></View>
      : <View style={{ marginTop: 14 }}>{rows.map((item, index) => <Row key={item.id} item={item} index={index} t={t} width={width} first={index === 0} />)}</View>}
  </View>;
}

/** Fit the complete opinion inside the exported frame, including on small preview screens. */
function TakeShareBody({ post, t, width, format }: { post: Ranking; t: Colors; width: number; format: Format }) {
  const compact = width < 260 && format === 'post';
  const gap = compact ? 8 : 12;
  const rowHeight = Math.max(width * 0.14, compact ? 38 : 46);
  const textBudget = Math.max(30, (width + 44) * aspect[format] - 110 - 14 - post.items.length * rowHeight - (post.items.length + 1) * gap);
  const [textSize, setTextSize] = useState(compact ? 12 : post.title.length > 180 ? 15 : 21);
  return <View style={{ gap }}>
    <Text style={{ fontFamily: font.monoBold, fontSize: 10, color: t.accent }}>{post.poll ? 'THIS OR THAT' : 'HOT TAKE'}</Text>
    <Text onLayout={(event) => { const height = event.nativeEvent.layout.height; if (height > textBudget + 1) setTextSize((size) => Math.max(6, size * Math.sqrt(textBudget / height) * 0.95)); }}
      style={{ fontFamily: font.bold, fontSize: textSize, lineHeight: textSize * 1.25, color: t.fg }}>{post.title}</Text>
    {post.items.map((item) => <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: rowHeight }}>
      <Artwork item={item} size={width * 0.14} rounded={8} /><View style={{ flex: 1 }}><Text numberOfLines={2} style={{ fontFamily: font.semibold, fontSize: compact ? 11 : 13, color: t.fg }}>{item.title}</Text><Text numberOfLines={1} style={{ fontFamily: font.regular, fontSize: compact ? 10 : 11, color: t.muted }}>{item.artist}</Text></View>
    </View>)}
  </View>;
}

export function postFooter(post: Ranking, format: Format) {
  if (post.kind === 'take') return post.poll ? 'Cast your vote in Riffs' : 'What’s your take?';
  if (post.kind === 'review') return 'What would you give it?';
  if (post.kind === 'pod') return post.open ? 'Add yours in Riffs' : 'Make your own pod in Riffs';
  const shown = format === 'story' ? 7 : 5;
  return `${post.items.length > shown && post.kind !== 'moodboard' ? `+ ${post.items.length - shown} more · ` : ''}What’s your order?`;
}

export function TopFiveBody({ title, ratings, t, width }: { title: string; ratings: Rating[]; t: Colors; width: number }) {
  return <View>
    <Overline t={t}>TOP 5</Overline>
    <Text numberOfLines={3} style={{ fontFamily: font.bold, fontSize: 24, lineHeight: 28, letterSpacing: -0.9, color: t.fg, marginTop: 6 }}>{title}</Text>
    <View style={{ marginTop: 14 }}>
      {ratings.map((r, index) => <Row key={r.item.id} item={r.item} index={index} t={t} width={width} score={r.score} first={index === 0} />)}
    </View>
  </View>;
}

/**
 * Template and format pickers, the live card, and the share/download actions. `children` renders the
 * card body for the chosen template; the studio supplies the brand frame around it.
 */
export function ShareStudio({ handle, filename, footer, link, note, children }: {
  handle: string; filename: string; footer: string | ((format: Format) => string); link?: { message: string; url: string }; note: string;
  children: (t: Colors, width: number, format: Format) => React.ReactNode;
}) {
  const { c } = useTheme();
  const { setNotice } = useApp();
  const [template, setTemplate] = useState<Template>('night');
  const [format, setFormat] = useState<Format>('post');
  const [sharing, setSharing] = useState(false);
  const card = useRef<React.ComponentRef<typeof ViewShot>>(null);
  const screen = useWindowDimensions();
  // Fit the card on screen at either shape, leaving room for the controls and footer buttons.
  const width = Math.round(Math.min(screen.width - 56, 340, Math.max(220, (screen.height - 330) / aspect[format])));
  const height = Math.round(width * aspect[format]);
  const t = templates[template];
  const web = Platform.OS === 'web';

  const shareImage = async () => {
    if (!card.current?.capture) return;
    setSharing(true);
    try {
      const uri = await card.current.capture();
      if (web) { const a = document.createElement('a'); a.href = uri; a.download = `${filename}.png`; a.click(); return; }
      if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable on this device.');
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share to your story or feed', UTI: 'public.png' });
      haptic.success();
    } catch (e) { setNotice(errorMessage(e)); }
    finally { setSharing(false); }
  };

  return <View style={{ gap: space.md }}>
    <Segmented value={template} onChange={setTemplate} style={{ marginTop: space.sm }} options={[{ value: 'night', label: 'Night' }, { value: 'paper', label: 'Paper' }, { value: 'red', label: 'Red' }]} />
    <Segmented value={format} onChange={setFormat} options={[{ value: 'post', label: 'Post 4:5', icon: 'square-outline' }, { value: 'story', label: 'Story 9:16', icon: 'phone-portrait-outline' }]} />
    <View style={{ alignItems: 'center', marginTop: space.md }}>
      <View style={[{ borderRadius: radius.lg, ...curve }, shadow(c, 3)]}>
        <ViewShot ref={card} options={{ format: 'png', quality: 1, result: web ? 'data-uri' : 'tmpfile', ...exportSize[format] }} style={{ width, height, borderRadius: radius.lg, overflow: 'hidden' }}>
          <View collapsable={false} style={{ backgroundColor: t.bg, width, height, padding: 22, justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Wordmark color={t.fg} accent={t.accent} />
              <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 10, color: t.muted, flexShrink: 1, marginLeft: 8 }}>{handle}</Text>
            </View>
            <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 14 }}>{children(t, width - 44, format)}</View>
            <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 10, color: t.muted }}>{typeof footer === 'function' ? footer(format) : footer}</Text>
          </View>
        </ViewShot>
      </View>
    </View>
    <T v="footnote" tone="secondary" center style={{ paddingHorizontal: space.lg }}>{note}</T>
    <View style={{ gap: space.sm, marginTop: space.sm }}>
      <Button label={web ? 'Download image' : 'Share image'} icon={web ? 'download-outline' : 'share-outline'} loading={sharing} onPress={() => void shareImage()} />
      {link && <Button label="Share link" icon="link" variant="secondary" onPress={() => void shareLink(link.message, link.url).then((r) => { if (r === 'copied') setNotice('Link copied.'); }).catch((e) => setNotice(errorMessage(e)))} />}
    </View>
  </View>;
}
