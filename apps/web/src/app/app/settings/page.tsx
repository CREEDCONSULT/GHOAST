'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, clearTokens } from '../../../lib/api';
import { useToast } from '../../../context/ToastContext';

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (confirmation !== 'DELETE') return;
    setDeleting(true);
    try {
      await api.deleteAccount();
      clearTokens();
      router.replace('/');
    } catch (err) {
      toast(
        err instanceof ApiError ? err.message : 'Account deletion failed. Please try again.',
        'error',
      );
      setDeleting(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '40px auto' }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Settings</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 40 }}>
        Manage your Ghoast account and data.
      </p>

      <section style={{ borderTop: '1px solid rgba(255,62,62,.35)', paddingTop: 24 }}>
        <h2 style={{ fontSize: 19, color: 'var(--red)', marginBottom: 8 }}>
          Delete account
        </h2>
        <p style={{ color: 'var(--muted)', lineHeight: 1.65, marginBottom: 18 }}>
          This permanently removes your profile, connected Instagram accounts, scans, and action
          history. Pending actions are canceled and active subscriptions are ended.
        </p>
        <label className="field" style={{ maxWidth: 360 }}>
          <span className="field-label">Type DELETE to confirm</span>
          <input
            className="field-input"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
          />
        </label>
        <button
          className="btn btn-danger"
          type="button"
          disabled={confirmation !== 'DELETE' || deleting}
          onClick={handleDelete}
          style={{ marginTop: 16 }}
        >
          {deleting ? 'Deleting...' : 'Delete account'}
        </button>
      </section>
    </div>
  );
}
