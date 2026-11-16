import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
const server=await createServer({server:{host:'127.0.0.1',port:5192,strictPort:true}});
await server.listen();
let browser;
try {
  browser=await chromium.launch({headless:true,channel:'msedge'});
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5192/tests/audio-browser.html');
  await page.getByRole('button',{name:'RENDER ALL SOUND EFFECTS'}).click();
  await page.waitForFunction(()=>/^(PASS|FAIL|ERROR)/.test(document.querySelector('#result').textContent),null,{timeout:60000});
  const result=await page.locator('#result').textContent();
  assert.ok(result.startsWith('PASS'),result);
  assert.deepEqual(errors,[]);
  console.log(result+'; approved WAVs loaded for every render; four-player stress includes warning cues.');
} finally {await browser?.close();await server.close();}
