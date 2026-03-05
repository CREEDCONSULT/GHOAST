'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Input from '../../components/ui/Input';
import { ApiError } from '../../lib/api';
import { Spinner } from '../../components/ui/Spinner';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const newErrors: typeof errors = {};

    if (!email) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'Enter a valid email';
    if (!password) newErrors.password = 'Password is required';

    if (Object.keys(newErrors).length) { setErrors(newErrors); return; }
    setErrors({});
    setLoading(true);

    try {
      await login(email, password);
      router.push('/app/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setErrors({ form: 'Invalid email or password.' });
      } else {
        toast('Something went wrong. Try again.', 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        position: 'relative',
      }}
    >
      {/* Background orbs */}
      <div className="noise-layer" />
      <div className="orb orb-1" />
      <div className="orb orb-2" />

      {/* Logo */}
      <Link
        href="/"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 32,
          position: 'relative',
          zIndex: 1,
          textDecoration: 'none',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            background: 'var(--grad)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 900,
            color: '#fff',
          }}
        >
          G
        </div>
        <span style={{ fontSize: 18, fontWeight: 800 }}>
          Gh<span className="gradient-text">oa</span>st
        </span>
      </Link>

      <div className="auth-card">
        <h1
          style={{
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: '-.5px',
            marginBottom: 6,
          }}
        >
          Welcome back
        </h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 28 }}>
          Sign in to see who ghosted your count.
        </p>

        {errors.form && (
          <div
            style={{
              background: 'rgba(255,62,62,.08)',
              border: '1px solid rgba(255,62,62,.3)',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13,
              color: 'var(--red)',
              marginBottom: 20,
            }}
          >
            {errors.form}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            autoComplete="email"
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            autoComplete="current-password"
          />
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}
          >
            {loading ? <Spinner size={18} /> : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--muted)' }}>
          No account?{' '}
          <Link href="/register" style={{ color: 'var(--violet)', fontWeight: 600 }}>
            Create one free
          </Link>
        </p>
      </div>

      {/* Dev credentials hint */}
      <div
        style={{
          marginTop: 20,
          padding: '10px 16px',
          background: 'rgba(123,79,255,.08)',
          border: '1px solid rgba(123,79,255,.2)',
          borderRadius: 10,
          fontSize: 12,
          color: 'var(--muted)',
          maxWidth: 440,
          width: '100%',
          position: 'relative',
          zIndex: 1,
          lineHeight: 1.7,
        }}
      >
        <strong style={{ color: 'var(--ghost-text)' }}>Test accounts:</strong>{' '}
        free@ghoast.dev / pro@ghoast.dev / proplus@ghoast.dev
        <br />Password: <span style={{ fontFamily: 'DM Mono', color: 'var(--ghost-text)' }}>Password123!</span>
      </div>
    </div>
  );
}
