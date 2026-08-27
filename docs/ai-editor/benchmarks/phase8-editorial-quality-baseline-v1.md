# Phase-8 Editorial Quality Baseline v1

## Authority

- Benchmark revision: `phase8-editorial-quality-baseline:v1`
- Immutable fixture revision: `phase8-editorial-quality-fixture:v1`
- Control plan: `plan-a:r1`
- Evaluation policy: `editorial-quality-evaluation-policy:v1`
- Style profile: `travel-soft-v1` / `1.0.0`
- Project frame rate: `30/1`

This document freezes the first Phase-8 control measurement before any Editorial Brain/planning policy is introduced or accepted. It is a baseline measurement, not an acceptance threshold.

## Immutable control plan

The control uses three ordered, non-overlapping project-frame shots:

| Shot | Source scene | Shot type | Movement | Continuity group | Frames |
|---|---|---|---|---|---:|
| `shot-1` | `scene-a` | `wide` | `static` | `location-a` | `0..90` |
| `shot-2` | `scene-a` | `wide` | `static` | `location-b` | `90..180` |
| `shot-3` | `scene-c` | `wide` | `static` | `location-b` | `180..270` |

Project timing remains integer frames + rational FPS. Style-profile millisecond duration preferences are used only as transient comparison preferences by the verified P8-02 evaluator and are not persisted as canonical timing authority.

## Baseline measurement

Exact deterministic control values:

| Metric | Baseline |
|---|---:|
| Pacing score | `0.6111111111111112` (`11/18`) |
| Pacing within-bounds rate | `1.0` |
| Continuity score | `0.5` |
| Variety score | `0.0` |
| Shot-type change rate | `0.0` |
| Movement change rate | `0.0` |
| Repeat rate | `0.3333333333333333` (`1/3`) |
| Repeated shot count | `1` |
| Shot count | `3` |

The control is intentionally imperfect: the first hook shot is longer than the style target, continuity breaks once, adjacent shot type/movement never varies, and one immutable source scene repeats. These characteristics make later same-fixture improvements measurable without changing the benchmark to manufacture a win.

## Comparison rule

Any Phase-8 improvement claim must use the verified evaluator and compare a distinct immutable plan revision against this exact fixture revision and exact Style Profile authority. The benchmark itself does not set a minimum delta. Pacing, continuity and variety must be reported separately, and repeat rate must remain a separate lower-is-better metric.

A planner, scoring policy, prompt or model upgrade is not accepted merely because it exists. Before/after evidence on this control is required by the Project Bible.
