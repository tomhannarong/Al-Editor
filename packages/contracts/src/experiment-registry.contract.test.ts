import { describe, expect, it } from 'vitest';

import {
  EXPERIMENT_REGISTRY_SCHEMA_VERSION,
  validateExperimentRegistryRevisionV1,
  type ExperimentRegistryRevisionV1,
} from './experiment-registry.contract.js';

const RESULT_SHA = 'a'.repeat(64);

function validRevision(): ExperimentRegistryRevisionV1 {
  return {
    schemaVersion: EXPERIMENT_REGISTRY_SCHEMA_VERSION,
    experimentId: 'phase9:editorial-brain-quality',
    revisionId: 'phase9:editorial-brain-quality:r1',
    benchmarkControl: {
      benchmarkId: 'phase8-editorial-brain-quality-evaluation',
      benchmarkRevisionId: 'phase8-editorial-brain-quality-evaluation:v1',
      controlRevisionId: 'phase8-editorial-quality-baseline:v1',
      fixtureRevisionId: 'phase8-editorial-quality-fixture:v1',
    },
    candidate: {
      policy: {
        policyId: 'editorial-brain:travel-soft:v1',
        policyRevisionId: 'editorial-brain:travel-soft:v1:r1',
      },
      model: {
        modelId: 'editorial-brain-deterministic-planner',
        modelVersion: '1.0.0',
      },
      prompt: {
        promptId: 'editorial-brain-planning',
        promptVersion: '1.0.0',
      },
      executionProfile: {
        profileId: 'editorial-brain-local-deterministic',
        profileVersion: '1.0.0',
      },
    },
    evaluation: {
      evaluationPolicyId: 'editorial-quality-evaluation-policy',
      evaluationPolicyVersion: 'v1',
      resultId: 'phase8-editorial-brain-quality-result',
      resultRevisionId: 'phase8-editorial-brain-quality-result:v1',
      resultArtifactId: 'benchmark-result:phase8-editorial-brain-quality:v1',
      resultSha256: RESULT_SHA,
    },
    startedAt: '2026-08-27T10:08:00.000Z',
    completedAt: '2026-08-27T10:09:00.000Z',
    createdAt: '2026-08-27T10:09:10.000Z',
  };
}

describe('experiment registry contract', () => {
  it('accepts an immutable experiment revision pinned to benchmark, candidate registry identities and result evidence', () => {
    expect(validateExperimentRegistryRevisionV1(validRevision())).toEqual({ valid: true, errors: [] });
  });

  it('rejects mutable aliases across benchmark, candidate and evaluation identities', () => {
    const revision = validRevision();
    revision.revisionId = 'latest';
    revision.benchmarkControl.benchmarkRevisionId = 'main';
    revision.candidate.policy.policyRevisionId = 'current';
    revision.candidate.model.modelVersion = 'stable';
    revision.candidate.executionProfile.profileVersion = 'default';
    revision.evaluation.resultRevisionId = 'head';

    const result = validateExperimentRegistryRevisionV1(revision);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('revisionId must be pinned and must not use a mutable alias');
    expect(result.errors).toContain('benchmarkControl.benchmarkRevisionId must be pinned and must not use a mutable alias');
    expect(result.errors).toContain('candidate.policy.policyRevisionId must be pinned and must not use a mutable alias');
    expect(result.errors).toContain('candidate.model.modelVersion must be pinned and must not use a mutable alias');
    expect(result.errors).toContain('candidate.executionProfile.profileVersion must be pinned and must not use a mutable alias');
    expect(result.errors).toContain('evaluation.resultRevisionId must be pinned and must not use a mutable alias');
  });

  it('requires immutable result artifact evidence', () => {
    const revision = validRevision();
    revision.evaluation.resultSha256 = 'not-a-digest';
    revision.evaluation.resultArtifactId = ' ';

    const result = validateExperimentRegistryRevisionV1(revision);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('evaluation.resultArtifactId is required');
    expect(result.errors).toContain('evaluation.resultSha256 must be a SHA-256 hex digest');
  });

  it('requires chronological execution timestamps', () => {
    const revision = validRevision();
    revision.startedAt = '2026-08-27T10:10:00.000Z';
    revision.completedAt = '2026-08-27T10:09:00.000Z';

    const result = validateExperimentRegistryRevisionV1(revision);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('completedAt must not be earlier than startedAt');
  });

  it('keeps raw model artifacts, prompts, secrets and benchmark payloads outside the experiment registry', () => {
    const revision = validRevision();

    expect('modelArtifact' in revision.candidate).toBe(false);
    expect('promptTemplate' in revision.candidate).toBe(false);
    expect('credential' in revision.candidate).toBe(false);
    expect('benchmarkPayload' in revision).toBe(false);
    expect('resultPayload' in revision.evaluation).toBe(false);
  });
});
