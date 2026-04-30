import assert from 'node:assert/strict';
import { mkdtemp, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { rtkify } from '../dist/index.mjs';

async function withFakeRtk(script, run) {
  const binDir = await mkdtemp(path.join(tmpdir(), 'rtkify-test-bin-'));
  const rtkPath = path.join(binDir, 'rtk');
  await writeFile(rtkPath, script, { mode: 0o755 });
  await chmod(rtkPath, 0o755);

  const originalPath = process.env.PATH;
  process.env.PATH = `${binDir}${path.delimiter}${originalPath ?? ''}`;
  try {
    return await run();
  } finally {
    if (originalPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = originalPath;
    }
  }
}

test('uses rewrite output when rtk exits 3 for ask/default permissions', async () => {
  await withFakeRtk(
    '#!/usr/bin/env bash\nprintf "%s" "rtk ls -la /tmp"\nexit 3\n',
    async () => {
      assert.equal(rtkify('ls -la /tmp'), 'rtk ls -la /tmp');
    },
  );
});
