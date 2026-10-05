'use client';

/**
 * Bridge to the optional GHOAST Chrome Companion Extension (apps/extension).
 *
 * Security boundary (feature spec §C): the extension is an execution adapter.
 * This client sends only an ordered username list + pacing. It never receives
 * or transmits anything else; Instagram stays authoritative; every positive
 * outcome lands as handled_self locally and awaits export reconciliation.
 */

export interface ExtensionReceiptPayload {
  ts: number;
  username: string;
  kind: 'opened' | 'requested' | 'confirmed' | 'skipped' | 'failed' | 'stopped';
  detail?: string;
}

export interface ExtensionState {
  active: boolean;
  status: 'idle' | 'running' | 'paused' | 'stopped' | 'done';
  total: number;
  currentIndex: number;
  haltedReason: string | null;
  receipts: ExtensionReceiptPayload[];
}

export type ExtensionCommand =
  | { type: 'GHOAST_BATCH_START'; usernames: string[]; pacing: { intervalSeconds: number; breakEvery: number } }
  | { type: 'GHOAST_BATCH_PAUSE' }
  | { type: 'GHOAST_BATCH_RESUME' }
  | { type: 'GHOAST_BATCH_STOP' }
  | { type: 'GHOAST_BATCH_STATUS' };

const EXTENSION_ID = process.env.NEXT_PUBLIC_GHOAST_EXTENSION_ID ?? '';

declare const chrome:
  | {
      runtime?: {
        sendMessage?: (
          id: string,
          message: unknown,
          cb?: (response: unknown) => void,
        ) => Promise<unknown> | undefined;
        lastError?: { message?: string } | undefined;
      };
    }
  | undefined;

export function extensionAvailable(): boolean {
  return (
    EXTENSION_ID.length > 0 &&
    typeof chrome !== 'undefined' &&
    typeof chrome?.runtime?.sendMessage === 'function'
  );
}

export async function sendToExtension(cmd: ExtensionCommand): Promise<ExtensionState | null> {
  if (!extensionAvailable()) return null;
  try {
    const send = chrome!.runtime!.sendMessage!;
    const response = await new Promise<unknown>((resolve) => {
      const maybePromise = send.call(chrome!.runtime, EXTENSION_ID, cmd, (r: unknown) => resolve(r));
      // MV3 returns a promise when no callback form is used; callback covers older impls
      if (maybePromise && typeof (maybePromise as Promise<unknown>).then === 'function') {
        (maybePromise as Promise<unknown>).then(resolve, () => {
          const err = chrome!.runtime!.lastError;
          resolve(err ? null : null);
        });
      }
    });
    return (response as ExtensionState) ?? null;
  } catch {
    return null; // extension absent/blocked — UI degrades to manual mode
  }
}
