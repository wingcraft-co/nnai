import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildGuideExportFilename,
  markdownToCanvasLines,
} from './guide-export.mjs';

test('normalizes markdown headings and bullets for canvas rendering', () => {
  const lines = markdownToCanvasLines('# 방콕 가이드\n\n## 비자\n- 여권\n일반 문장');

  assert.deepEqual(lines, ['방콕 가이드', '비자', '• 여권', '일반 문장']);
});

test('limits very long canvas source by preserving line order', () => {
  const lines = markdownToCanvasLines('a\n\nb\n\nc');

  assert.deepEqual(lines, ['a', 'b', 'c']);
});

test('builds safe export filename from city label', () => {
  assert.equal(buildGuideExportFilename('방콕 / Bangkok', 'md'), 'nnai-bangkok-guide.md');
  assert.equal(buildGuideExportFilename('', 'png'), 'nnai-guide.png');
});
