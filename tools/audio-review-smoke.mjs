import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { cp, mkdtemp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
const testRoot=await mkdtemp(resolve('.cache/audio-review-smoke-'));
await cp(resolve('docs/audio-review'),testRoot,{recursive:true});
const server=spawn(process.execPath,['tools/audio-review-server.mjs'],{env:{...process.env,AUDIO_REVIEW_ROOT:testRoot,AUDIO_REVIEW_PORT:'5191'},windowsHide:true,stdio:['ignore','pipe','pipe']});
await new Promise((done,reject)=>{
  server.stdout.once('data',done);server.once('error',reject);server.once('exit',code=>reject(Error(`Review server exited ${code}`)));
});
const origin='http://127.0.0.1:5191';
const initial=await (await fetch(`${origin}/api/decisions`)).json();
const catalog=await (await fetch(`${origin}/catalog.json`)).json();
const current=catalog.sounds.filter(s=>(s.batch||1)===(catalog.currentBatch||1));
const firstName=current[0].name;
const restore={...initial,sounds:{...initial.sounds,[current[0].id]:initial.sounds[current[0].id]||{pick:null,alternates:[],notes:'',regenerate:false}}};
let browser;
const errors=[];
try {
  browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL || 'msedge'});
  const page=await browser.newPage({viewport:{width:1440,height:1050}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);
  await page.getByText('Ready · Your choices save automatically').waitFor();
  assert.equal(await page.locator('.sound').count(),Math.min(6,current.length));
  assert.equal(await page.locator('.candidate').count(),Math.min(6,current.length)*4);
  const decode=await page.evaluate(async()=>{
    const catalog=await (await fetch('catalog.json')).json(), audio=new AudioContext();
    const result=[];
    for(const sound of catalog.sounds) for(const c of sound.candidates){
      const response=await fetch(c.file); if(!response.ok) throw Error(c.file);
      const b=await audio.decodeAudioData(await response.arrayBuffer());
      result.push({id:c.id,duration:b.duration,channels:b.numberOfChannels});
    }
    await audio.close();return result;
  });
  assert.equal(decode.length,catalog.sounds.length*4);assert.ok(decode.every(c=>c.duration>.1&&c.channels===1));
  const first=page.locator('.sound').first();
  await first.getByRole('button',{name:'Pick B',exact:true}).click();
  await page.getByText('All choices saved to this project').waitFor();
  await first.locator('.candidate').first().getByRole('button',{name:'Keep alternate'}).click();
  await first.locator('textarea').fill('Test feedback: tighten the tail.');
  await first.getByRole('button',{name:'Request new options',exact:true}).click();
  await page.getByText('All choices saved to this project').waitFor();
  await page.reload();
  await page.getByText('Ready · Your choices save automatically').waitFor();
  assert.equal(await first.getByRole('button',{name:'Pick B',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await first.locator('textarea').inputValue(),'Test feedback: tighten the tail.');
  assert.equal(await first.getByRole('button',{name:'✓ New options requested',exact:true}).getAttribute('aria-pressed'),'true');
  await first.getByRole('button',{name:`Repeat ${firstName} option A`,exact:true}).click();
  await page.locator('.playing').waitFor();
  await page.getByRole('button',{name:'■ Stop audio',exact:true}).click();
  assert.equal(await page.locator('.playing').count(),0);
  await first.getByRole('button',{name:`Play ${firstName} option A`,exact:true}).click();
  await page.locator('.playing').waitFor();
  await page.locator('.playing').waitFor({state:'detached'});
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export my selections ↗'}).click();assert.equal((await download).suggestedFilename(),'dead-draw-sound-selections.json');
  await page.getByRole('tab',{name:'Full sound checklist'}).click();
  assert.equal(await page.locator('tbody tr').count(),24);
  await page.getByRole('tab',{name:'Current shortlist'}).click();
  await page.locator('#show-previous').check();
  for(const [id,d] of Object.entries(initial.sounds)) if(d.pick){
    await page.locator('#search').fill(id);
    const panel=page.locator(`[data-sound="${id}"]`);
    if(id!==current[0].id) assert.equal(await panel.locator(`[data-pick="${d.pick}"]`).getAttribute('aria-pressed'),'true');
  }
  await page.locator('#search').fill('');
  await page.locator('#show-previous').uncheck();
  if(current.length>6){
    await page.locator('#next-page').click();assert.equal(await page.locator('.sound').first().getAttribute('data-sound'),current[6].id);
    await page.locator('#previous-page').click();
  }
  await page.locator('#search').fill('no-such-sound-xyz');assert.equal(await page.locator('.sound').count(),0);
  await page.locator('#search').fill('');
  await page.locator('#category').selectOption('Weapons');assert.ok((await page.locator('.sound').count())>0);
  await page.locator('#category').selectOption('');
  const loop=current.find(s=>s.loop);
  if(loop){
    await page.locator('#search').fill(loop.id);
    await page.getByRole('button',{name:`Repeat ${loop.name} option A`,exact:true}).click();
    await page.locator('.playing').waitFor();await page.getByRole('button',{name:'■ Stop audio',exact:true}).click();
    assert.equal(await page.locator('.playing').count(),0);await page.locator('#search').fill('');
  }
  await page.locator('#only-pending').check();
  assert.equal(await page.locator(`[data-sound="${current[0].id}"]`).count(),0);
  await page.locator('#only-pending').uncheck();
  const response=await fetch(`${origin}/api/decisions`,{method:'POST',headers:{'Content-Type':'application/json','Origin':origin},body:JSON.stringify({sounds:{'unknown':{pick:'bad',alternates:[],notes:'',regenerate:false}}})});assert.equal(response.status,400);
  const denied=await fetch(`${origin}/api/decisions`,{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://example.org'},body:JSON.stringify(initial)});assert.equal(denied.status,403);
  await fetch(`${origin}/api/decisions`,{method:'POST',headers:{'Content-Type':'application/json','Origin':origin},body:JSON.stringify(restore)});
  await page.reload();await page.getByText('Ready · Your choices save automatically').waitFor();
  await page.screenshot({path:'.cache/audio-review-desktop.png',fullPage:false});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'.cache/audio-review-mobile.png',fullPage:false});
  assert.deepEqual(errors,[]);
  console.log(`PASS: all ${decode.length} WAVs decode; ${current.length} sounds available through filters and pagination; prior picks preserved; playback, loops, save and export work; 24 checklist families; invalid/cross-origin writes rejected; mobile fits; no page errors. Live selections untouched.`);
} finally {
  await fetch(`${origin}/api/decisions`,{method:'POST',headers:{'Content-Type':'application/json','Origin':origin},body:JSON.stringify(restore)});
  await browser?.close();
  server.kill();
}
