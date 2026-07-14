/**
 * Data-Export Import Routes (compliant)
 *
 * POST /api/v1/accounts/import   (multipart/form-data)
 *   fields: handle (text), file (the Instagram data export .zip or a single .json)
 *   — parses the export, computes + scores ghosts, returns an import summary.
 *
 * This is the compliant replacement for the old session-cookie "connect + scan" flow.
 * No Instagram credentials are involved anywhere in this path.
 */

import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  parseUpload,
  importParsedExport,
  ExportParseError,
  InvalidHandleError,
} from '../services/import.service.js';
import { logger } from '../lib/logger.js';

const MAX_UPLOAD_BYTES = 60 * 1024 * 1024; // 60 MB — plenty for a JSON-only export

export async function importRoutes(app: FastifyInstance): Promise<void> {
  app.post('/import', { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.user!.id;

    if (!request.isMultipart()) {
      return reply
        .status(400)
        .send({ error: 'Bad Request', message: 'Upload the export as multipart/form-data.' });
    }

    let handle = '';
    let fileBuffer: Buffer | null = null;
    let filename = '';

    try {
      for await (const part of request.parts()) {
        if (part.type === 'file') {
          filename = part.filename ?? 'upload';
          const chunks: Buffer[] = [];
          let total = 0;
          for await (const chunk of part.file) {
            total += chunk.length;
            if (total > MAX_UPLOAD_BYTES) {
              return reply.status(413).send({
                error: 'Payload Too Large',
                message:
                  'That file is over 60 MB. When requesting your export, choose JSON format and ' +
                  'select only "Followers and following" (plus Likes/Comments) to keep it small.',
              });
            }
            chunks.push(chunk as Buffer);
          }
          fileBuffer = Buffer.concat(chunks);
        } else if (part.fieldname === 'handle') {
          handle = String(part.value ?? '');
        }
      }
    } catch (err) {
      logger.error({ userId, err: (err as Error).name }, 'Failed reading upload stream');
      return reply.status(400).send({ error: 'Bad Request', message: 'Could not read the upload.' });
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: 'No file was uploaded.' });
    }

    try {
      const parsed = parseUpload(filename, fileBuffer);
      const summary = await importParsedExport(userId, handle, parsed);
      return reply.status(200).send(summary);
    } catch (err) {
      if (err instanceof InvalidHandleError) {
        return reply.status(400).send({ error: 'Bad Request', code: 'INVALID_HANDLE', message: err.message });
      }
      if (err instanceof ExportParseError) {
        return reply.status(422).send({ error: 'Unprocessable Entity', code: 'BAD_EXPORT', message: err.message });
      }
      logger.error({ userId, err: (err as Error).name }, 'Import failed');
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
}
