import { describe, expect, it } from 'vitest';

import {
  EXPERIMENT_REGISTRY_SCHEMA_VERSION,
  type ExperimentRegistryRevisionV1,
} from '../../contracts/src/experiment-registry.contract.js';
import {
  ExperimentRegistryPersistenceInvariantError,
  InMemoryExperimentRegistryStore,
  sameImmutableExperimentRevision,
} from './index.js';

function validRevision(overrides: Partial<ExperimentRegistryRevisionV1> = {}): ExperimentRegistryRevisionV1 {
  return {
    schemaVersion: EXPERIMENT_REGISTRY_SCHEMA_VERSION,
    experimentId: 'experiment:phase9-editorial-brain-v2',
    revisionId: 'experiment-revision:v1',
    benchmarkControl: {
      benchmarkId: 'phase8-editorial-quality',
      benchmarkRevisionId: 'phase8-editorial-quality-baseline:v1',
      controlRevisionId: 'editorial-plan-control:r1',
      fixtureRevisionId: 'phase8-editorial-quality-fixture:v1',
    },
    candidate: {
      policy: {
        policyId: 'editorial-brain-planning-policy',
        policyRevisionId: 'editorial-brain-planning-policy:v1',
      },
      model: {
        modelId: 'editorial-brain-local',
        modelVersion: '1.0.0',
      },
      prompt: {
        promptId: 'editorial-brain-plan',
        promptVersion: '1.0.0',
      },
      executionProfile: {
        profileId: 'editorial-brain-deterministic',
        profileVersion: '1.0.0',
      },
    },
    evaluation: {
      evaluationPolicyId: 'editorial-quality-evaluation-policy',
      evaluationPolicyVersion: '1.0.0',
      resultId: 'phase8-editorial-brain-quality-evaluation',
      resultRevisionId: 'phase8-editorial-brain-quality-evaluation:v1',
      resultArtifactId: 'benchmark:phase8-editorial-brain-quality-evaluation:v1',
      resultSha256: 'a'.repeat(64),
    },
    startedAt: '2026-08-27T10:00:00.000Z',
    completedAt: '2026-08-27T10:01:00.000Z',
    createdAt: '2026-08-27T10:01:01.000Z',
    ...overrides,
  };
}

describe('experiment registry persistence', () => {
  it('registers immutable experiment evidence and returns deep defensive copies', () => {
    const store = new InMemoryExperimentRegistryStore();
    const candidate = validRevision();

    const first = store.registerRevision(candidate);
    expect(first.created).toBe(true);

    first.revision.benchmarkControl.benchmarkRevisionId = 'mutated';
    first.revision.candidate.model.modelVersion = 'mutated';
    first.revision.evaluation.resultSha256 = 'b'.repeat(64);

    expect(store.getRevision(candidate.revisionId)).toEqual(validRevision());
  });

  it('treats exact semantic re-registration as idempotent', () => {
    const store = new InMemoryExperimentRegistryStore();
    expect(store.registerRevision(validRevision()).created).toBe(true);

    const second = store.registerRevision(validRevision());
    expect(second.created).toBe(false);
    expect(second.revision).toEqual(validRevision());
  });

  it('fails closed when benchmark or control evidence changes under the same revisionId', () => {
    const store = new InMemoryExperimentRegistryStore();
    store.registerRevision(validRevision());

    const changed = validRevision();
    changed.benchmarkControl = {
      ...changed.benchmarkControl,
      benchmarkRevisionId: 'phase8-editorial-quality-baseline:v2',
    };

    expect(() => store.registerRevision(changed))
      .toThrow(ExperimentRegistryPersistenceInvariantError);
    expect(store.getRevision(changed.revisionId)?.benchmarkControl.benchmarkRevisionId)
      .toBe('phase8-editorial-quality-baseline:v1');
  });

  it('fails closed when candidate registry identities change', () => {
    const store = new InMemoryExperimentRegistryStore();
    store.registerRevision(validRevision());

    const changedModel = validRevision();
    changedModel.candidate = {
      ...changedModel.candidate,
      model: { ...changedModel.candidate.model, modelVersion: '1.1.0' },
    };
    expect(() => store.registerRevision(changedModel))
      .toThrow(ExperimentRegistryPersistenceInvariantError);

    const changedPrompt = validRevision();
    changedPrompt.candidate = {
      ...changedPrompt.candidate,
      prompt: { promptId: 'editorial-brain-plan', promptVersion: '2.0.0' },
    };
    expect(() => store.registerRevision(changedPrompt))
      .toThrow(ExperimentRegistryPersistenceInvariantError);

    const withoutPrompt = validRevision();
    withoutPrompt.candidate = {
      policy: { ...withoutPrompt.candidate.policy },
      model: { ...withoutPrompt.candidate.model },
      executionProfile: { ...withoutPrompt.candidate.executionProfile },
    };
    expect(() => store.registerRevision(withoutPrompt))
      .toThrow(ExperimentRegistryPersistenceInvariantError);
  });

  it('fails closed when evaluation/result evidence or timestamps change', () => {
    const store = new InMemoryExperimentRegistryStore();
    store.registerRevision(validRevision());

    const changedResult = validRevision();
    changedResult.evaluation = {
      ...changedResult.evaluation,
      resultSha256: 'c'.repeat(64),
    };
    expect(() => store.registerRevision(changedResult))
      .toThrow(ExperimentRegistryPersistenceInvariantError);

    expect(() => store.registerRevision(validRevision({ completedAt: '2026-08-27T10:02:00.000Z' })))
      .toThrow(ExperimentRegistryPersistenceInvariantError);
    expect(() => store.registerRevision(validRevision({ createdAt: '2026-08-27T10:02:01.000Z' })))
      .toThrow(ExperimentRegistryPersistenceInvariantError);
  });

  it('requires a new revision for an experiment upgrade and preserves history', () => {
    const store = new InMemoryExperimentRegistryStore();
    store.registerRevision(validRevision());

    const next = validRevision({
      revisionId: 'experiment-revision:v2',
      candidate: {
        ...validRevision().candidate,
        model: { ...validRevision().candidate.model, modelVersion: '1.1.0' },
      },
      evaluation: {
        ...validRevision().evaluation,
        resultRevisionId: 'phase8-editorial-brain-quality-evaluation:v2',
        resultArtifactId: 'benchmark:phase8-editorial-brain-quality-evaluation:v2',
        resultSha256: 'd'.repeat(64),
      },
      startedAt: '2026-08-27T10:03:00.000Z',
      completedAt: '2026-08-27T10:04:00.000Z',
      createdAt: '2026-08-27T10:04:01.000Z',
    });

    expect(store.registerRevision(next).created).toBe(true);
    expect(store.getRevision('experiment-revision:v1')?.candidate.model.modelVersion).toBe('1.0.0');
    expect(store.getRevision('experiment-revision:v2')?.candidate.model.modelVersion).toBe('1.1.0');
  });

  it('rejects invalid evidence before persistence and compares complete immutable semantics', () => {
    const store = new InMemoryExperimentRegistryStore();
    const invalid = validRevision();
    invalid.evaluation = { ...invalid.evaluation, resultSha256: 'not-a-digest' };

    expect(() => store.registerRevision(invalid))
      .toThrow(ExperimentRegistryPersistenceInvariantError);
    expect(store.getRevision(invalid.revisionId)).toBeUndefined();

    expect(sameImmutableExperimentRevision(validRevision(), validRevision())).toBe(true);
    expect(sameImmutableExperimentRevision(
      validRevision(),
      validRevision({ startedAt: '2026-08-27T10:00:01.000Z' }),
    )).toBe(false);
  });
});
