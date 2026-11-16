import assert from 'node:assert/strict';
import { WEAPONS } from '../shared/data.js';
import { ENEMIES } from '../shared/expansion.js';
import { APPROVED_SAMPLES, sampleKey } from '../src/audio-samples.js';
import { readFile,writeFile } from 'node:fs/promises';
const root=new URL('../docs/audio-review/',import.meta.url);
const catalog=JSON.parse(await readFile(new URL('catalog.json',root),'utf8'));
const plan=JSON.parse(await readFile(new URL('batch-03-plan.json',root),'utf8'));
const combined=[...catalog.sounds,...plan.sounds.filter(s=>!catalog.sounds.some(c=>c.id===s.id))];
const ready=new Set(catalog.sounds.filter(s=>s.candidates.length===4).map(s=>s.id));
const get=(id,cue)=>combined.find(s=>s.cue===cue&&(s.weapon===id||s.kind===id||s.appliesTo?.includes(id)));
const coverage={weapons:[],enemies:[],shared:[]};
for(const [id,w] of Object.entries(WEAPONS)){
 const cues=w.melee?['shot','switch','weaponFlesh','weaponImpact']:['shot','reload','reloadEnd','switch','empty'];
 if(id==='flamethrower')cues.push('weaponLoop','weaponStop');
 if(id==='minigun')cues.push('weaponStart','weaponLoop','weaponStop');
 if(id==='rpg')cues.push('projectileLoop','explosion');
 if(['crossbow','railgun','tesla'].includes(id))cues.push('weaponImpact');
 const sounds=cues.map(cue=>{const sound=get(id,cue);assert.ok(sound,`${id} missing ${cue}`);return {cue,sound:sound.id,ready:ready.has(sound.id)};});
 coverage.weapons.push({id,name:w.name,sounds});
}
for(const [id,e] of Object.entries(ENEMIES)){
 const cues=['enemy','enemyAttack','enemyHurt','death'];
 if(['brute','boss'].includes(id))cues.push('warnSlam','slam');
 if(id==='boss')cues.push('boss');
 if(id==='spitter')cues.push('warnAcid','spit','acid');
 if(['goose','wheelchair','crawler'].includes(id))cues.push('enemyMove');
 const sounds=cues.map(cue=>{const sound=get(id,cue);assert.ok(sound,`${id} missing ${cue}`);return {cue,sound:sound.id,ready:ready.has(sound.id)};});
 coverage.enemies.push({id,name:e.name,sounds});
}
coverage.shared=combined.filter(s=>s.id.startsWith('shared-')).map(s=>({sound:s.id,ready:ready.has(s.id)}));
await writeFile(new URL('coverage.json',root),JSON.stringify(coverage,null,2)+'\n');
const inventory=JSON.parse(await readFile(new URL('inventory.json',root),'utf8'));
for(const type of ['weapons','enemies'])for(const entry of inventory[type]){
 const map=coverage[type].find(e=>e.id===entry.id),complete=map.sounds.every(s=>s.ready);
 const integrated=map.sounds.filter(s=>APPROVED_SAMPLES[sampleKey(s.cue,{weapon:entry.id,kind:entry.id})]).length;
 entry.status=`${integrated}/${map.sounds.length} selected sounds integrated; `+(complete?'other sounds keep existing behavior (candidates available)':'remaining candidates generating');
 entry.reviewSounds=map.sounds.map(s=>s.sound);
}
await writeFile(new URL('inventory.json',root),JSON.stringify(inventory,null,2)+'\n');
const missing=[...coverage.weapons,...coverage.enemies].flatMap(e=>e.sounds).filter(s=>!s.ready);
console.log(JSON.stringify({weapons:coverage.weapons.length,enemies:coverage.enemies.length,plannedFamilies:combined.length,readyFamilies:ready.size,missingGeneratedFamilies:[...new Set(missing.map(s=>s.sound))].length}));
if(process.argv.includes('--complete')){
 assert.equal(missing.length,0,'All required sounds must have four completed candidates');
 for(const s of plan.sounds)assert.ok(ready.has(s.id),`Missing completed family ${s.id}`);
}
