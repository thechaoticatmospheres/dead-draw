"""Download existing ElevenLabs results, preserve originals, and build audition assets.

No generation calls. Uses Python standard library and FFmpeg. Rankings describe
signal measurements, not a subjective listening review.
"""
import array
import json
import math
from pathlib import Path
import subprocess
import sys
import urllib.request
import wave
from concurrent.futures import ThreadPoolExecutor

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs' / 'audio-review'
RECORD = json.loads((ROOT / (sys.argv[1] if len(sys.argv)>1 else '.cache/audio-pilot-downloads.json')).read_text(encoding='utf-8'))
RATE = 44100

def rms(data):
    return math.sqrt(sum(x*x for x in data) / max(1,len(data)))

def analyze(media, sound, take):
    ident = media['generation_id']
    source = OUT / 'originals' / f'{ident}.mp3'
    source.parent.mkdir(parents=True, exist_ok=True)
    if not source.exists():
        with urllib.request.urlopen(media['master_url'], timeout=60) as response:
            source.write_bytes(response.read())
    raw = subprocess.run(['ffmpeg','-v','error','-i',str(source),'-ac','1','-ar',str(RATE),'-f','f32le','-'], check=True,capture_output=True).stdout
    samples = array.array('f',raw)
    if sys.byteorder != 'little': samples.byteswap()
    peak=max(abs(v) for v in samples)
    if peak < .0001: raise ValueError(f'Silent candidate {ident}')
    threshold=peak * 10**(-45/20)
    active=[i for i,v in enumerate(samples) if abs(v)>threshold]
    start=max(0,active[0]-int(.002*RATE)); end=min(len(samples),active[-1]+int(.02*RATE))
    if sound.get('loop'): start,end=0,len(samples)
    data=array.array('f',samples[start:end])
    block=int(RATE*.005)
    levels=[rms(data[i:i+block]) for i in range(0,len(data),block)]
    level_peak=max(levels)
    active_levels=[v for v in levels if v>level_peak*.1]
    active_rms=math.sqrt(sum(v*v for v in active_levels)/max(1,len(active_levels)))
    target=10**((-20 if sound['cue']=='shot' else -22)/20)
    gain=min(target/max(active_rms,1e-9),10**(-3/20)/peak)
    onset_peak_ms=levels.index(level_peak)*5
    energy=sum(v*v for v in data)
    after_interval=sum(v*v for v in data[int(sound['interval']*RATE):])/max(energy,1e-12)
    clipped=sum(abs(v)>=.999 for v in samples)/len(samples)
    # Prompt-independent, reproducible technical ordering. Lower is better.
    score=(onset_peak_ms + after_interval*300 + clipped*10000) if sound['cue']=='shot' else (clipped*10000 + abs(len(data)/RATE-sound['duration'])*100 + abs(data[-1])*100)
    if sound.get('loop'): score=clipped*10000+abs(data[-1]-data[0])/peak*100
    fade=int(.005*RATE)
    pcm=array.array('h')
    for i,v in enumerate(data):
        edge=1 if sound.get('loop') else min(1,(i+1)/max(1,int(.0005*RATE)),(len(data)-i)/fade)
        pcm.append(round(max(-1,min(1,v*gain*edge))*32767))
    if sys.byteorder != 'little': pcm.byteswap()
    audio=OUT/'audio'/f'{ident}.wav'; audio.parent.mkdir(exist_ok=True)
    with wave.open(str(audio),'wb') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(RATE);w.writeframes(pcm.tobytes())
    step=max(1,math.ceil(len(data)/100))
    waveform=[round(max(abs(v) for v in data[i:i+step])/peak,3) for i in range(0,len(data),step)]
    return {'id':ident,'take':take,'file':f'audio/{ident}.wav','original':f'originals/{ident}.mp3','duration':round(len(data)/RATE,4),'waveform':waveform,'score':round(score,4),'metrics':{'originalDuration':round(len(samples)/RATE,4),'trimStartMs':round(start/RATE*1000,1),'attackPeakMs':onset_peak_ms,'energyAfterIntervalPercent':round(after_interval*100,2),'sourceClippedPercent':round(clipped*100,4),'gainDb':round(20*math.log10(gain),2),'activeRmsDb':round(20*math.log10(max(1e-9,active_rms*gain)),2)}}

catalog={'version':1,'provider':'ElevenLabs','model':'eleven_text_to_sound_v2','flow_url':f"https://elevenlabs.io/app/flows/{RECORD['flow_id']}",'reviewBasis':'Provisional technical shortlist using measured attack timing, tail overlap and full-scale exceedance. No subjective auditory review performed. User selects timbre and realism.','processing':'Original MP3 retained; review WAV is mono 44.1kHz, silence trimmed, active RMS matched within each family with -3dB peak cap and a 5ms tail fade.','sounds':[]}
previous = json.loads((OUT/'catalog.json').read_text(encoding='utf-8')) if (OUT/'catalog.json').exists() else {'sounds':[]}
catalog['currentBatch']=max(RECORD.get('batch',1),previous.get('currentBatch',1))
for sound in RECORD['pilot']:
    medias=[m for m in RECORD['media'] if m.get('prompt')==sound['prompt']]
    if len(medias)!=4: raise ValueError(f"Expected four candidates for {sound['id']}")
    with ThreadPoolExecutor(max_workers=4) as pool:
        candidates=list(pool.map(lambda item: analyze(item[1],sound,item[0]+1),enumerate(medias)))
    candidates.sort(key=lambda c:c['score'])
    for i,c in enumerate(candidates):
        c['rank']=i+1;c['label']='ABCD'[i]
        if sound['cue']=='shot':
            c['title']=['First to audition','Second option','Third option','Reserve take'][i]
            caution = f" Source exceeds full scale on {c['metrics']['sourceClippedPercent']:.1f}% of samples; audition for distortion." if c['metrics']['sourceClippedPercent'] else ''
            c['note']=f"Attack peak at {c['metrics']['attackPeakMs']} ms; {c['metrics']['energyAfterIntervalPercent']:.1f}% of energy remains beyond the firing interval." + caution
        else:
            c['title']=['First to audition','Second option','Third option','Reserve take'][i]
            kind='loop' if sound.get('loop') else 'vocal' if sound['cue'] in ['enemy','enemyAttack','enemyHurt','death','boss'] else 'effect'
            tail=' Repeat preview plays three continuous cycles; listen for a seam.' if sound.get('loop') else ' Compare character and timing in the repeat preview.'
            c['note']=f"{c['duration']:.2f}s {kind}; {c['metrics']['sourceClippedPercent']:.2f}% of decoded samples exceed full scale."+tail
    catalog['sounds'].append({**sound,'batch':RECORD.get('batch',1),'candidates':candidates})
    print(f"Prepared {sound['id']}: {len(candidates)} candidates",flush=True)
updated={s['id'] for s in catalog['sounds']}
catalog['sounds'].extend(s for s in previous['sounds'] if s['id'] not in updated)
catalog['sounds'].sort(key=lambda s:-s.get('batch',1))
if '--prepare-only' not in sys.argv:
    (OUT/'catalog.json').write_text(json.dumps(catalog,indent=2)+'\n',encoding='utf-8')
print(f"Prepared {len(RECORD['media'])} local audition WAVs; original MP3s and previous batches preserved.")
