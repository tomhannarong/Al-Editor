import { describe, expect, it } from 'vitest';
import { frameToMicroseconds, frameToSourcePts, microsecondsToFrame, sourcePtsToFrame, sourcePtsToMicroseconds } from './index.js';

const RATES = [
  { numerator: 24, denominator: 1 }, { numerator: 25, denominator: 1 }, { numerator: 30, denominator: 1 },
  { numerator: 50, denominator: 1 }, { numerator: 60, denominator: 1 },
  { numerator: 24000, denominator: 1001 }, { numerator: 30000, denominator: 1001 }, { numerator: 60000, denominator: 1001 },
] as const;
const VIDEO_TIME_BASE = { numerator: 1, denominator: 90000 } as const;

describe('central media-time authority', () => {
  it.each(RATES)('round-trips absolute frame positions without one-frame drift: $numerator/$denominator', (rate) => {
    const tenMinuteFrame = Math.round((600 * rate.numerator) / rate.denominator);
    const pts = frameToSourcePts(tenMinuteFrame, rate, VIDEO_TIME_BASE, 'nearest-half-away-from-zero');
    expect(sourcePtsToFrame(pts, VIDEO_TIME_BASE, rate, 'nearest-half-away-from-zero')).toBe(tenMinuteFrame);
  });
  it('maps non-zero native PTS without assuming stream starts at zero', () => {
    expect(sourcePtsToMicroseconds(900000, VIDEO_TIME_BASE, 'nearest-half-away-from-zero')).toBe(10_000_000);
    expect(sourcePtsToFrame(900000, VIDEO_TIME_BASE, { numerator: 30, denominator: 1 }, 'nearest-half-away-from-zero')).toBe(300);
  });
  it('uses explicit floor/ceil boundaries', () => {
    expect(frameToMicroseconds(1, { numerator: 24, denominator: 1 }, 'floor')).toBe(41666);
    expect(frameToMicroseconds(1, { numerator: 24, denominator: 1 }, 'ceil')).toBe(41667);
  });
  it('round-trips microseconds at exact integer-rate frame boundaries', () => {
    const us = frameToMicroseconds(300, { numerator: 30, denominator: 1 }, 'nearest-half-away-from-zero');
    expect(microsecondsToFrame(us, { numerator: 30, denominator: 1 }, 'nearest-half-away-from-zero')).toBe(300);
  });
});
