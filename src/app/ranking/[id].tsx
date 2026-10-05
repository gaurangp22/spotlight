import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, Share, StyleSheet, TextInput, View } from 'react-native';
import { api, errorMessage } from '../../lib/api';
import { displayDate } from '../../lib/dates';
import { postLink } from '../../lib/links';
import { useApp } from '../../store/AppContext';
import { Loading, MusicRow, Screen, visibilityIcon, visibilityLabel } from '../../ui/components';
import { useTask } from '../../ui/forms';
import { haptic } from '../../ui/haptics';
import { MoodGrid } from '../../ui/mood';
import { Avatar, Badge, Button, Card, Dialog, IconButton, Ionicons, ListGroup, ListRow, SectionHeader, T, Tap, TextField } from '../../ui/primitives';
import { curve, makeStyles, noOutline, radius, space, type, useTheme } from '../../ui/theme';

export default function RankingScreen() {
  const s = useStyles();
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { allRankings, reactions, toggleReaction, startDraft, addComment, commentsFor, user, loadPost, editRanking, startMood, deletePost, deleteComment, setNotice } = useApp();
  const ranking = allRankings.find((entry) => entry.id === id);
  const [comment, setComment] = useState('');
  const [replyItem, setReplyItem] = useState<string | undefined>();
  const [loadError, setLoadError] = useState('');
  const [deleting, setDeleting] = useState(false), [reporting, setReporting] = useState(false), [reason, setReason] = useState('');
  const input = useRef<TextInput>(null);
  const { busy, run } = useTask();
  useEffect(() => { let active = true; loadPost(id).then(() => { if (active) setLoadError(''); }).catch((e) => { if (active) setLoadError(errorMessage(e)); }); return () => { active = false; }; }, [id, loadPost]);

  if (!ranking) return <Screen back title="Post">{loadError
    ? <Card style={{ marginTop: space.xl, gap: space.md }}><T v="headline">This post isn’t available</T><T v="subhead" tone="secondary">{loadError}</T><Button label="Try again" variant="secondary" onPress={() => void run(() => loadPost(id))} /></Card>
    : <Loading label="Loading post…" />}</Screen>;

  const owned = !!user && ranking.userId === user.id;
  const isMood = ranking.kind === 'moodboard';
  const reacted = reactions.includes(ranking.id);
  const comments = commentsFor(ranking.id);
  const origin = allRankings.find((entry) => entry.id === ranking.originId);
  const replyTitle = ranking.items.find((item) => item.id === replyItem)?.title;
  const cover = ranking.items.find((item) => item.artwork)?.artwork;
  const submitComment = async () => {
    if (!comment.trim()) return;
    await addComment(ranking.id, comment.trim(), replyItem);
    haptic.success(); setComment(''); setReplyItem(undefined);
  };
  const makeMine = () => { startDraft(ranking); router.push('/builder'); };
  const replyTo = (itemId: string) => { setReplyItem(itemId); if (user && !ranking.isSample) input.current?.focus(); };

  const composer = ranking.isSample ? <T v="footnote" tone="secondary" center>This is an example. Make your own version to start a real conversation.</T>
    : !user ? <Button label="Sign in to join the conversation" variant="secondary" onPress={() => router.push('/auth')} />
    : <View style={{ gap: space.sm }}>
      {replyTitle && <Pressable accessibilityRole="button" accessibilityLabel="Stop replying to this pick" onPress={() => setReplyItem(undefined)} style={s.replyTag}>
        <Ionicons name="return-down-forward" size={14} color={c.accent} /><T v="caption" tone="accent" weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>On “{replyTitle}”</T><Ionicons name="close" size={14} color={c.accent} />
      </Pressable>}
      <View style={s.composer}>
        <TextInput ref={input} accessibilityLabel="Add a comment" style={[type.body, s.composerInput, { color: c.text }, noOutline]} value={comment} onChangeText={setComment}
          placeholder={replyTitle ? 'Say something about this pick' : 'Add to the conversation'} placeholderTextColor={c.tertiary} selectionColor={c.accent} maxLength={1000} multiline maxFontSizeMultiplier={1.4}
          // Browsers default a textarea to two rows; start at one and let it grow.
          numberOfLines={Platform.OS === 'web' ? 1 : undefined} />
        <Tap onPress={() => void run(submitComment)} disabled={!comment.trim() || busy} feedback={false} scaleTo={0.88} accessibilityLabel="Send comment" style={[s.send, { backgroundColor: comment.trim() ? c.accentFill : c.fillStrong }]}>
          <Ionicons name="arrow-up" size={19} color={comment.trim() ? c.onAccent : c.tertiary} />
        </Tap>
      </View>
    </View>;

  return <Screen back title={isMood ? 'Mood board' : 'Ranking'} footer={composer}
    right={<IconButton icon="share-outline" label="Share" onPress={() => router.push(`/share/${ranking.id}`)} size={38} />}>
    <View style={s.hero}>
      {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={Platform.OS === 'android' ? 25 : 40} transition={200} />
        : <View style={[StyleSheet.absoluteFill, { backgroundColor: ranking.items[0]?.color ?? '#2A2826' }]} />}
      <LinearGradient colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.82)']} style={StyleSheet.absoluteFill} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {ranking.isSample ? <Badge label="Example" tone="inverse" /> : <Badge label={visibilityLabel[ranking.visibility]} icon={visibilityIcon[ranking.visibility]} tone="inverse" />}
        {!!origin && <Badge label="Remix" icon="git-branch-outline" tone="inverse" />}
      </View>
      <T v="title1" style={{ color: '#FFFFFF', marginTop: space.xl }}>{ranking.title}</T>
      {!!ranking.subtitle && <T v="body" style={{ color: '#FFFFFFCC', marginTop: space.sm }}>{ranking.subtitle}</T>}
      <Pressable accessibilityRole="button" accessibilityLabel={`View ${ranking.author}’s profile`} disabled={ranking.isSample} onPress={() => router.push(`/person/${ranking.handle.slice(1)}`)} style={s.author}>
        <Avatar name={ranking.author} seed={ranking.handle} size={34} />
        <View style={{ flex: 1 }}>
          <T v="callout" weight="semibold" style={{ color: '#FFFFFF' }}>{ranking.author}</T>
          <T v="caption" style={{ color: '#FFFFFFB3' }}>{displayDate(ranking.createdAt)} · {isMood ? 'Mood board' : `${ranking.items.length} picks`}</T>
        </View>
      </Pressable>
    </View>

    <View style={s.actions}>
      <Tap onPress={() => user ? void run(() => toggleReaction(ranking.id)) : router.push('/auth')} disabled={busy || ranking.isSample} feedback="press" accessibilityLabel={reacted ? `Remove your agree. ${ranking.reactionCount} agrees` : `Agree. ${ranking.reactionCount} agrees`} accessibilityState={{ selected: reacted }} style={[s.action, reacted && { backgroundColor: c.accentSoft }]}>
        <Ionicons name={reacted ? 'heart' : 'heart-outline'} size={20} color={reacted ? c.accent : c.text} /><T v="footnote" weight="semibold" tone={reacted ? 'accent' : 'primary'} tabular>{ranking.reactionCount}</T>
      </Tap>
      <Tap onPress={() => user && !ranking.isSample ? input.current?.focus() : undefined} accessibilityLabel={`${comments.length} comments`} style={s.action}>
        <Ionicons name="chatbubble-outline" size={19} color={c.text} /><T v="footnote" weight="semibold" tabular>{comments.length}</T>
      </Tap>
      {!isMood && <Button label="Make mine" icon="git-branch-outline" size="md" style={{ flex: 1.6 }} onPress={makeMine} />}
    </View>

    {origin && <ListGroup style={{ marginTop: space.lg }}>
      <ListRow icon="git-branch-outline" iconColor="#2F5F7A" title={`Remixed from ${origin.author}`} subtitle={origin.title} onPress={() => router.push(`/ranking/${origin.id}`)} />
      {owned && <ListRow icon="analytics-outline" title={`Compare with ${origin.author}`} subtitle="See where your orders agree and split" onPress={() => router.push({ pathname: '/compare', params: { left: ranking.id, right: origin.id } })} />}
    </ListGroup>}

    {isMood && <MoodGrid post={ranking} />}
    {ranking.items.length > 0 && <>
      <SectionHeader title={isMood ? 'Soundtrack' : 'The order'} detail={`${ranking.items.length} picks`} />
      <Card padded={false} style={{ paddingLeft: space.md, paddingRight: space.xs }}>
        {ranking.items.map((item, index) => <MusicRow key={item.id} item={item} index={isMood ? undefined : index} separator={index < ranking.items.length - 1}
          trailing={<View style={{ flexDirection: 'row' }}>
            {item.externalUrl && <IconButton icon="open-outline" label={`Open ${item.title} in Spotify`} filled={false} size={36} tone="secondary" onPress={() => void run(() => Linking.openURL(item.externalUrl!))} />}
            <IconButton icon={replyItem === item.id ? 'chatbubble' : 'chatbubble-outline'} label={`Comment on ${item.title}`} filled={false} size={36} tone={replyItem === item.id ? 'accent' : 'tertiary'} onPress={() => replyTo(item.id)} />
          </View>} />)}
      </Card>
    </>}

    <SectionHeader title="Conversation" detail={comments.length ? `${comments.length}` : undefined} />
    {comments.length ? <Card padded={false}>
      {comments.map((entry, i) => {
        const position = entry.itemId ? ranking.items.findIndex((item) => item.id === entry.itemId) : -1;
        return <View key={entry.id} style={[s.comment, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }]}>
          <Avatar name={entry.author} size={32} />
          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
              <T v="subhead" weight="semibold">{entry.author}</T>
              {entry.createdAt && <T v="caption" tone="tertiary">{displayDate(entry.createdAt)}</T>}
            </View>
            {position >= 0 && <T v="caption" tone="accent" weight="semibold" numberOfLines={1}>On #{position + 1} · {ranking.items[position].title}</T>}
            <T v="body">{entry.text}</T>
            {(owned || entry.userId === user?.id) && !ranking.isSample && <Pressable accessibilityRole="button" disabled={busy} hitSlop={8} onPress={() => void run(() => deleteComment(entry.id))} style={{ alignSelf: 'flex-start', marginTop: 4 }}>
              <T v="caption" tone="secondary">Remove</T>
            </Pressable>}
          </View>
        </View>;
      })}
    </Card> : <Card><T v="subhead" tone="secondary">No comments yet. Disagree with the order? Say so — or tap the bubble beside any pick.</T></Card>}

    <ListGroup>
      {!ranking.isSample && <ListRow icon="link-outline" iconColor="#6B6862" title="Share link" onPress={() => void Share.share({ message: `${ranking.title}\n${postLink(ranking.id)}` }).catch((e) => setNotice(errorMessage(e)))} />}
      <ListRow icon="image-outline" iconColor="#4E3A78" title="Share as image" onPress={() => router.push(`/share/${ranking.id}`)} />
      {owned && <ListRow icon="pencil" iconColor="#2F5F7A" title={isMood ? 'Edit mood board' : 'Edit ranking'} onPress={() => { if (isMood) { startMood(ranking); router.push('/moodboard'); } else { editRanking(ranking); router.push('/builder'); } }} />}
      {owned && <ListRow title="Delete post" destructive chevron={false} onPress={() => setDeleting(true)} />}
      {!owned && !ranking.isSample && user && <ListRow title="Report post" destructive chevron={false} onPress={() => setReporting(true)} />}
    </ListGroup>

    <Dialog visible={deleting} title="Delete this post?" description="This permanently removes the post, its comments, and reactions for everyone." confirmLabel="Delete" destructive busy={busy}
      onCancel={() => setDeleting(false)} onConfirm={() => void run(async () => { await deletePost(ranking.id); setDeleting(false); router.replace('/(tabs)/profile'); })} />
    <Dialog visible={reporting} title="Report this post" description="Tell us what’s wrong. Reports are private and reviewed by the MARGIN team." confirmLabel="Send report" busy={busy}
      onCancel={() => setReporting(false)} onConfirm={() => void run(async () => { await api(`/posts/${ranking.id}/report`, { method: 'POST', body: { reason } }); setReporting(false); setReason(''); setNotice('Thanks. Your report was sent.'); })}>
      <TextField label="Reason" value={reason} onChangeText={setReason} maxLength={500} multiline placeholder="Spam, harassment, something else…" />
    </Dialog>
  </Screen>;
}

const useStyles = makeStyles((c) => ({
  hero: { borderRadius: radius.xl, overflow: 'hidden', padding: space.xl, paddingTop: space.xl, marginTop: space.xs, backgroundColor: '#1E1D1B', ...curve },
  author: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: space.xl },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  action: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.fill, borderRadius: radius.sm + 2, ...curve },
  comment: { flexDirection: 'row', gap: space.md, padding: space.lg },
  replyTag: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: c.accentSoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, maxWidth: '100%' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: c.fill, borderRadius: 22, paddingLeft: space.lg, paddingRight: 5, paddingVertical: 5, minHeight: 44, ...curve },
  composerInput: { flex: 1, maxHeight: 120, paddingVertical: 6, marginRight: space.sm },
  send: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
}));
