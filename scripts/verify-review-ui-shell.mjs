import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../apps/studio/index.html', import.meta.url), 'utf8');
const required = [
  'data-role="review-shell"',
  'data-role="preview-viewport"',
  'data-role="timeline-review"',
  'data-role="review-actions"',
  'data-action="replace"',
  'data-action="trim"',
  'data-action="lock"',
  'data-action="create-revision"',
  'data-role="revision-evidence"',
  'data-role="decision-evidence"',
  'data-field="revision-id"',
  'data-field="schema-version"',
  'data-field="frame-rate"',
  'data-field="manifest-sha256"',
];

const missing = required.filter((marker) => !html.includes(marker));
if (missing.length > 0) {
  console.error(`FAIL: review UI shell is missing required markers: ${missing.join(', ')}`);
  process.exit(1);
}

if (!html.includes('this shell does not own canonical timing')) {
  console.error('FAIL: review shell must state that canonical timing authority is external.');
  process.exit(1);
}

console.log(`PASS: review UI shell contract markers verified (${required.length} markers)`);
