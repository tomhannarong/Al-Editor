import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../packages/contracts/src/renderer-adapter.contract.ts', import.meta.url), 'utf8');
const markers = [
  "timingAuthority: 'canonical-timeline'",
  "sourcePathPolicy: 'confined-resolved-paths-only'",
  "complianceAuthority: 'ffmpeg-ffprobe'",
  'Readonly<TTimeline>',
  'manifestSha256',
  'renderPlanSha256',
  "['ffmpeg', 'remotion', 'otio']",
];
const missing = markers.filter((marker) => !source.includes(marker));
if (missing.length) {
  console.error(`FAIL: renderer boundary missing markers: ${missing.join(', ')}`);
  process.exit(1);
}
console.log(`PASS: renderer-neutral boundary markers verified (${markers.length} markers)`);
