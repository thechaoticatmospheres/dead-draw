import { WEAPONS } from '../shared/data.js';
import { ENEMIES } from '../shared/expansion.js';
import { readFile, writeFile } from 'node:fs/promises';
const existing=JSON.parse(await readFile(new URL('../docs/audio-review/catalog.json',import.meta.url),'utf8'));
const sounds=[];
const add=(id,name,cue,group,duration,prompt,extra={})=>sounds.push({id,name,cue,group,duration,interval:duration+.4,batch:3,prompt,loop:false,...extra});
const shots={
 sword:['One fast sword swing, sharp airy blade whoosh with a light metallic ring, close dry isolated sound.',.5],
 crossbow:['One crossbow shot, tight springy string snap and wooden body thump, dry close isolated sound.',.5],
 rpg:['One rocket launcher discharge, punchy hollow launch thump and short forceful exhaust whoosh, dry isolated sound.',1],
 flamethrower:['One flamethrower ignition, sharp gas ignition pop swelling into a brief roaring flame burst, dry isolated sound.',.6],
 minigun:['One heavy rotary machine-gun shot, tight aggressive mechanical crack and bassy thump, very short dry decay, no burst or background.',.5],
 railgun:['One railgun discharge, sharp electric snap and deep magnetic punch with a short descending whine, dry isolated sound.',.8],
 tesla:['One tesla weapon discharge, harsh electrical crack and short buzzing arc, dry isolated sound.',.7],
 switch:['One compact automatic pistol gunshot, immediate sharp dry pop with a tight gritty body, short decay, no burst or echo.',.5],
 dividend:['One rifle gunshot, immediate crisp hard crack and solid midrange punch, short dry decay, no echo or background.',.5],
 sovereign:['One heavy battle rifle gunshot, immediate hard crack with a deep forceful thump and short rough decay, dry isolated sound.',.6],
};
for(const [id,[prompt,duration]] of Object.entries(shots)) add(`${id}-shot`,`${WEAPONS[id].name} · ${id==='sword'?'Swing':'Fire'}`,'shot','Weapons',duration,prompt,{weapon:id,interval:WEAPONS[id].interval,appliesTo:[id]});
const handling=[
 ['pistol','Pistols',['courtesy','velvet'],'pistol magazine sliding out with a crisp release click','pistol magazine seating firmly with a short metal slide rack','pistol being drawn with a short cloth slide and metal click','one dry pistol trigger click'],
 ['automatic','Automatics',['switch','house'],'compact automatic weapon magazine release and short plastic magazine slide','compact automatic weapon magazine seating with a sharp charging-handle click','compact automatic weapon raised with strap rustle and light metal clack','one dry automatic weapon trigger click'],
 ['rifle','Rifles',['dividend','sovereign'],'rifle magazine release and firm metal magazine slide','rifle magazine seating and a solid bolt clack','rifle raised with a short strap rustle and solid metal clack','one dry rifle firing-mechanism click'],
 ['shotgun','Pit Viper',['pitViper'],'shotgun loading gate opening with a short metal clack','shotgun action racking shut with a heavy mechanical clack','shotgun raised with a solid wooden and metal handling clunk','one hollow dry shotgun trigger click'],
 ['crossbow','Pit Boss Crossbow',['crossbow'],'crossbow string pulled back against creaking mechanical tension','crossbow bolt seated with a wooden tap and latch click','crossbow raised with a short wooden creak and strap rustle','one empty crossbow latch click'],
 ['rocket','Housebreaker RPG',['rpg'],'rocket launcher breech opening with a heavy hollow metal clunk','rocket seating in launcher and heavy breech latch snapping shut','rocket launcher raised with a heavy tube handling clunk','one dry rocket launcher trigger click'],
 ['fuel','Dragon’s Breath',['flamethrower'],'flamethrower fuel coupling unscrewing with a brief pressure hiss','flamethrower fuel coupling locking shut with a metallic click','flamethrower raised with hose movement and a metal handling clunk','one empty flamethrower igniter click and weak gas sputter'],
 ['heavy','The Debt Collector',['minigun'],'heavy machine-gun ammunition box opening with rattling belt links','heavy ammunition feed cover locking with a solid metallic slam','heavy rotary gun raised with a heavy metal handling clunk','one empty rotary gun mechanical click'],
 ['energy','Energy weapons',['railgun','tesla'],'energy weapon power cell unlocking with a mechanical click and brief electrical hiss','energy weapon power cell seating with a snap and brief charging hum','energy weapon raised with a short electronic chirp and mechanical clack','one depleted energy weapon trigger buzz'],
];
for(const [id,name,appliesTo,...prompts] of handling) for(const [i,cue] of ['reload','reloadEnd','switch','empty'].entries()) {
 const labels=['Reload start','Reload finish','Equip','Empty']; const duration=[.8,.8,.5,.5][i];
 add(`handling-${id}-${cue}`,`${name} · ${labels[i]}`,cue,'Weapon handling',duration,`${prompts[i][0].toUpperCase()+prompts[i].slice(1)}, close dry isolated sound with no background.`,{appliesTo});
}
add('sword-switch','Velvet Saber · Equip','switch','Weapon handling',.65,'One sword drawn from a sheath, clean metallic scrape ending in a short ring, dry isolated sound.',{appliesTo:['sword']});
const voices={
 goose:'mutated goose, harsh nasal honk with a rough throaty hiss',
 dealer:'gaunt undead dealer, dry wheezy midrange throat rasp and rattling breath',
 security:'heavy undead security guard, low chesty human growl and labored breath',
 wheelchair:'undead last-call regular, frail gravelly croak with breathy throat rattle',
 crawler:'crawling zombie, low wet guttural rasp and strained breath',
 walker:'feral human-sized zombie, low ragged throaty rasp and strained breath',
 runner:'fast feral zombie, higher ragged throat rasp and quick strained breath',
 brute:'hulking zombie, deep coarse chest rumble and ragged throaty rasp',
 spitter:'acid-spitting zombie, wet gurgling throat rasp with a hissing breath',
 boss:'enormous undead high roller, very deep resonant chest growl with coarse human throat rasp',
};
for(const [id,v] of Object.entries(voices)) {
 if(!existing.sounds.some(s=>s.id===`${id}-enemy`)) add(`${id}-enemy`,`${ENEMIES[id].name} · Idle vocal`,'enemy','Zombie vocals',2,`One idle vocal from a ${v}, close dry isolated recording without words or background.`,{kind:id,appliesTo:[id]});
 for(const [cue,label,duration,action] of [['enemyAttack','Attack',.8,'short aggressive attack vocal'],['enemyHurt','Hurt',.7,'brief pained recoil vocal'],['death','Death',1.5,'dying vocal fading into a final breath']]) add(`${id}-${cue}`,`${ENEMIES[id].name} · ${label}`,cue,'Zombie vocals',duration,`One ${action} from a ${v}, close dry isolated recording without words or background.`,{kind:id,appliesTo:[id]});
}
const special=[
 ['flame-loop','Dragon’s Breath · Sustained flame','weaponLoop',3,'Steady pressurized flamethrower roar, close dry rushing flame with gritty crackle, seamless continuous loop without ignition or shutdown.',{weapon:'flamethrower',loop:true}],
 ['flame-stop','Dragon’s Breath · Release','weaponStop',.6,'One flamethrower shutting off, brief dwindling flame whoosh and gas-valve click, dry isolated sound.',{weapon:'flamethrower'}],
 ['minigun-start','The Debt Collector · Spin-up','weaponStart',1,'Rotary machine-gun barrels spinning up, rising mechanical motor whir, no firing, dry isolated sound.',{weapon:'minigun'}],
 ['minigun-loop','The Debt Collector · Sustained fire','weaponLoop',3,'Steady rotary machine-gun firing at eighteen shots per second, tight rapid mechanical gunfire, seamless loop without startup or shutdown, dry close sound.',{weapon:'minigun',loop:true}],
 ['minigun-stop','The Debt Collector · Spin-down','weaponStop',1,'Rotary machine-gun motor winding down, descending mechanical whir and final light clack, no firing, dry isolated sound.',{weapon:'minigun'}],
 ['rocket-flight','Housebreaker RPG · Rocket flight','projectileLoop',2,'Steady fast rocket exhaust hiss and low rushing air, close dry seamless continuous loop.',{weapon:'rpg',loop:true}],
 ['crossbow-impact','Pit Boss Crossbow · Bolt impact','weaponImpact',.5,'One crossbow bolt striking wood, sharp dry thunk with a short vibrating shaft rattle, isolated sound.',{weapon:'crossbow'}],
 ['railgun-impact','Royal Flush Railgun · Piercing impact','weaponImpact',.6,'One high-velocity rail projectile piercing metal, sharp bright impact crack and short ringing tail, dry isolated sound.',{weapon:'railgun'}],
 ['tesla-impact','Static Jackpot · Chain arc','weaponImpact',.6,'One electrical arc jumping between targets, sharp sizzling snap and brief buzzing decay, dry isolated sound.',{weapon:'tesla'}],
 ['brute-warnSlam','Pit Boss · Slam warning','warnSlam',.75,'One hulking zombie preparing a heavy slam, rising deep strained growl, dry isolated sound without words.',{kind:'brute'}],
 ['brute-slam','Pit Boss · Slam impact','slam',.8,'One huge body slam striking a stone floor, deep heavy thud with a short gritty debris rattle, dry isolated sound.',{kind:'brute'}],
 ['boss-entrance','THE HIGH ROLLER · Entrance roar','boss',2.5,'One enormous undead creature entrance roar, very deep coarse resonant human throat bellow, dry isolated sound without words.',{kind:'boss'}],
 ['boss-warnSlam','THE HIGH ROLLER · Slam warning','warnSlam',.9,'One enormous undead creature winding up a slam, rising bassy strained bellow with a rough throat rasp, dry isolated sound.',{kind:'boss'}],
 ['boss-slam','THE HIGH ROLLER · Slam impact','slam',1,'One enormous ground slam, massive deep stone impact with a short crumbling rubble tail, dry isolated sound.',{kind:'boss'}],
 ['spitter-warnAcid','Spitter · Acid warning','warnAcid',.6,'One acid zombie gathering spit, rising wet throat gurgle and pressurized hiss, dry isolated sound without words.',{kind:'spitter'}],
 ['spitter-spit','Spitter · Spit attack','spit',.5,'One forceful acid spit, wet guttural expulsion with a short liquid spray, dry isolated sound.',{kind:'spitter'}],
 ['spitter-acid','Spitter · Acid splash','acid',1.2,'One corrosive acid splash onto stone, wet splatter and short bubbling sizzle, dry isolated sound.',{kind:'spitter'}],
 ['wheelchair-move','Last Call Regular · Wheel movement','enemyMove',2,'Old wheelchair rolling steadily on hard flooring, light wheel squeak and loose metal rattle, dry seamless loop.',{kind:'wheelchair',loop:true}],
 ['crawler-move','Drunken Crawler · Scraping movement','enemyMove',1.5,'One zombie dragging its body over rough flooring, gritty cloth scrape and short heavy hand scuff, dry isolated sound.',{kind:'crawler'}],
 ['goose-flap','Jackpot Goose · Wing flaps','enemyMove',.8,'One pair of frantic goose wing flaps, close sharp feather buffets, dry isolated sound.',{kind:'goose'}],
];
for(const [id,name,cue,duration,prompt,extra] of special) add(id,name,cue,'Special abilities',duration,prompt,{...extra,appliesTo:[extra.weapon||extra.kind]});
for(const [id,name,cue,prompt,duration] of [
 ['shared-flesh','Shared · Flesh impact','hit','One blunt projectile hit into soft flesh, short wet meaty thud, dry isolated sound.',.5],
 ['shared-surface','Shared · Surface impact','impact','One bullet hitting hard concrete, sharp dry tick and tiny gritty debris rattle, isolated sound.',.5],
 ['shared-headshot','Shared · Headshot','headshot','One sharp headshot impact, short crunchy wet crack, dry isolated sound.',.5],
 ['shared-explosion','Shared · Rocket and grenade explosion','explosion','One heavy explosion, sharp forceful blast and deep thump with a short gritty debris decay, dry isolated sound.',1.5],
 ['sword-flesh','Velvet Saber · Flesh impact','weaponFlesh','One sword cutting into flesh, short sharp wet slice and meaty impact, dry isolated sound.',.5],
 ['sword-surface','Velvet Saber · Surface impact','weaponImpact','One sword striking hard stone, sharp metallic clang and brief gritty scrape, dry isolated sound.',.6],
 ]) add(id,name,cue,'Impacts',duration,prompt,{appliesTo:id.startsWith('sword')?['sword']:Object.keys(WEAPONS)});
const plan={flow_id:'2C75vSuIQQnCbmeVpgmu',batch:3,variations:4,sounds};
await writeFile(new URL('../docs/audio-review/batch-03-plan.json',import.meta.url),JSON.stringify(plan,null,2)+'\n');
console.log(JSON.stringify({families:sounds.length,candidates:sounds.length*4,groups:Object.fromEntries([...new Set(sounds.map(s=>s.group))].map(g=>[g,sounds.filter(s=>s.group===g).length])),seconds:sounds.reduce((n,s)=>n+s.duration*4,0)}));
