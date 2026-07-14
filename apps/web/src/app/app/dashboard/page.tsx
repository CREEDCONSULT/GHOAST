'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, type Ghost, type Account, type AccountStats, type UserTier } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import StatsBar from '../../../components/dashboard/StatsBar';
import TierFilterTabs from '../../../components/dashboard/TierFilterTabs';
import GhostList from '../../../components/dashboard/GhostList';
import { Spinner } from '../../../components/ui/Spinner';

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [account, setAccount] = useState<Account | null>(null);
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 });
  const [dailyCleanupCount, setDailyCleanupCount] = useState(0);
  const [dailyCleanupCap, setDailyCleanupCap] = useState(10);

  const [activeTier, setActiveTier] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [bulkMarking, setBulkMarking] = useState(false);

  const [pageLoading, setPageLoading] = useState(true);
  const [ghostsLoading, setGhostsLoading] = useState(false);

  const userTier = (user?.tier ?? 'FREE') as UserTier;
  const isFree = userTier === 'FREE';

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const { accounts } = await api.getAccounts();
        if (accounts.length === 0) {
          router.push('/app/connect');
          return;
        }
        const acc = accounts[0];
        setAccount(acc);

        const [ghostsData, statsData] = await Promise.all([
          api.getGhosts(acc.id),
          api.getStats(acc.id),
        ]);

        setGhosts(ghostsData.ghosts);
        setPagination(ghostsData.pagination);
        setDailyCleanupCount(ghostsData.dailyUnfollowCount);
        setDailyCleanupCap(ghostsData.dailyUnfollowCap);
        setStats(statsData);
      } catch {
        toast('Failed to load dashboard. Please refresh.', 'error');
      } finally {
        setPageLoading(false);
      }
    }
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reload ghosts when filter/page changes ────────────────────────────────
  const loadGhosts = useCallback(
    async (accId: string, tier: number | null, q: string, p: number) => {
      setGhostsLoading(true);
      try {
        const data = await api.getGhosts(accId, {
          tier: tier as 1 | 2 | 3 | 4 | 5 | undefined,
          search: q || undefined,
          page: p,
          limit: 50,
        });
        setGhosts(data.ghosts);
        setPagination(data.pagination);
        setDailyCleanupCount(data.dailyUnfollowCount);
        setDailyCleanupCap(data.dailyUnfollowCap);
        setSelectedIds(new Set());
      } catch {
        toast('Failed to load ghost list.', 'error');
      } finally {
        setGhostsLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (!account) return;
    loadGhosts(account.id, activeTier, search, page);
  }, [activeTier, search, page, account]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Selection ─────────────────────────────────────────────────────────────
  function handleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds(new Set(ghosts.filter((g) => g.tier !== 5).map((g) => g.id)));
    } else {
      setSelectedIds(new Set());
    }
  }

  function afterRemoved(ids: string[]) {
    setGhosts((prev) => prev.filter((g) => !ids.includes(g.id)));
    setDailyCleanupCount((n) => n + ids.length);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    if (stats) setStats({ ...stats, removedGhosts: stats.removedGhosts + ids.length });
  }

  // ── Mark a single ghost as unfollowed ─────────────────────────────────────
  async function handleMarkDone(ghost: Ghost) {
    if (!account) return;
    if (isFree && dailyCleanupCount >= dailyCleanupCap) {
      toast('Daily cleanup limit reached. Upgrade to track unlimited cleanups.', 'warning');
      return;
    }
    setMarkingId(ghost.id);
    try {
      await api.markGhostUnfollowed(account.id, ghost.id);
      afterRemoved([ghost.id]);
      toast(`Marked @${ghost.handle} as unfollowed`, 'success');
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        toast('Daily cleanup limit reached.', 'warning');
      } else {
        toast(`Could not mark @${ghost.handle}`, 'error');
      }
    } finally {
      setMarkingId(null);
    }
  }

  // ── Bulk mark selected as done ────────────────────────────────────────────
  async function handleBulkMark() {
    if (!account || selectedIds.size === 0) return;
    setBulkMarking(true);
    const ids = Array.from(selectedIds);
    const done: string[] = [];
    try {
      for (const id of ids) {
        if (isFree && dailyCleanupCount + done.length >= dailyCleanupCap) {
          toast('Daily cleanup limit reached — upgrade to continue.', 'warning');
          break;
        }
        try {
          await api.markGhostUnfollowed(account.id, id);
          done.push(id);
        } catch {
          /* skip failures, keep going */
        }
      }
      if (done.length > 0) {
        afterRemoved(done);
        toast(`Marked ${done.length} as unfollowed`, 'success');
      }
    } finally {
      setBulkMarking(false);
    }
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (pageLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
          gap: 12,
          color: 'var(--muted)',
        }}
      >
        <Spinner size={22} />
        <span style={{ fontSize: 14 }}>Loading your ghost list…</span>
      </div>
    );
  }

  if (!account || !stats) return null;

  const selectedCount = selectedIds.size;

  return (
    <div>
      {/* Stats bar */}
      <StatsBar account={account} stats={stats} />

      {/* How-to hint */}
      <div
        style={{
          fontSize: 13,
          color: 'var(--muted)',
          background: 'var(--slate)',
          border: '1px solid rgba(123,79,255,.14)',
          borderRadius: 12,
          padding: '10px 14px',
          marginBottom: 16,
          lineHeight: 1.5,
        }}
      >
        Tap <strong>Open ↗</strong> to view a ghost on Instagram and unfollow them there, then hit{' '}
        <strong>Done ✓</strong> to check them off. Ghoast never touches your Instagram account —
        it just organizes the work.
      </div>

      {/* Search + re-import row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
          flexWrap: 'wrap' as const,
        }}
      >
        <input
          type="text"
          className="field-input"
          placeholder="Search by handle…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ maxWidth: 260, flex: 1 }}
        />
        <button className="btn btn-ghost btn-sm" onClick={() => router.push('/app/connect')}>
          ↻ Re-import export
        </button>
      </div>

      {/* Tier filter */}
      <TierFilterTabs
        active={activeTier}
        onChange={(t) => { setActiveTier(t); setPage(1); }}
        tierBreakdown={stats.tierBreakdown}
      />

      {/* Ghost list */}
      <GhostList
        ghosts={ghosts}
        userTier={userTier}
        selectedIds={selectedIds}
        onSelect={handleSelect}
        onSelectAll={handleSelectAll}
        onMarkDone={handleMarkDone}
        markingId={markingId}
        loading={ghostsLoading}
        dailyCleanupCount={dailyCleanupCount}
        dailyCleanupCap={dailyCleanupCap}
      />

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ← Prev
          </button>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              fontFamily: 'DM Mono',
              fontSize: 13,
              color: 'var(--muted)',
              padding: '0 8px',
            }}
          >
            {page} / {pagination.pages}
          </span>
          <button className="btn btn-ghost btn-sm" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>
            Next →
          </button>
        </div>
      )}

      {/* Selected-actions bar */}
      {selectedCount > 0 && (
        <div
          style={{
            position: 'sticky',
            bottom: 16,
            marginTop: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            background: 'var(--slate)',
            border: '1px solid rgba(123,79,255,.28)',
            borderRadius: 14,
            boxShadow: '0 8px 30px rgba(0,0,0,.35)',
            flexWrap: 'wrap' as const,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600 }}>{selectedCount} selected</span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            Unfollow them on Instagram first, then mark them done here.
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn btn-sm btn-ghost" onClick={() => setSelectedIds(new Set())} disabled={bulkMarking}>
              Clear
            </button>
            <button className="btn btn-sm btn-primary" onClick={handleBulkMark} disabled={bulkMarking}>
              {bulkMarking ? 'Marking…' : `Mark ${selectedCount} as done ✓`}
            </button>
          </div>
        </div>
      )}

      {/* Upgrade gate for Free tier */}
      {isFree && (
        <div className="upgrade-gate" style={{ marginTop: 20 }}>
          <span>⚡</span>
          <span>
            <strong>Upgrade to Pro</strong> to unlock your full ghost list, unlimited cleanup
            tracking, and follower-trend history.
          </span>
          <a
            href="/pricing"
            style={{
              marginLeft: 'auto',
              color: 'var(--violet)',
              fontWeight: 700,
              fontSize: 13,
              whiteSpace: 'nowrap' as const,
            }}
          >
            See plans →
          </a>
        </div>
      )}
    </div>
  );
}
