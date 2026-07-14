'use client';

import { useState, useRef, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, type ImportSummary } from '../../../lib/api';
import { useToast } from '../../../context/ToastContext';
import Input from '../../../components/ui/Input';
import { Spinner } from '../../../components/ui/Spinner';

const EXPORT_URL = 'https://accountscenter.instagram.com/info_and_permissions/dyi/';

export default function ConnectPage() {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [handle, setHandle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function pickFile(f: File | null) {
    if (!f) return;
    const ok = /\.(zip|json)$/i.test(f.name);
    if (!ok) {
      setError('Upload the .zip Instagram sent you, or a following.json file.');
      return;
    }
    setError('');
    setFile(f);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    pickFile(e.dataTransfer.files?.[0] ?? null);
  }

  async function handleUpload() {
    const h = handle.trim().replace(/^@/, '');
    if (!h) { setError('Enter your Instagram username.'); return; }
    if (!file) { setError('Choose your Instagram data export file.'); return; }

    setError('');
    setLoading(true);
    setProgress(0);
    try {
      const summary: ImportSummary = await api.importExport(h, file, setProgress);
      toast(
        `Found ${summary.ghostCount} ghost${summary.ghostCount === 1 ? '' : 's'} not following you back`,
        'success',
      );
      router.push('/app/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'BAD_EXPORT') setError(err.message);
        else if (err.code === 'INVALID_HANDLE') setError(err.message);
        else if (err.status === 413) setError(err.message);
        else if (err.status === 403) setError('Account limit reached for your plan.');
        else setError(err.message || 'Could not process that export.');
      } else {
        toast('Something went wrong. Try again.', 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 620, margin: '40px auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
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
          Import your data
        </span>
        <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-.5px', marginBottom: 8 }}>
          Analyze your Instagram
        </h1>
        <p style={{ fontSize: 15, color: 'var(--muted)', lineHeight: 1.6 }}>
          Ghoast reads a copy of <strong>your own</strong> Instagram data — the official export
          Instagram gives you. No password, no login, no access to your account. Ever.
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
          How to get your export (2 minutes)
        </p>
        {[
          <>Open Instagram&rsquo;s <a href={EXPORT_URL} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cyan)' }}>Download your information</a> page and sign in there (not here).</>,
          <>Choose <strong>Some of your information</strong> → select <strong>Followers and following</strong> (add <strong>Likes</strong> and <strong>Comments</strong> for smarter scoring).</>,
          <>Set format to <strong>JSON</strong> and date range to <strong>All time</strong>, then request the download.</>,
          <>Instagram emails you a .zip in a few minutes. Download it and drop it below.</>,
        ].map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, marginBottom: i < 3 ? 12 : 0, alignItems: 'flex-start' }}>
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
            <span style={{ fontSize: 14, color: 'var(--ghost-text)', lineHeight: 1.5 }}>{step}</span>
          </div>
        ))}
      </div>

      {/* Form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Input
          label="Your Instagram username"
          type="text"
          placeholder="yourhandle"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          style={{
            border: `2px dashed ${dragging ? 'var(--violet)' : 'rgba(123,79,255,.3)'}`,
            background: dragging ? 'var(--violet-lo)' : 'var(--specter)',
            borderRadius: 14,
            padding: '28px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all .15s ease',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,.json,application/zip,application/json"
            style={{ display: 'none' }}
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
          <div style={{ fontSize: 30, marginBottom: 8 }}>{file ? '📦' : '⬆️'}</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
            {file ? file.name : 'Drop your export .zip here'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            {file ? `${(file.size / 1024 / 1024).toFixed(1)} MB — click to change` : 'or click to browse (.zip or .json)'}
          </div>
        </div>

        {error && <p style={{ fontSize: 13, color: 'var(--red)', lineHeight: 1.5 }}>{error}</p>}

        {loading && progress > 0 && progress < 100 && (
          <div style={{ height: 6, background: 'var(--specter)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--violet)', transition: 'width .2s ease' }} />
          </div>
        )}

        <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
          Your file is processed to build your ghost list and is not shared with anyone. Ghoast
          does not store your Instagram password and never signs in to your account.
        </p>

        <button
          type="button"
          onClick={handleUpload}
          disabled={loading || !file || !handle.trim()}
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {loading ? <Spinner size={18} /> : 'Analyze my ghosts →'}
        </button>
      </div>
    </div>
  );
}
