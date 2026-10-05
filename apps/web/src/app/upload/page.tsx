'use client';

/**
 * S-05 Upload — the highest-trust screen in the product (spec §10).
 * Validation order: is-zip → DYI structure → JSON vs HTML → lists present →
 * size → duplicate (sha-256) → stale (non-blocking). Processing checklist
 * ticks are real (parse completes before the final tick) but paced ≥1.8s so
 * the scan doesn't read as fake (spec §13 step 6).
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDate } from '@/lib/analysis';
import { track } from '@/lib/analytics';
import { copy } from '@/lib/copy';
import { db } from '@/lib/db';
import { parseInstagramExport } from '@/lib/parser/instagram-dyi';
import { getSettings, ingestParsedExport, sha256Hex, updateSettings } from '@/lib/store';
import type { ParseErrorCode } from '@/lib/types';
import { ExportParseError } from '@/lib/types';

type Phase =
  | { kind: 'idle' }
  | { kind: 'selected'; file: File }
  | { kind: 'duplicate'; file: File; existingDate: string; existingId: string }
  | { kind: 'stale'; file: File; days: number }
  | { kind: 'processing'; file: File }
  | { kind: 'interrupted'; fileName: string }
  | { kind: 'error'; code: ParseErrorCode; fileName: string };

const STALE_DAYS = 30;
const MIN_PROCESSING_MS = 1800; // spec §13: too-fast processing reads as "they didn't really scan"

export default function UploadPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [dragActive, setDragActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [showWhatWeRead, setShowWhatWeRead] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Interruption recovery (SH-4): offer resume when a previous run never finished.
  useEffect(() => {
    void getSettings().then((s) => {
      if (s.pendingJobFileName) {
        setPhase({ kind: 'interrupted', fileName: s.pendingJobFileName });
      }
    });
  }, []);

  const runProcessing = useCallback(
    async (file: File) => {
      setPhase({ kind: 'processing', file });
      setStepIndex(0);
      await updateSettings({ pendingJobFileName: file.name });
      void track('upload_start');

      const started = performance.now();
      const errored = (err: unknown) => {
        void updateSettings({ pendingJobFileName: null });
        const code = err instanceof ExportParseError ? err.code : 'not_zip';
        void track('upload_error', { error_code: code });
        setPhase({ kind: 'error', code, fileName: err instanceof ExportParseError ? err.fileName : file.name });
      };

      try {
        // Tick 1: opening archive (+ hash for duplicate detection)
        setStepIndex(1);
        const [parsed, hash] = await Promise.all([parseInstagramExport(file), sha256Hex(file)]);
        setStepIndex(2); // found the lists

        if (parsed.partial) {
          // Spec §22 partial-mode required followers-only ghosts; that's
          // logically impossible (ghosts need BOTH lists) — rejected with a
          // repair message instead. Recorded as spec conflict in ENGINEERING-LOG.
          throw new ExportParseError('incomplete', file.name);
        }

        const result = await ingestParsedExport(parsed, file, hash);
        setStepIndex(3); // relationships matched

        const ms = performance.now() - started;
        void track('upload_complete', {
          counts_following: result.snapshot.counts.following,
          counts_ghosts: result.snapshot.counts.ghosts,
          duration_ms_bucket: ms < 1000 ? 'under_1s' : ms < 3000 ? '1_3s' : ms < 8000 ? '3_8s' : 'over_8s',
        });
        void track('analysis_complete', { counts_ghosts: result.snapshot.counts.ghosts });
        if (result.comparison) {
          void track('reconciliation_complete', {
            reconciled_verified: result.reconciledVerified,
            still_present: result.stillPresent,
          });
        }

        // Pace the checklist so the reveal doesn't feel counterfeit.
        const elapsed = performance.now() - started;
        if (elapsed < MIN_PROCESSING_MS) {
          await new Promise((r) => setTimeout(r, MIN_PROCESSING_MS - elapsed));
        }
        setStepIndex(4); // ghosts met

        await new Promise((r) => setTimeout(r, 300));
        if (result.duplicateOf) {
          // Re-scanned the exact file on purpose — land on that snapshot's board.
          router.push('/results');
        } else {
          router.push('/results');
        }
      } catch (err) {
        errored(err);
      }
    },
    [router],
  );

  const onFile = useCallback(
    async (file: File) => {
      // Duplicate check before parsing (cheap: hash only).
      try {
        const hash = await sha256Hex(file);
        const existing = await db.snapshots.where('fileHash').equals(hash).first();
        if (existing) {
          setPhase({
            kind: 'duplicate',
            file,
            existingDate: formatDate(existing.createdAt),
            existingId: existing.id,
          });
          return;
        }
        // Stale check (non-blocking, spec SH-2).
        if (file.lastModified) {
          const days = Math.floor((Date.now() - file.lastModified) / 86_400_000);
          if (days >= STALE_DAYS) {
            setPhase({ kind: 'stale', file, days });
            return;
          }
        }
        setPhase({ kind: 'selected', file });
      } catch {
        setPhase({ kind: 'selected', file });
      }
    },
    [],
  );

  const errCopy = phase.kind === 'error' ? copy.upload.errors[phase.code] : null;

  return (
    <main id="main">
      <div className="public-page" style={{ paddingTop: 48, maxWidth: 520 }}>
        <div className="spread mb-4">
          <Link href="/start" className="micro">← {copy.a11y.back}</Link>
          <Link href="/how-it-works" className="micro">{copy.footer.howItWorks}</Link>
        </div>

        {phase.kind === 'processing' ? (
          <>
            <h1>{copy.brand.tagline}</h1>
            <div role="status" aria-live="polite" className="mt-6">
              {copy.upload.processing.map((label, i) => {
                const state = i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'pending';
                return (
                  <div key={label} className={`step-item ${state}`}>
                    <span className="step-dot" aria-hidden="true">{state === 'done' ? '✓' : ''}</span>
                    {label}
                  </div>
                );
              })}
            </div>
            <p className="micro faint mt-4">{copy.upload.processingNote}</p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: '2rem' }}>{copy.upload.title}</h1>

            {phase.kind === 'interrupted' && (
              <div className="card mb-4" role="alert">
                <p style={{ margin: 0 }}>{copy.upload.interrupted(phase.fileName)}</p>
              </div>
            )}

            {phase.kind === 'duplicate' && (
              <div className="card mb-4" role="alert">
                <p style={{ margin: 0 }}>{copy.upload.duplicate(phase.existingDate)}</p>
                <div className="stack mt-4">
                  <Link href="/results" className="btn btn-primary">{copy.upload.duplicateView}</Link>
                  <button className="btn btn-secondary" onClick={() => void runProcessing(phase.file)}>
                    {copy.upload.duplicateAnyway}
                  </button>
                </div>
              </div>
            )}

            {phase.kind === 'stale' && (
              <div className="card mb-4" role="note">
                <p style={{ margin: 0 }}>{copy.upload.stale(phase.days)}</p>
                <div className="stack mt-4">
                  <button className="btn btn-primary" onClick={() => void runProcessing(phase.file)}>
                    {copy.upload.staleUse}
                  </button>
                  <Link href="/get-my-file" className="btn btn-secondary">{copy.upload.staleFresh}</Link>
                </div>
              </div>
            )}

            {phase.kind === 'error' && errCopy && (
              <div className="card mb-4" role="alert" style={{ borderColor: 'var(--rose-400)' }}>
                <h3 style={{ margin: '0 0 8px' }}>{errCopy.title}</h3>
                <p className="muted" style={{ margin: 0 }}>
                  {'body' in errCopy && typeof errCopy.body === 'function'
                    ? errCopy.body(phase.fileName)
                    : errCopy.body}
                </p>
                <div className="stack mt-4">
                  <Link href="/get-my-file" className="btn btn-primary">
                    {copy.upload.errorGuideCta}
                  </Link>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setPhase({ kind: 'idle' });
                      inputRef.current?.click();
                    }}
                  >
                    {copy.upload.tryAgain}
                  </button>
                </div>
              </div>
            )}

            {(phase.kind === 'idle' || phase.kind === 'interrupted') && (
              <button
                type="button"
                className={`dropzone ${dragActive ? 'drag-active' : ''}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) void onFile(f);
                }}
              >
                <span style={{ fontSize: 40 }} aria-hidden="true">👻</span>
                <span className="btn btn-primary">{copy.upload.chooseFile}</span>
                <span className="micro faint">{copy.upload.dragHint}</span>
              </button>
            )}

            {phase.kind === 'selected' && (
              <>
                <div className="filechip mb-4">
                  <span aria-hidden="true">📦</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {phase.file.name}
                  </span>
                  <span className="micro faint tnum">{(phase.file.size / 1024 / 1024).toFixed(1)} MB</span>
                  <button className="btn-tertiary btn-sm" aria-label={copy.a11y.close} onClick={() => setPhase({ kind: 'idle' })}>
                    ✕
                  </button>
                </div>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => void runProcessing(phase.file)}>
                  {copy.upload.analyze}
                </button>
                <p className="micro faint center mt-2">{copy.upload.dontUnzip}</p>
              </>
            )}

            <p className="micro muted mt-4" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span aria-hidden="true">🛈</span>
              {copy.upload.trust}
            </p>

            <p className="micro">
              <button className="btn-tertiary btn-sm" onClick={() => setShowWhatWeRead((v) => !v)} aria-expanded={showWhatWeRead}>
                {copy.upload.whatWeRead}
              </button>
              {showWhatWeRead && <span className="muted">{copy.upload.whatWeReadBody}</span>}
            </p>

            <input
              ref={inputRef}
              type="file"
              accept=".zip,application/zip"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = '';
              }}
            />
          </>
        )}
      </div>
    </main>
  );
}
