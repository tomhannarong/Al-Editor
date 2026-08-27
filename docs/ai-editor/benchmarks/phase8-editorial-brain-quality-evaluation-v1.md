# Phase 8 Editorial Brain same-fixture quality evaluation v1

**Benchmark revision:** `phase8-editorial-brain-quality-evaluation:v1`  
**Frozen control:** `phase8-editorial-quality-baseline:v1`  
**Fixture:** `phase8-editorial-quality-fixture:v1`  
**Style Profile:** `travel-soft-v1` / `1.0.0`  
**Planning policy:** `editorial-brain-travel-v1:r1`  
**Evaluation policy:** `editorial-quality-evaluation-policy:v1`

This benchmark evaluates the actual deterministic Editorial Brain execution output against the exact immutable Phase-8 control fixture. It does not move the control fixture, change the Style Profile, or introduce a new timing authority.

## Control plan

- plan revision: `plan-a:r1`
- pacing score: `0.6111111111111112` (`11/18`)
- continuity score: `0.5`
- variety score: `0.0`
- repeat rate: `0.3333333333333333` (`1/3`)

## Planner after-plan

- plan revision: `plan-a:r2`
- selected scenes: `scene-a`, `scene-b`, `scene-c`
- project-frame spans at `30/1` FPS: `[0,30)`, `[30,90)`, `[90,150)`
- pacing score: `1.0`
- continuity score: `1.0`
- variety score: `1.0`
- repeat rate: `0.0`

## Same-fixture deltas

- pacing delta: `+0.3888888888888889` (`+7/18`)
- continuity delta: `+0.5`
- variety delta: `+1.0`
- repeat-rate delta: `-0.3333333333333333` (`-1/3`)

All four explicit Phase-8 gate directions improve on the same frozen fixture: pacing improves, continuity improves, variety improves, and repeat rate decreases.

The benchmark is deterministic evidence for this exact policy/fixture pair, not a claim that these absolute values generalize to unseen footage. Broader benchmark coverage belongs to Phase 9 evaluation and regression work.
