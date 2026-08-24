import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const schema=JSON.parse(readFileSync(new URL('../packages/contracts/schemas/ai-model-registry.v1.json',import.meta.url),'utf8'));
assert.equal(schema.$id,'https://ai-editor.local/schemas/ai-model-registry.v1.json');
for(const name of ['promptEntry','modelEntry','localArtifact','providerArtifact','executionProfile']) assert.ok(schema.$defs?.[name],`missing $defs.${name}`);
assert.deepEqual(schema.$defs.version.not.enum,['latest','main','master','stable','default','current']);
assert.equal(schema.$defs.localArtifact.properties.artifactSha256.$ref,'#/$defs/sha256');
assert.equal(schema.$defs.providerArtifact.required.includes('termsEvidence'),true);
console.log('PASS: model registry JSON Schema authority markers verified');
