import assert from 'node:assert/strict'; import {readFile} from 'node:fs/promises';
const schema=JSON.parse(await readFile(new URL('../packages/contracts/schemas/editorial-style-profile.v1.json',import.meta.url),'utf8'));
assert.equal(schema.additionalProperties,false); assert.equal(schema.properties.schemaVersion.const,'1.0');
assert.deepEqual(schema.properties.status.enum,['draft','approved','archived']);
assert.equal(schema.properties.brandAuthority.properties.videoStyleDnaDocument.additionalProperties,false);
assert.equal(schema.properties.movement.properties.movementPreferenceWeight.maximum,1);
assert.equal(schema.properties.transitions.properties.maxNonCutTransitionRatio.maximum,1);
const text=JSON.stringify(schema); for(const forbidden of ['brandCopy','visualIdentity','toneOfVoice']) assert.equal(text.includes(forbidden),false);
console.log('PASS: editorial style profile v1 JSON Schema authority markers verified');
