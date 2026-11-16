import test from "node:test";
import assert from "node:assert/strict";
import { LocalDemo, DEMO_ID, demoOptions, seededRandom } from "../src/demo.js";
import { keyboardLook } from "../src/accessibility-input.js";
import { ROOMS, roomAt } from "../shared/map.js";
import { recordRun } from "../src/profile.js";

test("local demo query is bounded, seeded, and opt-in independently of normal rooms", () => {
  assert.equal(demoOptions("").requested,false);
  assert.equal(demoOptions("?profile=1").requested,false);
  assert.deepEqual(demoOptions("?seed=3&auto=1&t=99999&view=table"),{
    requested:true,seed:3,stateName:"tour",auto:true,freezeAt:600,view:"table",power:null,
  });
  assert.equal(demoOptions("?state=unknown&t=NaN").stateName,"atrium");
  assert.equal(demoOptions("?state=power-up").stateName,"power-up");
  assert.equal(demoOptions("?t=NaN").freezeAt,null);
  const a=seededRandom(42),b=seededRandom(42),c=seededRandom(43);
  const series=()=>Array.from({length:20},()=>a());
  const expected=series();
  assert.deepEqual(expected,Array.from({length:20},()=>b()));
  assert.notDeepEqual(expected,Array.from({length:20},()=>c()));
});

test("same seed and tick count reproduce actual combat without modifying live game state", () => {
  const a=new LocalDemo({seed:17,auto:true,stateName:"combat",freezeAt:8});
  const b=new LocalDemo({seed:17,auto:true,stateName:"combat",freezeAt:8});
  assert.deepEqual(a.snapshot(),b.snapshot());
  assert.ok(a.player.kills>0,"the bot damages and defeats real enemies through the actual gun simulation");
  const original=a.snapshot();
  a.advance(10,{forward:1});
  a.action({type:"grenade"});
  assert.deepEqual(a.snapshot(),original,"frozen captures cannot advance their own simulation");
  b.game.campaign.power=true;
  assert.equal(a.game.campaign.power,false,"each local instance has independent campaign authority");
});

test("held unlocked input uses existing movement, collision, reload, roll and jump systems", () => {
  const d=new LocalDemo({stateName:"atrium"});
  const start=d.player.z;
  for(let i=0;i<30;i++)d.advance(1/60,{forward:1,yaw:0});
  assert.ok(d.player.z<start-2.8);
  d.action({type:"jump"});
  d.advance(1/60,{});
  assert.ok(d.player.height>0);
  for(let i=0;i<80;i++)d.advance(1/60,{});
  d.action({type:"dodge"});
  assert.ok(d.player.dodgeTime>0);
  for(let i=0;i<50;i++)d.advance(1/60,{shoot:true,yaw:0});
  assert.ok(d.player.guns[0].ammo<12);
  d.action({type:"reload"});
  for(let i=0;i<180;i++)d.advance(1/60,{});
  assert.equal(d.player.guns[0].ammo,12);
  for(let i=0;i<600;i++)d.advance(1/60,{forward:-1,yaw:0});
  assert.ok(d.player.z<15.61,"shared level bounds hold under sustained movement");
});

test("all inspection rooms are accessible and power fixtures exercise the real power action", () => {
  for(const room of ROOMS) {
    const d=new LocalDemo({stateName:room.id});
    assert.equal(roomAt(d.player).id,room.id);
    assert.ok(d.game.openRooms.includes(room.id));
  }
  const d=new LocalDemo({stateName:"power"});
  assert.equal(d.game.campaign.power,true);
  assert.equal(d.player.chips,300,"fixture restored power at the real 150 chip cost");
  const dark=new LocalDemo({stateName:"sapphire",power:false});
  assert.equal(dark.game.campaign.power,false);
  assert.equal(new LocalDemo({stateName:"sapphire",power:true}).game.campaign.power,true);
  const transition = new LocalDemo({stateName:"power-up",auto:true});
  assert.equal(transition.game.campaign.power,false);
  for(let i=0;i<200;i++) transition.advance(1/60);
  assert.equal(transition.game.campaign.power,true);
  assert.equal(transition.player.chips,300,"power-up pays the normal cost after the demonstration delay");
});

test("a frozen ending restarts into a playable isolated run while other captures stay frozen", () => {
  const combat = new LocalDemo({stateName:"combat",freezeAt:0});
  const unchanged = combat.snapshot();
  combat.action({type:"start"});
  assert.deepEqual(combat.snapshot(),unchanged,"start cannot unfreeze or reset an active combat capture");
  assert.equal(combat.frozen,true);

  const demo = new LocalDemo({stateName:"defeat",freezeAt:5,view:"hero",auto:true});
  assert.equal(demo.game.phase,"over");
  const ending = demo.snapshot(), oldRun = demo.game.runId;
  demo.action({type:"grenade"});
  assert.deepEqual(demo.snapshot(),ending);
  demo.accumulator = .012;
  demo.action({type:"start"});
  assert.equal(demo.game.phase,"break");
  assert.equal(demo.game.timer,90,"normal authority restart retains the full opening intermission");
  assert.equal(demo.player.hp,100);
  assert.equal(demo.player.down,false);
  assert.equal(demo.frozen,false);
  assert.equal(demo.freezeAt,null);
  assert.equal(demo.elapsedTicks,0);
  assert.equal(demo.accumulator,0);
  assert.equal(demo.auto,false);
  assert.equal(demo.inspectionView(),null,"restart returns the ordinary player camera");
  assert.equal(demo.game.testing,true);
  assert.match(demo.game.runId,/^LOCAL-DEMO-/);
  assert.notEqual(demo.game.runId,oldRun);
  assert.deepEqual(demo.game.openRooms,["atrium"]);
  const startZ = demo.player.z;
  for(let i=0;i<60;i++) demo.advance(1/60,{forward:1,yaw:0});
  assert.ok(demo.player.z<startZ-2,"held movement works after leaving the frozen ending");
  assert.ok(demo.game.timer<90 && demo.game.timer>88);
  demo.player.hp=0;
  demo.player.down=true;
  demo.game.update(1/60);
  assert.equal(demo.game.summary.testing,true,"the next ending remains ineligible for career records");
});

test("tour uses real casino settlement and finishes a local extraction without career writes", () => {
  const d=new LocalDemo({stateName:"tour",auto:true});
  let paidSlots=false,paidRoulette=false,restored=false,actualHouseDefeat=false;
  for(let i=0;i<120*60;i++) {
    d.step();
    paidSlots ||= !!d.game.hand(d.player,"slots")?.paid;
    paidRoulette ||= !!d.game.hand(d.player,"roulette")?.paid;
    if(d.fixtureName==="power-up")restored ||= d.game.campaign.power;
    if(d.fixtureName==="house")actualHouseDefeat ||= d.game.campaign.defeated;
    d.game.events=[];
  }
  assert.ok(paidSlots&&paidRoulette&&restored&&actualHouseDefeat);
  assert.equal(d.game.summary.extracted,true);
  assert.equal(d.game.summary.testing,true);
  let writes=0;
  const prior=globalThis.localStorage;
  globalThis.localStorage={getItem:()=>null,setItem:()=>writes++};
  try { recordRun(d.game.summary,DEMO_ID); assert.equal(writes,0); }
  finally { if(prior===undefined) delete globalThis.localStorage; else globalThis.localStorage=prior; }
  d.action({type:"start"});
  assert.equal(d.game.testing,true);
  assert.equal(d.game.phase,"break");
  assert.equal(d.game.timer,90,"restart preserves normal opening intermission");
});

test("IJKL look is framerate controlled, clamped, optic aware, and does not consume arrow keys", () => {
  const keys=new Set(["KeyJ","KeyI"]);
  const normal=keyboardLook(keys,.02,0,0);
  const scoped=keyboardLook(keys,.02,0,0,3);
  assert.equal(normal.yaw,scoped.yaw*3);
  assert.equal(keyboardLook(new Set(["ArrowLeft","ArrowUp"]),.02,0,0).yaw,0);
  assert.equal(keyboardLook(keys,.05,0,.64).pitch,.65);
});
