import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { errorMessage } from '../../lib/api';
import { postLink } from '../../lib/links';
import { useApp } from '../../store/AppContext';
import { goBack, Loading, Screen } from '../../ui/components';
import { Button, Card, IconButton, T } from '../../ui/primitives';
import { space } from '../../ui/theme';
import { PostCardBody, postFooter, ShareStudio } from '../../ui/ShareCards';

const titles = { ranking: 'Share ranking', moodboard: 'Share mood board', review: 'Share review', pod: 'Share pod', take: 'Share take' };

export default function ShareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { allRankings, loadPost, setNotice } = useApp();
  const post = allRankings.find((entry) => entry.id === id);
  const [failure, setFailure] = useState<{ id: string; message: string } | null>(null);
  const [attempt, retry] = useState(0);
  useEffect(() => { let active = true; loadPost(id).then(() => { if (active) setFailure(null); }).catch((e) => { if (active) { const message = errorMessage(e); setFailure({ id, message }); setNotice(message); } }); return () => { active = false; }; }, [id, loadPost, setNotice, attempt]);
  const close = <IconButton icon="close" label="Close" onPress={goBack} size={36} />;
  if (!post) return <Screen left={close} title="Share">{failure?.id === id ? <Card style={{ gap: space.md, marginTop: space.lg }}><T v="headline">This post isn’t available</T><T v="subhead" tone="secondary">{failure.message}</T><Button label="Try again" variant="secondary" onPress={() => { setFailure(null); retry((v) => v + 1); }} /></Card> : <Loading label="Preparing your card…" />}</Screen>;

  return <Screen left={close} title={titles[post.kind ?? 'ranking']}>
    <ShareStudio handle={post.handle} filename={`margin-${post.id}`} footer={(format) => postFooter(post, format)}
      link={post.isSample ? undefined : { message: post.title, url: postLink(post.id) }}
      note={post.visibility !== 'public' ? 'Anyone you send the image to can see it. The link still respects your visibility setting.'
        : post.kind === 'pod' && post.open ? 'Share the card, or send the link so friends can add their picks.' : 'Share the card anywhere, or send a link so friends can weigh in.'}>
      {(t, width, format) => <PostCardBody post={post} t={t} width={width} format={format} />}
    </ShareStudio>
  </Screen>;
}
