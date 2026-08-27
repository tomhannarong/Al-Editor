import { describe, expect, it } from 'vitest';
import type { RegressionGateRevisionV1 } from '../../contracts/src/regression-gate.contract.js';
import {
  executeRegressionGateV1,
  RegressionGateExecutionInvariantError,
  type RegressionCandidateMetricEvidenceV1,
  type RegressionControlMetricEvidenceV1,
} from './execution.js';

const sha = 'a'.repeat(64);

const gate: RegressionGateRevisionV1 = {
  schemaVersion: '1.0',
  gateId: 'phase9-regression-gate',
  revisionId: 'phase9-regression-gate:r1',
  benchmarkControl: {
    benchmarkId: 'phase8-editorial-quality',
    benchmarkRevisionId: 'phase8-editorial-quality:v1',
    controlRevisionId: 'plan-a:r1',
    fixtureRevisionId: 'phase8-editorial-quality-fixture:v1',
  },
  candidate: {
    experimentId: 'editorial-brain-experiment',
    experimentRevisionId: 'editorial-brain-experiment:r2',
    resultId: 'editorial-quality-result',
    resultRevisionId: 'editorial-quality-result:r2',
    resultSha256: sha,
  },
  metrics: [
    {
      metricId: 'pacing-score',
      direction: 'higher-is-better',
      tolerance: { kind: 'absolute', maxRegression: 0.02 },
    },
    {
      metricId: 'repeat-rate',
      direction: 'lower-is-better',
      tolerance: { kind: 'absolute', maxRegression: 0.01 },
    },
  ],
  createdAt: '2026-08-27T14:00:00.000Z',
};

const control: RegressionControlMetricEvidenceV1 = {
  benchmarkControl: { ...gate.benchmarkControl },
  metrics: [
    { metricId: 'pacing-score', value: 0.8 },
    { metricId: 'repeat-rate', value: 0.2 },
  ],
};

const candidate: RegressionCandidateMetricEvidenceV1 = {
  benchmarkControl: { ...gate.benchmarkControl },
  candidate: { ...gate.candidate },
  metrics: [
    { metricId: 'pacing-score', value: 0.79 },
    { metricId: 'repeat-rate', value: 0.21 },
  ],
};

describe('executeRegressionGateV1', () => {
  it('emits a deterministic pass when every metric is within its explicit tolerance', () => {
    const decision = executeRegressionGateV1(gate, control, candidate);

    expect(decision.passed).toBe(true);
    expect(decision.failedMetricIds).toEqual([]);
    expect(decision.metricDecisions).toEqual([
      {
        metricId: 'pacing-score',
        direction: 'higher-is-better',
        controlValue: 0.8,
        candidateValue: 0.79,
        maxRegression: 0.02,
        boundaryValue: 0.78,
        passed: true,
      },
      {
        metricId: 'repeat-rate',
        direction: 'lower-is-better',
        controlValue: 0.2,
        candidateValue: 0.21,
        maxRegression: 0.01,
        boundaryValue: 0.21000000000000002,
        passed: true,
      },
    ]);
    expect(decision.candidateResultSha256).toBe(sha);
  });

  it('emits a structured fail and preserves gate metric order', () => {
    const failing: RegressionCandidateMetricEvidenceV1 = {
      ...candidate,
      metrics: [
        { metricId: 'repeat-rate', value: 0.25 },
        { metricId: 'pacing-score', value: 0.7 },
      ],
    };

    const decision = executeRegressionGateV1(gate, control, failing);

    expect(decision.passed).toBe(false);
    expect(decision.failedMetricIds).toEqual(['pacing-score', 'repeat-rate']);
    expect(decision.metricDecisions.map((metric) => metric.metricId)).toEqual([
      'pacing-score',
      'repeat-rate',
    ]);
  });

  it('fails closed when benchmark/control or candidate result identity does not match the gate', () => {
    expect(() => executeRegressionGateV1(gate, {
      ...control,
      benchmarkControl: { ...control.benchmarkControl, controlRevisionId: 'other-control:r1' },
    }, candidate)).toThrow(RegressionGateExecutionInvariantError);

    expect(() => executeRegressionGateV1(gate, control, {
      ...candidate,
      candidate: { ...candidate.candidate, resultRevisionId: 'other-result:r1' },
    })).toThrow(RegressionGateExecutionInvariantError);
  });

  it('fails closed on missing, duplicate, unexpected, or non-finite metric evidence', () => {
    expect(() => executeRegressionGateV1(gate, {
      ...control,
      metrics: [{ metricId: 'pacing-score', value: 0.8 }],
    }, candidate)).toThrow(/missing repeat-rate/);

    expect(() => executeRegressionGateV1(gate, control, {
      ...candidate,
      metrics: [
        { metricId: 'pacing-score', value: 0.79 },
        { metricId: 'pacing-score', value: 0.8 },
        { metricId: 'repeat-rate', value: 0.21 },
      ],
    })).toThrow(/duplicate metric pacing-score/);

    expect(() => executeRegressionGateV1(gate, control, {
      ...candidate,
      metrics: [
        { metricId: 'pacing-score', value: 0.79 },
        { metricId: 'repeat-rate', value: 0.21 },
        { metricId: 'latency-p95', value: 20 },
      ],
    })).toThrow(/unexpected metric latency-p95/);

    expect(() => executeRegressionGateV1(gate, control, {
      ...candidate,
      metrics: [
        { metricId: 'pacing-score', value: Number.NaN },
        { metricId: 'repeat-rate', value: 0.21 },
      ],
    })).toThrow(/pacing-score must be finite/);
  });

  it('fails closed before execution when the gate contract itself is invalid', () => {
    const invalidGate = {
      ...gate,
      metrics: [],
    };

    expect(() => executeRegressionGateV1(invalidGate, control, candidate)).toThrow(
      /invalid regression gate revision/,
    );
  });
});
