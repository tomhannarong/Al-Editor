import { describe, expect, it } from 'vitest';

import {
  REGRESSION_GATE_SCHEMA_VERSION,
  passesRegressionMetricRuleV1,
  validateRegressionGateRevisionV1,
  type RegressionGateRevisionV1,
  type RegressionMetricRuleV1,
} from './regression-gate.contract.js';

const RESULT_SHA = 'b'.repeat(64);

function validRevision(): RegressionGateRevisionV1 {
  return {
    schemaVersion: REGRESSION_GATE_SCHEMA_VERSION,
    gateId: 'phase9:editorial-quality-regression',
    revisionId: 'phase9:editorial-quality-regression:r1',
    benchmarkControl: {
      benchmarkId: 'phase8-editorial-brain-quality-evaluation',
      benchmarkRevisionId: 'phase8-editorial-brain-quality-evaluation:v1',
      controlRevisionId: 'phase8-editorial-quality-baseline:v1',
      fixtureRevisionId: 'phase8-editorial-quality-fixture:v1',
    },
    candidate: {
      experimentId: 'phase9:editorial-brain-quality',
      experimentRevisionId: 'phase9:editorial-brain-quality:r1',
      resultId: 'phase8-editorial-brain-quality-result',
      resultRevisionId: 'phase8-editorial-brain-quality-result:v1',
      resultSha256: RESULT_SHA,
    },
    metrics: [
      {
        metricId: 'pacing-score',
        direction: 'higher-is-better',
        tolerance: { kind: 'absolute', maxRegression: 0.01 },
      },
      {
        metricId: 'repeat-rate',
        direction: 'lower-is-better',
        tolerance: { kind: 'absolute', maxRegression: 0 },
      },
    ],
    createdAt: '2026-08-27T13:20:00.000Z',
  };
}

describe('regression gate contract', () => {
  it('accepts a versioned gate pinned to exact benchmark/control and experiment result evidence', () => {
    expect(validateRegressionGateRevisionV1(validRevision())).toEqual({ valid: true, errors: [] });
  });

  it('rejects mutable aliases and malformed result evidence', () => {
    const revision = validRevision();
    revision.revisionId = 'latest';
    revision.benchmarkControl.benchmarkRevisionId = 'main';
    revision.benchmarkControl.controlRevisionId = 'current';
    revision.candidate.experimentRevisionId = 'stable';
    revision.candidate.resultRevisionId = 'head';
    revision.candidate.resultSha256 = 'not-a-digest';

    const result = validateRegressionGateRevisionV1(revision);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('revisionId must be pinned and must not use a mutable alias');
    expect(result.errors).toContain('benchmarkControl.benchmarkRevisionId must be pinned and must not use a mutable alias');
    expect(result.errors).toContain('benchmarkControl.controlRevisionId must be pinned and must not use a mutable alias');
    expect(result.errors).toContain('candidate.experimentRevisionId must be pinned and must not use a mutable alias');
    expect(result.errors).toContain('candidate.resultRevisionId must be pinned and must not use a mutable alias');
    expect(result.errors).toContain('candidate.resultSha256 must be a SHA-256 hex digest');
  });

  it('requires unique metric identities and finite non-negative absolute tolerances', () => {
    const revision = validRevision();
    revision.metrics = [
      revision.metrics[0]!,
      {
        metricId: 'pacing-score',
        direction: 'higher-is-better',
        tolerance: { kind: 'absolute', maxRegression: -0.1 },
      },
    ];

    const result = validateRegressionGateRevisionV1(revision);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('metrics[1].metricId must be unique');
    expect(result.errors).toContain('metrics[1].tolerance.maxRegression must be a finite non-negative number');
  });

  it('defines higher-is-better tolerance as candidate >= control - maxRegression', () => {
    const rule: RegressionMetricRuleV1 = {
      metricId: 'recall-at-10',
      direction: 'higher-is-better',
      tolerance: { kind: 'absolute', maxRegression: 0.02 },
    };

    expect(passesRegressionMetricRuleV1(rule, 0.9, 0.88)).toBe(true);
    expect(passesRegressionMetricRuleV1(rule, 0.9, 0.879)).toBe(false);
  });

  it('defines lower-is-better tolerance as candidate <= control + maxRegression', () => {
    const rule: RegressionMetricRuleV1 = {
      metricId: 'repeat-rate',
      direction: 'lower-is-better',
      tolerance: { kind: 'absolute', maxRegression: 0.01 },
    };

    expect(passesRegressionMetricRuleV1(rule, 0.1, 0.11)).toBe(true);
    expect(passesRegressionMetricRuleV1(rule, 0.1, 0.111)).toBe(false);
  });

  it('fails closed for non-finite measurement values', () => {
    const rule = validRevision().metrics[0]!;
    expect(passesRegressionMetricRuleV1(rule, Number.NaN, 1)).toBe(false);
    expect(passesRegressionMetricRuleV1(rule, 1, Number.POSITIVE_INFINITY)).toBe(false);
  });
});
