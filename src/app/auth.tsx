import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { api } from '../lib/api';
import { useApp } from '../store/AppContext';
import { Action, Eyebrow, Header, Page } from '../ui/components';
import { Field, F, useTask } from '../ui/forms';
import { C } from '../ui/theme';

export default function AuthScreen() {
  const { login, register } = useApp();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('register');
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [name, setName] = useState(''), [handle, setHandle] = useState('');
  const [message, setMessage] = useState('');
  const { run, busy } = useTask();
  async function submit() {
    if (mode === 'forgot') { const r = await api<{ message: string }>('/auth/forgot', { method: 'POST', body: { email } }); setMessage(r.message); return; }
    if (mode === 'register') await register({ email, password, name, handle }); else await login(email, password);
    router.replace('/(tabs)/profile');
  }
  return <Page><Header title="Your music, together" back /><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={{ paddingTop: 35 }}><Eyebrow>WELCOME TO MARGIN</Eyebrow><Text style={F.title}>{mode === 'register' ? 'Make yourself heard.' : mode === 'login' ? 'Back in rotation.' : 'Find your way back.'}</Text><Text style={[F.note, { marginBottom: 28 }]}>A place for your favourites, your friends, and your strongest music opinions.</Text>
    {mode === 'register' && <><Field label="Display name" value={name} onChangeText={setName} autoComplete="name" maxLength={50} /><Field label="Username" value={handle} onChangeText={setHandle} autoCapitalize="none" autoCorrect={false} placeholder="e.g. radioheadfan" maxLength={24} /></>}
    <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" />
    {mode !== 'forgot' && <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'register' ? 'new-password' : 'current-password'} placeholder={mode === 'register' ? 'At least 10 characters' : undefined} maxLength={128} />}
    {!!message && <Text style={[F.note, { paddingVertical: 12 }]}>{message}</Text>}
    <Action label={busy ? 'Working…' : mode === 'register' ? 'Create account' : mode === 'login' ? 'Sign in' : 'Send recovery email'} disabled={busy || !email.trim() || (mode !== 'forgot' && !password) || (mode === 'register' && (!name.trim() || !handle.trim()))} onPress={() => void run(submit)} />
    <Pressable accessibilityRole="button" style={{ padding: 20 }} onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setMessage(''); }}><Text style={{ color: C.accent, textAlign: 'center', fontWeight: '800' }}>{mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}</Text></Pressable>
    {mode === 'login' && <Pressable accessibilityRole="button" style={{ padding: 15 }} onPress={() => setMode('forgot')}><Text style={{ color: C.muted, textAlign: 'center' }}>Forgot your password?</Text></Pressable>}
    <Text style={F.note}>Public posts can be viewed by anyone. Keep personal information out of your username and public posts.</Text></View></KeyboardAvoidingView></Page>;
}
