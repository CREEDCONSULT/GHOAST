'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, type Ghost, type Account, type AccountStats, type UserTier } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import StatsBar from '../../../components/dashboard/StatsBar';
import TierFilterTabs from '../../../components/dashboard/TierFilterTabs';
import GhostList from '../../../components/dashboard/GhostList';
import QueuePanel from '../../../components/dashboard/QueuePanel';
import QueueProgress from '../../../components/dashboard/QueueProgress';
import { Spinner } from '../../../components/ui/Spinner';

type QueueState =
  | { status: 'idle' }
  | { status: 'starting' }
  | { status: 'running'; jobId: string; totalJobs: number; accountId: string }
  | { status: 'pausing' }
  | { status: 'cancelling' };

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [account, setAccount] = useState<Account | null>(null);
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 });
  const [dailyUnfollowCount, setDailyUnfollowCount] = useState(0);
  const [dailyUnfollowCap, setDailyUnfollowCap] = useState(10);

  const [activeTier, setActiveTier] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [unfollowingId, setUnfollowingId] = useState<string | null>(null);

  const [queueState, setQueueState] = useState<QueueState>({ status: 'idle' });

  const [pageLoading, setPageLoading] = useState(true);
  const [ghostsLoading, setGhostsLoading] = useState(false);

  const userTier = (user?.tier ?? 'FREE') as UserTier;
  const isPro = userTier === 'PRO' || userTier === 'PRO_PLUS';

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
        setDailyUnfollowCount(ghostsData.dailyUnfollowCount);
        setDailyUnfollowCap(ghostsData.dailyUnfollowCap);
        setStats(statsData);

        // Auto-select Tier 1 for Pro users
        if (isPro) {
          const tier1Ids = ghostsData.ghosts
            .filter((g) => g.tier === 1)
            .map((g) => g.id);
          setSelectedIds(new Set(tier1Ids));
        }
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
        setDailyUnfollowCount(data.dailyUnfollowCount);
        setDailyUnfollowCap(data.dailyUnfollowCap);
        // Clear stale selections when filter changes
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
      const selectableIds = ghosts.filter((g) => g.tier !== 5).map((g) => g.id);
      setSelectedIds(new Set(selectableIds));
    } else {
      setSelectedIds(new Set());
    }
  }

  // ── Manual unfollow (Free tier) ───────────────────────────────────────────
  async function handleUnfollow(ghost: Ghost) {
    if (!account) return;
    if (dailyUnfollowCount >= dailyUnfollowCap) {
      toast('Daily unfollow limit reached. Upgrade for bulk queue.', 'warning');
      return;
    }
    setUnfollowingId(ghost.id);
    try {
      await api.unfollowGhost(account.id, ghost.id);
      setGhosts((prev) => prev.filter((g) => g.id !== ghost.id));
      setDailyUnfollowCount((n) => n + 1);
      toast(`Unfollowed @${ghost.handle}`, 'success');
      if (stats) setStats({ ...stats, totalGhosts: stats.totalGhosts, removedGhosts: stats.removedGhosts + 1 });
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        toast('Daily cap reached.', 'warning');
      } else {
        toast(`Failed to unfollow @${ghost.handle}`, 'error');
      }
    } finally {
      setUnfollowingId(null);
    }
  }

  // ── Queue ─────────────────────────────────────────────────────────────────
  async function handleStartQueue() {
    if (!account || selectedIds.size === 0) return;
    setQueueState({ status: 'starting' });
    try {
      const { jobId, totalJobs } = await api.startQueue(
        account.id,
        Array.from(selectedIds),
      );
      setQueueState({ status: 'running', jobId, totalJobs, accountId: account.id });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        toast('Upgrade to Pro to use the bulk queue.', 'warning');
      } else if (err instanceof ApiError && err.status === 429) {
        toast('Daily queue cap reached.', 'warning');
      } else {
        toast('Failed to start queue.', 'error');
      }
      setQueueState({ status: 'idle' });
    }
  }

  async function handlePauseQueue() {
    if (!account) return;
    setQueueState((s) => s.status === 'running' ? { ...s, status: 'pausing' } : s);
    try {
      await api.pauseQueue(account.id);
      toast('Queue paused.', 'info');
    } catch {
      toast('Could not pause queue.', 'error');
    } finally {
      setQueueState({ status: 'idle' });
    }
  }

  async function handleCancelQueue() {
    if (!account) return;
    setQueueState((s) => s.status === 'running' ? { ...s, status: 'cancelling' } : s);
    try {
      await api.cancelQueue(account.id);
    } catch {
      toast('Could not cancel queue.', 'error');
    } finally {
      setQueueState({ status: 'idle' });
    }
  }

  function handleQueueComplete(removedIds: string[]) {
    setGhosts((prev) => prev.filter((g) => !removedIds.includes(g.id)));
    setSelectedIds(new Set());
    setQueueState({ status: 'idle' });
    toast('Queue complete. Cleaned.', 'success');
    // Refresh stats
    if (account) {
      api.getStats(account.id).then(setStats).catch(() => null);
    }
  }

  function handleQueueCancelled() {
    setQueueState({ status: 'idle' });
    toast('Queue cancelled.', 'info');
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

  const selectedGhosts = ghosts.filter((g) => selectedIds.has(g.id));
  const queueRunning =
    queueState.status === 'running' ||
    queueState.status === 'pausing' ||
    queueState.status === 'cancelling';

  return (
    <div>
      {/* Stats bar */}
      <StatsBar account={account} stats={stats} />

      {/* Search + scan row */}
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
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            if (account) api.startScan(account.id)
              .then(() => toast('Scan started. Check back in a moment.', 'info'))
              .catch(() => toast('Could not start scan.', 'error'));
          }}
        >
          ↻ Rescan
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
        onUnfollow={handleUnfollow}
        unfollowingId={unfollowingId}
        loading={ghostsLoading}
        dailyUnfollowCount={dailyUnfollowCount}
        dailyUnfollowCap={dailyUnfollowCap}
      />

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 8,
            marginTop: 16,
          }}
        >
          <button
            className="btn btn-ghost btn-sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
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
          <button
            className="btn btn-ghost btn-sm"
            disabled={page >= pagination.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      )}

      {/* Queue panel (Pro users with selections) */}
      {isPro && !queueRunning && (
        <QueuePanel
          selectedGhosts={selectedGhosts}
          onStart={handleStartQueue}
          onClear={() => setSelectedIds(new Set())}
          starting={queueState.status === 'starting'}
        />
      )}

      {/* Queue progress (active queue) */}
      {queueRunning && queueState.status !== 'starting' && (
        <QueueProgress
          accountId={queueState.accountId}
          totalJobs={queueState.totalJobs}
          onComplete={handleQueueComplete}
          onCancel={handleQueueCancelled}
          onPause={handlePauseQueue}
          isPausing={queueState.status === 'pausing'}
          isCancelling={queueState.status === 'cancelling'}
        />
      )}

      {/* Upgrade gate for Free tier */}
      {!isPro && (
        <div className="upgrade-gate" style={{ marginTop: 20 }}>
          <span>⚡</span>
          <span>
            <strong>Upgrade to Pro</strong> to bulk unfollow up to 150 ghosts per day with full rate-limit protection.
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
