import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../lib/api';
import { useApp } from '../store/AppContext';
import { goBack, Screen } from '../ui/components';
import { useTask } from '../ui/forms';
import { haptic } from '../ui/haptics';
import { RiffsWordmark } from '../ui/brand';
import { Button, IconButton, Segmented, T, TextField } from '../ui/primitives';
import { font, space, type, useTheme } from '../ui/theme';

type Mode = 'login' | 'register' | 'forgot';
const copy: Record<Mode, { title: string; text: string; cta: string }> = {
  register: { title: 'Make yourself heard.', text: 'Rank what you love, remix your friends, and find out where you really disagree.', cta: 'Create account' },
  login: { title: 'Back in rotation.', text: 'Sign in to pick up your rankings and conversations.', cta: 'Sign in' },
  forgot: { title: 'Find your way back.', text: 'Enter your account email and we’ll send you a link to choose a new password.', cta: 'Send reset link' },
};

export default function AuthScreen() {
  const { c } = useTheme();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { login, loginOtp, register, config } = useApp();
  const [mode, setMode] = useState<Mode>(params.mode === 'login' ? 'login' : 'register');
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [name, setName] = useState(''), [handle, setHandle] = useState('');
  const [message, setMessage] = useState('');
  const [touched, setTouched] = useState(false);
  const { run, busy } = useTask();
  const [method, setMethod] = useState<'password' | 'otp'>('password');
  const [challenge, setChallenge] = useState(''), [code, setCode] = useState('');
  const [resendAt, setResendAt] = useState(0), [seconds, setSeconds] = useState(0);
  const otp = mode === 'login' && method === 'otp';
  const codeFlow = otp || (mode === 'register' && !!config?.signupVerification);
  useEffect(() => {
    const tick = () => setSeconds(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    tick();
    if (!resendAt) return;
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [resendAt]);
  const resetCode = () => { setChallenge(''); setCode(''); setMessage(''); };

  const cleanHandle = handle.trim().toLowerCase().replace(/^@/, '');
  const errors = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? '' : 'Enter a valid email address.',
    handle: /^[a-z0-9_]{3,24}$/.test(cleanHandle) ? '' : '3–24 letters, numbers, or underscores.',
    name: name.trim() ? '' : 'Add the name people will see.',
    password: mode === 'register' ? (password.length >= 10 ? '' : 'At least 10 characters.') : (password ? '' : 'Enter your password.'),
    code: /^\d{6}$/.test(code) ? '' : 'Enter the six digits from your email.',
  };
  const invalid = !!errors.email || (mode !== 'forgot' && !otp && !!errors.password) || (codeFlow && !!challenge && !!errors.code) || (mode === 'register' && (!!errors.handle || !!errors.name));
  const show = (key: keyof typeof errors) => touched ? errors[key] : '';

  async function sendCode() {
    setTouched(true);
    if (errors.email) { haptic.warn(); return; }
    const r = await api<{ challenge: string; resendAfter: number; message: string }>(mode === 'register' ? '/auth/signup/request' : '/auth/otp/request', { method: 'POST', body: { email: email.trim() } });
    setChallenge(r.challenge); setCode(''); setTouched(false); setMessage(r.message); setResendAt(Date.now() + r.resendAfter * 1000);
  }

  async function submit() {
    setTouched(true);
    if (invalid) { haptic.warn(); return; }
    if (mode === 'forgot') { const r = await api<{ message: string }>('/auth/forgot', { method: 'POST', body: { email: email.trim() } }); setMessage(r.message); return; }
    if (codeFlow && !challenge) { await sendCode(); return; }
    if (mode === 'register') await register({ email: email.trim(), password, name: name.trim(), handle: cleanHandle, ...(codeFlow ? { challenge, code } : {}) });
    else if (otp) await loginOtp(challenge, code);
    else await login(email.trim(), password);
    haptic.success();
    if (mode === 'register') { router.replace('/onboarding'); return; }
    if (router.canGoBack()) router.back(); else router.replace('/(tabs)/profile');
  }
  const switchMode = (next: Mode) => { if (busy) return; setMode(next); resetCode(); setTouched(false); };
  const cta = codeFlow ? (challenge ? mode === 'register' ? 'Verify & create account' : 'Verify & sign in' : 'Send email code') : copy[mode].cta;

  return <Screen left={<IconButton icon="close" label="Close" onPress={goBack} size={36} />}
    footer={<Button label={cta} loading={busy} disabled={otp && config?.emailOtp === false} onPress={() => void run(submit)} />}>
    <View style={{ paddingTop: space.lg, paddingBottom: space.xl }}>
      <RiffsWordmark />
      <T v="title1" style={{ marginTop: space.xl }} accessibilityRole="header">{copy[mode].title}</T>
      <T v="body" tone="secondary" style={{ marginTop: space.sm }}>{copy[mode].text}</T>
    </View>
    {mode !== 'forgot' && <Segmented value={mode} onChange={switchMode} style={{ marginBottom: space.xl }} options={[{ value: 'register', label: 'Create account' }, { value: 'login', label: 'Sign in' }]} />}
    {mode === 'login' && <Segmented value={method} onChange={(next) => { if (busy) return; setMethod(next); resetCode(); setTouched(false); }} style={{ marginBottom: space.lg }} options={[{ value: 'password', label: 'Password' }, { value: 'otp', label: 'Email code' }]} />}
    {mode === 'register' && <>
      <TextField label="Name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" maxLength={50} placeholder="How you’ll appear to others" error={show('name')} />
      <TextField label="Username" value={handle} onChangeText={setHandle} autoCapitalize="none" autoCorrect={false} autoComplete="username-new" textContentType="username" placeholder="e.g. radioheadfan" maxLength={25} error={show('handle')} hint={cleanHandle ? `You’ll appear as @${cleanHandle}` : undefined} />
    </>}
    <TextField label="Email" value={email} editable={!busy} onChangeText={(next) => { setEmail(next); resetCode(); setTouched(false); }} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" placeholder="you@example.com" error={show('email')} />
    {otp && config?.emailOtp === false && <T v="footnote" tone="secondary" style={{ marginBottom: space.lg }}>Email codes aren’t available yet. Use Password to sign in while email delivery is being set up.</T>}
    {codeFlow && !!challenge && <>
      <TextField label={mode === 'register' ? 'Verification code' : 'Sign-in code'} value={code} editable={!busy} onChangeText={(next) => setCode(next.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" autoCorrect={false} maxLength={6} placeholder="Six-digit code" error={show('code')} onSubmitEditing={() => void run(submit)} returnKeyType="go" />
      <Button label={seconds ? `Resend code in ${seconds}s` : 'Resend code'} variant="plain" size="md" disabled={busy || seconds > 0} onPress={() => void run(sendCode)} />
    </>}
    {mode !== 'forgot' && !otp && <TextField label="Password" value={password} onChangeText={setPassword} editable={!busy} secureTextEntry autoComplete={mode === 'register' ? 'new-password' : 'current-password'} textContentType={mode === 'register' ? 'newPassword' : 'password'}
      placeholder={mode === 'register' ? 'At least 10 characters' : 'Your password'} maxLength={128} error={show('password')} onSubmitEditing={() => void run(submit)} returnKeyType="go" />}
    {!!message && <View style={{ backgroundColor: c.accentSoft, borderRadius: 12, padding: space.md, marginBottom: space.lg }}><T v="subhead">{message}</T></View>}
    {mode === 'login' && <Button label="Forgot password?" variant="plain" size="md" onPress={() => switchMode('forgot')} />}
    {mode === 'forgot' && <Button label="Back to sign in" variant="plain" size="md" onPress={() => switchMode('login')} />}
    <Text style={[type.footnote, { color: c.secondary, textAlign: 'center', marginTop: space.lg }]}>
      {mode === 'register' ? 'By creating an account you agree to the ' : 'Read our '}
      <Text accessibilityRole="link" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'terms' } })} style={{ color: c.accent, fontFamily: font.medium }}>Terms</Text>
      {' and '}
      <Text accessibilityRole="link" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy' } })} style={{ color: c.accent, fontFamily: font.medium }}>Privacy Policy</Text>.
      {mode === 'register' ? ' Public posts can be seen by anyone.' : ''}
    </Text>
  </Screen>;
}
