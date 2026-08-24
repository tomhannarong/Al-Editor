import { normalizeCanonicalRational, type CanonicalRational } from '../../contracts/src/canonical-timeline.contract.js';

export const CANONICAL_ROUNDING_MODES = ['floor', 'ceil', 'nearest-half-away-from-zero'] as const;
export type CanonicalRoundingMode = (typeof CANONICAL_ROUNDING_MODES)[number];

const MICROSECONDS_PER_SECOND = 1_000_000n;
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE_BIGINT = BigInt(Number.MIN_SAFE_INTEGER);

function assertSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${name} must be a safe integer`);
}
function asBigIntSafeInteger(value: number, name: string): bigint {
  assertSafeInteger(value, name);
  return BigInt(value);
}
function normalizedParts(value: CanonicalRational): [bigint, bigint] {
  const normalized = normalizeCanonicalRational(value);
  return [BigInt(normalized.numerator), BigInt(normalized.denominator)];
}
function divideRounded(numerator: bigint, denominator: bigint, mode: CanonicalRoundingMode): bigint {
  if (denominator <= 0n) throw new RangeError('denominator must be greater than zero');
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder === 0n) return quotient;
  if (mode === 'floor') return numerator < 0n ? quotient - 1n : quotient;
  if (mode === 'ceil') return numerator > 0n ? quotient + 1n : quotient;
  const absoluteRemainder = remainder < 0n ? -remainder : remainder;
  if (absoluteRemainder * 2n < denominator) return quotient;
  return numerator < 0n ? quotient - 1n : quotient + 1n;
}
function toSafeNumber(value: bigint, name: string): number {
  if (value < MIN_SAFE_BIGINT || value > MAX_SAFE_BIGINT) throw new RangeError(`${name} exceeds the JavaScript safe-integer range`);
  return Number(value);
}

export function frameToMicroseconds(frame: number, frameRate: CanonicalRational, rounding: CanonicalRoundingMode): number {
  const frameValue = asBigIntSafeInteger(frame, 'frame');
  const [rateNumerator, rateDenominator] = normalizedParts(frameRate);
  return toSafeNumber(divideRounded(frameValue * rateDenominator * MICROSECONDS_PER_SECOND, rateNumerator, rounding), 'microseconds');
}

export function microsecondsToFrame(microseconds: number, frameRate: CanonicalRational, rounding: CanonicalRoundingMode): number {
  const value = asBigIntSafeInteger(microseconds, 'microseconds');
  const [rateNumerator, rateDenominator] = normalizedParts(frameRate);
  return toSafeNumber(divideRounded(value * rateNumerator, MICROSECONDS_PER_SECOND * rateDenominator, rounding), 'frame');
}

export function sourcePtsToMicroseconds(pts: number, timeBase: CanonicalRational, rounding: CanonicalRoundingMode): number {
  const ptsValue = asBigIntSafeInteger(pts, 'pts');
  const [tbNum, tbDen] = normalizedParts(timeBase);
  return toSafeNumber(divideRounded(ptsValue * tbNum * MICROSECONDS_PER_SECOND, tbDen, rounding), 'microseconds');
}

export function microsecondsToSourcePts(microseconds: number, timeBase: CanonicalRational, rounding: CanonicalRoundingMode): number {
  const value = asBigIntSafeInteger(microseconds, 'microseconds');
  const [tbNum, tbDen] = normalizedParts(timeBase);
  return toSafeNumber(divideRounded(value * tbDen, MICROSECONDS_PER_SECOND * tbNum, rounding), 'pts');
}

export function frameToSourcePts(frame: number, frameRate: CanonicalRational, targetTimeBase: CanonicalRational, rounding: CanonicalRoundingMode): number {
  const frameValue = asBigIntSafeInteger(frame, 'frame');
  const [rateNum, rateDen] = normalizedParts(frameRate);
  const [tbNum, tbDen] = normalizedParts(targetTimeBase);
  return toSafeNumber(divideRounded(frameValue * rateDen * tbDen, rateNum * tbNum, rounding), 'pts');
}

export function sourcePtsToFrame(pts: number, sourceTimeBase: CanonicalRational, frameRate: CanonicalRational, rounding: CanonicalRoundingMode): number {
  const ptsValue = asBigIntSafeInteger(pts, 'pts');
  const [tbNum, tbDen] = normalizedParts(sourceTimeBase);
  const [rateNum, rateDen] = normalizedParts(frameRate);
  return toSafeNumber(divideRounded(ptsValue * tbNum * rateNum, tbDen * rateDen, rounding), 'frame');
}
