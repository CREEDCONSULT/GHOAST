/**
 * Local persistence — Dexie/IndexedDB. This is the ONLY persistence layer.
 * Nothing in this app calls a server; anonymous use is full use (spec §4
 * principle 8, §14).
 */

import Dexie, { type Table } from 'dexie';
import type {
  CleanupBatch,
  Comparison,
  Decision,
  LedgerEvent,
  Relation,
  SettingsRecord,
  Snapshot,
} from './types';

export class GhoastDB extends Dexie {
  snapshots!: Table<Snapshot, string>;
  relations!: Table<Relation, number>;
  decisions!: Table<Decision, string>;
  comparisons!: Table<Comparison, string>;
  events!: Table<LedgerEvent, number>;
  settings!: Table<SettingsRecord, string>;
  cleanupBatches!: Table<CleanupBatch, string>;

  constructor() {
    super('ghoast');
    this.version(1).stores({
      snapshots: 'id, createdAt, fileHash',
      relations: '++id, snapshotId, username, [snapshotId+direction]',
      decisions: 'username, state, updatedAt',
      comparisons: 'id, fromSnapshotId, toSnapshotId, createdAt',
      events: '++id, ts, username, snapshotId, action',
      settings: 'id',
    });
    this.version(2).stores({
      cleanupBatches: 'id, status, createdAt',
    });
  }
}

export const db = new GhoastDB();
