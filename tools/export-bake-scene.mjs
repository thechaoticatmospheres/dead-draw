// Export actual loaded render meshes, transforms and material averages locally.
// Start npm run dev first. No scene data is uploaded to an external service.
import { chromium } from 'playwright-core';
import { mkdir, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
const destination=resolve('assets/source/bake/scene.json');
const url=new URL(process.env.DEAD_DRAW_URL || 'http://127.0.0.1:5191/');
Object.entries({state:'atrium',t:0,view:'entrance',bake:'off',seed:1978}).forEach(([k,v])=>url.searchParams.set(k,v));
const executablePath=process.env.EDGE_PATH || (process.platform==='win32'?'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe':undefined);
const browser=await chromium.launch({executablePath,headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
try {
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  await page.goto(url.href);
  await page.waitForFunction(()=>window.__deadDraw?.captureReady,{},{timeout:60000});
  const downloadPromise=page.waitForEvent('download');
  const count=await page.evaluate(()=>{
    if(__deadDraw.world.bakeStatus!=='disabled') throw new Error('Export must use original unbaked topology.');
    const scene=__deadDraw.world.environment.exportBakeScene();
    for(const mesh of scene.meshes) {
      if(mesh.positions.length%3 || !mesh.positions.every(Number.isFinite)) throw new Error('Invalid exported geometry.');
      mesh.positions=mesh.positions.map(value=>Math.round(value*100000)/100000);
    }
    const blob=URL.createObjectURL(new Blob([JSON.stringify(scene)],{type:'application/json'}));
    const link=document.createElement('a');link.href=blob;link.download='scene.json';link.click();
    setTimeout(()=>URL.revokeObjectURL(blob),10000);
    return scene.meshes.length;
  });
  await mkdir(dirname(destination),{recursive:true});
  await(await downloadPromise).saveAs(destination);
  console.log(`Exported ${count} static meshes (${(await stat(destination)).size} bytes) to ${destination}`);
} finally { await browser.close(); }
