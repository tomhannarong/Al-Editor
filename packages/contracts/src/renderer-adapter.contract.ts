export const RENDERER_ADAPTER_BOUNDARY_VERSION = '1.0' as const;

export const RENDERER_ADAPTER_KINDS = ['ffmpeg', 'remotion', 'otio'] as const;
export type RendererAdapterKind = (typeof RENDERER_ADAPTER_KINDS)[number];

export interface RendererTimelineIdentityV1 {
  schemaVersion: string;
  revisionId: string;
  manifestSha256: string;
}

export interface RendererOutputIdentityV1 {
  artifactId: string;
  deliveryProfileVersion: string;
}

export interface RendererAdapterRequestV1 {
  boundaryVersion: typeof RENDERER_ADAPTER_BOUNDARY_VERSION;
  adapterKind: RendererAdapterKind;
  adapterVersion: string;
  timeline: RendererTimelineIdentityV1;
  output: RendererOutputIdentityV1;
  timingAuthority: 'canonical-timeline';
  sourcePathPolicy: 'confined-resolved-paths-only';
  complianceAuthority: 'ffmpeg-ffprobe';
}

export interface RendererAdapterPlanV1 {
  boundaryVersion: typeof RENDERER_ADAPTER_BOUNDARY_VERSION;
  adapterKind: RendererAdapterKind;
  adapterVersion: string;
  revisionId: string;
  manifestSha256: string;
  artifactId: string;
  renderPlanSha256: string;
}

export interface RendererAdapterV1<TTimeline, TPlan extends RendererAdapterPlanV1> {
  readonly kind: RendererAdapterKind;
  readonly version: string;
  plan(timeline: Readonly<TTimeline>, request: Readonly<RendererAdapterRequestV1>): Readonly<TPlan>;
}

export interface RendererBoundaryValidationResult {
  valid: boolean;
  errors: string[];
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

export function validateRendererAdapterRequestV1(
  request: RendererAdapterRequestV1,
): RendererBoundaryValidationResult {
  const errors: string[] = [];
  if (request.boundaryVersion !== RENDERER_ADAPTER_BOUNDARY_VERSION) {
    errors.push('boundaryVersion must be 1.0');
  }
  if (!request.adapterVersion.trim()) {
    errors.push('adapterVersion is required');
  }
  if (!request.timeline.schemaVersion.trim() || !request.timeline.revisionId.trim()) {
    errors.push('timeline schemaVersion and revisionId are required');
  }
  if (!SHA256_PATTERN.test(request.timeline.manifestSha256)) {
    errors.push('timeline manifestSha256 must be a SHA-256 hex digest');
  }
  if (!request.output.artifactId.trim() || !request.output.deliveryProfileVersion.trim()) {
    errors.push('output artifactId and deliveryProfileVersion are required');
  }
  if (request.timingAuthority !== 'canonical-timeline') {
    errors.push('renderer cannot become timing authority');
  }
  if (request.sourcePathPolicy !== 'confined-resolved-paths-only') {
    errors.push('renderer inputs must use confined resolved paths');
  }
  if (request.complianceAuthority !== 'ffmpeg-ffprobe') {
    errors.push('final compliance authority must remain ffmpeg-ffprobe');
  }
  return { valid: errors.length === 0, errors };
}
