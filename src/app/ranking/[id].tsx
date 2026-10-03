import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useApp } from '../../store/AppContext';
import { Action, Eyebrow, Header, MusicRow, Page } from '../../ui/components';
import { C } from '../../ui/theme';

export default function RankingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { allRankings, reactions, toggleReaction, startDraft, addComment, commentsFor } = useApp();
  const ranking = allRankings.find((entry) => entry.id === id);
  const [comment, setComment] = useState('');
  const [replyItem, setReplyItem] = useState<string | undefined>();
  if (!ranking) return <Page><Header title="Ranking" back /><Text style={styles.missing}>This ranking is unavailable on this device.</Text></Page>;
  const comments = commentsFor(ranking.id);
  const origin = allRankings.find((entry) => entry.id === ranking.originId);
  const replyTitle = ranking.items.find((item) => item.id === replyItem)?.title;
  const submitComment = () => {
    if (!comment.trim()) return;
    addComment(ranking.id, comment, replyItem);
    setComment(''); setReplyItem(undefined);
  };
  const makeMine = () => { startDraft(ranking); router.push('/builder'); };

  return <Page>
    <Header title="The ranking" back right={<Pressable accessibilityRole="button" onPress={() => router.push(`/share/${ranking.id}`)} style={styles.headerShare} accessibilityLabel="Share ranking"><MaterialCommunityIcons name="share-variant-outline" size={23} color={C.ink} /></Pressable>} />
    <View style={styles.hero}><Eyebrow>{ranking.isSample ? 'EXAMPLE RANKING' : ranking.visibility.toUpperCase()}</Eyebrow><Text style={styles.title}>{ranking.title}</Text>{ranking.subtitle && <Text style={styles.subtitle}>{ranking.subtitle}</Text>}
      <View style={styles.meta}><View style={styles.avatar}><Text style={styles.avatarText}>{ranking.author[0]}</Text></View><View><Text style={styles.author}>{ranking.author} <Text style={styles.handle}>{ranking.handle}</Text></Text><Text style={styles.date}>{ranking.createdAt} · {ranking.items.length} picks</Text></View></View>
    </View>
    {origin && <Pressable accessibilityRole="button" style={styles.origin} onPress={() => router.push(`/ranking/${origin.id}`)}><MaterialCommunityIcons name="source-branch" size={17} color={C.accent} /><Text style={styles.originText}>Remixed from {origin.author}’s ranking</Text><MaterialCommunityIcons name="arrow-right" size={19} color={C.accent} /></Pressable>}
    <View style={styles.listHeader}><Text style={styles.listLabel}>THE ORDER</Text><Text style={styles.listCount}>{String(ranking.items.length).padStart(2, '0')} TRACKS</Text></View>
    {ranking.items.map((item, index) => <MusicRow key={item.id} item={item} index={index} trailing={<Pressable accessibilityRole="button" accessibilityLabel={`Comment on ${item.title}`} onPress={() => setReplyItem(item.id)} style={styles.rowComment}><MaterialCommunityIcons name="comment-outline" size={19} color={replyItem === item.id ? C.accent : C.muted} /></Pressable>} />)}
    <View style={styles.actions}><Action label="Make mine" onPress={makeMine} icon="source-branch" /><Action label="Share card" onPress={() => router.push(`/share/${ranking.id}`)} secondary icon="share-variant-outline" /></View>
    {ranking.author === 'You' && ranking.originId && origin && <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/compare', params: { left: ranking.id, right: origin.id } })} style={styles.compare}><Text style={styles.compareText}>See where you disagree with {origin.author}</Text><MaterialCommunityIcons name="arrow-right" size={23} color={C.accent} /></Pressable>}
    <View style={styles.social}><Pressable accessibilityRole="button" onPress={() => toggleReaction(ranking.id)} style={[styles.reaction, reactions.includes(ranking.id) && styles.reacted]}><MaterialCommunityIcons name={reactions.includes(ranking.id) ? 'check' : 'thumb-up-outline'} color={reactions.includes(ranking.id) ? C.white : C.ink} size={19} /><Text style={[styles.reactionText, reactions.includes(ranking.id) && { color: C.white }]}>{reactions.includes(ranking.id) ? 'Agreed' : 'Agree'} · {ranking.reactionCount + (reactions.includes(ranking.id) ? 1 : 0)}</Text></Pressable><Text style={styles.commentCount}>{comments.length} comments</Text></View>
    <View style={styles.comments}><Text style={styles.commentsTitle}>The conversation</Text>{comments.map((entry) => <View key={entry.id} style={styles.comment}><Text style={styles.commentAuthor}>{entry.author}</Text>{entry.itemId && <Text style={styles.commentReference}>ON #{ranking.items.findIndex((item) => item.id === entry.itemId) + 1} · {ranking.items.find((item) => item.id === entry.itemId)?.title}</Text>}<Text style={styles.commentBody}>{entry.text}</Text></View>)}
      {replyTitle && <Pressable accessibilityRole="button" style={styles.replyTag} onPress={() => setReplyItem(undefined)}><Text style={styles.replyText}>Replying on “{replyTitle}”</Text><MaterialCommunityIcons name="close" size={15} color={C.accent} /></Pressable>}
      <View style={styles.commentInputRow}><TextInput style={styles.commentInput} value={comment} onChangeText={setComment} placeholder="Add to the conversation" placeholderTextColor={C.muted} multiline /><Pressable accessibilityRole="button" onPress={submitComment} disabled={!comment.trim()} style={styles.send}><MaterialCommunityIcons name="arrow-up" size={23} color={comment.trim() ? C.white : C.muted} /></Pressable></View>
      {ranking.isSample && <Text style={styles.exampleNote}>Example people and posts are for trying the prototype. Your comments stay on this device.</Text>}
    </View>
  </Page>;
}

const styles = StyleSheet.create({
  headerShare: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }, missing: { marginTop: 30, color: C.muted }, hero: { paddingTop: 30, paddingBottom: 27 }, title: { color: C.ink, fontSize: 38, lineHeight: 41, letterSpacing: -1.6, fontWeight: '900', marginTop: 11 }, subtitle: { color: C.muted, fontSize: 15, lineHeight: 20, marginTop: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24 }, avatar: { width: 39, height: 39, borderRadius: 20, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: C.white, fontWeight: '900', fontSize: 16 }, author: { color: C.ink, fontWeight: '900', fontSize: 13 }, handle: { color: C.muted, fontSize: 12, fontWeight: '400' }, date: { color: C.muted, fontSize: 11, marginTop: 3 },
  origin: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 15, borderTopWidth: 1, borderColor: C.line }, originText: { flex: 1, color: C.accent, fontSize: 12, fontWeight: '800' },
  listHeader: { borderTopWidth: 2, borderColor: C.ink, flexDirection: 'row', justifyContent: 'space-between', paddingTop: 15, paddingBottom: 11 }, listLabel: { color: C.ink, fontSize: 11, fontWeight: '900', letterSpacing: 1.4 }, listCount: { color: C.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 }, rowComment: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 23 }, compare: { minHeight: 57, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, borderTopWidth: 1, borderColor: C.accent }, compareText: { color: C.ink, fontSize: 14, fontWeight: '900', flex: 1, paddingRight: 12 },
  social: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 27, marginTop: 20, borderTopWidth: 1, borderColor: C.line }, reaction: { minHeight: 48, paddingHorizontal: 14, flexDirection: 'row', gap: 7, alignItems: 'center', borderWidth: 1, borderColor: C.ink }, reacted: { backgroundColor: C.accent, borderColor: C.accent }, reactionText: { color: C.ink, fontSize: 12, fontWeight: '900' }, commentCount: { color: C.muted, fontSize: 12 },
  comments: { borderTopWidth: 2, borderColor: C.ink, paddingTop: 15, marginBottom: 30 }, commentsTitle: { color: C.ink, fontWeight: '900', fontSize: 22, letterSpacing: -0.5, marginBottom: 18 }, comment: { borderTopWidth: 1, borderColor: C.line, paddingVertical: 14 }, commentAuthor: { color: C.ink, fontWeight: '900', fontSize: 12 }, commentReference: { color: C.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.5, marginTop: 6 }, commentBody: { color: C.ink, fontSize: 14, marginTop: 6, lineHeight: 20 },
  replyTag: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.soft, padding: 10, marginTop: 8 }, replyText: { color: C.accent, fontSize: 11, fontWeight: '800' }, commentInputRow: { flexDirection: 'row', marginTop: 8, minHeight: 50, borderWidth: 1, borderColor: C.line }, commentInput: { flex: 1, color: C.ink, paddingHorizontal: 13, paddingVertical: 10, fontSize: 13, maxHeight: 100 }, send: { width: 48, backgroundColor: C.ink, justifyContent: 'center', alignItems: 'center' }, exampleNote: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 12 },
});
