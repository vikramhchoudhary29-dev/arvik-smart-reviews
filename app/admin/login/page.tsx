'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import { clientAuth } from '@/lib/firebase-client';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const auth = clientAuth();

      const result = await signInWithEmailAndPassword(auth, email, password);

      // Refresh the user's email verification status.
      await result.user.reload();

      if (!result.user.emailVerified) {
        try {
          await sendEmailVerification(result.user);
          setError(
            'Verification email sent! Check your inbox and spam folder. Verify your email, then sign in again.',
          );
        } catch (verificationError) {
          setError(
            verificationError instanceof Error
              ? `Could not send verification email: ${verificationError.message}`
              : 'Could not send verification email. Please try again.',
          );
        }

        await signOut(auth);
        return;
      }

      // Refresh token after email verification.
      const token = await result.user.getIdToken(true);

      const response = await fetch('/api/admin/businesses', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        await signOut(auth);

        throw new Error(
          response.status === 401
            ? 'This account is not authorized as an owner. Check ADMIN_EMAILS and Firebase Admin configuration.'
            : 'Could not verify owner access. Please try again.',
        );
      }

      router.replace('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 space-y-5"
      >
        <p className="text-emerald-400 font-semibold">ARVIK DIGITAL</p>

        <h1 className="text-3xl font-bold">Owner login</h1>

        <label className="block text-sm">
          Email
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full rounded-xl bg-slate-900 border border-white/15 p-3"
          />
        </label>

        <label className="block text-sm">
          Password
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full rounded-xl bg-slate-900 border border-white/15 p-3"
          />
        </label>

        {error && (
          <p role="alert" className="text-red-300 text-sm">
            {error}
          </p>
        )}

        <button
          disabled={loading}
          className="w-full rounded-xl bg-emerald-500 text-slate-950 p-3 font-semibold disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
