import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { api, errorMessage } from '../../lib/api';
import { activeKinds, categories } from '../../lib/categories';
import { displayDate } from '../../lib/dates';
import { postLink, shareLink } from '../../lib/links';
import { useApp } from '../../store/AppContext';
import { Loading, MusicRow, Screen, ScoreBadge, visibilityIcon, visibilityLabel } from '../../ui/components';
import { MusicPicker, useAvailableKinds } from '../../ui/MusicPicker';
import { MusicItem } from '../../lib/types';
import { useTask } from '../../ui/forms';
import { haptic } from '../../ui/haptics';
import { MoodGrid } from '../../ui/mood';
import { PollCard, TrackPill } from '../../ui/equals';
import { SavePostRow } from '../../ui/library';
import { Artwork, Avatar, Badge, BotBadge, Button, Card, Dialog, IconButton, Ionicons, ListGroup, ListRow, SectionHeader, T, Tap, TextField } from '../../ui/primitives';
import { curve, makeStyles, noOutline, radius, space, type, useTheme } from '../../ui/theme';

function CommentText({ text }: { text: string }) {
  const parts: ReactNode[] = []; let cursor = 0;
  for (const match of text.matchAll(/(?:^|[^a-zA-Z0-9_])@([a-z0-9_]{3,24})(?![a-z0-9_])/gi)) {
    const start = match.index! + match[0].indexOf('@'), end = start + match[1].length + 1;
    parts.push(text.slice(cursor, start));
    parts.push(<T key={start} tone="accent" accessibilityRole="link" onPress={() => router.push(`/person/${match[1].toLowerCase()}`)}>@{match[1]}</T>);
    cursor = end;
  }
  parts.push(text.slice(cursor));
  return <T v="body">{parts}</T>;
}

export default function RankingScreen() {
  const s = useStyles();
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { allRankings, reactions, toggleReaction, startDraft, startTake, addComment, commentsFor, user, loadPost, editRanking, startMood, deletePost, deleteComment, setNotice, rememberItem, contribute, removeFromPod, spotifyConnected } = useApp();
  const kinds = useAvailableKinds(activeKinds);
  const [adding, setAdding] = useState(false);
  const ranking = allRankings.find((entry) => entry.id === id);
  const [comment, setComment] = useState('');
  const [replyItem, setReplyItem] = useState<string | undefined>();
  const [replyComment, setReplyComment] = useState<string | undefined>();
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
  const isReview = ranking.kind === 'review';
  const isPod = ranking.kind === 'pod';
  const isTake = ranking.kind === 'take';
  const reviewed = isReview ? ranking.items[0] : undefined;
  const canContribute = isPod && !ranking.clubId && !ranking.isSample && (owned || !!ranking.open);
  const openItem = (item: MusicItem) => { rememberItem(item); router.push(`/item/${encodeURIComponent(item.id)}`); };
  const kindLabel = ranking.clubId ? 'Album club' : isTake ? ranking.poll ? 'Poll' : 'Hot take' : isMood ? 'Mood board' : isReview ? 'Review' : isPod ? 'Pod' : 'Ranking';
  const reacted = reactions.includes(ranking.id);
  const comments = commentsFor(ranking.id);
  const origin = allRankings.find((entry) => entry.id === ranking.originId);
  const replyTitle = ranking.items.find((item) => item.id === replyItem)?.title;
  const cover = ranking.items.find((item) => item.artwork)?.artwork;
  const submitComment = async () => {
    if (!comment.trim()) return;
    await addComment(ranking.id, comment.trim(), replyItem, replyComment);
    haptic.success(); setComment(''); setReplyItem(undefined); setReplyComment(undefined);
  };
  const makeMine = () => { startDraft(ranking); router.push('/builder'); };
  const replyTo = (itemId: string) => { setReplyItem(itemId); setReplyComment(undefined); if (user && !ranking.isSample) input.current?.focus(); };

  const composer = ranking.isSample ? <T v="footnote" tone="secondary" center>This is an example. Make your own version to start a real conversation.</T>
    : !user ? <Button label="Sign in to join the conversation" variant="secondary" onPress={() => router.push('/auth')} />
    : <View style={{ gap: space.sm }}>
      {replyComment && <Button label={`Cancel reply to ${comments.find((entry) => entry.id === replyComment)?.author || 'comment'}`} variant="plain" size="sm" onPress={() => { setReplyComment(undefined); setReplyItem(undefined); }} />}
      {replyTitle && <Pressable accessibilityRole="button" accessibilityLabel="Stop replying to this pick" onPress={() => setReplyItem(undefined)} style={s.replyTag}>
        <Ionicons name="return-down-forward" size={14} color={c.accent} /><T v="caption" tone="accent" weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>On “{replyTitle}”</T><Ionicons name="close" size={14} color={c.accent} />
      </Pressable>}
      <View style={s.composer}>
        <TextInput ref={input} accessibilityLabel="Add a comment" style={[type.body, s.composerInput, { color: c.text }, noOutline]} value={comment} onChangeText={setComment}
          placeholder={replyTitle ? 'Say something about this pick' : 'Add to the conversation'} placeholderTextColor={c.secondary} selectionColor={c.accent} maxLength={1000} multiline maxFontSizeMultiplier={1.4}
          // Browsers default a textarea to two rows; start at one and let it grow.
          numberOfLines={Platform.OS === 'web' ? 1 : undefined} />
        <Tap onPress={() => void run(submitComment)} disabled={!comment.trim() || busy} feedback={false} scaleTo={0.88} accessibilityLabel="Send comment" style={[s.send, { backgroundColor: comment.trim() ? c.accentFill : c.fillStrong }]}>
          <Ionicons name="arrow-up" size={19} color={comment.trim() ? c.onAccent : c.tertiary} />
        </Tap>
      </View>
    </View>;

  return <Screen back title={kindLabel} footer={composer}
    right={<IconButton icon="share-outline" label="Share" onPress={() => router.push(`/share/${ranking.id}`)} size={38} />}>
    <View style={s.hero}>
      {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={Platform.OS === 'android' ? 25 : 40} transition={200} />
        : <View style={[StyleSheet.absoluteFill, { backgroundColor: ranking.items[0]?.color ?? '#15131C' }]} />}
      <LinearGradient colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.82)']} style={StyleSheet.absoluteFill} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {ranking.isSample ? <Badge label="Example" tone="inverse" /> : <Badge label={visibilityLabel[ranking.visibility]} icon={visibilityIcon[ranking.visibility]} tone="inverse" />}
        {!!origin && <Badge label="Remix" icon="git-branch-outline" tone="inverse" />}
      </View>
      {reviewed ? <Pressable accessibilityRole="button" accessibilityLabel={`Open ${reviewed.title}`} onPress={() => openItem(reviewed)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.xl }}>
        <View>
          <Artwork item={reviewed} size={112} rounded={radius.md} />
          {ranking.score !== undefined && <View style={{ position: 'absolute', right: -10, bottom: -10 }}><ScoreBadge score={ranking.score} size={52} ring /></View>}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <T v="title2" style={{ color: '#FFFFFF' }} numberOfLines={3}>{reviewed.title}</T>
          <T v="subhead" style={{ color: '#FFFFFFCC' }} numberOfLines={1}>{reviewed.artist}</T>
          <T v="caption" style={{ color: '#FFFFFF99' }}>{categories[reviewed.kind].label}</T>
        </View>
      </Pressable> : <T v="title1" style={{ color: '#FFFFFF', marginTop: space.xl }}>{ranking.title}</T>}
      {!!ranking.subtitle && <T v={isReview ? 'title3' : 'body'} style={{ color: isReview ? '#FFFFFF' : '#FFFFFFCC', marginTop: isReview ? space.lg : space.sm }}>{isReview ? `“${ranking.subtitle}”` : ranking.subtitle}</T>}
      {isPod && ranking.open && <View style={{ marginTop: space.md }}><Badge label="Open — anyone can add" icon="people" tone="inverse" /></View>}
      <Pressable accessibilityRole="button" accessibilityLabel={`View ${ranking.author}’s profile`} disabled={ranking.isSample} onPress={() => router.push(`/person/${ranking.handle.slice(1)}`)} style={s.author}>
        <Avatar name={ranking.author} seed={ranking.handle} uri={ranking.avatar} size={34} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}><T v="callout" weight="semibold" style={{ color: '#FFFFFF' }}>{ranking.author}</T>{ranking.authorBot && <BotBadge />}</View>
          <T v="caption" style={{ color: '#FFFFFFB3' }}>{displayDate(ranking.updatedAt || ranking.createdAt)} · {isTake ? kindLabel : isMood ? 'Mood board' : isReview ? 'Review' : isPod ? `${ranking.items.length} items` : `${ranking.items.length} picks`}</T>
        </View>
      </Pressable>
    </View>

    <View style={s.actions}>
      <Tap onPress={() => user ? void run(() => toggleReaction(ranking.id)) : router.push('/auth')} disabled={busy || ranking.isSample} feedback="press" accessibilityLabel={reacted ? `Remove your agree. ${ranking.reactionCount} agrees` : `Agree. ${ranking.reactionCount} agrees`} accessibilityState={{ selected: reacted }} style={[s.action, reacted && { backgroundColor: c.accentSoft }]}>
        <Ionicons name={reacted ? 'heart' : 'heart-outline'} size={20} color={reacted ? c.heart : c.text} /><T v="footnote" weight="semibold" tone={reacted ? 'accent' : 'primary'} tabular>{ranking.reactionCount}</T>
      </Tap>
      <Tap onPress={() => user && !ranking.isSample ? input.current?.focus() : undefined} accessibilityLabel={`${comments.length} comments`} style={s.action}>
        <Ionicons name="chatbubble-outline" size={19} color={c.text} /><T v="footnote" weight="semibold" tabular>{comments.length}</T>
      </Tap>
      {!isMood && !isReview && !isPod && !isTake && <Button label="Make mine" icon="git-branch-outline" size="md" style={{ flex: 1.6 }} onPress={makeMine} />}
      {reviewed && <Button label={owned ? 'Video review' : 'Rate it too'} icon={owned ? 'videocam' : 'star'} size="md" style={{ flex: 1.6 }}
        onPress={() => { rememberItem(reviewed); router.push(owned ? { pathname: '/video', params: { itemId: reviewed.id } } : { pathname: '/rate', params: { itemId: reviewed.id } }); }} />}
      {canContribute && <Button label="Add to pod" icon="add" size="md" style={{ flex: 1.6 }} onPress={() => user ? setAdding(true) : router.push('/auth')} />}
    </View>

    {origin && <ListGroup style={{ marginTop: space.lg }}>
      <ListRow icon="git-branch-outline" iconColor="#007AFF" title={`Remixed from ${origin.author}`} subtitle={origin.title} onPress={() => router.push(`/ranking/${origin.id}`)} />
      {owned && <ListRow icon="analytics-outline" title={`Compare with ${origin.author}`} subtitle="See where your orders agree and split" onPress={() => router.push({ pathname: '/compare', params: { left: ranking.id, right: origin.id } })} />}
    </ListGroup>}

    {isMood && <MoodGrid post={ranking} />}
    {isTake && (ranking.poll ? <PollCard ranking={ranking} /> : ranking.items[0] ? <TrackPill item={ranking.items[0]} /> : null)}
    {!isReview && !isTake && ranking.items.length > 0 && <>
      <SectionHeader title={isMood ? 'Soundtrack' : isPod ? 'In this pod' : 'The order'} detail={`${ranking.items.length} ${isPod ? 'items' : 'picks'}`} />
      <Card padded={false} style={{ paddingLeft: space.md, paddingRight: space.xs }}>
        {ranking.items.map((item, index) => {
          const removable = isPod && !ranking.clubId && !ranking.isSample && (owned || (!!user && item.addedBy === user.handle));
          return <View key={item.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: index < ranking.items.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: c.hairline }}>
              <View style={{ flex: 1, minWidth: 0 }}><MusicRow item={item} index={isMood || isPod ? undefined : index} separator={false} onPress={ranking.isSample ? undefined : () => openItem(item)} /></View>
              <View style={{ flexDirection: 'row' }}>
                {removable && <IconButton icon="remove-circle-outline" label={`Remove ${item.title}`} filled={false} size={44} tone="tertiary" onPress={() => void run(() => removeFromPod(ranking.id, item.id))} />}
                <IconButton icon={replyItem === item.id ? 'chatbubble' : 'chatbubble-outline'} label={`Comment on ${item.title}`} filled={false} size={44} tone={replyItem === item.id ? 'accent' : 'tertiary'} onPress={() => replyTo(item.id)} />
              </View>
            </View>
            {item.addedBy && <T v="caption" tone="secondary" style={{ marginLeft: 60, marginTop: -10, marginBottom: 8 }}>Added by {item.addedBy}</T>}
          </View>;
        })}
      </Card>
      {isPod && !ranking.items.length && <Card><T v="subhead" tone="secondary">Nothing here yet.</T></Card>}
    </>}

    <SectionHeader title="Conversation" detail={comments.length ? `${comments.length}` : undefined} />
    {comments.length ? <Card padded={false}>
      {comments.map((entry, i) => {
        const position = entry.itemId ? ranking.items.findIndex((item) => item.id === entry.itemId) : -1;
        return <View key={entry.id} style={[s.comment, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }]}>
          <Avatar name={entry.author} uri={entry.avatar} seed={entry.handle} size={32} />
          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
              <T v="subhead" weight="semibold">{entry.author}</T>{entry.bot && <BotBadge />}
              {entry.createdAt && <T v="caption" tone="tertiary">{displayDate(entry.createdAt)}</T>}
            </View>
            {position >= 0 && <T v="caption" tone="accent" weight="semibold" numberOfLines={1}>On #{position + 1} · {ranking.items[position].title}</T>}
            {entry.parentId && <T v="caption" tone="secondary">Replying to {comments.find((parent) => parent.id === entry.parentId)?.author || 'an unavailable comment'}</T>}
            <CommentText text={entry.text} />
            {user && !ranking.isSample && <Button label={`Reply to ${entry.author}`} variant="plain" size="sm" inline disabled={busy} onPress={() => { setReplyComment(entry.id); setReplyItem(entry.itemId); input.current?.focus(); }} />}
            {(owned || entry.userId === user?.id) && !ranking.isSample && <Pressable accessibilityRole="button" disabled={busy} hitSlop={8} onPress={() => void run(() => deleteComment(entry.id))} style={{ alignSelf: 'flex-start', marginTop: 4 }}>
              <T v="caption" tone="secondary">Remove</T>
            </Pressable>}
          </View>
        </View>;
      })}
    </Card> : <Card><T v="subhead" tone="secondary">{isTake ? 'No comments yet. What’s your take?' : 'No comments yet. Disagree with the order? Say so — or tap the bubble beside any pick.'}</T></Card>}

    <ListGroup>
      {user && !ranking.isSample && <SavePostRow id={ranking.id} />}
      {user && !ranking.isSample && <ListRow icon="paper-plane" iconColor="#007AFF" title="Send to a conversation" onPress={() => router.push({ pathname: '/messages', params: { postId: ranking.id } })} />}
      {ranking.sourceUrl && <ListRow icon="link-outline" title="Open original playlist" onPress={() => void Linking.openURL(ranking.sourceUrl!)} />}
      {ranking.clubId && <ListRow icon="disc-outline" title="Go to listening club" onPress={() => router.push(`/clubs/${ranking.clubId}`)} />}
      {!ranking.isSample && <ListRow icon="link-outline" iconColor="#8E8E93" title="Share link" onPress={() => void shareLink(ranking.title, postLink(ranking.id)).then((r) => { if (r === 'copied') setNotice('Link copied.'); }).catch((e) => setNotice(errorMessage(e)))} />}
      <ListRow icon="image-outline" iconColor="#AF52DE" title="Share as image" onPress={() => router.push(`/share/${ranking.id}`)} />
      {owned && !ranking.clubId && <ListRow icon="pencil" iconColor="#007AFF" title={isTake ? 'Edit post' : isMood ? 'Edit mood board' : isReview ? 'Rate again' : isPod ? 'Edit pod' : 'Edit ranking'} onPress={() => {
        if (isTake) { startTake(ranking); router.push('/take'); }
        else if (isMood) { startMood(ranking); router.push('/moodboard'); }
        else if (reviewed) { rememberItem(reviewed); router.push({ pathname: '/rate', params: { itemId: reviewed.id } }); }
        else if (isPod) router.push({ pathname: '/pod', params: { editId: ranking.id } });
        else { editRanking(ranking); router.push('/builder'); }
      }} />}
      {reviewed?.externalUrl && <ListRow icon="open-outline" iconColor="#1DB954" title="Open externally" subtitle={reviewed.externalUrl.replace(/^https:\/\/(www\.)?/, '').split('/')[0]} onPress={() => void run(() => Linking.openURL(reviewed.externalUrl!))} />}
      {owned && <ListRow title="Delete post" destructive chevron={false} onPress={() => setDeleting(true)} />}
      {!owned && !ranking.isSample && user && <ListRow title="Report post" destructive chevron={false} onPress={() => setReporting(true)} />}
    </ListGroup>

    <MusicPicker visible={adding} onClose={() => setAdding(false)} kinds={kinds} title={`Add to ${ranking.title}`} spotifyConnected={spotifyConnected}
      onPick={(item) => void run(async () => { await contribute(ranking.id, item); setAdding(false); haptic.success(); setNotice(`Added ${item.title}.`); })} />
    <Dialog visible={deleting} title="Delete this post?" description={isReview ? 'This removes your review and your rating for this item, along with its comments and reactions.' : 'This permanently removes the post, its comments, and reactions for everyone.'} confirmLabel="Delete" destructive busy={busy}
      onCancel={() => setDeleting(false)} onConfirm={() => void run(async () => { await deletePost(ranking.id); setDeleting(false); router.replace('/(tabs)/profile'); })} />
    <Dialog visible={reporting} title="Report this post" description="Tell us what’s wrong. Reports are private and reviewed by the Riffs team." confirmLabel="Send report" busy={busy}
      onCancel={() => setReporting(false)} onConfirm={() => void run(async () => { await api(`/posts/${ranking.id}/report`, { method: 'POST', body: { reason } }); setReporting(false); setReason(''); setNotice('Thanks. Your report was sent.'); })}>
      <TextField label="Reason" value={reason} onChangeText={setReason} maxLength={500} multiline placeholder="Spam, harassment, something else…" />
    </Dialog>
  </Screen>;
}

const useStyles = makeStyles((c) => ({
  hero: { borderRadius: radius.xl, overflow: 'hidden', padding: space.xl, paddingTop: space.xl, marginTop: space.xs, backgroundColor: '#15131C', ...curve },
  author: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: space.xl },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  action: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.fill, borderRadius: radius.sm + 2, ...curve },
  comment: { flexDirection: 'row', gap: space.md, padding: space.lg },
  replyTag: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: c.accentSoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, maxWidth: '100%' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: c.fill, borderRadius: 22, paddingLeft: space.lg, paddingRight: 5, paddingVertical: 5, minHeight: 44, ...curve },
  composerInput: { flex: 1, maxHeight: 120, paddingVertical: 6, marginRight: space.sm },
  send: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
}));
