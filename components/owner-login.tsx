'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { clientAuth } from '@/lib/firebase-client';
import { api } from './admin';
export default function OwnerLogin() {
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const router = useRouter();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const auth = clientAuth();
      const result = await signInWithEmailAndPassword(auth, email, password);
      await result.user.reload();
      if (!result.user.emailVerified) {
        try {
          await sendEmailVerification(result.user);
          setNotice(
            'Verification email sent. Check your inbox and spam folder, verify your email, then sign in again.',
          );
        } finally {
          await signOut(auth);
        }
        return;
      }
      await result.user.getIdToken(true);
      const data = await api<{ businesses: { id: string }[] }>('/api/owner/me');
      if (!data.businesses.length) {
        await signOut(auth);
        throw Error('No active business assignment. Please contact Arvik Digital.');
      }
      router.replace('/owner');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    if (!email.trim()) {
      setError('Enter your account email first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await sendPasswordResetEmail(clientAuth(), email.trim());
      setNotice(
        'If an account exists for this email, you will receive password reset instructions.',
      );
    } catch {
      setNotice(
        'If an account exists for this email, you will receive password reset instructions. If nothing arrives, contact Arvik support.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="owner-login">
      <form className="panel" onSubmit={submit}>
        <p className="eyebrow">ARVIK SMART REVIEWS</p>
        <h1>Business Owner login</h1>
        <p className="muted">Your business. Your team. Your insights.</p>
        <label>
          Email
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="notice">
            {notice}
          </p>
        )}
        <button className="primary full" disabled={busy}>
          {busy ? 'Please wait…' : 'Sign in'}
        </button>
        <button
          className="full"
          style={{ marginTop: 12 }}
          type="button"
          disabled={busy}
          onClick={reset}
        >
          Forgot password?
        </button>
        <p className="muted small">
          Accounts are assigned by Arvik Digital. There is no public registration.
        </p>
        <Link href="/admin/login">Super Admin sign in</Link>
      </form>
    </main>
  );
}
