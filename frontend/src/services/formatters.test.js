import test from 'node:test';
import assert from 'node:assert/strict';
import { formatFileSize } from './formatters.js';

test('formats uploaded file sizes for the document library', () => {
  assert.equal(formatFileSize(512), '1 KB');
  assert.equal(formatFileSize(1_572_864), '1.5 MB');
});
