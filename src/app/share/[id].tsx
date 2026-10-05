import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Share, Text, useWindowDimensions, View } from 'react-native';
import ViewShot from 'react-native-view-shot';
import { errorMessage } from '../../lib/api';
import { postLink } from '../../lib/links';
import { useApp } from '../../store/AppContext';
import { goBack, Loading, Screen } from '../../ui/components';
import { haptic } from '../../ui/haptics';
import { MoodGrid } from '../../ui/mood';
import { Artwork, Button, IconButton, Segmented, T } from '../../ui/primitives';
import { curve, font, radius, shadow, space, useTheme } from '../../ui/theme';

const templates = {
  night: { bg: '#141413', fg: '#FFFFFF', muted: '#FFFFFF99', rule: '#FFFFFF1F', accent: '#FF6B4A' },
  paper: { bg: '#F7F3EA', fg: '#141413', muted: '#14141399', rule: '#1414131A', accent: '#C63A22' },
  red: { bg: '#C63A22', fg: '#FFFFFF', muted: '#FFFFFFB3', rule: '#FFFFFF33', accent: '#FFFFFF' },
};
type Template = keyof typeof templates;

export default function ShareScreen() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { allRankings, loadPost, setNotice } = useApp();
  const ranking = allRankings.find((entry) => entry.id === id);
  const [template, setTemplate] = useState<Template>('night');
  const [sharing, setSharing] = useState(false);
  const card = useRef<React.ComponentRef<typeof ViewShot>>(null);
  const width = Math.min(useWindowDimensions().width - 56, 340);
  useEffect(() => { loadPost(id).catch((e) => setNotice(errorMessage(e))); }, [id, loadPost, setNotice]);
  const close = <IconButton icon="close" label="Close" onPress={goBack} size={36} />;
  if (!ranking) return <Screen left={close} title="Share"><Loading label="Preparing your card…" /></Screen>;
  const t = templates[template];

  const shareImage = async () => {
    if (!card.current?.capture) return;
    setSharing(true);
    try {
      const uri = await card.current.capture();
      if (Platform.OS === 'web') { const link = document.createElement('a'); link.href = uri; link.download = `margin-${ranking.id}.png`; link.click(); return; }
      if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable on this device.');
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your ranking', UTI: 'public.png' });
      haptic.success();
    } catch (e) { setNotice(errorMessage(e)); }
    finally { setSharing(false); }
  };

  return <Screen left={close} title="Share"
    footer={<View style={{ gap: space.sm }}>
      <Button label={Platform.OS === 'web' ? 'Download image' : 'Share image'} icon={Platform.OS === 'web' ? 'download-outline' : 'share-outline'} loading={sharing} onPress={() => void shareImage()} />
      {!ranking.isSample && <Button label="Share link" icon="link" variant="secondary" onPress={() => Share.share({ message: `${ranking.title}\n${postLink(ranking.id)}` }).catch((e) => setNotice(errorMessage(e)))} />}
    </View>}>
    <Segmented value={template} onChange={setTemplate} style={{ marginTop: space.sm }} options={[{ value: 'night', label: 'Night' }, { value: 'paper', label: 'Paper' }, { value: 'red', label: 'Red' }]} />

    <View style={{ alignItems: 'center', marginTop: space.xl }}>
      <View style={[{ borderRadius: radius.lg, ...curve }, shadow(c, 3)]}>
        <ViewShot ref={card} options={{ format: 'png', quality: 1, result: Platform.OS === 'web' ? 'data-uri' : 'tmpfile' }} style={{ width, borderRadius: radius.lg, overflow: 'hidden' }}>
          <View collapsable={false} style={{ backgroundColor: t.bg, width, minHeight: width * 1.5, padding: 22, justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: font.heavy, fontSize: 17, letterSpacing: -0.8, color: t.fg }}>MARGIN<Text style={{ color: t.accent }}>.</Text></Text>
              <Text style={{ fontFamily: font.medium, fontSize: 10, color: t.muted }}>{ranking.handle}</Text>
            </View>
            <View style={{ marginTop: 28 }}>
              <Text style={{ fontFamily: font.semibold, fontSize: 10, letterSpacing: 1.2, color: t.accent }}>{ranking.kind === 'moodboard' ? 'MOOD BOARD' : `TOP ${Math.min(5, ranking.items.length)}`}</Text>
              <Text numberOfLines={3} style={{ fontFamily: font.bold, fontSize: 26, lineHeight: 30, letterSpacing: -0.9, color: t.fg, marginTop: 6 }}>{ranking.title}</Text>
            </View>
            {ranking.kind === 'moodboard' ? <MoodGrid post={ranking} compact /> : <View style={{ marginTop: 20 }}>
              {ranking.items.slice(0, 5).map((item, index) => <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderTopWidth: index ? 1 : 0, borderColor: t.rule }}>
                <Text style={{ fontFamily: font.bold, fontSize: 15, color: index === 0 ? t.accent : t.fg, width: 16, fontVariant: ['tabular-nums'] }}>{index + 1}</Text>
                <Artwork item={item} size={width * 0.13} rounded={6} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontFamily: font.semibold, fontSize: 13, color: t.fg, letterSpacing: -0.2 }}>{item.title}</Text>
                  <Text numberOfLines={1} style={{ fontFamily: font.regular, fontSize: 11, color: t.muted, marginTop: 1 }}>{item.artist}</Text>
                </View>
              </View>)}
            </View>}
            <Text style={{ fontFamily: font.medium, fontSize: 10, color: t.muted, marginTop: 20 }}>
              {ranking.items.length > 5 && ranking.kind !== 'moodboard' ? `+ ${ranking.items.length - 5} more · ` : ''}What’s your order?
            </Text>
          </View>
        </ViewShot>
      </View>
    </View>
    <T v="footnote" tone="secondary" center style={{ marginTop: space.xl, paddingHorizontal: space.lg }}>
      {ranking.visibility !== 'public' ? 'Anyone you send the image to can see it. The link still respects your visibility setting.' : 'Share the card anywhere, or send a link so friends can make their own version.'}
    </T>
  </Screen>;
}
