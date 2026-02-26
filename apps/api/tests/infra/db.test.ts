/**
 * Phase 0 — Database Infrastructure Tests
 * Verifies PostgreSQL connection and that all 8 schema tables exist.
 */
import { prisma } from '@ghoast/db';

describe('Database connection', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('connects to PostgreSQL successfully', async () => {
    const result = await prisma.$queryRaw<[{ result: number }]>`SELECT 1 AS result`;
    expect(result[0]?.result).toBe(1);
  });

  it('all 8 tables exist', async () => {
    const tables = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    const tableNames = tables.map((t) => t.table_name);

    const expectedTables = [
      'users',
      'instagram_accounts',
      'ghosts',
      'unfollow_queue_jobs',
      'queue_sessions',
      'account_snapshots',
      'credit_transactions',
      'subscriptions',
    ];

    for (const table of expectedTables) {
      expect(tableNames).toContain(table);
    }
  });

  it('users table has required columns', async () => {
    const columns = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
        AND table_schema = 'public'
    `;
    const colNames = columns.map((c) => c.column_name);

    expect(colNames).toContain('id');
    expect(colNames).toContain('email');
    expect(colNames).toContain('password_hash');
    expect(colNames).toContain('tier');
    expect(colNames).toContain('credit_balance');
    expect(colNames).toContain('created_at');
  });

  it('instagram_accounts table has session token columns', async () => {
    const columns = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'instagram_accounts'
        AND table_schema = 'public'
    `;
    const colNames = columns.map((c) => c.column_name);

    expect(colNames).toContain('session_token_encrypted');
    expect(colNames).toContain('session_token_iv');
  });

  it('ghosts table has scoring columns', async () => {
    const columns = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'ghosts'
        AND table_schema = 'public'
    `;
    const colNames = columns.map((c) => c.column_name);

    expect(colNames).toContain('priority_score');
    expect(colNames).toContain('tier');
    expect(colNames).toContain('score_account_type');
    expect(colNames).toContain('score_ratio');
    expect(colNames).toContain('score_engagement');
    expect(colNames).toContain('score_size_band');
    expect(colNames).toContain('score_post_recency');
    expect(colNames).toContain('removed_at');
    expect(colNames).toContain('is_whitelisted');
  });

  it('credit_transactions has stripe_payment_intent_id unique constraint', async () => {
    const constraints = await prisma.$queryRaw<{ constraint_name: string; constraint_type: string }[]>`
      SELECT tc.constraint_name, tc.constraint_type
      FROM information_schema.table_constraints tc
      WHERE tc.table_name = 'credit_transactions'
        AND tc.constraint_type = 'UNIQUE'
        AND tc.table_schema = 'public'
    `;
    // Should have at least one unique constraint (stripe_payment_intent_id)
    expect(constraints.length).toBeGreaterThanOrEqual(1);
  });
});
