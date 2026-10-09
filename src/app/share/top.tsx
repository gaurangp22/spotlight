import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { allKinds, categories } from '../../lib/categories';
import { api, errorMessage } from '../../lib/api';
import { MusicKind, Profile, Rating } from '../../lib/types';
import { useApp } from '../../store/AppContext';
import { goBack, Loading, Screen, topFive } from '../../ui/components';
import { Button, Card, EmptyState, IconButton } from '../../ui/primitives';
import { ShareStudio, TopFiveBody } from '../../ui/ShareCards';

export default function ShareTopScreen() {
  const params = useLocalSearchParams<{ category?: string; handle?: string }>();
  const kind: MusicKind = allKinds.includes(params.category as MusicKind) ? params.category as MusicKind : 'song';
  const { user, ratings } = useApp();
  const handle = params.handle ? `@${params.handle.replace(/^@/, '')}` : user?.handle;
  const mine = !!user && handle === user.handle;
  const [other, setOther] = useState<{ user: Profile; ratings: Rating[] } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (mine || !handle) return;
    let active = true;
    api<{ user: Profile; ratings: Rating[] }>(`/people/${encodeURIComponent(handle.slice(1))}`)
      .then((data) => { if (active) setOther(data); })
      .catch((e) => { if (active) setError(errorMessage(e)); });
    return () => { active = false; };
  }, [handle, mine]);

  const close = <IconButton icon="close" label="Close" onPress={goBack} size={36} />;
  const category = categories[kind];
  if (!handle) return <Screen left={close} title="Share top 5">
    <Card><EmptyState icon="person-circle-outline" title="Sign in to share your top 5" text="Your top picks come from the things you rate." action={<Button label="Sign in" inline onPress={() => router.push('/auth')} />} /></Card>
  </Screen>;
  if (error) return <Screen left={close} title="Share top 5"><Card><EmptyState icon="alert-circle-outline" title="Couldn’t load this top 5" text={error} /></Card></Screen>;
  const person = mine ? user : other?.user;
  if (!person) return <Screen left={close} title="Share top 5"><Loading label="Preparing the card…" /></Screen>;

  const top = topFive(mine ? ratings : other?.ratings ?? [], kind);
  const title = `${mine ? 'My' : `${person.name}’s`} top 5 ${category.plural.toLowerCase()}`;
  if (!top.length) return <Screen left={close} title="Share top 5">
    <Card><EmptyState icon={category.icon} title={`No ${category.plural.toLowerCase()} rated yet`} text={mine ? `Rate a few ${category.plural.toLowerCase()} and your top 5 builds itself.` : `${person.name} hasn’t rated any ${category.plural.toLowerCase()} you can see.`}
      action={mine ? <Button label={`Rate ${category.plural.toLowerCase()}`} inline onPress={() => router.replace({ pathname: '/rate', params: { kind } })} /> : undefined} /></Card>
  </Screen>;

  return <Screen left={close} title="Share top 5">
    <ShareStudio handle={person.handle} filename={`margin-top5-${kind}-${person.handle.slice(1)}`}
      footer={top.length < 5 ? `${5 - top.length} more to go · What’s in yours?` : 'What’s in yours?'}
      note={mine ? 'Scores come from your ratings and update as you rate more.' : 'Only ratings you’re allowed to see are included.'}>
      {(t, width) => <TopFiveBody title={title} ratings={top} t={t} width={width} />}
    </ShareStudio>
  </Screen>;
}
