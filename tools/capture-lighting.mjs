// Capture the real playable level, never a replacement showcase scene.
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { ROOMS } from '../shared/map.js';
const base=process.env.DEAD_DRAW_URL || 'http://127.0.0.1:5191/';
const output=process.argv[2] || 'test-results/baked-rooms';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const context=await browser.newContext({viewport:{width:1600,height:900},deviceScaleFactor:1});
const page=await context.newPage(), errors=[], report=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('response',response=>{if(response.status()>=400) errors.push(`${response.status()} ${response.url()}`)});
try {
  for(const room of ROOMS) for(const power of [0,1]) {
    const url=new URL(base);Object.entries({state:room.id,power,view:'entrance',t:0,seed:1978}).forEach(([k,v])=>url.searchParams.set(k,v));
    await page.goto(url.href);
    await page.waitForFunction(()=>window.__deadDraw?.captureReady,{},{timeout:60000});
    // Let image uploads, shader compilation and the local reflection settle.
    await page.evaluate(()=>new Promise(resolve=>{let n=0;const step=()=>++n>20?resolve():requestAnimationFrame(step);step()}));
    await page.screenshot({path:`${output}/${room.id}-${power?'restored':'emergency'}.png`});
    const details=await page.evaluate(()=>{
      const w=__deadDraw.world,gl=w.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
      return {bake:w.bakedLighting?.coverage || w.bakeStatus,campaignPower:!!__deadDraw.state.campaign.power,draws:w.renderer.info.render.calls,triangles:w.renderer.info.render.triangles,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};
    });
    report.push({room:room.id,power,...details});console.log(JSON.stringify(report.at(-1)));
  }
} finally {
  await writeFile(`${output}/report.json`,JSON.stringify({report,errors},null,2));
  await browser.close();
}
