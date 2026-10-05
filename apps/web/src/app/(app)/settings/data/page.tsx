'use client';

/**
 * S-19 Data management — per-snapshot delete + Delete everything (SH-8
 * double-confirm, honest copy: nothing exists server-side because nothing
 * was ever sent — spec §S-19).
 */

import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { formatDate } from '@/lib/analysis';
import { copy } from '@/lib/copy';
import { db } from '@/lib/db';
import { deleteEverything, deleteSnapshot } from '@/lib/store';

export default function DataSettingsPage() {
  const router = useRouter();
  const { show } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const snapshots = useLiveQuery(() => db.snapshots.orderBy('createdAt').reverse().toArray(), []);

  return (
    <div className="page" style={{ maxWidth: 520 }}>
      <button className="btn-tertiary btn-sm mb-2" onClick={() => router.back()}>← {copy.a11y.back}</button>
      <h1>{copy.dataSettings.title}</h1>

      <h2 style={{ fontSize: '1.125rem' }}>{copy.dataSettings.snapshots}</h2>
      {!snapshots || snapshots.length === 0 ? (
        <p className="muted">{copy.dataSettings.noSnapshots}</p>
      ) : (
        <div className="stack mb-4">
          {snapshots.map((s) => (
            <div key={s.id} className="card spread">
              <div>
                <strong className="micro">{s.fileName}</strong>
                <p className="caption faint" style={{ margin: 0 }}>
                  {formatDate(s.createdAt)} · <span className="tnum">{s.counts.following.toLocaleString()}</span> following
                </p>
              </div>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => void deleteSnapshot(s.id).then(() => show('Scan deleted.'))}
              >
                {copy.dataSettings.deleteScan}
              </button>
            </div>
          ))}
        </div>
      )}

      <button className="btn btn-danger" onClick={() => setConfirmOpen(true)}>
        {copy.dataSettings.deleteAll}
      </button>

      <Sheet open={confirmOpen} title={copy.dataSettings.confirmTitle} onClose={() => setConfirmOpen(false)}>
        <p className="muted">{copy.dataSettings.confirmBody}</p>
        <div className="stack mt-4">
          <button
            className="btn btn-danger"
            onClick={() => {
              void deleteEverything().then(() => {
                setConfirmOpen(false);
                show(copy.dataSettings.deletedToast);
                router.push('/start');
              });
            }}
          >
            {copy.dataSettings.confirmDelete}
          </button>
          <button className="btn btn-secondary" onClick={() => setConfirmOpen(false)} autoFocus>
            {copy.dataSettings.confirmKeep}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
