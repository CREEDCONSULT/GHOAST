'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Input from '../../components/ui/Input';
import { ApiError } from '../../lib/api';
import { Spinner } from '../../components/ui/Spinner';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirm?: string;
    form?: string;
  }>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const newErrors: typeof errors = {};

    if (!email) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'Enter a valid email';

    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 8) newErrors.password = 'Must be at least 8 characters';

    if (!confirm) newErrors.confirm = 'Please confirm your password';
    else if (confirm !== password) newErrors.confirm = 'Passwords do not match';

    if (Object.keys(newErrors).length) { setErrors(newErrors); return; }
    setErrors({});
    setLoading(true);

    try {
      await register(email, password);
      router.push('/app/connect');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setErrors({ email: 'An account with this email already exists.' });
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
          Start for free
        </h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 28 }}>
          See your ghost list for free.
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
            placeholder="8+ characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            autoComplete="new-password"
          />
          <Input
            label="Confirm Password"
            type="password"
            placeholder="••••••••"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={errors.confirm}
            autoComplete="new-password"
          />

          <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, marginTop: 4 }}>
            By creating an account you agree to our{' '}
            <Link href="/terms" style={{ color: 'var(--violet)' }}>Terms of Service</Link>{' '}
            and{' '}
            <Link href="/privacy" style={{ color: 'var(--violet)' }}>Privacy Policy</Link>.
            Ghoast is not affiliated with Instagram or Meta.
          </p>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {loading ? <Spinner size={18} /> : 'Create Account — Free'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--muted)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--violet)', fontWeight: 600 }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
