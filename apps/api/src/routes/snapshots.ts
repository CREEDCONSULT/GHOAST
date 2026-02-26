/**
 * Snapshot Routes
 *
 * GET /api/v1/accounts/:id/snapshots        — Growth history (Pro/Pro+ only)
 * GET /api/v1/accounts/:id/ghosts/export    — CSV export of ghost list (Pro/Pro+ only)
 *
 * Both routes require:
 * - Authentication (requireAuth)
 * - Pro or higher subscription (checkTier('PRO'))
 * - Account ownership (verified within handler or service)
 */

import type { FastifyInstance } from 'fastify';
import { requireAuth, checkTier } from '../middleware/requireAuth.js';
import {
  getSnapshots,
  SnapshotAccountNotFoundError,
} from '../services/snapshot.service.js';
import { prisma } from '@ghoast/db';
import { logger } from '../lib/logger.js';

// ── CSV helpers ────────────────────────────────────────────────────────────────

/** Escapes a value for CSV — wraps in quotes if it contains commas, quotes, or newlines. */
function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

interface GhostExportRow {
  displayName: string | null;
  handle: string;
  followersCount: number;
  followingCount: number;
  tier: number;
  priorityScore: number;
  lastPostDate: Date | null;
  accountType: string;
}

function formatCsvRow(ghost: GhostExportRow): string {
  const ratio =
    ghost.followersCount > 0
      ? (ghost.followingCount / ghost.followersCount).toFixed(2)
      : '0.00';

  const lastPostDate = ghost.lastPostDate
    ? ghost.lastPostDate.toISOString().slice(0, 10)
    : '';

  return [
    escapeCsvField(ghost.displayName),
    escapeCsvField(ghost.handle),
    ghost.followersCount,
    ghost.followingCount,
    ratio,
    ghost.tier,
    ghost.priorityScore,
    lastPostDate,
    escapeCsvField(ghost.accountType),
  ].join(',');
}

const CSV_HEADER =
  'display_name,handle,followers,following,ratio,tier,priority_score,last_post_date,account_type';

// ── Routes ─────────────────────────────────────────────────────────────────────

export async function snapshotRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /accounts/:id/snapshots ────────────────────────────────────────────

  app.get<{ Params: { id: string } }>(
    '/:id/snapshots',
    { preHandler: [requireAuth, checkTier('PRO')] },
    async (request, reply) => {
      const { id: accountId } = request.params;
      const userId = request.user!.id;
      const tier = request.user!.tier;

      try {
        const snapshots = await getSnapshots(userId, accountId, tier);
        return reply.status(200).send(snapshots);
      } catch (err) {
        if (err instanceof SnapshotAccountNotFoundError) {
          return reply.status(403).send({ error: 'Forbidden' });
        }
        logger.error({ accountId, userId, err }, 'Failed to get snapshots');
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    },
  );

  // ── GET /accounts/:id/ghosts/export (streamed CSV) ─────────────────────────

  app.get<{ Params: { id: string } }>(
    '/:id/ghosts/export',
    { preHandler: [requireAuth, checkTier('PRO')] },
    async (request, reply) => {
      const { id: accountId } = request.params;
      const userId = request.user!.id;

      // Verify account ownership before streaming
      const account = await prisma.instagramAccount.findFirst({
        where: { id: accountId, userId },
        select: { id: true, handle: true },
      });

      if (!account) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const today = new Date().toISOString().slice(0, 10);
      const filename = `ghoast-export-${account.handle}-${today}.csv`;

      reply.raw.setHeader('Content-Type', 'text/csv; charset=utf-8');
      reply.raw.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );

      // Write CSV header row
      reply.raw.write(`${CSV_HEADER}\r\n`);

      // Stream ghosts in cursor-based batches of 500 — handles 5,000+ rows efficiently
      let cursor: string | undefined;
      const BATCH_SIZE = 500;

      try {
        do {
          const batch = await prisma.ghost.findMany({
            where: { accountId, removedAt: null },
            take: BATCH_SIZE,
            skip: cursor ? 1 : 0,
            ...(cursor ? { cursor: { id: cursor } } : {}),
            orderBy: { priorityScore: 'asc' },
            select: {
              id: true,
              displayName: true,
              handle: true,
              followersCount: true,
              followingCount: true,
              tier: true,
              priorityScore: true,
              lastPostDate: true,
              accountType: true,
            },
          });

          for (const ghost of batch) {
            reply.raw.write(`${formatCsvRow(ghost)}\r\n`);
          }

          cursor = batch.length === BATCH_SIZE ? batch[BATCH_SIZE - 1]!.id : undefined;
        } while (cursor);
      } catch (err) {
        logger.error({ accountId, userId, err }, 'CSV export failed mid-stream');
        // Response already started — cannot change status code
        reply.raw.end();
        return;
      }

      reply.raw.end();

      // Wait for the response to finish before resolving the handler
      await new Promise<void>((resolve) => {
        reply.raw.on('close', resolve);
        reply.raw.on('finish', resolve);
      });
    },
  );
}
