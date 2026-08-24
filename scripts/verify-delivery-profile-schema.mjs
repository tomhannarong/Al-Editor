import assert from 'node:assert/strict'; import {readFileSync} from 'node:fs';
const schema=JSON.parse(readFileSync(new URL('../packages/contracts/schemas/delivery-profile.v1.json',import.meta.url),'utf8'));
assert.equal(schema.$id,'https://ai-editor.local/schemas/delivery-profile.v1.json'); assert.equal(schema.properties.schemaVersion.const,'1.0');
for (const key of ['frameRate','colorPrimaries','colorTransfer','colorMatrix','colorRange','hdrPolicy']) assert.ok(schema.properties.video.properties[key],`missing video.${key}`);
for (const key of ['integratedLufsTarget','truePeakDbtpMax']) assert.ok(schema.properties.audio.properties[key],`missing audio.${key}`);
for (const key of ['mode','safeAreaPercent','sidecarFormat']) assert.ok(schema.properties.captions.properties[key],`missing captions.${key}`);
console.log('PASS: delivery profile JSON Schema authority markers verified');
