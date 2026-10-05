import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';

// jsdom gaps → polyfill from Node for parser/store tests
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
}
if (typeof Blob !== 'undefined' && !Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function arrayBuffer() {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = (v: unknown) => JSON.parse(JSON.stringify(v));
}
if (typeof globalThis.TextDecoder === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  globalThis.TextDecoder = require('node:util').TextDecoder;
}
