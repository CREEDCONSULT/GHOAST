'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '../../../lib/api';
import { useToast } from '../../../context/ToastContext';
import Input from '../../../components/ui/Input';
import { Spinner } from '../../../components/ui/Spinner';

export default function ConnectPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [sessionToken, setSessionToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const token = sessionToken.trim();
    if (!token) { setError('Session token is required'); return; }
    if (token.length < 10) { setError('This doesn\'t look like a valid session token'); return; }
    setError('');
    setLoading(true);

    try {
      await api.connectAccount(token);
      toast('Account connected!', 'success');
      router.push('/app/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) setError('Invalid or expired session token. Try copying it again.');
        else if (err.status === 403) setError('Account limit reached for your plan.');
        else if (err.status === 429) setError('Instagram rate limit hit. Wait a moment and try again.');
        else setError(err.message || 'Could not connect account.');
      } else {
        toast('Something went wrong. Try again.', 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 580, margin: '40px auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <span
          style={{
            display: 'inline-block',
            background: 'var(--violet-lo)',
            border: '1px solid var(--violet-mid)',
            borderRadius: 20,
            padding: '4px 14px',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '.12em',
            textTransform: 'uppercase' as const,
            color: 'var(--violet)',
            marginBottom: 14,
          }}
        >
          Step 1 of 1
        </span>
        <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-.5px', marginBottom: 8 }}>
          Connect your Instagram
        </h1>
        <p style={{ fontSize: 15, color: 'var(--muted)', lineHeight: 1.6 }}>
          Ghoast uses your Instagram session cookie to read your follower list.
          Your session token is encrypted and stored securely.
        </p>
      </div>

      {/* Steps card */}
      <div
        style={{
          background: 'var(--slate)',
          border: '1px solid rgba(123,79,255,.18)',
          borderRadius: 16,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <p
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '.08em',
            textTransform: 'uppercase' as const,
            color: 'var(--muted)',
            marginBottom: 16,
          }}
        >
          How to get your session token
        </p>
        {[
          'Open Instagram in your browser and sign in.',
          'Open DevTools (F12), go to Application → Cookies → instagram.com.',
          'Find the cookie named "sessionid" and copy its value.',
          'Paste it below.',
        ].map((step, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 12,
              marginBottom: i < 3 ? 12 : 0,
              alignItems: 'flex-start',
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: 'var(--specter)',
                border: '1px solid rgba(123,79,255,.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--violet)',
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              {i + 1}
            </div>
            <span style={{ fontSize: 14, color: 'var(--ghost-text)', lineHeight: 1.5 }}>
              {step}
            </span>
          </div>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Input
          label="Instagram Session Token"
          type="password"
          placeholder="Paste your sessionid cookie value here"
          value={sessionToken}
          onChange={(e) => setSessionToken(e.target.value)}
          error={error}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />

        <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
          Your session token is encrypted with AES-256 before storage and never logged.
          Ghoast does not store your Instagram password.
        </p>

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {loading ? <Spinner size={18} /> : 'Connect Account →'}
        </button>
      </form>
    </div>
  );
}
