'use client';

/**
 * List engine — C-07 AccountRow + C-09 FilterBar, reused across Ghosts /
 * Fans / Mutuals / Saved / Kept / comparison detail (spec §26.5).
 * One engine, built once, used everywhere.
 */

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { bandFor, bandLabel, formatSince, profileUrl } from '@/lib/analysis';
import { copy } from '@/lib/copy';
import type { DecisionState, Direction, Relation } from '@/lib/types';
import { Monogram } from './Monogram';

export type SortKey = 'oldest' | 'newest' | 'az' | 'za';
export type BandFilter = 'all' | 'longstanding' | 'recent' | 'saved';

export interface ListItem {
  relation: Relation;
  decision: DecisionState | null;
}

function evidenceLine(direction: Direction, since: number | null): string {
  const formatted = formatSince(since);
  if (direction === 'following') return copy.lists.evidenceGhost(formatted);
  if (direction === 'follower') return copy.lists.evidenceFan(formatted);
  return copy.lists.evidenceMutual(since ? formatSince(since) : null);
}

export function AccountRow({
  item,
  stateChip,
  actions,
  selected,
  onToggleSelect,
  selectionMode,
}: {
  item: ListItem;
  stateChip?: boolean;
  actions?: React.ReactNode;
  selected?: boolean;
  onToggleSelect?: (username: string) => void;
  selectionMode?: boolean;
}) {
  const { relation, decision } = item;
  const since = relation.direction === 'follower' ? relation.followerSince : relation.followingSince;
  const band = bandFor(since);

  return (
    <div className="row" data-selected={selected || undefined}>
      {selectionMode && (
        <input
          type="checkbox"
          checked={!!selected}
          onChange={() => onToggleSelect?.(relation.username)}
          aria-label={`Select @${relation.username}`}
          style={{ width: 20, height: 20 }}
        />
      )}
      <Monogram username={relation.username} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link
          href={`/account/${encodeURIComponent(relation.username)}`}
          style={{
            fontWeight: 700,
            color: 'var(--text-1)',
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          aria-label={`@${relation.username}, ${evidenceLine(relation.direction, since)}`}
        >
          <bdi>@{relation.username}</bdi>
        </Link>
        <div className="micro muted">{evidenceLine(relation.direction, since)}</div>
      </div>
      {relation.direction === 'following' && band === 'recent' && (
        <span className="badge badge-new">{bandLabel(band)}</span>
      )}
      {stateChip && decision && (
        <span
          className={`badge ${
            decision === 'kept'
              ? 'badge-kept'
              : decision === 'queued'
                ? 'badge-queued'
                : decision === 'saved'
                  ? 'badge-saved'
                  : 'badge-handled'
          }`}
        >
          {copy.lists.stateChips[decision]}
        </span>
      )}
      {actions}
    </div>
  );
}

interface AccountListProps {
  items: ListItem[];
  searchable?: boolean;
  showBandFilters?: boolean;
  initialBand?: BandFilter;
  stateChips?: boolean;
  renderActions?: (item: ListItem) => React.ReactNode;
  emptyMessage: string;
  bulkActions?: {
    onKeep: (usernames: string[]) => void;
    onSave: (usernames: string[]) => void;
  };
  /** Batch Cleanup Assistant: turns the current filtered+sorted result into a batch of the first N. */
  batchTools?: {
    onCreateBatch: (usernames: string[]) => void;
    excludedCount?: number; // kept/queued others inform the hint
  };
  skeleton?: boolean;
}

const BATCH_QUICK_N = [5, 10, 25, 50, 100, 200] as const;

export function AccountList({
  items,
  searchable = true,
  showBandFilters = true,
  initialBand = 'all',
  stateChips = true,
  renderActions,
  emptyMessage,
  bulkActions,
  batchTools,
  skeleton,
}: AccountListProps) {
  const [query, setQuery] = useState('');
  const [band, setBand] = useState<BandFilter>(initialBand);
  const [sort, setSort] = useState<SortKey>('oldest');
  const [batchN, setBatchN] = useState<number>(25);
  const [customN, setCustomN] = useState('');
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [renderLimit, setRenderLimit] = useState(200); // progressive render: keeps 5k+ rows at 60fps (spec §22)
  const selectionMode = selection.size > 0;

  const filtered = useMemo(() => {
    let out = items;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      out = out.filter((i) => i.relation.username.toLowerCase().includes(q));
    }
    if (band === 'saved') {
      out = out.filter((i) => i.decision === 'saved');
    } else if (band !== 'all') {
      out = out.filter((i) => {
        const since =
          i.relation.direction === 'follower' ? i.relation.followerSince : i.relation.followingSince;
        return bandFor(since) === band;
      });
    }
    // Default sort: oldest first — staleness is the honest proxy (spec §11).
    const key = (i: ListItem) =>
      (i.relation.direction === 'follower'
        ? i.relation.followerSince
        : i.relation.followingSince) ?? Number.MAX_SAFE_INTEGER;
    return [...out].sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return key(a) - key(b);
        case 'newest':
          return key(b) - key(a) === Number.MIN_SAFE_INTEGER ? 0 : key(b) - key(a);
        case 'az':
          return a.relation.username.localeCompare(b.relation.username);
        case 'za':
          return b.relation.username.localeCompare(a.relation.username);
      }
    });
  }, [items, query, band, sort]);

  const counts = useMemo(() => {
    const c: Record<BandFilter, number> = { all: items.length, longstanding: 0, recent: 0, saved: 0 };
    for (const i of items) {
      const since =
        i.relation.direction === 'follower' ? i.relation.followerSince : i.relation.followingSince;
      const b = bandFor(since);
      if (b === 'longstanding' || b === 'recent') c[b]++;
      if (i.decision === 'saved') c.saved++;
    }
    return c;
  }, [items]);

  const toggleSelect = (username: string) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username);
      else next.add(username);
      return next;
    });
  };

  if (skeleton) {
    return (
      <div className="stack-lg" aria-busy="true">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 64 }} />
        ))}
      </div>
    );
  }

  const effectiveN = customN.trim() ? Math.max(1, Math.min(Number(customN) || 1, filtered.length)) : batchN;

  return (
    <div>
      {batchTools && items.length > 0 && (
        <div className="card mb-4">
          <div className="spread wrap" style={{ rowGap: 8 }}>
            <span className="micro muted">
              Batch the current filtered list —{' '}
              <span className="tnum">{filtered.length.toLocaleString()}</span> match
            </span>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {BATCH_QUICK_N.map((n) => (
                <button
                  key={n}
                  className={`chip ${!customN && batchN === n ? 'active' : ''}`}
                  aria-pressed={!customN && batchN === n}
                  onClick={() => {
                    setBatchN(n);
                    setCustomN('');
                  }}
                >
                  {n}
                </button>
              ))}
              <input
                className="field-input"
                style={{ width: 72 }}
                type="number"
                min={1}
                placeholder="N"
                value={customN}
                onChange={(e) => setCustomN(e.target.value)}
                aria-label="Custom batch size"
              />
              <button
                className="btn btn-sm btn-primary"
                disabled={filtered.length === 0}
                onClick={() =>
                  batchTools.onCreateBatch(
                    filtered.slice(0, effectiveN).map((i) => i.relation.username),
                  )
                }
              >
                Add first {Math.min(effectiveN, filtered.length)} to Cleanup Batch →
              </button>
            </span>
          </div>
        </div>
      )}
      <div className="filterbar">
        {selectionMode && bulkActions ? (
          <div className="chip-row spread">
            <span className="micro muted">{copy.lists.selected(selection.size)}</span>
            <span style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  bulkActions.onKeep([...selection]);
                  setSelection(new Set());
                }}
              >
                {copy.lists.keepSelected}
              </button>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  bulkActions.onSave([...selection]);
                  setSelection(new Set());
                }}
              >
                {copy.lists.saveSelected}
              </button>
              <button className="btn btn-sm btn-tertiary" onClick={() => setSelection(new Set())}>
                {copy.lists.clear}
              </button>
            </span>
          </div>
        ) : (
          <>
            {showBandFilters && (
              <div className="chip-row" role="group" aria-label={copy.a11y.filterAccounts}>
                {(['all', 'longstanding', 'recent', 'saved'] as BandFilter[]).map((b) => (
                  <button
                    key={b}
                    className={`chip ${band === b ? 'active' : ''}`}
                    aria-pressed={band === b}
                    onClick={() => setBand(b)}
                  >
                    {copy.lists.filters[b]} <span className="tnum">{counts[b]}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="chip-row">
              {searchable && (
                <input
                  className="field-input"
                  style={{ flex: 1 }}
                  type="search"
                  placeholder={copy.lists.searchPlaceholder}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label={copy.lists.searchPlaceholder}
                />
              )}
              <select
                className="field-input"
                style={{ width: 'auto' }}
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                aria-label={copy.a11y.sortMenu}
              >
                {(Object.keys(copy.lists.sorts) as SortKey[]).map((s) => (
                  <option key={s} value={s}>
                    {copy.lists.sorts[s]}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="card center">
          <p className="muted" style={{ margin: 0 }}>
            {items.length === 0
              ? emptyMessage
              : copy.lists.noMatch}{' '}
            {items.length > 0 && (
              <button
                className="btn-tertiary btn-sm"
                onClick={() => {
                  setQuery('');
                  setBand('all');
                }}
              >
                {copy.lists.clearFilters}
              </button>
            )}
          </p>
        </div>
      ) : (
        <div className="list-container">
          {filtered.slice(0, renderLimit).map((item) => (
            <AccountRow
              key={item.relation.username}
              item={item}
              stateChip={stateChips}
              actions={
                <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {(renderActions && (!bulkActions || !selectionMode)) && renderActions(item)}
                  {bulkActions && (
                    <button
                      className="btn-tertiary btn-sm"
                      aria-label={`${selection.has(item.relation.username) ? 'Deselect' : 'Select'} @${item.relation.username}`}
                      aria-pressed={selection.has(item.relation.username)}
                      onClick={() => toggleSelect(item.relation.username)}
                    >
                      {selection.has(item.relation.username) ? '☑' : '☐'}
                    </button>
                  )}
                </span>
              }
              selected={selection.has(item.relation.username)}
              selectionMode={selectionMode}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}

      {filtered.length > renderLimit && (
        <p className="center mt-4">
          <button className="btn btn-secondary" onClick={() => setRenderLimit((n) => n + 500)}>
            Show more ({(filtered.length - renderLimit).toLocaleString()} remaining)
          </button>
        </p>
      )}
    </div>
  );
}

export function rowActionsFor(username: string, href: string | null) {
  return (
    <a
      className="btn-tertiary btn-sm"
      href={profileUrl(username, href)}
      target="_blank"
      rel="noopener noreferrer nofollow"
      onClick={(e) => e.stopPropagation()}
    >
      {copy.lists.viewOnInstagram} ↗
    </a>
  );
}
