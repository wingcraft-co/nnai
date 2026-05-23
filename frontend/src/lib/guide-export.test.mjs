import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildGuideExportFilename,
  markdownToCanvasLines,
} from './guide-export.mjs';
import { briefingToMarkdown } from './briefing-markdown.ts';

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

test('exports the visible country briefing content as markdown', () => {
  const markdown = briefingToMarkdown({
    documentId: 'NNAI-TH-20260523-abc123',
    issuedDate: '2026-05-23',
    preparedFor: 'Free Spirit',
    classification: 'Personal Briefing',
    cityName: 'Bangkok',
    cityKr: '방콕',
    countryOfficial: 'Kingdom of Thailand',
    countryId: 'TH',
    quickFacts: {
      visa: 'DTV',
      stay: '180 days',
      monthly: '$1,300',
      taxResidency: '180 days',
    },
    sections: [
      {
        num: '1',
        title: 'Executive Summary',
        body: '방콕은 원격 근무자에게 적합합니다.[1]',
      },
      {
        num: '2',
        title: 'Cost Profile',
        table: {
          headers: ['Category', 'USD'],
          rows: [['Rent', '700']],
          sourceLabel: 'Source: Numbeo Bangkok[2]',
        },
      },
    ],
    references: [
      { num: 1, issuer: 'MOFA', title: 'Thailand Safety', url: 'overseas.mofa.go.kr', year: 2026 },
      { num: 2, issuer: 'Numbeo', title: 'Bangkok Cost', url: 'numbeo.com', year: 2026 },
    ],
  });

  assert.match(markdown, /# 방콕 정착 가이드/);
  assert.match(markdown, /Document: NNAI-TH-20260523-abc123/);
  assert.match(markdown, /- Visa: DTV/);
  assert.match(markdown, /## 1\. Executive Summary/);
  assert.match(markdown, /\| Category \| USD \|/);
  assert.match(markdown, /\[1\] MOFA\. Thailand Safety, 2026\. overseas\.mofa\.go\.kr/);
});
