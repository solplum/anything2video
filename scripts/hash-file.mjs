import fs from 'node:fs';
import {createHash} from 'node:crypto';

// All callers are synchronous, so one bounded scratch buffer can be reused.
// Every call reads every byte: this is not a metadata or digest cache.
let buffer;
export function sha256File(file) {
  buffer ??= Buffer.allocUnsafe(1024 * 1024);
  const hash = createHash('sha256');
  const handle = fs.openSync(file, 'r');
  try {
    let bytes;
    while ((bytes = fs.readSync(handle, buffer, 0, buffer.length, null)) > 0) {
      hash.update(buffer.subarray(0, bytes));
    }
    return hash.digest('hex');
  } finally {fs.closeSync(handle);}
}
