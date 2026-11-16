import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
const directory='test-results/baked-performance';await mkdir(directory,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
try {
  const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto((process.env.DEAD_DRAW_URL || 'http://127.0.0.1:5191/')+'?state=stress&auto=1&view=hero&profile=1');
  await page.waitForFunction(()=>window.__deadDraw?.captureReady);
  await page.waitForTimeout(1500);
  await page.evaluate(()=>{
    __deadDraw.beginDemo({stateName:'stress',auto:true,seed:1978,view:'hero'});
    const m=__deadDraw.world.metrics;m.frames.length=m.cpu.length=m.gpu.length=0;m.last=0;
  });
  const started=Date.now();
  const measurement=page.evaluate(()=>new Promise(resolve=>{
    const frames=[],start=performance.now();let last=null;
    const frame=now=>{
      const s=__deadDraw.state,w=__deadDraw.world;
      // RAF timestamps describe the start of a frame and may precede the
      // performance.now() taken while scheduling its first callback.
      if (last !== null) frames.push({milliseconds:now-last,enemies:s.zombies.length,survivors:s.players.length,effects:w.effectPool.active.length,phase:s.phase});
      last=now;
      if(now-start<10000) requestAnimationFrame(frame);
      else resolve({frames,renderer:{...w.renderer.domElement.dataset},bake:w.bakeStatus});
    };requestAnimationFrame(frame);
  }));
  for(const [delay,name] of [[750,'01-heavy-combat'],[2300,'02-projectiles'],[5000,'03-wave-pressure']]) {
    await page.waitForTimeout(Math.max(0,started+delay-Date.now()));
    await page.screenshot({path:`${directory}/${name}.png`});
  }
  const result=await measurement;
  const summary=list=>{
    const values=list.map(frame=>frame.milliseconds).sort((a,b)=>a-b),average=values.reduce((a,b)=>a+b,0)/values.length;
    return {frames:values.length,averageMS:average,averageFPS:1000/average,p95MS:values[Math.floor((values.length-1)*.95)],p99MS:values[Math.floor((values.length-1)*.99)],over20MSPercent:100*values.filter(v=>v>20).length/values.length,enemiesMin:Math.min(...list.map(v=>v.enemies)),enemiesMax:Math.max(...list.map(v=>v.enemies)),effectsMax:Math.max(...list.map(v=>v.effects))};
  };
  const heavy=result.frames.filter(frame=>frame.enemies>=20);
  const report={...result,all:summary(result.frames),heavy:heavy.length?summary(heavy):null,errors};
  await writeFile(`${directory}/report.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify({all:report.all,heavy:report.heavy,renderer:result.renderer,errors},null,2));
} finally {await browser.close()}
