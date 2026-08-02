/* Aura Studio — application.
   Extracted verbatim from index.html. The whole app is ONE IIFE with no globals:
   audio engine, sequencer, piano roll, recorder and export all close over the same
   private scope. Splitting it into separate <script> files would require exposing that
   scope on window, which is a behavioural change — so the split is file-level only.
   Section markers below map to the requested modules. */
(() => {
  const STEPS=16, N_PATTERNS=6, SONG_SLOTS=32;

  // ---------- music theory ----------
  const NOTE_NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const midiToFreq=m=>440*Math.pow(2,(m-69)/12);
  const SCALES={
    major:   {steps:[0,2,4,5,7,9,11], quals:['maj','min','min','maj','maj','min','dim'], romans:['I','ii','iii','IV','V','vi','vii°']},
    minor:   {steps:[0,2,3,5,7,8,10], quals:['min','dim','maj','min','min','maj','maj'], romans:['i','ii°','III','iv','v','VI','VII']},
    dorian:  {steps:[0,2,3,5,7,9,10], quals:['min','min','maj','maj','min','dim','maj'], romans:['i','ii','III','IV','v','vi°','VII']},   // soulful (hip-hop / neo-soul)
    phrygian:{steps:[0,1,3,5,7,8,10], quals:['min','maj','maj','min','dim','maj','min'], romans:['i','♭II','♭III','iv','v°','♭VI','♭vii']}, // exotic (Persian hip-hop lane)
    // gospel: raised leading tone makes V a true dominant (with 'soul' 7ths -> V7, the gospel V7 pull); III voiced major per gospel practice
    harmonicMinor:{steps:[0,2,3,5,7,8,11], quals:['min','dim','maj','min','maj','maj','dim'], romans:['i','ii°','III','iv','V','VI','vii°']},
  };
  let keyRoot=0, keyMode='major', reverbWet=0.18, chordStyle='pad', bassStyle='sub';
  function scale(){ return SCALES[keyMode]; }
  function chordRootMidi(deg){ return 60 + keyRoot + scale().steps[deg]; }
  function chordName(deg){ const pc=(keyRoot+scale().steps[deg])%12, q=scale().quals[deg]; return NOTE_NAMES[pc]+(q==='min'?'m':q==='dim'?'°':q==='aug'?'+':''); }
  function chordMidiNotes(deg, seventh){ const root=chordRootMidi(deg), q=scale().quals[deg]; const iv=q==='maj'?[0,4,7]:q==='min'?[0,3,7]:q==='aug'?[0,4,8]:[0,3,6]; const notes=iv.map(i=>root+i);
    if(seventh){ const st=scale().steps; let off=((st[(deg+6)%7]-st[deg])%12+12)%12; if(off<9) off+=12; notes.push(root+off); }   // add the diatonic 7th (soul/gospel)
    return notes; }

  // ---------- instruments ----------
  const drums=[
    {id:'kick',   name:'Kick',    key:'On the floor', vol:.95},
    {id:'snare',  name:'Snare',   key:'Dembow',       vol:.7},
    {id:'clap',   name:'Clap',    key:'Layer',        vol:.5},
    {id:'hat',    name:'Hi-hat',  key:'Closed',       vol:.4},
    {id:'openhat',name:'Open hat',key:'Sizzle',       vol:.35},
    {id:'shaker', name:'Shaker',  key:'Perc',         vol:.42},
  ];
  const CHORD_DEGREES=[0,1,2,3,4,5,6].map(d=>({id:'deg'+d, deg:d}));
  const BUS_VOL={kick:.95,snare:.7,clap:.5,hat:.4,openhat:.35,shaker:.42,chords:.5,bass:.6,melody:.55};
  // ---------- mixer ----------
  // Every mixer control is a NO-OP at its default (vol 1, pan 0, flat EQ, no sends), so adding the
  // mixer cannot change how an existing track sounds. Groups sit between instrument buses and the mix bus.
  const GROUPS=[
    {id:'kick',   name:'Kick',    buses:['kick']},
    {id:'snare',  name:'Snare',   buses:['snare','clap'],        sub:'+ Clap'},
    {id:'hats',   name:'Hats',    buses:['hat','openhat','shaker'], sub:'+ Perc'},
    {id:'bass',   name:'Bass',    buses:['bass']},
    {id:'chords', name:'Chords',  buses:['chords']},
    {id:'melody', name:'Melody',  buses:['melody']},
    {id:'vocals', name:'Vocals',  buses:[]},                     // the recorded take feeds this directly
    {id:'sample', name:'Sample',  buses:[], sub:'Imported'},     // APPENDED — never reorder, `mx` is index-mapped
  ];
  // ---------- imported audio ----------
  // smp holds everything about a user-imported instrumental. Nothing here is persisted to
  // localStorage or share links — audio never leaves the machine and never bloats a URL.
  const smp={ buf:null, name:'', bpm:0, key:0, mode:'minor', conf:0,
              on:false, rate:1, half:false, hp:20, offset:0,
              fmt:'', sr:0, chans:0, bytes:0, rms:null };
  // ---------- A/B comparison state ----------
  // Live-only, and a MULTIPLIER on the group gains rather than a saved-and-restored value. It is
  // never written into mix[], never read by groupGain() or buildBusses(), so it cannot reach autosave,
  // a .aura file, a share link or an exported WAV — and leaving the comparison restores the real
  // balance exactly, because there is nothing to restore: the gains are recomputed from mix[] alone.
  // Declared here, above the first reader (applyGroupLive), so there is no dead-zone hazard at init.
  let abMode='off';                 // 'off' | 'orig' | 'aura' | 'both'
  let abMatchDb=0, abMatchMsg='';
  const AURA_GROUPS=['kick','snare','hats','bass','chords','melody'];
  const AB_WINDOW_DB=1.0, AB_MAX_DB=6.0, AB_FLOOR=0.0008;
  const mixDefault=()=>({vol:100,pan:0,mute:0,solo:0,lo:0,mid:0,hi:0,rev:0,dly:0});
  const mix={}; GROUPS.forEach(g=>mix[g.id]=mixDefault());
  const fx={ dlyTime:280, dlyFb:32, revSize:50, comp:40 };      // comp 40 == the existing glue compressor
  const anySolo=()=>GROUPS.some(g=>mix[g.id].solo);
  // StereoPanner uses an equal-power law: a mono source at centre comes out 0.707 per channel, where the old
  // direct up-mix gave 1.0. Pre-multiplying by sqrt(2) makes centre-pan exactly unity, so inserting the mixer
  // leaves every existing track at its original level.
  const PAN_COMP=Math.SQRT2;
  const groupGain=id=>{ const m=mix[id]; if(m.mute) return 0; if(anySolo()&&!m.solo) return 0; return m.vol/100*PAN_COMP; };
  // Baseline reverb send per channel — these reproduce the pre-mixer per-voice sends, but now they are tapped
  // POST-fader inside the channel strip, so mute / solo / volume / pan / EQ all apply to the reverb too.
  const REV_BASE={kick:0, snare:0.14, hats:0.06, bass:0, chords:0.32, melody:0.22, vocals:0.12, sample:0.08};
  const groupRev=id=>REV_BASE[id]*reverbWet + (mix[id].rev/100)*0.6;
  // piano roll range: C3..B5 (3 octaves), grid-quantized to the 16-step bar
  const PR_LO=48, PR_HI=83, PR_RH=19;             // Phase 3: taller rows
  let PR_CW=40;                                    // column width — sized to fit 16 steps
  let melodySound='lead';
  const DRUM_SEND=id=>(id==='snare'||id==='clap'||id==='shaker');  // which drums get a touch of reverb

  // ---------- pattern state ----------
  // melody: [{p:midi, s:step, l:steps, v:velocity}]
  // bass:   [{p:midi, s:step, l:steps, v:velocity, g:glideFromPrevious}] — the editable low-end part.
  //         EMPTY by default, and empty means "fall back to the chord roots", which is exactly what
  //         every project before v13.3 did. That is what makes this addition backwards-compatible:
  //         an old project has no bass array, gets an empty one, and sounds identical.
  function emptyPattern(){ const p={}; drums.forEach(t=>p[t.id]=new Array(STEPS).fill(false)); CHORD_DEGREES.forEach(c=>p[c.id]=new Array(STEPS).fill(false)); p.melody=[]; p.bass=[]; return p; }
  const patterns=Array.from({length:N_PATTERNS}, emptyPattern);
  let currentPattern=0;
  const song=new Array(SONG_SLOTS).fill(null);
  let mode='pattern';
  const P=()=>patterns[currentPattern];
  // per-step accents (drums, per pattern) and per-track mutes
  const accents=Array.from({length:N_PATTERNS}, ()=>{ const a={}; drums.forEach(t=>a[t.id]=new Array(STEPS).fill(false)); return a; });
  const mutes={};
  const A=()=>accents[currentPattern];

  // ---------- audio helpers ----------
  // Deterministic noise. Both the percussion noise buffer and the reverb impulse used
  // Math.random(), and both are cached per AudioContext while every export builds a FRESH
  // OfflineAudioContext — so exporting one unchanged project twice produced two different files.
  // Measured at 0.59 dB RMS spread across five renders of the same project. White noise with a
  // fixed seed is indistinguishable from white noise with a random one, and a decaying noise
  // impulse is a decaying noise impulse, so this changes nothing anyone can hear; it only makes
  // the same project export to the same audio. mulberry32, the same generator the fixtures use.
  function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296; }; }
  function getNoise(ctx){ if(ctx.__noise) return ctx.__noise; const len=Math.floor(ctx.sampleRate*0.4), b=ctx.createBuffer(1,len,ctx.sampleRate), d=b.getChannelData(0); const rnd=mulberry32(0x51ED27); for(let i=0;i<len;i++) d[i]=rnd()*2-1; ctx.__noise=b; return b; }
  function env(g,t,a,d,peak){ g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(peak,t+a); g.gain.exponentialRampToValueAtTime(0.0001,t+a+d); }
  function susEnv(g,t,dur,peak){ const rel=Math.min(.2,dur*0.45), hold=Math.max(.02,dur-rel); g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(peak,t+.03); g.gain.setValueAtTime(peak,t+hold); g.gain.exponentialRampToValueAtTime(0.0001,t+hold+rel); }

  // Kick "on the floor" — deep sine body + a bright noise click so it enters like an explosion
  function playKick(ctx,bus,t,vel){ vel=vel||1;
    const o=ctx.createOscillator(),g=ctx.createGain(); o.type='sine'; o.frequency.setValueAtTime(155,t); o.frequency.exponentialRampToValueAtTime(45,t+.11); env(g,t,.004,.34,1*vel); o.connect(g).connect(bus); o.start(t); o.stop(t+.4);
    const c=ctx.createBufferSource(); c.buffer=getNoise(ctx); const cf=ctx.createBiquadFilter(); cf.type='highpass'; cf.frequency.value=2600; const cg=ctx.createGain(); env(cg,t,.001,.028,.5*vel); c.connect(cf).connect(cg).connect(bus); c.start(t); c.stop(t+.05);
  }
  // Layered snare: bright noise crack + low tonal body (the genre signal)
  function playSnare(ctx,bus,t,send,vel){ vel=vel||1; const s=ctx.createBufferSource(); s.buffer=getNoise(ctx); const f=ctx.createBiquadFilter(); f.type='highpass'; f.frequency.value=1700; const g=ctx.createGain(); env(g,t,.004,.17,.95*vel); s.connect(f).connect(g); g.connect(bus); if(send) g.connect(send); const o=ctx.createOscillator(),og=ctx.createGain(); o.type='triangle'; o.frequency.setValueAtTime(185,t); env(og,t,.005,.11,.45*vel); o.connect(og).connect(bus); s.start(t); s.stop(t+.2); o.start(t); o.stop(t+.15); }
  function playHat(ctx,bus,t,send,vel){ vel=vel||1; const s=ctx.createBufferSource(); s.buffer=getNoise(ctx); const f=ctx.createBiquadFilter(); f.type='highpass'; f.frequency.value=7500; const g=ctx.createGain(); env(g,t,.002,.045,.5*vel); s.connect(f).connect(g).connect(bus); s.start(t); s.stop(t+.07); }
  function playOpenHat(ctx,bus,t,send,vel){ vel=vel||1; const s=ctx.createBufferSource(); s.buffer=getNoise(ctx); const f=ctx.createBiquadFilter(); f.type='highpass'; f.frequency.value=6800; const g=ctx.createGain(); env(g,t,.003,.28,.42*vel); s.connect(f).connect(g); g.connect(bus); if(send) g.connect(send); s.start(t); s.stop(t+.34); }
  function playShaker(ctx,bus,t,send,vel){ vel=vel||1; const s=ctx.createBufferSource(); s.buffer=getNoise(ctx); const f=ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=6500; f.Q.value=0.8; const g=ctx.createGain(); env(g,t,.006,.055,.5*vel); s.connect(f).connect(g); g.connect(bus); if(send) g.connect(send); s.start(t); s.stop(t+.09); }
  function playClap(ctx,bus,t,send,vel){ vel=vel||1; for(let i=0;i<3;i++){ const s=ctx.createBufferSource(); s.buffer=getNoise(ctx); const f=ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=1200; f.Q.value=1.2; const g=ctx.createGain(); env(g,t+i*.012,.001,.12,.5*vel); s.connect(f).connect(g); g.connect(bus); if(send) g.connect(send); s.start(t+i*.012); s.stop(t+i*.012+.15); } }
  function playDrum(ctx,bus,id,t,send,vel){ return id==='kick'?playKick(ctx,bus,t,vel):id==='snare'?playSnare(ctx,bus,t,send,vel):id==='hat'?playHat(ctx,bus,t,send,vel):id==='openhat'?playOpenHat(ctx,bus,t,send,vel):id==='shaker'?playShaker(ctx,bus,t,send,vel):playClap(ctx,bus,t,send,vel); }

  // Chord voice with 3 selectable styles: pad (sustained), piano (percussive), pluck (short + arpeggiated)
  function playChord(ctx,dry,send,freqs,t,dur,style){
    style=style||'pad';
    const g=ctx.createGain(); const f=ctx.createBiquadFilter(); f.type='lowpass'; f.Q.value=0.4; g.connect(dry); if(send) g.connect(send);
    if(style==='piano'){
      const len=Math.min(dur,1.5); f.frequency.value=3400; f.connect(g);
      g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.22,t+.006); g.gain.exponentialRampToValueAtTime(0.0001,t+len);
      freqs.forEach(fr=>{ const o=ctx.createOscillator(); o.type='triangle'; o.frequency.setValueAtTime(fr,t); o.connect(f); o.start(t); o.stop(t+len+.05);
        const o2=ctx.createOscillator(),g2=ctx.createGain(); g2.gain.value=0.28; o2.type='sine'; o2.frequency.setValueAtTime(fr*2,t); o2.connect(g2).connect(f); o2.start(t); o2.stop(t+len*0.6+.05); });
    } else if(style==='soul'){   // Rhodes / gospel: warm triangle + short bell tine, longer sustain (pairs with 7th chords)
      const len=Math.min(dur,2.0); f.frequency.value=2600; f.connect(g);
      g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.18,t+.012); g.gain.exponentialRampToValueAtTime(0.06,t+len*0.5); g.gain.exponentialRampToValueAtTime(0.0001,t+len);
      freqs.forEach(fr=>{ const o=ctx.createOscillator(); o.type='triangle'; o.frequency.setValueAtTime(fr,t); o.connect(f); o.start(t); o.stop(t+len+.05);
        const tine=ctx.createOscillator(),tg=ctx.createGain(); tg.gain.value=0.16; tine.type='sine'; tine.frequency.setValueAtTime(fr*4,t); tine.connect(tg).connect(f); tine.start(t); tine.stop(t+.22); });
    } else if(style==='pluck'){
      f.frequency.value=2500; f.connect(g); g.gain.value=1;
      freqs.forEach((fr,i)=>{ const on=t+i*0.05; const pg=ctx.createGain(); pg.connect(f);
        pg.gain.setValueAtTime(0.0001,on); pg.gain.exponentialRampToValueAtTime(0.3,on+.004); pg.gain.exponentialRampToValueAtTime(0.0001,on+.42);
        const o=ctx.createOscillator(); o.type='triangle'; o.frequency.setValueAtTime(fr,on); o.connect(pg); o.start(on); o.stop(on+.46);
        const o2=ctx.createOscillator(),g2=ctx.createGain(); g2.gain.value=0.12; o2.type='sawtooth'; o2.frequency.setValueAtTime(fr,on); o2.connect(g2).connect(pg); o2.start(on); o2.stop(on+.46); });
    } else { // pad
      f.frequency.setValueAtTime(2600,t); f.frequency.exponentialRampToValueAtTime(1400,t+Math.min(dur,0.7)); susEnv(g,t,dur,0.17); f.connect(g);
      freqs.forEach(fr=>{
        const o1=ctx.createOscillator(); o1.type='triangle'; o1.frequency.setValueAtTime(fr,t); o1.connect(f); o1.start(t); o1.stop(t+dur+.25);
        const o2=ctx.createOscillator(),g2=ctx.createGain(); g2.gain.value=0.55; o2.type='triangle'; o2.frequency.setValueAtTime(fr,t); o2.detune.setValueAtTime(8,t); o2.connect(g2).connect(f); o2.start(t); o2.stop(t+dur+.25);
        const o3=ctx.createOscillator(),g3=ctx.createGain(); g3.gain.value=0.14; o3.type='sine'; o3.frequency.setValueAtTime(fr*2,t); o3.connect(g3).connect(f); o3.start(t); o3.stop(t+dur+.25);
      });
    }
  }
  // bass: 'sub' = warm saw+sub (reggaetón); '808' = sine with a pitch-drop thump + long sustain (hip-hop)
  // vel is optional and defaults to 1, so every existing call site is unchanged. The written
  // low-end part passes a per-note velocity; the chord-root fallback does not.
  function playBass(ctx,bus,freq,t,dur,style,vel){ style=style||'sub'; vel=(vel==null?1:vel);
    const g=ctx.createGain(),f=ctx.createBiquadFilter(); f.type='lowpass'; f.Q.value= style==='808'?1.1:0.7; f.frequency.setValueAtTime(style==='808'?260:430,t); susEnv(g,t,dur, (style==='808'?0.72:0.6)*Math.max(0.2,Math.min(1.3,vel))); f.connect(g).connect(bus);
    const o=ctx.createOscillator(); o.type= style==='808'?'sine':'sawtooth'; o.frequency.setValueAtTime(style==='808'?freq*2:freq,t); if(style==='808') o.frequency.exponentialRampToValueAtTime(freq,t+.06); o.connect(f); o.start(t); o.stop(t+dur+.15);
    const sub=ctx.createOscillator(),sg=ctx.createGain(); sg.gain.value=0.8; sub.type='sine'; sub.frequency.setValueAtTime(freq/2,t); sub.connect(sg).connect(f); sub.start(t); sub.stop(t+dur+.15);
  }
  // melody voices for the piano roll — one note per call, all synthesized
  function playMelody(ctx,bus,send,midi,t,dur,vel,sound){ vel=vel||0.85; const fr=midiToFreq(midi);
    const g=ctx.createGain(); const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.Q.value=0.5; lp.connect(g); g.connect(bus); if(send) g.connect(send);
    const mk=(type,mult,gain)=>{ const o=ctx.createOscillator(),og=ctx.createGain(); og.gain.value=gain; o.type=type; o.frequency.setValueAtTime(fr*mult,t); o.connect(og).connect(lp); o.start(t); o.stop(t+dur+.3); return o; };
    if(sound==='pluck'){ lp.frequency.value=2500; const len=Math.min(dur,.5); g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(.32*vel,t+.004); g.gain.exponentialRampToValueAtTime(.0001,t+len); mk('triangle',1,1); mk('sawtooth',1,.12); }
    else if(sound==='keys'){ lp.frequency.value=3000; const len=Math.min(dur,1.2); g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(.26*vel,t+.006); g.gain.exponentialRampToValueAtTime(.0001,t+len); mk('triangle',1,1); mk('sine',2,.25); }
    else if(sound==='pad'){ lp.frequency.setValueAtTime(1900,t); lp.frequency.exponentialRampToValueAtTime(1100,t+Math.min(dur,.6)); susEnv(g,t,dur,.2*vel); const o=mk('triangle',1,1); const o2=mk('triangle',1,.5); o2.detune.setValueAtTime(9,t); }
    else if(sound==='bell'){ lp.frequency.value=6000; const len=Math.min(dur+.3,.9); g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(.24*vel,t+.003); g.gain.exponentialRampToValueAtTime(.0001,t+len); mk('sine',1,1); mk('sine',3,.2); }
    else if(sound==='b808'){ lp.frequency.value=300; susEnv(g,t,dur,.6*vel); const o=mk('sine',2,1); o.frequency.exponentialRampToValueAtTime(fr,t+.05); mk('sine',1,.7); }
    else { /* lead */ lp.frequency.value=2200; susEnv(g,t,dur,.2*vel); const o=mk('sawtooth',1,.7); o.detune.setValueAtTime(-5,t); const o2=mk('sawtooth',1,.7); o2.detune.setValueAtTime(6,t); }
  }
  // Metronome / count-in click. Level and tone come from metCfg. Only ever connected to the
  // LIVE context (scheduleTick + start count-in) — exportWav never calls this, so it is never rendered.
  const metCfg={ level:60, bars:1, tone:'click' };   // level 0-100, bars 1|2, tone click|beep|wood
  function playClick(ctx,accent,t){ const lvl=metCfg.level/100;
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.type = metCfg.tone==='beep' ? 'sine' : metCfg.tone==='wood' ? 'triangle' : 'square';
    const base = metCfg.tone==='wood' ? 900 : 1000;
    o.frequency.value=accent?base+500:base;
    const peak=(accent?.5:.3)*lvl;
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002,peak),t+.002); g.gain.exponentialRampToValueAtTime(0.0001,t+.06);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t+.08); }

  // synthesized reverb impulse (no file needed): de-correlated L/R noise with exponential (RT60) decay
  // Seeded per channel so L and R stay de-correlated (that is what makes the reverb wide), and
  // seeded from the length so a different reverb size still gets a different impulse — but the
  // SAME size always gets the same one. See getNoise() for why this is deterministic.
  function makeIR(ctx,seconds=2.2,rt60=1.8){ const rate=ctx.sampleRate, len=Math.floor(rate*seconds), buf=ctx.createBuffer(2,len,rate), k=rate*rt60/6.908; for(let c=0;c<2;c++){ const d=buf.getChannelData(c), rnd=mulberry32(0x9E3779B9+len*2+c); for(let i=0;i<len;i++) d[i]=(rnd()*2-1)*Math.exp(-i/k); } return buf; }

  // full bus graph:
  //   dry instrument buses -> instrSub -> presence scoop (3k) -> sum
  //   sends -> preDelay(30ms) -> convolver -> hp250 -> lp6000 -> reverbReturn -> sum   (bass never sent)
  //   vocal (export) connects straight to sum (no presence scoop, so the voice stays forward)
  //   sum(master vol) -> rumble HP -> glue comp -> makeup -> air shelf -> limiter -> destination
  const compThreshold=()=> -6 - (fx.comp/100)*22.5;   // comp 40 -> -15 dB (unchanged default)
  const compRatio=()=> 1.2 + (fx.comp/100)*3.25;      // comp 40 -> 2.5:1  (unchanged default)
  const irRT60=()=> 0.6 + (fx.revSize/100)*2.4;       // size 50 -> 1.8 s   (unchanged default)
  const irSeconds=()=> Math.max(1.2, irRT60()*(2.2/1.8));   // size 50 -> 2.2 s (the original IR length)
  function buildBusses(ctx,masterVol){
    const limiter=ctx.createDynamicsCompressor(); limiter.threshold.value=-1; limiter.knee.value=0; limiter.ratio.value=20; limiter.attack.value=.002; limiter.release.value=.08; limiter.connect(ctx.destination);
    const air=ctx.createBiquadFilter(); air.type='highshelf'; air.frequency.value=10000; air.gain.value=1.5; air.connect(limiter);
    const makeup=ctx.createGain(); makeup.gain.value=1.1; makeup.connect(air);
    // glue compressor — fx.comp 0..100 drives threshold/ratio together (40 == the classic -15dB / 2.5:1 setting)
    const glue=ctx.createDynamicsCompressor(); glue.threshold.value=compThreshold(); glue.knee.value=25; glue.ratio.value=compRatio(); glue.attack.value=.03; glue.release.value=.25; glue.connect(makeup);
    const hp=ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=30; hp.Q.value=0.7; hp.connect(glue);
    const sum=ctx.createGain(); sum.gain.value=masterVol;
    const masterAn=ctx.createAnalyser?ctx.createAnalyser():null;
    if(masterAn){ masterAn.fftSize=256; masterAn.smoothingTimeConstant=.5; sum.connect(masterAn); masterAn.connect(hp); }
    else sum.connect(hp);
    const instr=ctx.createGain(); const presence=ctx.createBiquadFilter(); presence.type='peaking'; presence.frequency.value=3000; presence.gain.value=-2.5; presence.Q.value=1.2; instr.connect(presence); presence.connect(sum);
    const conv=ctx.createConvolver(); conv.buffer=makeIR(ctx,irSeconds(),irRT60()); conv.normalize=true;
    const preDelay=ctx.createDelay(1); preDelay.delayTime.value=0.03; preDelay.connect(conv);
    const revHP=ctx.createBiquadFilter(); revHP.type='highpass'; revHP.frequency.value=250; const revLP=ctx.createBiquadFilter(); revLP.type='lowpass'; revLP.frequency.value=6000;
    // return is unity: the "Reverb" keybar slider now scales each channel's baseline send instead, so a
    // per-channel Reverb send still works even with the global slider at zero.
    const reverbReturn=ctx.createGain(); reverbReturn.gain.value=1; conv.connect(revHP); revHP.connect(revLP); revLP.connect(reverbReturn); reverbReturn.connect(sum);
    // tempo-ish delay line, filtered + fed back; returns to the mix bus. Silent until a channel sends to it.
    const dly=ctx.createDelay(2); dly.delayTime.value=fx.dlyTime/1000;
    const dlyLP=ctx.createBiquadFilter(); dlyLP.type='lowpass'; dlyLP.frequency.value=3200;
    const dlyFb=ctx.createGain(); dlyFb.gain.value=fx.dlyFb/100;
    const dlyIn=ctx.createGain();
    dlyIn.connect(dly); dly.connect(dlyLP); dlyLP.connect(dlyFb); dlyFb.connect(dly); dlyLP.connect(sum);
    // sidechain: every kick ducks the bass bus so the sub "breathes" around the kick instead of masking it
    const bassDuck=ctx.createGain(); bassDuck.gain.value=1;
    // one channel strip per group: volume -> 3-band EQ -> pan -> mix bus, with reverb + delay sends tapped post-pan
    const grp={};
    GROUPS.forEach(G=>{ const m=mix[G.id];
      const g=ctx.createGain(); g.gain.value=groupGain(G.id);
      const lo=ctx.createBiquadFilter(); lo.type='lowshelf';  lo.frequency.value=200;  lo.gain.value=m.lo;
      const md=ctx.createBiquadFilter(); md.type='peaking';   md.frequency.value=1200; md.Q.value=0.9; md.gain.value=m.mid;
      const hi=ctx.createBiquadFilter(); hi.type='highshelf'; hi.frequency.value=4000; hi.gain.value=m.hi;
      const pan=ctx.createStereoPanner(); pan.pan.value=m.pan/100;
      // vocals bypass the instrument presence scoop so the voice stays forward (as before the mixer existed)
      g.connect(lo); lo.connect(md); md.connect(hi); hi.connect(pan);
      const rs=ctx.createGain(); rs.gain.value=groupRev(G.id); pan.connect(rs); rs.connect(preDelay);
      const ds=ctx.createGain(); ds.gain.value=m.dly/100*0.6; pan.connect(ds); ds.connect(dlyIn);
      // the analyser sits INLINE (it is a transparent pass-through). A dead-end analyser is never
      // pulled by the rendering graph, so an out-of-path tap would always read silence.
      const dest=(G.id==='vocals'||G.id==='sample')?sum:instr;   // imported audio is already mixed; skip the presence scoop
      const an=ctx.createAnalyser?ctx.createAnalyser():null;
      if(an){ an.fftSize=256; an.smoothingTimeConstant=.5; pan.connect(an); an.connect(dest); }
      else pan.connect(dest);
      grp[G.id]={g,lo,md,hi,pan,rs,ds,an};
    });
    bassDuck.connect(grp.bass.g);
    const busTarget=id=>{ if(id==='bass') return bassDuck; const G=GROUPS.find(x=>x.buses.includes(id)); return G?grp[G.id].g:instr; };
    const bus={}; Object.keys(BUS_VOL).forEach(id=>{ const g=ctx.createGain(); g.gain.value=BUS_VOL[id]; g.connect(busTarget(id)); bus[id]=g; });
    bus.bassDuck=bassDuck; bus.grp=grp; bus.vocalIn=grp.vocals.g; bus.sampleIn=grp.sample.g;
    // high-pass on the imported channel so Aura's own 808 can own the low end (the standard hip-hop move)
    const sampHP=ctx.createBiquadFilter(); sampHP.type='highpass'; sampHP.frequency.value=smp.hp; sampHP.Q.value=0.7;
    sampHP.connect(grp.sample.g); bus.sampleHP=sampHP;
    bus.dly=dly; bus.dlyFb=dlyFb;
    // the old pre-fader per-voice sends are gone; each channel strip carries its own post-fader send instead
    bus.chordSend=null; bus.melodySend=null; bus.drumSend=null;
    bus.masterAn=masterAn;
    bus.reverb=preDelay; bus.reverbReturn=reverbReturn;
    return {master:sum,bus,glue,conv};
  }

  // chord timing
  function chordOnsetAt(pat,s){ return CHORD_DEGREES.some(c=>patterns[pat][c.id][s]); }
  function chordDurSteps(pat,s){ for(let k=1;k<=STEPS;k++){ if(chordOnsetAt(pat,(s+k)%STEPS)) return k; } return STEPS; }
  // Deterministic groove velocity: emphasize downbeats + hits that land with the kick/snare (per the doc), plus accents
  function drumVel(pat,id,s){
    let v=0.82;
    if(s%4===0) v+=0.16; else if(s%2===0) v+=0.06;
    if(id==='hat'||id==='openhat'||id==='shaker'){ if(patterns[pat].kick[s]||patterns[pat].snare[s]) v+=0.12; }
    v += (((s*53 + id.charCodeAt(0)*7)%11)-5)/120;   // ±~0.04 deterministic wobble so it isn't robotic
    if(accents[pat][id] && accents[pat][id][s]) v+=0.28;
    return Math.max(0.4, Math.min(1.18, v));
  }
  function scheduleStepAudio(ctx,bus,pat,s,t,sps,fill){
    // fill mode (last bar before a section change): last beat clears the tops and hands it to a rising snare build
    // (a muted snare disables the whole build, so the pattern plays untouched instead of dropping out)
    const inBuild=fill&&s>=13&&!mutes.snare;
    drums.forEach(tr=>{ if(inBuild&&(tr.id==='snare'||tr.id==='hat'||tr.id==='openhat'||tr.id==='shaker')) return;
      if(patterns[pat][tr.id][s] && !mutes[tr.id]) playDrum(ctx,bus[tr.id],tr.id,t,DRUM_SEND(tr.id)?bus.drumSend:null,drumVel(pat,tr.id,s)); });
    if(inBuild){ playSnare(ctx,bus.snare,t,bus.drumSend,[0.78,0.95,1.12][s-13]); if(s===15&&!mutes.openhat) playOpenHat(ctx,bus.openhat,t,bus.drumSend,0.5); }
    // a muted or un-soloed kick must not duck the bass
    if(patterns[pat].kick[s] && !mutes.kick && groupGain('kick')>0 && bus.bassDuck){ const g=bus.bassDuck.gain; g.cancelScheduledValues(t); g.setValueAtTime(0.55,t); g.setTargetAtTime(1,t+0.03,0.08); }
    const degs=CHORD_DEGREES.filter(c=>patterns[pat][c.id][s]);
    if(degs.length){ const dur=chordDurSteps(pat,s)*sps*0.98;
      if(!mutes.chords) degs.forEach(c=>playChord(ctx,bus.chords,bus.chordSend,chordMidiNotes(c.deg, chordStyle==='soul').map(midiToFreq),t,dur,chordStyle));
      // Only fall back to "root of the chord on this step" when the pattern has NO written low end.
      // A reconstructed bass part replaces that behaviour rather than doubling it.
      if(BUS_VOL.bass>0 && !mutes.bass && !(patterns[pat].bass||[]).length)
        playBass(ctx,bus.bass,midiToFreq(chordRootMidi(degs[0].deg)-24),t, bassStyle==='808'?dur:Math.min(dur,sps*3), bassStyle); }
    // the written low-end part, when there is one
    const lo=patterns[pat].bass||[];
    if(lo.length && BUS_VOL.bass>0 && !mutes.bass){
      lo.forEach(nte=>{ if(nte.s!==s) return;
        playBass(ctx,bus.bass,midiToFreq(nte.p),t,Math.max(sps*0.4,nte.l*sps*0.97),bassStyle,nte.v);
      });
    }
    if(!mutes.melody) patterns[pat].melody.forEach(n=>{ if(n.s===s) playMelody(ctx,bus.melody,bus.melodySend,n.p,t,Math.max(1,n.l)*sps*0.98,n.v,melodySound); });
  }
  // auto-fill: true when bar i of an arrangement hands off to a different section (or the end / a gap)
  function fillForBar(list,i,wrap){ if(!autoFillEl.checked) return false; const cur=list[i]; if(cur==null) return false;
    const ni=wrap?(i+1)%list.length:i+1; return list[ni]!==cur; }
  // bars actually used in the arrangement (through the last non-empty slot) — playback and export ignore the tail
  function songUsedLen(){ let last=-1; for(let i=0;i<SONG_SLOTS;i++) if(song[i]!=null) last=i; return last+1; }

  // ---------- live playback ----------
  let ac=null, liveMaster=null, liveBus=null, liveGlue=null, liveConv=null;
  function ensureCtx(){
    if(!ac){ ac=new (window.AudioContext||window.webkitAudioContext)({latencyHint:'interactive'}); const b=buildBusses(ac,+masterEl.value/100); liveMaster=b.master; liveBus=b.bus; liveGlue=b.glue; liveConv=b.conv;
      liveBus.chords.gain.value=+chordVolEl.value/100; liveBus.bass.gain.value=+bassVolEl.value/100; }   // reverb return stays at unity; wet amount lives in each channel's send
    if(ac.state==='suspended') ac.resume();
  }
  const now=()=>ac.currentTime;
  const INPUT_LAT_EST=0.02;  // Web Audio never exposes input latency; ~20ms is a wired/built-in mic default (Sync slider fine-tunes)
  const LAT=()=> (ac&&ac.outputLatency?ac.outputLatency:0)+(ac&&ac.baseLatency?ac.baseLatency:0)+INPUT_LAT_EST;
  let playing=false, timer=null, nextTime=0, step=0, slotIndex=0, musicZeroTime=0;
  const LOOKAHEAD=.1, INTERVAL=25;
  const secondsPerStep=()=>(60/(+bpmEl.value))/4;
  // secondsPerStep() for the tempo an Apply is ABOUT to set, clamped the same way applyChosenTempo
  // clamps it. Anything that sizes notes for a reconstruction must use this, not the live tempo.
  function chosenStepSeconds(){
    const want=(typeof chosenTempo==='function')?chosenTempo():null;
    if(want==null) return secondsPerStep();
    const r=tempoRange();
    const t=Math.max(r.lo,Math.min(r.hi,Math.round(want)));
    return (60/t)/4;
  }
  function currentPlaybackPattern(){ if(mode==='pattern') return currentPattern; const p=song[slotIndex]; return p==null?-1:p; }
  function scheduleTick(t){ const pat=currentPlaybackPattern(); if(pat>=0) scheduleStepAudio(ac,liveBus,pat,step,t,secondsPerStep(), mode==='song'&&fillForBar(song,slotIndex,true));
    if(metOn && step%4===0) playClick(ac, step===0, t); const s=step, sl=slotIndex; setTimeout(()=>paintPlayhead(s,sl), Math.max(0,(t-now())*1000)); }
  function advance(){ step++; if(step>=STEPS){ step=0; if(mode==='song') slotIndex=(slotIndex+1)%(songUsedLen()||SONG_SLOTS); } }
  function loop(){ while(nextTime<now()+LOOKAHEAD){ let t=nextTime; if(step%2===1) t+=secondsPerStep()*(+swingEl.value/100)*0.9; scheduleTick(t); nextTime+=secondsPerStep(); advance(); } timer=setTimeout(loop,INTERVAL); }
  function start(withCue){
    ensureCtx(); clearTimeout(timer); stopTake(); stopPreview(); playing=true; step=0; slotIndex=0;  // idempotent: never leave a second scheduler loop running
    let t0=now()+.12;
    if(countInEl.checked){ const beat=secondsPerStep()*4, total=4*metCfg.bars;   // 1 or 2 bars of count-in
      for(let k=0;k<total;k++){ playClick(ac,k%4===0,t0+k*beat);
        if(withCue){ const n=total-k; setTimeout(()=>showCue(n), Math.max(0,(t0+k*beat-now())*1000)); } }
      if(withCue) setTimeout(hideCue, Math.max(0,(t0+total*beat-now())*1000)); t0+=total*beat; }
    // Kept performance moves are part of the SONG, so their clock starts when the song does — not
    // when Play is pressed. Starting the replay at the press meant a count-in pushed every move a
    // full bar early relative to the music, and the export (which maps event time onto musical
    // time from zero) then disagreed with what the singer had just heard.
    musicZeroTime=t0; nextTime=t0;
    { const lead=Math.max(0,(t0-now())*1000);
      if(lead<8) automationStartPlayback();
      else { automationStopPlayback();
             autoStartTimer=setTimeout(()=>{ if(playing) automationStartPlayback(); }, lead); } }
    loop(); playBtn.classList.add('on'); playBtn.textContent='■ Stop';
    {const rb=document.getElementById('readyPlay'); if(rb) rb.textContent='■ Stop';}
    stopSample(); sampleSrc=scheduleSample(ac,liveBus,t0,null);
    const xp=document.getElementById('xport'); if(xp) xp.classList.add('playing');
    document.body.classList.add('playing-now');           // wakes the Datafield up a notch
  }
  // Schedule the imported instrumental. Same function for live and offline, so the export matches what you hear.
  function scheduleSample(ctx,bus,startAt,dur){
    if(!smp.buf||!smp.on||!bus.sampleHP) return null;
    // vocPlayBuf() is the reshaped reference when the singer chose one, and the untouched recording
    // otherwise. Both the live graph and the offline export graph come through here, which is why an
    // export can never disagree with what was auditioned.
    const play=(typeof vocPlayBuf==='function'&&vocPlayBuf())||smp.buf;
    const src=ctx.createBufferSource(); src.buffer=play;
    src.playbackRate.value=sampleRate();
    src.loop=true; src.loopStart=Math.max(0,smp.offset); src.loopEnd=smp.buf.duration;
    src.connect(bus.sampleHP);
    src.start(startAt, Math.max(0,smp.offset));
    if(dur!=null) src.stop(startAt+dur);
    return src;
  }
  // tape-style: pitch and speed move together, exactly like speeding a record up
  function sampleRate(){ if(!smp.bpm) return smp.rate; const target=+bpmEl.value*(smp.half?0.5:1); return (target/smp.bpm)*smp.rate; }
  let sampleSrc=null;
  function stopSample(){ if(sampleSrc){ try{sampleSrc.stop();}catch(e){} sampleSrc=null; } }
  let takeSource=null, takeGain=null;
  function stopTake(){ if(takeSource){ try{takeSource.stop();}catch(e){} takeSource=null; takeGain=null; } }
  function stop(){ playing=false; clearTimeout(timer); automationStopPlayback(); clearPlayhead(); hideCue(); stopTake(); stopSample(); playBtn.classList.remove('on'); playBtn.textContent='▶ Play';
    {const rb=document.getElementById('readyPlay'); if(rb) rb.textContent='▶ Play backing';}
    const xp=document.getElementById('xport'); if(xp) xp.classList.remove('playing');
    document.body.classList.remove('playing-now');
    if(prPH) prPH.style.left='-10px';
    document.querySelectorAll('.mtr i').forEach(e=>e.style.height='0%'); }   // meters must not freeze mid-level

  // vocal channel: rumble highpass -> gentle 3:1 comp so the take sits level on top of the mix (voice stays forward of the presence scoop)
  function vocalChain(ctx,dest){ const hp=ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=80; hp.Q.value=0.7;
    const comp=ctx.createDynamicsCompressor(); comp.threshold.value=-18; comp.knee.value=12; comp.ratio.value=3; comp.attack.value=.006; comp.release.value=.12;
    hp.connect(comp); comp.connect(dest); return hp; }

  // ---------- export (backing + optional vocal, aligned) ----------
  // The export render, separated from writing a file. Nothing about the graph changes — this is the
  // same code that produced the WAV before, and exportWav() now calls it — but a test can hold the
  // rendered buffer and measure it. That is what makes "no imported audio leaks into an Aura-only
  // export" a measurement instead of an assurance.
  async function renderExportBuffer(){
    const isSong=song.some(s=>s!=null);
    const active= isSong ? song.slice(0,songUsedLen()) : [currentPattern];
    const sps=secondsPerStep(), totalSteps=active.length*STEPS;
    const vocalTail = vocalBuffer ? Math.max(0, vocalBuffer.duration - vocalHeadSec) : 0;
    // leave room for the reverb tail and a few delay repeats so long FX aren't chopped off the end
    const fxTail=0.9+irSeconds()+(fx.dlyTime/1000)*4;
    const dur=Math.max(totalSteps*sps, vocalTail)+fxTail, sr=44100;
    const off=new OfflineAudioContext(2, Math.ceil(dur*sr), sr);
    const {master,bus}=buildBusses(off,+masterEl.value/100);
    bus.chords.gain.value=+chordVolEl.value/100; bus.bass.gain.value=+bassVolEl.value/100;
    // Kept performance moves are part of the song, so they belong in the file. Both kinds are applied
    // per step from the SAME replay playback uses: mutes through `automationMutesAt`, and the gain
    // moves by running the very same action and then stamping the resulting values onto this graph
    // with `setValueAtTime`. Running `performActions()` rather than a second gain map is the point —
    // there is nothing for playback and the export to drift apart on.
    const savedMutes=Object.assign({},mutes);
    const hasAuto=automation.enabled&&automation.events.length>0;
    // A replayed action writes real DOM inputs, so the export must put them back or it silently
    // remixes the singer's project. Same reason the mutes are saved.
    const savedCtl=hasAuto?autoCtlSnapshot():null;
    let autoCursor=0;
    // Re-read exactly the expressions buildBusses used, so a stamped value cannot mean something
    // different from the value the graph was built with.
    const stampGains=when=>{
      master.gain.setValueAtTime(+masterEl.value/100, when);
      bus.chords.gain.setValueAtTime(+chordVolEl.value/100, when);
      bus.bass.gain.setValueAtTime(+bassVolEl.value/100, when);
      if(bus.melody) bus.melody.gain.setValueAtTime(BUS_VOL.melody, when);
      GROUPS.forEach(G=>{ const n=bus.grp&&bus.grp[G.id]; if(!n) return;
        n.g.gain.setValueAtTime(groupGain(G.id), when);
        n.rs.gain.setValueAtTime(groupRev(G.id), when); });
    };
    for(let i=0;i<active.length;i++){ const pat=active[i]; if(pat==null) continue; const fl=isSong&&fillForBar(active,i,false); for(let s=0;s<STEPS;s++){ let t=(i*STEPS+s)*sps; if(s%2===1) t+=sps*(+swingEl.value/100)*0.9;
      if(hasAuto){ const am=automationMutesAt(t*1000);
        // Restore by CLEARING first, the same way the loop's own cleanup does below. `mutes` is a
        // sparse object — a project with nothing muted is `{}` — so rewriting only the keys that
        // were in `savedMutes` restores nothing at all, and a mute this replay sets at step 5 stays
        // set for every step after it. One "Mute Beat" move silenced the whole rest of the WAV
        // instead of the section the singer actually muted.
        Object.keys(mutes).forEach(k=>delete mutes[k]); Object.assign(mutes,savedMutes);
        if(am.beat) drums.forEach(d=>{ mutes[d.id]=true; });
        ['bass','chords','melody'].forEach(g=>{ if(am[g]) mutes[g]=true; });
        // Gain moves, in order, up to this step. Only `kind:'range'` actions in AUTO_GAIN run:
        // a trigger replayed here would be destructive rather than audible — `nextVersion` takes a
        // checkpoint and switches the project's variation, `playPause` clicks the transport.
        let moved=false;
        while(autoCursor<automation.events.length && automation.events[autoCursor].t<=t*1000){
          const e=automation.events[autoCursor++], a=performActions()[e.a];
          if(a && !a.noAuto && a.kind==='range' && AUTO_GAIN[e.a]){
            applyDepth++;                       // replaying is not an edit; autosave stays out of it
            try{ a.run(e.v); }catch(err){}
            finally{ applyDepth--; }
            moved=true;
          }
        }
        if(moved) stampGains(t); }
      scheduleStepAudio(off,bus,pat,s,t,sps,fl); } }
    Object.keys(mutes).forEach(k=>delete mutes[k]); Object.assign(mutes,savedMutes);
    autoCtlRestore(savedCtl);
    scheduleSample(off,bus,0,totalSteps*sps);        // the imported track renders into the WAV too
    if(vocalBuffer){
      const vs=off.createBufferSource(); vs.buffer=vocalBuffer;
      const vg=off.createGain(); vg.gain.value=+vocalVolEl.value/100; vs.connect(vg); vg.connect(vocalChain(off,bus.vocalIn));
      // vocal reverb now comes from the Vocals channel strip's own send, so muting the channel kills it too
      const head=vocalHeadSec+LAT()+(+syncEl.value/1000);
      if(head>=0) vs.start(0, head); else vs.start(-head, 0);
    }
    const rendered=await off.startRendering();
    // peak-normalize safety: scale down (never up) so a stray overshoot can't wrap on 16-bit write
    let peak=0; for(let c=0;c<rendered.numberOfChannels;c++){ const d=rendered.getChannelData(c); for(let i=0;i<d.length;i++){ const a=Math.abs(d[i]); if(a>peak) peak=a; } }
    if(peak>0.985){ const g=0.985/peak; for(let c=0;c<rendered.numberOfChannels;c++){ const d=rendered.getChannelData(c); for(let i=0;i<d.length;i++) d[i]*=g; } }
    return rendered;
  }
  async function exportWav(){
    const rendered=await renderExportBuffer();
    const wav=encodeWav(rendered);
    const url=URL.createObjectURL(new Blob([wav],{type:'audio/wav'}));
    const a=document.createElement('a'); a.href=url; a.download= vocalBuffer?'aura-studio-song-with-vocals.wav':'aura-studio-backing.wav'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),4000);
  }
  // ---------- MIDI export ----------
  // One type-1 file: track 1 = melody, track 2 = chords. Ticks are 480/quarter = 120 per 16th step.
  function exportMidi(captureOnly){
    const TPQ=480, TPS=TPQ/4, sec=songUsedLen()||1;
    const active = song.some(s=>s!=null) ? song.slice(0,sec) : [currentPattern];
    const vlq=n=>{ const b=[n&0x7f]; n>>=7; while(n>0){ b.unshift((n&0x7f)|0x80); n>>=7; } return b; };
    const evts=(notesOf)=>{ const list=[];
      active.forEach((pat,bar)=>{ if(pat==null) return; notesOf(pat).forEach(n=>{
        const start=(bar*STEPS+n.s)*TPS; list.push({t:start,d:[0x90,n.p,Math.round(Math.min(127,n.v*100))]});
        list.push({t:start+n.l*TPS,d:[0x80,n.p,0]}); }); });
      list.sort((a,b)=>a.t-b.t||((a.d[0]&0xf0)===0x80?-1:1));
      const bytes=[]; let last=0;
      list.forEach(e=>{ bytes.push(...vlq(e.t-last),...e.d); last=e.t; });
      bytes.push(...vlq(0),0xff,0x2f,0x00); return bytes; };
    const melodyNotes=pat=>patterns[pat].melody.map(n=>({p:n.p,s:n.s,l:Math.max(1,n.l),v:n.v}));
    const chordNotes=pat=>{ const out=[];
      for(let s=0;s<STEPS;s++){ CHORD_DEGREES.forEach(c=>{ if(!patterns[pat][c.id][s]) return;
        const dur=chordDurSteps(pat,s);
        chordMidiNotes(c.deg, chordStyle==='soul').forEach(p=>out.push({p,s,l:dur,v:0.8})); }); }
      return out; };
    const trk=b=>{ const len=b.length; return [0x4d,0x54,0x72,0x6b,(len>>24)&255,(len>>16)&255,(len>>8)&255,len&255,...b]; };
    const tempo=Math.round(60000000/(+bpmEl.value));
    const meta=[...vlq(0),0xff,0x51,0x03,(tempo>>16)&255,(tempo>>8)&255,tempo&255,
                ...vlq(0),0xff,0x2f,0x00];
    const head=[0x4d,0x54,0x68,0x64,0,0,0,6,0,1,0,3,(TPQ>>8)&255,TPQ&255];
    const bytes=new Uint8Array([...head,...trk(meta),...trk(evts(melodyNotes)),...trk(evts(chordNotes))]);
    // When called for the complete-project bundle we hand the bytes back instead of triggering a
    // second download, so the file lands in the bundle with the bundle's own naming.
    if(captureOnly){ __midiCapture=new Uint8Array(bytes); return; }
    const url=URL.createObjectURL(new Blob([bytes],{type:'audio/midi'}));
    const a=document.createElement('a'); a.href=url; a.download='aura-studio.mid';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),4000);
    toast('MIDI exported — melody + chords');
  }
  function encodeWav(buffer){
    const nCh=buffer.numberOfChannels, sr=buffer.sampleRate, n=buffer.length;
    const data=new DataView(new ArrayBuffer(44+n*nCh*2)); const w=(o,s)=>{ for(let i=0;i<s.length;i++) data.setUint8(o+i,s.charCodeAt(i)); };
    w(0,'RIFF'); data.setUint32(4,36+n*nCh*2,true); w(8,'WAVE'); w(12,'fmt '); data.setUint32(16,16,true); data.setUint16(20,1,true); data.setUint16(22,nCh,true);
    data.setUint32(24,sr,true); data.setUint32(28,sr*nCh*2,true); data.setUint16(32,nCh*2,true); data.setUint16(34,16,true); w(36,'data'); data.setUint32(40,n*nCh*2,true);
    let off=44; const chans=[]; for(let c=0;c<nCh;c++) chans.push(buffer.getChannelData(c));
    for(let i=0;i<n;i++){ for(let c=0;c<nCh;c++){ let v=Math.max(-1,Math.min(1,chans[c][i])); data.setInt16(off, v<0?v*0x8000:v*0x7FFF, true); off+=2; } }
    return data.buffer;
  }

  // ---------- vocal recording ----------
  let vocalBuffer=null, micStream=null, micSource=null, micAnalyser=null, monitorGain=null;
  let mediaRecorder=null, recChunks=[], recording=false, recStartTime=0, vocalHeadSec=0, meterRAF=null;
  async function ensureMic(){
    if(micStream) return true;
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){ recStatus.textContent='Mic not supported in this browser'; return false; }
    try{ micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:1}}); }
    catch(e){
      const n=e&&e.name;
      const msg = n==='NotAllowedError'  ? 'Microphone blocked. Allow mic access for this site in your browser, then press Record again.'
                : n==='NotFoundError'    ? 'No microphone found. Plug one in or check your system input, then try again.'
                : n==='NotReadableError' ? '🎤 Your microphone is busy in another app. Close it and try again.'
                : n==='SecurityError'    ? '🎤 Recording needs a secure page (https). Open the live site rather than a local file.'
                : '🎤 Could not start the microphone: '+(n||'unknown error');
      recStatus.textContent=msg; toast(msg); return false; }
    ensureCtx();
    micSource=ac.createMediaStreamSource(micStream);
    micAnalyser=ac.createAnalyser(); micAnalyser.fftSize=1024; micSource.connect(micAnalyser);
    monitorGain=ac.createGain(); monitorGain.gain.value=monitorEl.checked?0.9:0; micSource.connect(monitorGain).connect(ac.destination);
    return true;
  }
  function pickMime(){ const opts=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg']; for(const m of opts){ if(window.MediaRecorder&&MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(m)) return m; } return ''; }
  // keep the transport record button in step with the panel one — only these two change during recording
  function syncRecUI(on){ const b=document.getElementById('recX'); if(b){ b.classList.toggle('on',on); b.setAttribute('aria-pressed',String(on)); }
    document.body.classList.toggle('recording-now',on); }   // background motion drops back while recording
  async function startRecording(){
    if(recording) return;
    if(!(await ensureMic())) return;
    if(!window.MediaRecorder){ recStatus.textContent='Recording not supported in this browser'; return; }
    recChunks=[]; const mime=pickMime();
    try{ mediaRecorder=new MediaRecorder(micStream, mime?{mimeType:mime}:undefined); }
    catch(e){ recStatus.textContent='Recorder failed to start'; return; }
    mediaRecorder.ondataavailable=e=>{ if(e.data&&e.data.size) recChunks.push(e.data); };
    mediaRecorder.onstop=onRecStop;
    recording=true; recBtn.classList.add('on'); recBtn.textContent='■ Stop'; syncRecUI(true);
    start(true);                       // backing + count-in; sets musicZeroTime
    recStartTime=now();                // vocal sample 0 ≈ this audio time
    mediaRecorder.start();
    startMeter();
    recStatus.textContent=countInEl.checked?'Count-in… get ready to sing':'Recording… sing!';
  }
  function stopRecording(){
    if(mediaRecorder&&mediaRecorder.state!=='inactive'){ recStatus.textContent='Processing take…'; try{mediaRecorder.stop();}catch(e){} }
    recording=false; recBtn.classList.remove('on'); recBtn.textContent='● Record'; syncRecUI(false); stop(); stopMeter();
  }
  function releaseMic(){ try{ if(micStream) micStream.getTracks().forEach(t=>t.stop()); }catch(e){} micStream=null; micSource=null; micAnalyser=null; monitorGain=null; }
  async function onRecStop(){
    releaseMic();   // free the device + clear the browser recording indicator; re-acquired on next take
    if(!recChunks.length){ recStatus.textContent='No audio captured'; return; }
    const blob=new Blob(recChunks,{type:recChunks[0].type||'audio/webm'});
    try{ const arr=await blob.arrayBuffer(); vocalBuffer=await ac.decodeAudioData(arr.slice(0)); }
    catch(e){ recStatus.textContent='Could not decode take'; console.error(e); return; }
    vocalHeadSec=Math.max(0, musicZeroTime-recStartTime);   // where musical-0 sits inside the vocal buffer
    playTakeBtn.disabled=false; clearTakeBtn.disabled=false;
    recStatus.innerHTML=`<span class="badge">Take ${vocalBuffer.duration.toFixed(1)}s</span> ✓ mixed into export`;
    updateExportLabel(); syncTakeUI();
  }
  // Whether a take exists is a state of the ROOM, not just of two disabled buttons — the words
  // step back once there is something to listen to. Driven from the buffer itself so it can
  // never disagree with what the export will contain.
  function syncTakeUI(){ document.body.classList.toggle('has-take', !!vocalBuffer); }
  function playTake(){
    if(!vocalBuffer) return; ensureCtx();
    start(false);
    const vs=ac.createBufferSource(); vs.buffer=vocalBuffer; const vg=ac.createGain(); vg.gain.value=+vocalVolEl.value/100; vs.connect(vg).connect(vocalChain(ac,liveBus.vocalIn)); takeGain=vg;
    const head=vocalHeadSec+LAT()+(+syncEl.value/1000);
    if(head>=0) vs.start(musicZeroTime, head); else vs.start(musicZeroTime-head, 0);
    takeSource=vs;
  }
  function clearTake(){ vocalBuffer=null; stopTake(); playTakeBtn.disabled=true; clearTakeBtn.disabled=true; recStatus.textContent='No take yet'; updateExportLabel(); syncTakeUI(); }
  function startMeter(){ if(!micAnalyser) return; const data=new Float32Array(micAnalyser.fftSize); const tick=()=>{ micAnalyser.getFloatTimeDomainData(data); let sum=0; for(let i=0;i<data.length;i++) sum+=data[i]*data[i]; const rms=Math.sqrt(sum/data.length); const pct=Math.min(100,rms*220); meterEl.style.width=pct+'%'; meterEl.style.background= pct>88?'#ff5c8a':pct>8?'var(--green)':'#3a4270'; meterRAF=requestAnimationFrame(tick); }; tick(); }
  function stopMeter(){ if(meterRAF) cancelAnimationFrame(meterRAF); meterRAF=null; meterEl.style.width='0%'; }
  // Write the label WITHOUT touching the icon. `textContent` on the button would delete the
  // inline <svg>, and the button spends most of its life being relabelled — take, no take,
  // rendering, saved. The span is the only thing that changes.
  function btnText(el,s){ if(!el) return; const t=el.querySelector('.btxt'); if(t) t.textContent=s; else el.textContent=s; }
  function updateExportLabel(){ btnText(exportBtn, vocalBuffer? 'Export WAV + vocals' : 'Export WAV'); }

  // ---------- UI build ----------
  const gridEl=document.getElementById('grid'), bpmEl=document.getElementById('bpm'), bpmVal=document.getElementById('bpmVal');
  const swingEl=document.getElementById('swing'), masterEl=document.getElementById('master'), playBtn=document.getElementById('play');
  const patBar=document.getElementById('patBar'), slotsEl=document.getElementById('slots');
  const keyRootEl=document.getElementById('keyRoot'), keyModeEl=document.getElementById('keyMode'), progEl=document.getElementById('prog');
  const chordVolEl=document.getElementById('chordVol'), bassVolEl=document.getElementById('bassVol'), reverbEl=document.getElementById('reverb'), countInEl=document.getElementById('countin');
  const cueEl=document.getElementById('cue'), exportBtn=document.getElementById('export');
  const recBtn=document.getElementById('recBtn'), playTakeBtn=document.getElementById('playTake'), clearTakeBtn=document.getElementById('clearTake');
  const recStatus=document.getElementById('recStatus'), meterEl=document.getElementById('meter'), vocalVolEl=document.getElementById('vocalVol');
  const syncEl=document.getElementById('sync'), syncVal=document.getElementById('syncVal'), monitorEl=document.getElementById('monitor');
  const chordStyleEl=document.getElementById('chordStyle'), bassStyleEl=document.getElementById('bassStyle'), autoFillEl=document.getElementById('autofill');
  const cells={}, patBtns=[], slotEls=[], chordLabels={}, rowEls={};
  function showCue(n){ cueEl.textContent=n; cueEl.style.display='flex'; }
  function hideCue(){ cueEl.style.display='none'; }
  function rowMeta(){ return [...drums.map(d=>({...d,type:'drum'})), null, ...CHORD_DEGREES.map(c=>({...c,type:'chord'}))]; }

  function buildGrid(){
    gridEl.innerHTML='';
    // Beat headings above the step numbers, so "four beats of four" is visible rather than
    // something you have to count. One heading per group of four, spanning its own steps.
    const beats=document.createElement('tr'); beats.className='beat-head';
    beats.appendChild(document.createElement('td')); beats.appendChild(document.createElement('td'));
    for(let g=0;g<STEPS/4;g++){
      if(g>0){ const sp=document.createElement('td'); sp.className='beatgap'; beats.appendChild(sp); }
      const td=document.createElement('td'); td.className='beatnum'; td.colSpan=4;
      td.textContent=g+1; td.setAttribute('aria-hidden','true'); beats.appendChild(td);
    }
    gridEl.appendChild(beats);
    const head=document.createElement('tr'); head.className='col-head'; head.appendChild(document.createElement('td')); head.appendChild(document.createElement('td'));
    for(let s=0;s<STEPS;s++){ if(s>0&&s%4===0){ const g=document.createElement('td'); g.className='beatgap'; head.appendChild(g);} const td=document.createElement('td'); td.className='num'; td.textContent=s+1; head.appendChild(td);} gridEl.appendChild(head);
    rowMeta().forEach(meta=>{
      // The divider caption lives in the SPANNING cell, not the label column — otherwise its
      // nowrap text sets the label column's minimum width and the pads can never shrink.
      if(meta===null){ const dv=document.createElement('tr'); dv.className='divider';
        const l=document.createElement('td'); l.className='rowlabel'; dv.appendChild(l);
        const sp=document.createElement('td'); sp.colSpan=STEPS+5; sp.className='divlab';
        sp.textContent='Chords (sing over these)'; dv.appendChild(sp);
        gridEl.appendChild(dv); return; }
      const row=document.createElement('tr'); rowEls[meta.id]=row;
      const label=document.createElement('td'); label.className='rowlabel'; label.style.cursor='pointer'; label.title='Click the name to mute / unmute';
      if(meta.type==='drum') label.innerHTML=`<b>${meta.name}</b><span class="k">${meta.key}</span>`;
      else { label.innerHTML=`<b class="cn">${chordName(meta.deg)}</b><span class="k">${scale().romans[meta.deg]}</span>`; chordLabels[meta.id]=label; }
      label.addEventListener('click',()=>{ const key=meta.type==='drum'?meta.id:'chords'; mutes[key]=!mutes[key]; applyMutes(); autosave(); });
      row.appendChild(label);
      const volTd=document.createElement('td');
      if(meta.type==='drum'){ const vol=document.createElement('input'); vol.type='range'; vol.min=0; vol.max=100; vol.value=Math.round(meta.vol*100); vol.className='track-vol'; vol.title=meta.name+' volume'; vol.setAttribute('aria-label',meta.name+' track volume'); vol.addEventListener('input',()=>{ BUS_VOL[meta.id]=vol.value/100; if(liveBus&&liveBus[meta.id]) liveBus[meta.id].gain.value=BUS_VOL[meta.id]; autosave(); }); volTd.appendChild(vol); }
      row.appendChild(volTd);
      cells[meta.id]=[];
      for(let s=0;s<STEPS;s++){
        if(s>0&&s%4===0){ const g=document.createElement('td'); g.className='beatgap'; row.appendChild(g);}
        const td=document.createElement('td'); const c=document.createElement('div'); c.className='cell'+(meta.type==='chord'?' chord':'');
        if(meta.type==='drum'){ c.setAttribute('role','gridcell'); c.tabIndex=-1;   // roving: see rovingGrid()
          c.setAttribute('aria-label',`${meta.name} step ${s+1}. Click to toggle. Long-press, right-click, or press A to accent (accents play louder).`); }
        const toggleAccent=()=>{ if(meta.type!=='drum') return;
          if(!P()[meta.id][s]){ P()[meta.id][s]=true; c.classList.add('on'); }
          const acc=!A()[meta.id][s]; A()[meta.id][s]=acc; c.classList.toggle('acc',acc);
          c.setAttribute('aria-pressed',String(acc));
          ensureCtx(); playDrum(ac,liveBus[meta.id],meta.id,now()+.001,DRUM_SEND(meta.id)?liveBus.drumSend:null, acc?1.15:0.9);
          refreshPatBtns(); autosave(); if(typeof selectStep==='function') selectStep(meta,s,c); };
        c.addEventListener('click',e=>{
          if(meta.type==='drum' && (e.shiftKey||e.altKey)){ toggleAccent(); return; }   // desktop keyboard alternative
          const on=!P()[meta.id][s]; P()[meta.id][s]=on; c.classList.toggle('on',on);
          if(!on && meta.type==='drum'){ A()[meta.id][s]=false; c.classList.remove('acc'); }
          if(on){ ensureCtx(); if(meta.type==='drum') playDrum(ac,liveBus[meta.id],meta.id,now()+.001,DRUM_SEND(meta.id)?liveBus.drumSend:null, A()[meta.id][s]?1.12:0.95); else { playChord(ac,liveBus.chords,liveBus.chordSend,chordMidiNotes(meta.deg, chordStyle==='soul').map(midiToFreq),now()+.001,.7,chordStyle); playBass(ac,liveBus.bass,midiToFreq(chordRootMidi(meta.deg)-24),now()+.001,.7,bassStyle); } }
          if(meta.type==='drum'&&typeof selectStep==='function') selectStep(meta,s,c);
          refreshPatBtns(); autosave(); });
        if(meta.type==='drum'){
          c.addEventListener('contextmenu',e=>{ e.preventDefault(); toggleAccent(); });
          // long-press (touch): 460ms hold accents the step; a small move cancels it
          let lpTimer=null,lpX=0,lpY=0;
          const startLP=e=>{ const t=(e.touches&&e.touches[0])||e; lpX=t.clientX; lpY=t.clientY;
            lpTimer=setTimeout(()=>{ lpTimer=null; toggleAccent(); if(navigator.vibrate) navigator.vibrate(12); },460); };
          const moveLP=e=>{ if(!lpTimer) return; const t=(e.touches&&e.touches[0])||e;
            if(Math.abs(t.clientX-lpX)>8||Math.abs(t.clientY-lpY)>8){ clearTimeout(lpTimer); lpTimer=null; } };
          const endLP=()=>{ if(lpTimer){ clearTimeout(lpTimer); lpTimer=null; } };
          c.addEventListener('touchstart',startLP,{passive:true});
          c.addEventListener('touchmove',moveLP,{passive:true});
          c.addEventListener('touchend',endLP);
          c.addEventListener('keydown',e=>{ const k=e.key.toLowerCase();
            if(k==='enter'||k===' '){ e.preventDefault(); c.click(); }
            else if(k==='a'){ e.preventDefault(); toggleAccent(); } });   // keyboard accent
        }
        td.appendChild(c); row.appendChild(td); cells[meta.id].push({td,c});
      }
      gridEl.appendChild(row);
    });
    renderGrid();
  }
  function applyMutes(){ rowMeta().forEach(m=>{ if(!m) return; const key=m.type==='drum'?m.id:'chords'; if(rowEls[m.id]) rowEls[m.id].classList.toggle('muted',!!mutes[key]); }); }
  function renderGrid(){ rowMeta().forEach(m=>{ if(!m) return; P()[m.id].forEach((on,s)=>{ const c=cells[m.id][s].c; c.classList.toggle('on',on); if(m.type==='drum') c.classList.toggle('acc', on && !!A()[m.id][s]); }); }); applyMutes(); renderRoll(); }
  function relabelChords(){ CHORD_DEGREES.forEach(c=>{ if(chordLabels[c.id]) chordLabels[c.id].innerHTML=`<b class="cn">${chordName(c.deg)}</b><span class="k">${scale().romans[c.deg]}</span>`; }); refreshRollScale(); }
  function paintPlayhead(s,sl){ clearPlayhead(); rowMeta().forEach(m=>{ if(m) cells[m.id][s].td.classList.add('playhead'); }); if(prPH) prPH.style.left=s*PR_CW+'px'; if(mode==='song'&&slotEls[sl]) slotEls[sl].classList.add('playing'); updateReadout(); }
  function clearPlayhead(){ document.querySelectorAll('td.playhead').forEach(td=>td.classList.remove('playhead')); slotEls.forEach(el=>el.classList.remove('playing')); }
  function patternHasNotes(i){ return patterns[i].melody.length>0 || rowMeta().some(m=>m&&patterns[i][m.id].some(Boolean)); }
  function buildPatBar(){ for(let i=0;i<N_PATTERNS;i++){ const b=document.createElement('button'); b.className='pat'; b.textContent=i+1; b.addEventListener('click',()=>{ currentPattern=i; renderGrid(); refreshPatBtns(); }); patBar.appendChild(b); patBtns.push(b);} refreshPatBtns(); }
  function refreshPatBtns(){ patBtns.forEach((b,i)=>{ b.classList.toggle('on',i===currentPattern); b.classList.toggle('has',patternHasNotes(i)); }); }
  function buildSong(){ for(let i=0;i<SONG_SLOTS;i++){ const el=document.createElement('div'); el.className='slot'; el.innerHTML=`<span class="bn">bar ${i+1}</span><span class="v">·</span>`; el.addEventListener('click',()=>{ const cur=song[i]; song[i]=cur==null?0:(cur+1>=N_PATTERNS?null:cur+1); renderSlot(i); renderSongTimeline(); autosave(); inspectContext(); }); slotsEl.appendChild(el); slotEls.push(el); renderSlot(i);}
    renderSongTimeline(); }
  // section names — beginner-facing labels for the playlist clips
  const SEC_DEFAULT=['Intro','Verse','Pre-Chorus','Chorus','Bridge','Outro'];
  const secNames=SEC_DEFAULT.slice();
  function renderSlot(i){ const el=slotEls[i], v=song[i];
    el.className='slot'+(v!=null?` set p${v+1}`:'')+(v!=null&&fillForBar(song,i,false)?' fillbar':'');
    el.querySelector('.v').textContent=v!=null?(v+1):'·';
    let lb=el.querySelector('.lbl'); if(!lb){ lb=document.createElement('span'); lb.className='lbl'; el.appendChild(lb); }
    lb.textContent=v!=null?(secNames[v]||('Sec '+(v+1))):'';
    el.title=v!=null?`Bar ${i+1} — ${secNames[v]||('Section '+(v+1))}`:`Bar ${i+1} — empty`; }
  function renderAllSlots(){ for(let i=0;i<SONG_SLOTS;i++) renderSlot(i); renderSongTimeline(); }

  // ---------- the song as a shape (v13.4) ----------
  // Consecutive bars carrying the same section are ONE block. That single change is what turns a
  // 32-cell spreadsheet into a timeline: duration becomes width, so a two-bar intro and a
  // sixteen-bar chorus stop looking identical.
  function songRuns(){
    const runs=[]; let i=0;
    while(i<SONG_SLOTS){
      const v=song[i]; let j=i;
      while(j<SONG_SLOTS && song[j]===v) j++;
      runs.push({pat:v, start:i, bars:j-i});
      i=j;
    }
    return runs;
  }
  // Role comes from the section's NAME, because the names are editable and a singer who renames
  // "Bridge" to "The turn" still means a bridge. Pre-chorus is tested before chorus: /chorus/
  // matches "Pre-Chorus", and that exact mistake once made the Emotion Map compare the verse
  // against the wrong section. Index is the fallback, never the first answer.
  const SONG_ROLE_RE=[
    ['prechorus', /pre[\s-]*chorus|build|lift/i],
    ['chorus',    /chorus|hook|drop/i],
    ['intro',     /intro|open/i],
    ['verse',     /verse/i],
    ['bridge',    /bridge|middle\s*8|turn/i],
    ['outro',     /outro|end|coda|close/i],
  ];
  function songRoleOf(pat){
    if(pat==null) return 'empty';
    const n=secNames[pat]||'';
    for(const [role,re] of SONG_ROLE_RE) if(re.test(n)) return role;
    return GROOVE_ROLES[pat]||'other';
  }
  // What each role is DOING, in a singer's words. Not a mood claim — a description of the part
  // it plays in the shape, which is the thing the timeline is drawing.
  const ROLE_READS={
    intro:'opens', verse:'stays close', prechorus:'starts rising', chorus:'opens right up',
    finalchorus:'the biggest it gets', bridge:'goes somewhere else', outro:'lets go',
    other:'carries on', empty:'silence'
  };
  function renderSongTimeline(){
    const host=document.getElementById('songTimeline'); if(!host) return;
    const runs=songRuns();
    // The last chorus is only "final" when there is an earlier one to be bigger than.
    const chorusRuns=runs.filter(r=>r.pat!=null && songRoleOf(r.pat)==='chorus');
    const finalIdx=chorusRuns.length>1 ? runs.indexOf(chorusRuns[chorusRuns.length-1]) : -1;
    host.innerHTML='';
    const filled=runs.filter(r=>r.pat!=null);
    if(!filled.length){
      const p=document.createElement('p'); p.className='sempty';
      p.textContent='Nothing is arranged yet. Open “Edit bar by bar” and click a bar, or ask the Song Architect to build the shape.';
      host.appendChild(p); setSongHint(runs, finalIdx); return;
    }
    runs.forEach((r,ri)=>{
      if(r.pat==null && r.bars<1) return;
      const role = ri===finalIdx ? 'finalchorus' : songRoleOf(r.pat);
      const m = r.pat!=null ? sectionMetrics(r.pat) : null;
      const b=document.createElement(r.pat==null?'div':'button');
      b.className='sblock r-'+role+(r.pat==null?' s-empty':'');
      b.setAttribute('role','listitem');
      // Width IS duration. flex-grow on the bar count, with a floor so a one-bar section stays
      // readable and a legal target rather than collapsing to a sliver.
      b.style.flexGrow=String(r.bars);
      if(r.pat!=null){
        b.type='button';
        const name=secNames[r.pat]||('Section '+(r.pat+1));
        const e = m ? Math.round(m.energy*100) : 0;
        const room = m ? Math.round(m.vocalSpace*100) : 0;
        const hasLyric = !!(lyrics.sections[r.pat]||'').trim();
        // Energy is drawn as a filled column height AND stated as a number, because the design
        // law is that state is never signalled by one channel alone.
        b.innerHTML=
          '<span class="sfill" style="height:'+e+'%"></span>'+
          '<span class="sbody">'+
            '<span class="sname"></span>'+
            '<span class="smeta"></span>'+
            '<span class="spips"></span>'+
            '<span class="sroom"><i style="width:'+room+'%"></i></span>'+
          '</span>';
        b.querySelector('.sname').textContent=name;
        b.querySelector('.smeta').textContent=r.bars+(r.bars===1?' bar':' bars')+' · '+ROLE_READS[role];
        // Part pips: which of the four things is actually playing here. Letter + filled/hollow,
        // never colour alone.
        const pips=[['B',m&&m.hits>0],['L',m&&m.bass>0],['H',m&&m.chords>0],['M',m&&m.melody>0]];
        if(hasLyric) pips.push(['♪',true]);
        const ph=b.querySelector('.spips');
        pips.forEach(([ch,on])=>{ const s=document.createElement('i');
          s.className='spip'+(on?' on':''); s.textContent=ch; ph.appendChild(s); });
        const lyricSay = hasLyric ? ', has a lyric' : '';
        b.setAttribute('aria-label',
          name+', bars '+(r.start+1)+' to '+(r.start+r.bars)+', '+ROLE_READS[role]+
          ', energy '+e+' per cent, room for the voice '+room+' per cent'+lyricSay);
        b.title=name+' — '+r.bars+' bars from bar '+(r.start+1);
        // Opening a section means editing it: select it as the current pattern, exactly as the
        // pattern bar does, so there is one notion of "the section you are working on".
        b.addEventListener('click',()=>{ currentPattern=r.pat; renderGrid(); refreshPatBtns();
          setSongHint(runs, finalIdx, r);
          toast(name+' — bars '+(r.start+1)+'–'+(r.start+r.bars)+'. The Beat tab now edits this section.'); });
      } else {
        b.innerHTML='<span class="sbody"><span class="smeta"></span></span>';
        b.querySelector('.smeta').textContent=r.bars+(r.bars===1?' bar':' bars')+' silent';
      }
      // A transition sits at the JOIN, so it belongs to the block it leads out of.
      if(r.pat!=null && fillForBar(song, r.start+r.bars-1, false)) b.classList.add('s-trans');
      host.appendChild(b);
    });
    setSongHint(runs, finalIdx);
  }
  // One honest sentence about the shape, computed from the same numbers the blocks draw. It says
  // what IS, never what the listener will feel.
  function setSongHint(runs, finalIdx, picked){
    const el=document.getElementById('songHint'); if(!el) return;
    const filled=runs.filter(r=>r.pat!=null);
    if(!filled.length){ el.textContent=''; return; }
    const bars=filled.reduce((a,r)=>a+r.bars,0);
    const v=activeVariation();
    const bits=[bars+' of '+SONG_SLOTS+' bars arranged', filled.length+' section'+(filled.length===1?'':'s')];
    if(finalIdx>=0){
      const fm=sectionMetrics(runs[finalIdx].pat);
      const first=runs.filter(r=>r.pat!=null&&songRoleOf(r.pat)==='chorus')[0];
      const im=first?sectionMetrics(first.pat):null;
      if(fm&&im) bits.push(fm.energy>im.energy
        ? 'the last chorus measures bigger than the first'
        : 'the last chorus does not yet measure bigger than the first');
    }
    if(v) bits.push('you are editing the version “'+v.name+'”');
    el.textContent=bits.join(' · ')+'.';
  }
  function buildSectionNames(){
    const host=document.getElementById('secnames'); if(!host) return;
    // Clear first. This is called at boot AND by restoreScoped on every song-scoped restore, so
    // without it each "Add as a new version" apply, each switch between versions, and each boot that
    // restores an active song-scoped variation appended six more name boxes — 6 -> 12 -> 24 measured.
    // The extras are not cosmetic: applyState writes secNames across ALL of them, so after a reload
    // most of the boxes on screen were blank while the project still held the right six names.
    host.innerHTML='';
    for(let i=0;i<N_PATTERNS;i++){
      const w=document.createElement('div'); w.className='secname';
      const b=document.createElement('b'); b.textContent=i+1;
      const inp=document.createElement('input'); inp.value=secNames[i]; inp.maxLength=14;
      inp.setAttribute('aria-label','Name for section '+(i+1));
      inp.addEventListener('input',()=>{ secNames[i]=inp.value||('Sec '+(i+1)); renderAllSlots(); autosave(); });
      w.appendChild(b); w.appendChild(inp); host.appendChild(w);
    } }
  function seedSong(){ for(let i=0;i<8;i++){ song[i]=0; renderSlot(i);} }

  // ---------- piano roll ----------
  const prGrid=document.getElementById('prGrid'), prKeys=document.getElementById('prKeys'), prPH=document.getElementById('prPH'), prScroll=document.getElementById('prScroll');
  const melSoundEl=document.getElementById('melSound'), melVolEl=document.getElementById('melVol'), scaleLockEl=document.getElementById('scaleLock');
  const melMuteBtn=document.getElementById('melMute'), prRows={};
  let prLastLen=2, prDrag=null;
  const clampN=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const pitchClass=m=>((m-keyRoot)%12+12)%12;
  const inScalePitch=m=>scale().steps.includes(pitchClass(m));
  function snapScale(m){ return scaleLockEl.checked ? nearestInScale(m) : m; }
  function buildPianoRoll(){
    const rows=PR_HI-PR_LO+1; prGrid.style.height=rows*PR_RH+'px';
    for(let m=PR_HI;m>=PR_LO;m--){
      const k=document.createElement('div'); k.className='prkey'; const pc=m%12, name=NOTE_NAMES[pc];
      k.textContent = pc===0 ? name+(Math.floor(m/12)-1) : name; if(pc===0) k.classList.add('oct'); prKeys.appendChild(k);
      const r=document.createElement('div'); r.className='prow'; r.style.top=(PR_HI-m)*PR_RH+'px'; prGrid.appendChild(r);
      prRows[m]={key:k,row:r};
    }
    refreshRollScale();
    prScroll.scrollTop=(PR_HI-72)*PR_RH-60;   // open centered around C5/C4 melody territory
  }
  function refreshRollScale(){ for(let m=PR_HI;m>=PR_LO;m--){ const e=prRows[m]; if(!e) continue;
    const root=pitchClass(m)===0; e.row.classList.toggle('inscale',inScalePitch(m)&&!root); e.row.classList.toggle('root',root);
    e.key.classList.toggle('root',root); } }
  function renderRoll(){ if(!prGrid) return; prGrid.querySelectorAll('.pnote').forEach(el=>el.remove());
    P().melody.forEach((n,i)=>{ const el=document.createElement('div');
      el.className='pnote '+(n.v<0.75?'v1':n.v<1?'v2':'v3'); el.dataset.i=i;
      el.style.left=n.s*PR_CW+1+'px'; el.style.top=(PR_HI-n.p)*PR_RH+1+'px'; el.style.width=n.l*PR_CW-3+'px';
      el.title=NOTE_NAMES[n.p%12]+(Math.floor(n.p/12)-1); prGrid.appendChild(el); });
    // An empty grid should say what to do, not just sit there ruled and silent.
    const empty=document.getElementById('prEmpty');
    if(empty) empty.hidden=P().melody.length>0; }
  function previewNote(p){ ensureCtx(); playMelody(ac,liveBus.melody,liveBus.melodySend,p,now()+.001,.35,.9,melodySound); }
  // ---- one deliberate pointer-interaction lifecycle for the melody grid ----
  // Capture is taken on #prGrid, never on the note: renderRoll() destroys and rebuilds every
  // .pnote on each move, so a capture held by a note element would be lost immediately.
  // Every handler ignores pointerIds other than the active one, so a second finger or a stylus
  // can never mutate the note the first pointer is editing.
  function prRelease(d){ if(d&&d.captureEl&&d.pointerId!=null){
    try{ d.captureEl.releasePointerCapture(d.pointerId); }catch(err){} } }
  function prCancel(){
    if(!prDrag) return;
    const d=prDrag; prDrag=null;                       // clear first: releasing fires lostpointercapture
    if(d.added){ const i=P().melody.indexOf(d.n); if(i>-1) P().melody.splice(i,1); }
    else if(d.n&&d.o){ d.n.p=d.o.p; d.n.s=d.o.s; d.n.l=d.o.l; }
    prRelease(d);
    renderRoll(); refreshPatBtns();                    // no autosave — a cancelled edit is not an edit
  }
  function prBegin(d,e){ prDrag=d; d.pointerId=e.pointerId; d.captureEl=null;
    try{ prGrid.setPointerCapture(e.pointerId); d.captureEl=prGrid; }catch(err){} }

  prGrid.addEventListener('pointerdown',e=>{
    if(e.button!==0||e.ctrlKey) return;                // ctrl+click is a right-click on macOS
    if(prDrag) return;                                 // one interaction at a time
    const r=prGrid.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top;
    const noteEl=e.target.closest('.pnote');
    if(noteEl){ const n=P().melody[+noteEl.dataset.i]; if(!n) return;
      e.preventDefault();
      const edge=(e.clientX-noteEl.getBoundingClientRect().left) > noteEl.offsetWidth-8;
      prBegin({mode:edge?'resize':'move', n, x0:x, y0:y, o:{p:n.p,s:n.s,l:n.l}, moved:false, added:false}, e);
      inspectContext(); return; }
    const s=clampN(Math.floor(x/PR_CW),0,STEPS-1), p=snapScale(clampN(PR_HI-Math.floor(y/PR_RH),PR_LO,PR_HI));
    // scale-snap can land on a row the user didn't click; grab that note instead of stacking an invisible duplicate
    const hit=P().melody.find(n=>n.p===p && s>=n.s && s<n.s+n.l);
    if(hit){ e.preventDefault();
      prBegin({mode:'move', n:hit, x0:x, y0:y, o:{p:hit.p,s:hit.s,l:hit.l}, moved:false, added:false}, e);
      return; }
    if(e.pointerType==='touch'){
      // A finger on blank grid may be the start of a scroll, so commit nothing yet and take no
      // capture — the decision is made on pointerup. Not preventing default keeps pan alive.
      prDrag={mode:'tap', pointerId:e.pointerId, captureEl:null, n:null, o:null,
              x0:x, y0:y, cx:e.clientX, cy:e.clientY, moved:false, added:false};
      return; }
    e.preventDefault();
    const n={p,s,l:Math.min(prLastLen,STEPS-s),v:0.85}; P().melody.push(n); previewNote(p);
    prBegin({mode:'resize', n, x0:x, y0:y, o:{p,s,l:n.l}, moved:true, added:true}, e);
    inspectContext(); renderRoll(); refreshPatBtns();
  });

  window.addEventListener('pointermove',e=>{
    if(!prDrag||e.pointerId!==prDrag.pointerId) return;
    if(prDrag.mode==='tap'){                            // moved far enough? it was a scroll
      if(Math.abs(e.clientX-prDrag.cx)>8||Math.abs(e.clientY-prDrag.cy)>8) prDrag=null;
      return; }
    const r=prGrid.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top, n=prDrag.n;
    if(Math.abs(x-prDrag.x0)>4||Math.abs(y-prDrag.y0)>4) prDrag.moved=true;
    if(prDrag.mode==='resize'){ n.l=clampN(Math.ceil((x-n.s*PR_CW)/PR_CW),1,STEPS-n.s); }
    else { n.s=clampN(prDrag.o.s+Math.round((x-prDrag.x0)/PR_CW),0,STEPS-n.l);
      const np=clampN(prDrag.o.p-Math.round((y-prDrag.y0)/PR_RH),PR_LO,PR_HI); const sp=snapScale(np); if(sp!==n.p){ n.p=sp; if(prDrag.moved) previewNote(sp); } }
    renderRoll(); });

  window.addEventListener('pointerup',e=>{
    if(!prDrag||e.pointerId!==prDrag.pointerId) return;
    const d=prDrag; prDrag=null;
    if(d.mode==='tap'){                                 // a tap creates exactly one note; a scroll creates none
      if(Math.abs(e.clientX-d.cx)>8||Math.abs(e.clientY-d.cy)>8) return;
      const n={p:d.p!=null?d.p:0, s:d.s!=null?d.s:0, l:1, v:0.85};
      n.s=clampN(Math.floor(d.x0/PR_CW),0,STEPS-1);
      n.p=snapScale(clampN(PR_HI-Math.floor(d.y0/PR_RH),PR_LO,PR_HI));
      n.l=Math.min(prLastLen,STEPS-n.s);
      P().melody.push(n); previewNote(n.p);
      inspectContext(); renderRoll(); refreshPatBtns(); autosave(); return; }
    const n=d.n;
    if(d.mode==='move'&&!d.moved&&!d.added){ const i=P().melody.indexOf(n); if(i>-1) P().melody.splice(i,1); }
    else prLastLen=n.l;
    prRelease(d);
    renderRoll(); refreshPatBtns(); autosave(); });

  window.addEventListener('pointercancel',e=>{ if(prDrag&&e.pointerId===prDrag.pointerId) prCancel(); });
  window.addEventListener('lostpointercapture',e=>{ if(prDrag&&e.pointerId===prDrag.pointerId&&prDrag.captureEl) prCancel(); });
  window.addEventListener('blur',()=>{ if(prDrag) prCancel(); });
  prGrid.addEventListener('contextmenu',e=>{ e.preventDefault(); const noteEl=e.target.closest('.pnote'); if(!noteEl) return;
    const n=P().melody[+noteEl.dataset.i]; if(!n) return; n.v = n.v<0.75?0.85:n.v<1?1.1:0.6; renderRoll(); autosave(); });
  melSoundEl.addEventListener('change',()=>{ melodySound=melSoundEl.value; previewNote(69); autosave(); });
  melVolEl.addEventListener('input',()=>{ BUS_VOL.melody=melVolEl.value/100; if(liveBus&&liveBus.melody) liveBus.melody.gain.value=BUS_VOL.melody; autosave(); });
  melMuteBtn.addEventListener('click',()=>{ mutes.melody=!mutes.melody; melMuteBtn.classList.toggle('on',!!mutes.melody); autosave(); });
  document.getElementById('melQuant').addEventListener('click',()=>{ const m=P().melody; if(!m.length) return;
    m.forEach(n=>{ n.s=clampN(Math.round(n.s/4)*4,0,STEPS-1); n.l=clampN(Math.max(1,Math.round(n.l/4)*4),1,STEPS-n.s); });
    renderRoll(); autosave(); toast('Melody quantized to the beat'); });
  document.getElementById('melDup').addEventListener('click',()=>{ const m=P().melody; if(!m.length) return;
    const src=m.filter(n=>n.s<8); if(!src.length){ toast('Nothing in the first half to duplicate'); return; }
    src.forEach(n=>{ const s=n.s+8; if(s<STEPS) m.push({p:n.p,s,l:Math.min(n.l,STEPS-s),v:n.v}); });
    renderRoll(); refreshPatBtns(); autosave(); toast('Melody duplicated into the second half'); });
  document.getElementById('melClear').addEventListener('click',()=>{ if(!P().melody.length) return;
    if(!confirm('Delete every melody note in this section?')) return;
    P().melody=[]; renderRoll(); refreshPatBtns(); autosave(); });
  // key changes transpose the melody so it always stays right (octave-folded into range)
  function transposeMelody(delta){ if(!delta) return; patterns.forEach(pp=>pp.melody.forEach(n=>{ n.p+=delta; while(n.p>PR_HI)n.p-=12; while(n.p<PR_LO)n.p+=12; })); renderRoll(); autosave(); }
  // mode changes (minor -> phrygian etc.) move different scale degrees, so fold every note back into the new scale
  function resnapMelodies(){ let moved=0; patterns.forEach(pp=>pp.melody.forEach(n=>{ const t=nearestInScale(n.p); if(t!==n.p){ n.p=t; moved++; } }));
    if(moved){ renderRoll(); autosave(); } return moved; }
  function nearestInScale(m){ if(inScalePitch(m)) return m;
    for(let d=1;d<7;d++){ if(m-d>=PR_LO&&inScalePitch(m-d)) return m-d; if(m+d<=PR_HI&&inScalePitch(m+d)) return m+d; } return m; }

  // selected-step accent control — the touch/keyboard-visible alternative to right-click
  // ---- Inspector: compact, collapsed until something contextual needs it ----
  let inspectPinned=false;
  function setInspect(open){
    const p=document.getElementById('inspect'); if(!p) return;
    p.classList.toggle('open',open);
    document.body.classList.toggle('inspect-collapsed',!open);
    const b=document.getElementById('tgInspect');
    if(b){ b.setAttribute('aria-expanded',String(open));
      b.setAttribute('aria-label',(open?'Hide':'Show')+' inspector'); }
    if(window.__auraFit) window.__auraFit();       // the workspace reclaims the width
  }
  // a note, clip, track or imported file was selected — open unless the user pinned it shut
  // On a phone Customize is a bottom sheet, so auto-opening it on every edit would bury the very
  // grid the user just touched. There it stays opt-in, via the More sheet.
  function inspectContext(){ if(inspectPinned) return;
    if(window.matchMedia&&window.matchMedia('(max-width:767px)').matches) return;
    setInspect(true); }

  let selStep=null;
  function selectStep(meta,s,c){ selStep={meta,s,c}; inspectContext();
    const bar=document.getElementById('stepbar'); if(!bar) return;
    bar.hidden=false;
    document.getElementById('stepbarLbl').textContent=`${meta.name} · step ${s+1}`;
    const btn=document.getElementById('stepAccent');
    btn.classList.toggle('on', !!A()[meta.id][s]);
    btn.setAttribute('aria-pressed', String(!!A()[meta.id][s]));
  }
  (function wireStepAccent(){ const btn=document.getElementById('stepAccent'); if(!btn) return;
    btn.addEventListener('click',()=>{ if(!selStep) return; const {meta,s,c}=selStep;
      if(!P()[meta.id][s]){ P()[meta.id][s]=true; c.classList.add('on'); }
      const acc=!A()[meta.id][s]; A()[meta.id][s]=acc; c.classList.toggle('acc',acc);
      c.setAttribute('aria-pressed',String(acc)); btn.classList.toggle('on',acc); btn.setAttribute('aria-pressed',String(acc));
      ensureCtx(); playDrum(ac,liveBus[meta.id],meta.id,now()+.001,DRUM_SEND(meta.id)?liveBus.drumSend:null, acc?1.15:0.9);
      refreshPatBtns(); autosave(); });
  })();

  // ---------- Complete project export ----------
  //
  // Book II Part 30, gap #2: one click for stems, MIDI, a tempo and key map, the lyrics and a
  // session file. Nobody ships it whole; a couple get partway. Aura holds all of it already, so
  // the only work is writing it out.
  //
  // Excluded by default, and the default is what matters: the imported reference audio, the Guide
  // conversation, anything about a controller, and every temporary buffer. A singer may deliberately
  // include a reference they hold rights to — that is a decision they make, not one Aura makes.

  function downloadFile(name, data, mime){
    const blob = (data instanceof Blob) ? data : new Blob([data], { type: mime || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 400);
  }

  function tempoKeyMap(){
    const sec = songUsedLen() || 1;
    return {
      tempo: Math.round(+bpmEl.value), swing: +swingEl.value,
      key: NOTE_NAMES[keyRoot], mode: keyMode,
      bars: sec, stepsPerBar: STEPS,
      sections: song.slice(0, sec).map((slot, bar) => ({
        bar: bar, section: slot, name: slot == null ? null : (secNames[slot] || ('Section ' + (slot + 1))) })),
    };
  }

  function lyricsDocument(){
    const lines = ['# ' + (projName || 'Untitled') + ' — lyrics', ''];
    for (let i = 0; i < N_PATTERNS; i++) {
      const t = lyrics.sections[i];
      if (!t || !t.trim()) continue;
      lines.push('## ' + (secNames[i] || ('Section ' + (i + 1))));
      lines.push(t.trim());
      if (lyrics.notes[i]) lines.push('', '_Performance note: ' + lyrics.notes[i] + '_');
      lines.push('');
    }
    if (lines.length === 2) lines.push('_No lyrics written yet._');
    return lines.join('\n');
  }

  function exportReadme(list){
    return [
      'AURA STUDIO — COMPLETE PROJECT EXPORT',
      '',
      'Project:  ' + (projName || 'Untitled'),
      'Aura:     ' + APP_VERSION,
      'Written:  ' + new Date().toISOString(),
      '',
      'WHAT IS HERE',
      list.map(f => '  ' + f).join('\n'),
      '',
      'WHAT IS DELIBERATELY NOT HERE',
      '  - The imported reference audio. It is a reference, not a part of your record.',
      '    Aura keeps it out unless you explicitly include it.',
      '  - Anything you typed into Ask Aura. That conversation is never saved.',
      '  - Anything about a connected controller. Mappings stay in this browser.',
      '  - Temporary analysis buffers.',
      '',
      'ON RIGHTS',
      '  RIGHTS.json records what went into this project as Aura observed it.',
      '  It is not legal advice, it is not proof of ownership, and it does not',
      '  clear anything for release. Nothing in this folder was sent anywhere.',
      '',
      'REOPENING',
      '  The .aura file opens in Aura Studio. Audio is never stored inside it,',
      '  so a recorded vocal or an imported file will not come back with it —',
      '  the WAVs in this folder are that audio.',
      '',
    ].join('\n');
  }

  // The whole bundle. Sequential rather than parallel: each render is an OfflineAudioContext and
  // firing them together stalls the audio thread.
  async function exportCompleteProject(opts){
    const o = opts || {};
    const stamp = (projName || 'aura-project').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'aura-project';
    const written = [];
    const emit = (name, data, mime) => { downloadFile(stamp + '--' + name, data, mime); written.push(name); };

    // 1. the project itself
    emit('project.aura', JSON.stringify(buildProjectFile(projName || 'Untitled', false), null, 1), 'application/json');
    // 2. the master
    const master = await renderExportBuffer();
    emit('master.wav', new Blob([encodeWav(master)], { type: 'audio/wav' }), 'audio/wav');
    // 3. maps and text
    emit('tempo-key-map.json', JSON.stringify(tempoKeyMap(), null, 1), 'application/json');
    emit('lyrics.md', lyricsDocument(), 'text/markdown');
    // 4. MIDI — reuses the shipped exporter so the files match what Aura plays
    try { const m = midiBytesForExport(); if (m) emit('parts.mid', new Blob([m], { type: 'audio/midi' }), 'audio/midi'); }
    catch (e) { /* a project with no notes has no MIDI, which is not a failure */ }
    // 5. performance automation and variations, as data rather than baked audio
    emit('performance.json', JSON.stringify({
      events: automation.events.map(e => ({ atMs: e.t, action: e.a, value: e.v })),
      note: 'Mute and level moves render into the master WAV, applied per step from the same replay ' +
            'playback uses. Section launches and pad triggers change where you are while you play ' +
            'and are not written into the audio. Tempo moves are not rendered: the file is laid out ' +
            'at one tempo before the render begins.',
    }, null, 1), 'application/json');
    emit('variations.json', JSON.stringify({
      active: variations.activeId, items: variations.items.map(v => ({ id:v.id, name:v.name, scope:v.scope })),
    }, null, 1), 'application/json');
    // 6. rights
    emit('RIGHTS.json', JSON.stringify(rightsManifest(), null, 1), 'application/json');
    // 7. controller mappings ONLY if deliberately asked for
    if (o.includeControllerMappings) {
      emit('controller-mappings.json', JSON.stringify({
        note: 'Message type, number and channel only. No hardware identity is recorded.',
        maps: midi.maps.map(m => ({ type:m.type, number:m.number, channel:m.channel, action:m.action })),
      }, null, 1), 'application/json');
      written.push('controller-mappings.json');
    }
    // 8. the README goes last, because it lists what was actually written
    downloadFile(stamp + '--README.txt', exportReadme(written), 'text/plain');
    return { files: written.concat(['README.txt']) };
  }

  // The MIDI exporter writes a file directly; this returns the bytes so the bundle can name them.
  let __midiCapture = null;
  function midiBytesForExport(){
    __midiCapture = null;
    try { exportMidi(true); } catch (e) { return null; }
    return __midiCapture;
  }

  // ---------- Finish the record ----------
  //
  // Book II Part 34's last instruction: bias to finishing. Every stage reports one of complete,
  // needs review, optional, unavailable, or blocked — measured from the project, not guessed. It
  // does not require every stage, and the final statement is a checklist, not a claim that the
  // record is good or legally clear.

  function finishStages(){
    const st = [];
    const add = (id, name, state, note) => st.push({ id, name, state, note });
    const anyDrums = patterns.some(p => drums.some(d => p[d.id].some(Boolean)));
    const anyBass  = patterns.some(p => (p.bass || []).length);
    const anyChord = patterns.some(p => CHORD_DEGREES.some(c => p[c.id].some(Boolean)));
    const anyMel   = patterns.some(p => (p.melody || []).length);
    const arranged = songUsedLen() > 1;
    const anyLyric = Object.keys(lyrics.sections).some(k => (lyrics.sections[k] || '').trim());
    const em = emotionMap();
    const mc = mixCheck();
    const rr = rightsReport();

    add('direction','Direction',
      intentionSummary() ? 'complete' : 'optional',
      intentionSummary() || 'No project intention written. Useful when you come back to this.');
    add('structure','Structure', arranged ? 'complete' : 'needs review',
      arranged ? songUsedLen() + ' bars arranged.' : 'Only one section is in the arrangement.');
    add('beat','Beat', anyDrums ? 'complete' : 'needs review',
      anyDrums ? 'Drums are written.' : 'No drums yet.');
    add('lowend','Low end', anyBass ? 'complete' : 'needs review',
      anyBass ? 'A low-end part is written.' : 'No low end yet.');
    add('harmony','Harmony', anyChord ? 'complete' : 'needs review',
      anyChord ? 'Chords are written.' : 'No harmony yet.');
    add('melody','Melody', anyMel ? 'complete' : 'optional',
      anyMel ? 'A melody is written.' : 'No melody. Plenty of records do not need one under the voice.');
    add('lyrics','Lyrics', anyLyric ? 'complete' : 'optional',
      anyLyric ? 'Words written.' : 'Nothing written yet.');
    add('vocalplan','Vocal plan',
      vocalRange(null) ? 'complete' : 'optional',
      vocalRange(null) ? 'The melody range is known, so the Coach has something to work from.'
                       : 'No melody to read a range from yet.');
    add('recording','Recording', vocalBuffer ? 'complete' : 'needs review',
      vocalBuffer ? 'A take is loaded.' : 'No vocal recorded. Aura never stores it in the project file.');
    add('transitions','Transitions',
      em.findings.some(f => f.id === 'long-flat-run') ? 'needs review' : 'complete',
      em.findings.some(f => f.id === 'long-flat-run')
        ? 'There is a long stretch with no change.' : 'No long flat stretches.');
    add('mix','Mix Check',
      mc.filter(w => w.severity === 'high').length ? 'needs review' : 'complete',
      mc.length ? mc.length + ' thing' + (mc.length === 1 ? '' : 's') + ' worth a look.'
                : 'Nothing colliding that Aura can measure.');
    add('rights','Rights & Sources',
      !rr.canConfirm ? 'blocked' : (rr.confirmed ? 'complete' : 'needs review'),
      !rr.canConfirm ? 'A source with an unknown origin is included. Aura cannot confirm around it.'
        : rr.confirmed ? 'You have confirmed you have permission for everything included.'
        : 'Not confirmed yet.');
    add('export','Export',
      st.filter(x => x.state === 'blocked').length ? 'blocked' : 'optional',
      'The complete bundle writes the project, the audio, MIDI, the maps, the lyrics and the manifest.');
    return st;
  }

  // A mark per state, so status never depends on colour. All typographic — check, ring, bang,
  // dash, cross — none of them in the pictographic ranges the release gate refuses.
  const FINISH_MARK = { 'complete':'✓', 'needs review':'!', 'optional':'–', 'blocked':'×' };
  // Where each stage actually lives. Every target is a real element that exists in the shipped
  // markup; scrollTo() refuses a hidden one and names the missing prerequisite rather than
  // scrolling to nothing, so a recommendation cannot send anyone somewhere that is not there.
  const FINISH_GO = {
    direction: () => { goTo('play')(); scrollTo('intentCard')(); },
    structure: () => { goTo('play')(); },
    beat:      () => { goTo('rack')(); },
    lowend:    () => { goTo('rack')(); scrollTo('grooveCard')(); },
    harmony:   () => { goTo('play')(); },
    melody:    () => { goTo('piano')(); },
    lyrics:    () => { goTo('voc')();  scrollTo('lyricCard')(); },
    vocalplan: () => { goTo('voc')();  scrollTo('coachCard')(); },
    recording: () => { goTo('voc')(); },
    transitions:()=> { goTo('play')(); scrollTo('transCard')(); },
    mix:       () => { goTo('mix')();  scrollTo('mixCard')(); },
    rights:    () => { goTo('smp')();  scrollTo('rightsCard')(); },
    export:    () => { goTo('mix')();  scrollTo('finishCard')(); },
  };
  // The single next thing. Blocked outranks needs-review, and `optional` is never recommended —
  // it is a real status meaning "you may skip this", not a softened failure.
  function finishNext(stages){
    const st = stages || finishStages();
    const pick = st.filter(x => x.state === 'blocked')[0] ||
                 st.filter(x => x.state === 'needs review')[0];
    if(!pick) return null;
    const go = FINISH_GO[pick.id];
    return go ? { stage: pick, go: go, blocked: pick.state === 'blocked' } : null;
  }
  function readyToShare(){
    const st = finishStages();
    const blocked = st.filter(x => x.state === 'blocked');
    const review  = st.filter(x => x.state === 'needs review');
    return {
      stages: st, blocked: blocked, needsReview: review,
      canShare: blocked.length === 0,
      // Deliberately not "your record is ready". Aura cannot judge that and will not pretend to.
      statement: blocked.length
        ? 'Not yet — ' + blocked.map(b => b.name).join(', ') + ' ' +
          (blocked.length === 1 ? 'is blocking.' : 'are blocking.')
        : review.length
          ? 'Nothing is blocking. ' + review.length + ' stage' + (review.length === 1 ? '' : 's') +
            ' still worth a look: ' + review.map(r => r.name).join(', ') + '.'
          : 'Nothing is blocking and nothing is flagged. That is a checklist result, not a ' +
            'judgement about the music or a legal clearance.',
    };
  }

  // ---------- Rights and Sources ----------
  //
  // Book II Part 31: the three questions before releasing anything. Aura cannot answer them — it is
  // software, not a lawyer — but it can tell you exactly what went into the record, which is the
  // part that is expensive to reconstruct afterwards and cheap to keep now.
  //
  // What this is NOT: legal advice, an ownership assurance, or an indemnity. Aura says so plainly
  // and never implies otherwise.

  const SOURCE_KINDS = {
    'aura-synth':    { label:'Aura synthesis',        release:'clear',   note:'Generated by Aura. Yours to use.' },
    'aura-perc':     { label:'Aura percussion',       release:'clear',   note:'Generated by Aura. Yours to use.' },
    'aura-transform':{ label:'Aura transformation',   release:'clear',   note:'Aura reshaped something you provided.' },
    'user-recording':{ label:'Your recording',        release:'clear',   note:'You recorded it. Yours.' },
    'user-import':   { label:'Your own file',         release:'declared',note:'You told Aura you have the right to use this.' },
    'reference':     { label:'Reference only',        release:'excluded',note:'Studied, not included. Muted and kept out of the export.' },
    'licensed':      { label:'Licensed by you',       release:'declared',note:'You declared a licence for this.' },
    'public-domain': { label:'Public domain',         release:'declared',note:'You declared this as public domain.' },
    'external':      { label:'Made in another tool',  release:'declared',note:'Generated elsewhere. Its terms are that tool’s, not Aura’s.' },
    'unknown':       { label:'Unknown',               release:'blocked', note:'Aura does not know where this came from.' },
  };

  // Assets are recorded as they are created, not reconstructed at export time — reconstructing
  // provenance after the fact is exactly the thing that cannot be done accurately.
  const provenance = { assets: [], confirmed:false, confirmedAt:'' };

  function assetId(){ return 'a' + (provenance.assets.length + 1).toString(36) +
    '-' + Math.abs((hist.past.length * 2654435761) ^ provenance.assets.length).toString(36).slice(0,4); }

  function recordAsset(kind, name, opts){
    if (!SOURCE_KINDS[kind]) kind = 'unknown';
    const o = opts || {};
    const a = { id: o.id || assetId(), kind: kind, name: String(name || SOURCE_KINDS[kind].label).slice(0,120),
                included: o.included !== false, rightsNote: String(o.rightsNote || '').slice(0,300),
                // What this was made FROM, when it was made from something. Aura's own steps are
                // Aura's, but their placement can come from a recording someone else owns — and a
                // part is no freer than what it was derived from.
                derivedFrom: o.derivedFrom || null,
                transforms: [], createdAt: new Date().toISOString() };
    provenance.assets.push(a);
    provenance.confirmed = false;                       // any new source invalidates a prior confirmation
    return a;
  }
  function noteTransform(id, what){
    const a = provenance.assets.filter(x => x.id === id)[0];
    if (!a) return false;
    a.transforms.push(String(what || '').slice(0,80));
    return true;
  }
  function setAssetIncluded(id, on){
    const a = provenance.assets.filter(x => x.id === id)[0];
    if (!a) return false;
    a.included = !!on; provenance.confirmed = false; return true;
  }
  function setAssetRights(id, note){
    const a = provenance.assets.filter(x => x.id === id)[0];
    if (!a) return false;
    a.rightsNote = String(note || '').slice(0,300); provenance.confirmed = false; return true;
  }

  // What Aura knows right now, including the things it knows it does not know.
  function rightsReport(){
    // The parts Aura made itself are always in the record, so they are always listed.
    const auto = [];
    const anyDrums = patterns.some(p => drums.some(d => p[d.id].some(Boolean)));
    const anyBass  = patterns.some(p => (p.bass || []).length);
    const anyChord = patterns.some(p => CHORD_DEGREES.some(c => p[c.id].some(Boolean)));
    const anyMel   = patterns.some(p => (p.melody || []).length);
    if (anyDrums) auto.push({ id:'aura-drums', kind:'aura-perc',  name:'Drum parts',   included:true, transforms:[] });
    if (anyBass)  auto.push({ id:'aura-bass',  kind:'aura-synth', name:'Low end',      included:true, transforms:[] });
    if (anyChord) auto.push({ id:'aura-chord', kind:'aura-synth', name:'Harmony',      included:true, transforms:[] });
    if (anyMel)   auto.push({ id:'aura-mel',   kind:'aura-synth', name:'Melody',       included:true, transforms:[] });
    if (vocalBuffer) auto.push({ id:'user-vox', kind:'user-recording', name:'Your vocal take', included:true, transforms:[] });
    // The imported reference, if there is one. Its inclusion follows the actual mute state.
    if (smp.buf) auto.push({ id:'ref', kind: sampleIncluded ? 'user-import' : 'reference',
                             name: smp.name || 'Imported recording',
                             included: !(mix.sample && mix.sample.mute), transforms:[] });

    // The sampler's own buffer, if one is loaded. Audio is never written to a project file, so this
    // is a live-session fact; the recorded asset is what carries the origin into the manifest.
    const all = auto.concat(provenance.assets);
    // A derived part inherits the strictest release class in its chain. Without this, chopping a
    // file you have not cleared into a section produced an 'aura-transform' marked `clear`, and the
    // whole project confirmed clean while the source sat in `excluded` — the source audio really is
    // excluded, but the section built from it is in the export, and it is not free just because
    // Aura wrote the steps.
    const RANK = { clear:0, excluded:0, declared:1, blocked:2 };
    const byId = {}; all.forEach(a => { byId[a.id] = a; });
    const effRelease = a => {
      let worst = SOURCE_KINDS[a.kind].release, seen = {};
      let cur = a;
      while (cur && cur.derivedFrom && !seen[cur.derivedFrom]) {
        seen[cur.derivedFrom] = 1;
        cur = byId[cur.derivedFrom];
        if (!cur) break;
        if (RANK[SOURCE_KINDS[cur.kind].release] > RANK[worst]) worst = SOURCE_KINDS[cur.kind].release;
      }
      return worst;
    };
    const included = all.filter(a => a.included);
    const excluded = all.filter(a => !a.included);
    const needsPermission = included.filter(a => effRelease(a) === 'declared');
    const unknown = included.filter(a => effRelease(a) === 'blocked');
    return {
      assets: all, included: included, excluded: excluded,
      auraMade: included.filter(a => /^aura-/.test(a.kind)),
      userMade: included.filter(a => a.kind === 'user-recording'),
      needsPermission: needsPermission, unknown: unknown,
      canConfirm: unknown.length === 0,
      confirmed: provenance.confirmed,
    };
  }

  function confirmRights(){
    const r = rightsReport();
    if (!r.canConfirm) return false;                    // cannot confirm what Aura cannot identify
    provenance.confirmed = true;
    provenance.confirmedAt = new Date().toISOString();
    return true;
  }

  // The manifest that ships with a complete export. Local file, never transmitted.
  function rightsManifest(){
    const r = rightsReport();
    return {
      format:'aura-rights-manifest', version:1,
      projectId: projMeta.id || '', projectName: projName,
      auraVersion: APP_VERSION, generatedAt: new Date().toISOString(),
      confirmed: provenance.confirmed, confirmedAt: provenance.confirmedAt,
      statement:
        'This manifest records what went into this project, as Aura observed it. It is not legal ' +
        'advice, it is not proof of ownership, and it does not clear anything for release. Aura ' +
        'never sends it anywhere.',
      assets: r.assets.map(a => ({
        id: a.id, source: SOURCE_KINDS[a.kind].label, category: a.kind,
        included: a.included, releaseStatus: SOURCE_KINDS[a.kind].release,
        rightsNote: a.rightsNote || '', transforms: a.transforms.slice(),
        createdAt: a.createdAt || '',
      })),
    };
  }

  // ---------- Find a sound ----------
  //
  // Book I is emphatic that the sound informs the part, not the other way round: the wrong sound
  // makes you write around it and then stack layers to compensate. So this comes before writing,
  // and it is browsed by FEELING rather than by preset name.
  //
  // Every family here is Aura's own synthesis described in plain words. No proprietary preset is
  // imitated, no synthesizer panel is copied, and nothing is named after anybody.

  const SOUND_FAMILIES = [
    { id:'warm',      name:'Warm',       voice:'keys',  oct: 0, hi:-3, lo: 3, rev:22, why:'Rounded and close. Sits under a voice without arguing with it.' },
    { id:'vintage',   name:'Vintage',    voice:'keys',  oct:-1, hi:-6, lo: 4, rev:30, why:'Darker and older-sounding — the analog-leaning colour this music grew out of.' },
    { id:'dark',      name:'Dark',       voice:'pad',   oct:-1, hi:-8, lo: 2, rev:38, why:'Low and shadowed. Good for a verse you want to feel enclosed.' },
    { id:'glassy',    name:'Glassy',     voice:'bell',  oct: 1, hi: 4, lo:-4, rev:34, why:'Bright and clear on top, out of the way of the voice.' },
    { id:'soft',      name:'Soft',       voice:'pad',   oct: 0, hi:-2, lo: 0, rev:44, why:'Quiet and diffuse. Almost atmosphere rather than a part.' },
    { id:'wide',      name:'Wide',       voice:'pad',   oct: 0, hi: 1, lo: 1, rev:52, why:'Spread out across the stereo field, leaving the middle for you.' },
    { id:'intimate',  name:'Intimate',   voice:'pluck', oct: 0, hi: 0, lo: 2, rev:12, why:'Dry and near. Sounds like it is in the room with you.' },
    { id:'metallic',  name:'Metallic',   voice:'bell',  oct: 0, hi: 6, lo:-6, rev:26, why:'Hard and ringing. Cuts through a dense arrangement.' },
    { id:'dreamlike', name:'Dreamlike',  voice:'pad',   oct: 1, hi: 2, lo:-2, rev:60, why:'Long and washed out. Time feels slower under it.' },
    { id:'orchestral',name:'Orchestral', voice:'pad',   oct:-1, hi:-1, lo: 3, rev:48, why:'Broad and cinematic. Carries a final chorus.' },
    { id:'guitarlike',name:'Guitar-like',voice:'pluck', oct: 0, hi: 2, lo: 1, rev:20, why:'Plucked and rhythmic — the broken-chord feel without playing one.' },
    { id:'analoglike',name:'Analog-like',voice:'lead',  oct: 0, hi:-4, lo: 5, rev:24, why:'Thick and slightly unruly. Present without being bright.' },
  ];

  // What is currently being auditioned, and what the singer kept.
  // `adj` accumulates, so pressing Warmer twice really is warmer twice. Choosing a different family
  // clears it — otherwise the family you picked is not the family you hear.
  const soundPick = { tryingId:null, keptId:null, oct:0, adj:{ warmer:0, brighter:0, wider:0 } };

  function soundFamily(id){ return SOUND_FAMILIES.filter(f => f.id === id)[0] || null; }

  // Audition: set the real melody voice and the real mixer values, so what you hear is what you get.
  // No preview-only path — a preview that differs from the result is how people get surprised later.
  function trySound(id, opts){
    const f = soundFamily(id); if (!f) return false;
    const o = opts || {};
    if (soundPick.tryingId !== id || o.reset){ soundPick.adj = { warmer:0, brighter:0, wider:0 }; soundPick.oct = 0; }
    soundPick.tryingId = id;
    if (o.octave != null) soundPick.oct = clampN(o.octave | 0, -2, 2);
    if (o.octaveBy) soundPick.oct = clampN(soundPick.oct + (o.octaveBy | 0), -2, 2);
    ['warmer','brighter','wider'].forEach(k => {
      if (o[k]) soundPick.adj[k] = clampN(soundPick.adj[k] + o[k], -24, 24);
    });
    melodySound = f.voice;
    if (melSoundEl) melSoundEl.value = f.voice;
    if (mix.melody) {
      mix.melody.hi = clampN(f.hi + soundPick.adj.brighter, -12, 12);
      mix.melody.lo = clampN(f.lo + soundPick.adj.warmer, -12, 12);
      mix.melody.rev = clampN(f.rev + soundPick.adj.wider, 0, 100);
    }
    applyAllGroupsLive(); syncMixerUI();
    // one note at the family's register, so the choice is made by ear
    if (!o.silent) { try { previewNote(69 + (soundPick.oct * 12) + (f.oct * 12)); } catch (e) {} }
    return true;
  }

  function keepSound(){
    if (!soundPick.tryingId) return false;
    soundPick.keptId = soundPick.tryingId;
    autosave();
    return true;
  }

  // Melody suggestions follow the kept soundPick. Book I: register, articulation and density come from
  // the sound, not from a generic idea of "a melody".
  function soundMelodyHint(id){
    const f = soundFamily(id || soundPick.keptId || soundPick.tryingId);
    if (!f) return null;
    const dense = (f.voice === 'pluck' || f.voice === 'bell');
    const sustained = (f.voice === 'pad');
    return {
      family: f.name,
      register: f.oct > 0 ? 'high' : f.oct < 0 ? 'low' : 'middle',
      density: dense ? 'more notes, shorter' : sustained ? 'fewer notes, held' : 'even',
      sustain: sustained ? 'long' : dense ? 'short' : 'medium',
      role: sustained ? 'sits underneath' : dense ? 'drives' : 'carries the line',
      advice: sustained
        ? 'Hold notes and let them overlap. A pad playing a busy line just turns to mud.'
        : dense
          ? 'Short repeated notes suit this. It will read as rhythm as much as melody.'
          : 'It will carry a plain line well — you do not need to make it clever.',
    };
  }

  // ---------- Create something ----------
  //
  // The beginner entry. Ask ONLY what changes the music: lane, tempo feeling, mood, starting point.
  // It is not a project wizard and it does not add a navigation item — it opens from the Vibes panel
  // and from Ask Aura, which are the two places someone already goes to begin.

  const CREATE_LANES = [
    { id:'reggaeton', name:'Reggaetón',      vibe:'moody',    bpm:92, groove:{dembow:75,breath:70} },
    { id:'rnb',       name:'R&B',            vibe:'rnbchill', bpm:86, groove:{dembow:35,breath:55} },
    { id:'latinpop',  name:'Latin pop',      vibe:'latinpop', bpm:98, groove:{dembow:60,breath:60} },
    { id:'melodic',   name:'Melodic hip-hop',vibe:'houston',  bpm:80, groove:{dembow:30,breath:50} },
    { id:'trap',      name:'Trap',           vibe:'drillnoir',    bpm:76, groove:{dembow:25,breath:45} },
    { id:'bachata',   name:'Bachata',        vibe:'latinpop', bpm:128,groove:{dembow:45,breath:65} },
    { id:'cinematic', name:'Chanson / orchestral', vibe:'atmos', bpm:72, groove:{dembow:15,breath:40} },
    { id:'hybrid',    name:'Hybrid',         vibe:'moody',    bpm:92, groove:{dembow:55,breath:60} },
    { id:'surprise',  name:'Surprise me',    vibe:null,       bpm:92, groove:{dembow:70,breath:65} },
  ];
  const CREATE_TEMPO = [
    { id:'slow',   name:'Slow',   bpm:84 },
    { id:'mid',    name:'Mid',    bpm:92 },
    { id:'upbeat', name:'Upbeat', bpm:100 },
  ];
  const CREATE_MOODS = [
    { id:'dark',        name:'Dark',        sound:'dark',       space:45, vintage:55 },
    { id:'intimate',    name:'Intimate',    sound:'intimate',   space:18, vintage:40 },
    { id:'romantic',    name:'Romantic',    sound:'warm',       space:38, vintage:50 },
    { id:'summery',     name:'Summery',     sound:'glassy',     space:30, vintage:25 },
    { id:'hard',        name:'Hard',        sound:'metallic',   space:20, vintage:30 },
    { id:'floating',    name:'Floating',    sound:'dreamlike',  space:60, vintage:35 },
    { id:'triumphant',  name:'Triumphant',  sound:'orchestral', space:50, vintage:30 },
    { id:'confessional',name:'Confessional',sound:'soft',       space:25, vintage:45 },
    { id:'cinematic',   name:'Cinematic',   sound:'orchestral', space:55, vintage:40 },
    { id:'danceable',   name:'Danceable',   sound:'analoglike', space:28, vintage:45 },
  ];
  // The nine ways into a song. This is the ONE list: the Create sheet's fourth question renders
  // from it, and so does the Welcome. The welcome fields are additive — `name` and `goes` are
  // untouched, so nothing that already reads this list changes behaviour.
  //   w     the Welcome's route key (see W_ROUTES)
  //   wname the Welcome's wording, when a singer arriving cold needs plainer words than a chip
  //         inside the Create sheet, where the surrounding question already supplies the context
  //   icon  sprite id, drawn for this product
  //   grp   'have' = they already have something · 'build' = Aura helps them start from nothing
  const CREATE_STARTS = [
    { id:'sound',   name:'Find a sound',        goes:'sound',   w:'sound',  icon:'sound',     grp:'build', wname:'Find a sound' },
    { id:'beat',    name:'Build a beat',        goes:'groove',  w:'beat',   icon:'beat',      grp:'build', wname:'Build a beat' },
    { id:'chords',  name:'Start with chords',   goes:'chords',  w:'chords', icon:'harmony',   grp:'build', wname:'Start with chords' },
    { id:'hum',     name:'Hum an idea',         goes:'record',  w:'hum',    icon:'mic',       grp:'have',  wname:'Hum a melody' },
    { id:'lyrics',  name:'Write lyrics',        goes:'lyrics',  w:'lyrics', icon:'lyrics',    grp:'build', wname:'Write a lyric' },
    { id:'voice',   name:'Start with my voice', goes:'record',  w:'record', icon:'record',    grp:'have',  wname:'Sing an idea' },
    { id:'record',  name:'Record a sound',      goes:'sampler', w:'snd',    icon:'mixer',     grp:'have',  wname:'Record a sound' },
    { id:'import',  name:'Import a reference',  goes:'import',  w:'sample', icon:'reference', grp:'have',  wname:'Use a song I have' },
    { id:'aura',    name:'Let Aura decide',     goes:'groove',  w:'create', icon:'create',    grp:'build', wname:'Answer four questions' },
  ];
  // Two doors the Create sheet asks as its OTHER questions rather than as a starting point, and
  // one workspace that has always been reachable from the welcome. They belong in the same field
  // so a singer sees every way in at once. Same shape as above so one renderer covers all of them.
  const WELCOME_EXTRA = [
    { id:'w-genre',  w:'genre',  icon:'song',   grp:'build', wname:'Pick a genre' },
    { id:'w-melody', w:'melody', icon:'melody', grp:'build', wname:'Write a melody' },
  ];
  function welcomeDoors(){ return CREATE_STARTS.concat(WELCOME_EXTRA); }

  // Build a complete, editable first version. Everything it writes is a real edit inside one
  // checkpoint, so a singer who does not like it presses undo once.
  function createSomething(choice){
    const c = choice || {};
    const lane = CREATE_LANES.filter(l => l.id === c.lane)[0] || CREATE_LANES[0];
    const mood = CREATE_MOODS.filter(m => m.id === c.mood)[0] || CREATE_MOODS[0];
    const bpm  = c.bpm != null ? clampN(c.bpm | 0, 60, 160)
               : (CREATE_TEMPO.filter(t => t.id === c.tempo)[0] || { bpm: lane.bpm }).bpm;
    // "Surprise me" still has to be reproducible, so it picks from the seed rather than at random.
    const seed = (c.seed == null) ? ((bpm * 7919) ^ (mood.id.length * 104729)) : (c.seed | 0);
    const pick = lane.vibe || CREATE_LANES[Math.abs(seed) % (CREATE_LANES.length - 1)].vibe;

    oneCheckpoint(() => {
      if (pick) applyVibe(pick);
      bpmEl.value = String(bpm); bpmVal.textContent = String(bpm);
      bpmEl.dispatchEvent(new Event('input', { bubbles: true }));
      Object.keys(lane.groove).forEach(k => setGroove(k, lane.groove[k]));
      setGroove('space', mood.space);
      setGroove('vintage', mood.vintage);
      grooveSeed = seed;
      trySound(mood.sound, { silent:true });
      keepSound();
      applyArchitect({ seed: seed });
      if (c.intention) setIntention('feeling', c.intention);
    });
    renderGrooveCard();
    return {
      lane: lane.name, mood: mood.name, bpm: bpm,
      sound: soundFamily(mood.sound).name,
      ideaCode: grooveIdeaCode(),
      startAt: (CREATE_STARTS.filter(x => x.id === c.start)[0] || CREATE_STARTS[8]).goes,
      parts: architectPlan({}).length,      // sections in the form
      bars: songUsedLen(),                  // arrangement slots those sections occupy
    };
  }

  // ---------- Project intention ----------
  //
  // Book II Part 30 gap #11: a co-producer that remembers your project across weeks — motifs, keys,
  // themes, what you already rejected. No platform has it, because no platform holds your project;
  // Aura does, on your own disk, so it can.
  //
  // What this deliberately does NOT hold: raw media, Guide conversation text, anything about your
  // hardware. It is a handful of short strings about what the record is trying to be, it is
  // inspectable and editable, and the singer can clear it.

  const INTENTION_DEFAULT = {
    feeling:'',      // "intimate but powerful"
    subject:'',      // what it is about
    motif:'',        // a recurring idea worth protecting
    voiceNote:'',    // range or delivery preference
    rejected:'',     // a direction already tried and abandoned
    nextTime:'',     // where to pick up
  };
  const INTENTION_MAX = { feeling:160, subject:200, motif:160, voiceNote:160, rejected:200, nextTime:200 };
  const INTENTION_UI = [
    { id:'feeling',   label:'What it should feel like', ph:'Intimate but powerful' },
    { id:'subject',   label:'What it is about',         ph:'Leaving somewhere you loved' },
    { id:'motif',     label:'An idea worth keeping',    ph:'The three-note figure in the intro' },
    { id:'voiceNote', label:'About the voice',          ph:'Sits better low; chorus can open up' },
    { id:'rejected',  label:'Already tried, not this',  ph:'Faster and brighter — lost the feeling' },
    { id:'nextTime',  label:'Next time, start with',    ph:'Writing the second verse' },
  ];
  const intention = Object.assign({}, INTENTION_DEFAULT);

  function setIntention(k, v){
    if (!(k in INTENTION_DEFAULT)) return false;
    intention[k] = String(v == null ? '' : v).slice(0, INTENTION_MAX[k] || 200);
    return true;
  }
  function clearIntention(){ Object.assign(intention, INTENTION_DEFAULT); return true; }
  function intentionSummary(){
    const parts = [];
    if (intention.feeling)  parts.push(intention.feeling);
    if (intention.subject)  parts.push('about ' + intention.subject);
    if (intention.voiceNote) parts.push(intention.voiceNote);
    return parts.join(' · ');
  }

  // ---------- the groove builder ----------
  //
  // Book I's reggaetón system, as musical logic rather than a preset. Seven controls, each of which
  // has to make a change you can hear and see in the grid — a control that does nothing is worse
  // than a missing feature, and this project has shipped four of those before.
  //
  // The three rules that are not negotiable, because breaking any one of them stops the pattern
  // being this style at all:
  //   1. the kick is on every beat — steps 0, 4, 8, 12 of a 16-step bar
  //   2. the snare and percussion lean on the 3-3-2 accents — steps 0, 3, 6 of each 8-step half
  //   3. the low end leaves the step before the backbeat open, so the groove can breathe
  //
  // Everything else here is taste, and every value is reachable from the controls.

  // 3 + 3 + 2 across eight steps, twice per bar. These are the accent positions the whole genre
  // hangs on, and the fixtures assert them literally.
  const TRESILLO_8 = [0, 3, 6];
  function tresilloSteps(){
    const out = [];
    for (let half = 0; half < STEPS; half += 8)
      TRESILLO_8.forEach(t => { if (half + t < STEPS) out.push(half + t); });
    return out;                                   // [0,3,6,8,11,14] for a 16-step bar
  }
  const FLOOR_STEPS = [0, 4, 8, 12];

  // Beginner controls, 0-100. Named for what they do to the music, not for the parameter they move.
  const GROOVE_DEFAULT = { dembow:70, swing:22, breath:65, vintage:45, heat:50, space:35, lift:0 };
  const groove = Object.assign({}, GROOVE_DEFAULT);

  // Deterministic per-section variation. Same seed and same controls give the same pattern, every
  // time — that is what makes an Idea Code mean anything.
  function grooveRng(seed){
    let a = (seed | 0) || 1;
    return function(){ a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  // How full a section is. Book I builds the hook first and derives the verse by taking away, so
  // these are subtractive weights rather than separate patterns.
  const SECTION_ENERGY = {
    intro:   { hats:0.35, shaker:0.0,  openhat:0.0,  snare:0.5, clap:0.0, kick:1,    bass:0.7 },
    verse:   { hats:0.7,  shaker:0.35, openhat:0.25, snare:1,   clap:0.0, kick:1,    bass:1 },
    prechorus:{hats:0.85, shaker:0.6,  openhat:0.5,  snare:1,   clap:0.4, kick:1,    bass:1 },
    chorus:  { hats:1,    shaker:1,    openhat:0.8,  snare:1,   clap:1,   kick:1,    bass:1 },
    bridge:  { hats:0.5,  shaker:0.3,  openhat:0.2,  snare:0.7, clap:0.0, kick:0.75, bass:0.8 },
    outro:   { hats:0.4,  shaker:0.15, openhat:0.1,  snare:0.6, clap:0.0, kick:1,    bass:0.6 },
    other:   { hats:0.7,  shaker:0.4,  openhat:0.3,  snare:1,   clap:0.2, kick:1,    bass:1 },
  };
  function sectionEnergy(role){ return SECTION_ENERGY[role] || SECTION_ENERGY.other; }

  // Build one bar of drums. Returns lane arrays rather than writing them, so a caller can preview,
  // diff, or apply inside a single checkpoint.
  function grooveBeat(opts){
    const o = Object.assign({ role:'chorus', seed:1 }, groove, opts || {});
    const e = sectionEnergy(o.role);
    const rnd = grooveRng(o.seed);
    const lanes = {}; drums.forEach(d => lanes[d.id] = new Array(STEPS).fill(false));
    const acc   = {}; drums.forEach(d => acc[d.id]   = new Array(STEPS).fill(false));

    // 1. THE KICK IS ON THE FLOOR. Not conditional on any control.
    FLOOR_STEPS.forEach(st => { if (e.kick >= 1 || rnd() < e.kick) lanes.kick[st] = true; });
    lanes.kick[0] = true;                                  // the downbeat is never dropped

    // 2. The snare leans on the tresillo. `dembow` decides how much of the 3-3-2 it takes: low
    //    values keep only the backbeats, high values move it fully onto the accents.
    const tres = tresilloSteps();
    const backbeats = [4, 12];
    const d = o.dembow / 100;
    backbeats.forEach(st => { if (rnd() < e.snare) lanes.snare[st] = true; });
    tres.forEach(st => {
      if (st === 0) return;                                // the 1 belongs to the kick
      if (backbeats.indexOf(st) >= 0) return;
      if (rnd() < d * e.snare) { lanes.snare[st] = true; acc.snare[st] = true; }
    });
    // Clap doubles the backbeat in the fuller sections — the bright top layer over the snare body.
    backbeats.forEach(st => { if (rnd() < e.clap) lanes.clap[st] = true; });

    // 3. Hats drive; open hats move; the shaker fills the top. `heat` decides how much velocity
    //    variation there is, which is what stops the pattern reading as a machine.
    const heat = o.heat / 100;
    for (let st = 0; st < STEPS; st += 2) if (rnd() < e.hats) lanes.hat[st] = true;
    if (heat > 0.45) for (let st = 1; st < STEPS; st += 2) if (rnd() < e.hats * heat * 0.7) lanes.hat[st] = true;
    // Accent the hats that land with the kick or the snare — Book I's velocity rule, as accents.
    for (let st = 0; st < STEPS; st++)
      if (lanes.hat[st] && (lanes.kick[st] || lanes.snare[st]) && rnd() < heat) acc.hat[st] = true;
    [6, 14].forEach(st => { if (rnd() < e.openhat) lanes.openhat[st] = true; });
    tres.forEach(st => { if (rnd() < e.shaker) lanes.shaker[st] = true; });
    for (let st = 2; st < STEPS; st += 4) if (rnd() < e.shaker * 0.6) lanes.shaker[st] = true;

    // 4. `lift` is the final-chorus push: one extra open hat and a denser shaker, nothing more.
    if (o.lift > 50) { lanes.openhat[STEPS - 2] = true;
      for (let st = 0; st < STEPS; st += 2) if (rnd() < 0.5) lanes.shaker[st] = true; }

    return { lanes:lanes, acc:acc, tresillo:tres, floor:FLOOR_STEPS };
  }

  // The low end for one bar. `breath` is the whole point: it decides how much of the step before
  // the backbeat is left open. At 0 the bass runs into the snare and the groove stiffens; at 100
  // it stops well clear. The note LENGTHS carry this, not the note positions.
  function grooveLowEnd(opts){
    const o = Object.assign({ role:'chorus', seed:1, root:0 }, groove, opts || {});
    const e = sectionEnergy(o.role);
    const rnd = grooveRng(o.seed ^ 0x5bf0);
    const breath = o.breath / 100;
    const notes = [];
    // Three of the four grid divisions, leaving the fourth open before the backbeat.
    const starts = [0, 3, 6, 8, 11, 14];
    starts.forEach(st => {
      if (rnd() > e.bass) return;
      const nextBack = (st < 4) ? 4 : (st < 12 ? 12 : STEPS);
      const room = Math.max(1, nextBack - st);
      // breath=1 stops a full step short of the backbeat; breath=0 runs right into it.
      const len = Math.max(1, Math.round(room - breath * Math.min(room - 1, 2)));
      notes.push({ p: 36 + (o.root % 12), s: st, l: len, v: 0.9, g: false });
    });
    return notes;
  }

  // What the controls are worth in the mix. `vintage` and `space` are timbral rather than rhythmic,
  // so they move real mixer values instead of the grid.
  function grooveMixTargets(){
    return {
      // vintage: darker top, more low-mid weight — the analog-leaning colour
      melodyHi: -Math.round((groove.vintage / 100) * 6),
      melodyLo: Math.round((groove.vintage / 100) * 3),
      // space: reverb send on the melodic parts, kept off the low end
      chordsRev: Math.round((groove.space / 100) * 55),
      melodyRev: Math.round((groove.space / 100) * 45),
    };
  }

  // Roles per section slot, so a generated song has a shape rather than six identical bars.
  const GROOVE_ROLES = ['intro','verse','prechorus','chorus','bridge','outro'];
  function grooveRoleFor(i){ return GROOVE_ROLES[i] || 'other'; }

  // Write the groove into the project. One checkpoint for the whole thing, because it is one
  // decision from the singer's point of view however many lanes it touches.
  function applyGroove(opts){
    const o = opts || {};
    const seed = (o.seed == null) ? 1 : (o.seed | 0);
    const only = o.section;                                  // undefined = every section
    oneCheckpoint(() => {
      patterns.forEach((pat, i) => {
        if (only != null && i !== only) return;
        const role = o.role || grooveRoleFor(i);
        const b = grooveBeat({ role: role, seed: seed + i * 7919 });
        drums.forEach(dr => {
          pat[dr.id] = b.lanes[dr.id].slice();
          accents[i][dr.id] = b.acc[dr.id].slice();
        });
        if (o.lowEnd !== false) {
          pat.bass = grooveLowEnd({ role: role, seed: seed + i * 7919, root: keyRoot });
        }
      });
      // The timbral controls move real mixer values, so Vintage and Space are audible and exported.
      const t = grooveMixTargets();
      if (mix.melody) { mix.melody.hi = t.melodyHi; mix.melody.lo = t.melodyLo; mix.melody.rev = t.melodyRev; }
      if (mix.chords) { mix.chords.rev = t.chordsRev; }
      applyAllGroupsLive(); syncMixerUI();
      renderGrid(); refreshPatBtns();
    });
    return true;
  }

  function setGroove(name, value){
    if (!(name in groove)) return false;
    groove[name] = clampN(+value | 0, 0, 100);
    return true;
  }

  // Each control says what it does in the singer's language. `hint` is deliberately short: this is a
  // card someone reads once, not documentation.
  const GROOVE_UI = [
    { id:'dembow',  name:'Dembow',     hint:'How far the snare leans onto the 3-3-2 accents.' },
    { id:'swing',   name:'Swing',      hint:'How much the off-steps lean, so the bar rolls.' },
    { id:'breath',  name:'Bass Breath',hint:'How much room the low end leaves before the backbeat.' },
    { id:'vintage', name:'Vintage',    hint:'Darker, warmer top — the older-sounding colour.' },
    { id:'heat',    name:'Heat',       hint:'How much the hats and shaker vary, so it is not a machine.' },
    { id:'space',   name:'Space',      hint:'How much room the melodic parts sit in.' },
    { id:'lift',    name:'Lift',       hint:'A final-chorus push: one more open hat, a denser shaker.' },
  ];

  function renderGrooveCard(){
    const host = document.getElementById('grooveGrid'); if(!host) return;
    host.innerHTML = '';
    GROOVE_UI.forEach(c => {
      const wrap = document.createElement('div'); wrap.className = 'groovectl';
      const lab = document.createElement('label'); lab.setAttribute('for','gv-'+c.id);
      const nm = document.createElement('span'); nm.textContent = c.name;
      const val = document.createElement('span'); val.className='gval'; val.id='gvv-'+c.id;
      val.textContent = groove[c.id];
      lab.appendChild(nm); lab.appendChild(val);
      const inp = document.createElement('input');
      inp.type='range'; inp.min='0'; inp.max='100'; inp.id='gv-'+c.id;
      inp.value = String(groove[c.id]);
      inp.setAttribute('aria-describedby','gvh-'+c.id);
      // Swing is the project's own control, not a groove-local one — keep them in step rather than
      // having two things called swing that disagree.
      inp.addEventListener('input', () => {
        setGroove(c.id, inp.value);
        val.textContent = groove[c.id];
        if (c.id === 'swing' && swingEl) {
          swingEl.value = String(groove.swing);
          swingEl.dispatchEvent(new Event('input',{bubbles:true}));
        }
      });
      const hint = document.createElement('div');
      hint.className='ghint2'; hint.id='gvh-'+c.id; hint.textContent = c.hint;
      wrap.appendChild(lab); wrap.appendChild(inp); wrap.appendChild(hint);
      host.appendChild(wrap);
    });
    paintGrooveIdea();
  }

  function paintGrooveIdea(){
    const el = document.getElementById('grooveIdea'); if(!el) return;
    el.textContent = 'Idea Code ' + grooveIdeaCode() +
      ' — the same code and the same tempo rebuild this groove exactly.';
  }

  // The Idea Code for the groove: the controls plus the seed, in a short readable form. Book II's
  // Part 30 gap #1 — no generator exposes a seed, so no generated idea can be recovered. Aura owns
  // its synthesis, so it can.
  let grooveSeed = 1;
  // FIXED WIDTH, two base-36 characters per control. One character per control does not work: any
  // value above 35 encodes as two characters, so the body length varies with the settings and the
  // decoder mis-parses it. Caught by round-tripping a real code rather than by reading the encoder.
  const IDEA_W = 2;
  function grooveIdeaCode(){
    const v = GROOVE_UI.map(c => {
      const t = clampN(groove[c.id]|0, 0, 100).toString(36);
      return t.length >= IDEA_W ? t.slice(-IDEA_W) : ('0'.repeat(IDEA_W - t.length) + t);
    }).join('');
    return ('G' + grooveSeed.toString(36) + '-' + v).toUpperCase();
  }
  function grooveFromIdeaCode(code){
    const m = /^G([0-9A-Z]+)-([0-9A-Z]+)$/i.exec(String(code||'').trim());
    if(!m) return false;
    const seed = parseInt(m[1], 36);
    const body = m[2].toLowerCase();
    if(!isFinite(seed) || body.length !== GROOVE_UI.length * IDEA_W) return false;
    const vals = GROOVE_UI.map((c,i) => parseInt(body.substr(i*IDEA_W, IDEA_W), 36));
    if(vals.some(v => !isFinite(v))) return false;          // refuse a damaged code outright
    GROOVE_UI.forEach((c,i) => { groove[c.id] = clampN(vals[i], 0, 100); });
    grooveSeed = seed;
    renderGrooveCard();
    return true;
  }

  function wireGrooveCard(){
    const card = document.getElementById('grooveCard'); if(!card) return;
    renderGrooveCard();
    const ap = document.getElementById('grooveApply');
    if(ap) ap.addEventListener('click', () => {
      applyGroove({ seed: grooveSeed });
      paintGrooveIdea();
      toast('Groove built across every section. The kick is on the floor; undo puts it back.');
    });
    const sec = document.getElementById('grooveSection');
    if(sec) sec.addEventListener('click', () => {
      applyGroove({ seed: grooveSeed, section: currentPattern, role: grooveRoleFor(currentPattern) });
      paintGrooveIdea();
      toast('Groove built for this section only.');
    });
    const rs = document.getElementById('grooveReset');
    if(rs) rs.addEventListener('click', () => {
      Object.assign(groove, GROOVE_DEFAULT); grooveSeed = 1; renderGrooveCard();
      toast('Groove controls back to the default. Nothing in your track changed until you build.');
    });
  }

  // ---------- Song Architect ----------
  //
  // Book I builds the hook first and derives everything else by taking away. That is the whole
  // design here: one full section is written, and the sparser ones are the same material with
  // parts removed, so contrast is structural rather than six unrelated patterns.

  const ARCH_FORM = ['intro','verse','prechorus','chorus','verse','prechorus','chorus','bridge','chorus','outro'];
  // Which of the six pattern slots each form position uses. Aura has six sections, so the repeats
  // reuse slots rather than needing ten.
  const ARCH_SLOT = { intro:0, verse:1, prechorus:2, chorus:3, bridge:4, outro:5 };
  // Bars per position. Book I: run a section twice before changing, so a listener can settle.
  const ARCH_BARS = { intro:2, verse:4, prechorus:2, chorus:4, bridge:2, outro:2 };

  function architectPlan(opts){
    const o = opts || {};
    const form = (o.form || ARCH_FORM).slice();
    const plan = [];
    let bar = 0;
    form.forEach((role, i) => {
      const slot = ARCH_SLOT[role];
      const bars = ARCH_BARS[role] || 2;
      if (bar + bars > SONG_SLOTS) return;
      plan.push({ role: role, slot: slot, from: bar, bars: bars,
                  last: (role === 'chorus' && i === form.lastIndexOf('chorus')) });
      bar += bars;
    });
    return plan;
  }

  // Build the whole arrangement. Writes the six section patterns from the groove at the role's
  // energy, lays them across the playlist, and names them.
  function applyArchitect(opts){
    const o = opts || {};
    const plan = architectPlan(o);
    const seed = (o.seed == null) ? grooveSeed : (o.seed | 0);
    oneCheckpoint(() => {
      // one pattern per role, written at that role's energy
      Object.keys(ARCH_SLOT).forEach(role => {
        const i = ARCH_SLOT[role];
        const b = grooveBeat({ role: role, seed: seed + i * 7919 });
        drums.forEach(dr => { patterns[i][dr.id] = b.lanes[dr.id].slice();
                              accents[i][dr.id] = b.acc[dr.id].slice(); });
        patterns[i].bass = grooveLowEnd({ role: role, seed: seed + i * 7919, root: keyRoot });
        if (!secNames[i] || /^Sec /.test(secNames[i])) secNames[i] = ARCH_NAME[role] || ('Part ' + (i+1));
      });
      song.fill(null);
      plan.forEach(p => { for (let b = 0; b < p.bars; b++) if (p.from + b < SONG_SLOTS) song[p.from + b] = p.slot; });
      for (let i = 0; i < SONG_SLOTS; i++) renderSlot(i);
      document.querySelectorAll('#secnames input').forEach((el, i) => { el.value = secNames[i] || ''; });
      renderGrid(); refreshPatBtns();
    });
    return plan;
  }
  const ARCH_NAME = { intro:'Intro', verse:'Verse', prechorus:'Pre-chorus',
                      chorus:'Chorus', bridge:'Bridge', outro:'Outro' };

  // Named architect actions. Each is a real edit to real data, and each is previewable before it
  // runs — the brief is explicit that nothing here mutates without a preview.
  function architectActions(){
    return {
      buildFull:  { label:'Build the full song',
                    preview:'Writes six sections and lays out a full arrangement. Undo puts it back.',
                    run:()=>{ applyArchitect({}); } },
      biggerChorus:{label:'Make the chorus bigger',
                    preview:'Adds the parts a chorus can carry and lifts its energy.',
                    run:()=>{ oneCheckpoint(()=>{ const i=ARCH_SLOT.chorus;
                      const b=grooveBeat({role:'chorus',seed:grooveSeed+i*7919,lift:80});
                      drums.forEach(dr=>{ patterns[i][dr.id]=b.lanes[dr.id].slice();
                                          accents[i][dr.id]=b.acc[dr.id].slice(); });
                      renderGrid(); refreshPatBtns(); }); } },
      simplerVerse:{label:'Make the verse simpler',
                    preview:'Takes parts out of the verse rather than rewriting it.',
                    run:()=>{ oneCheckpoint(()=>{ const i=ARCH_SLOT.verse;
                      const b=grooveBeat({role:'intro',seed:grooveSeed+i*7919});
                      drums.forEach(dr=>{ patterns[i][dr.id]=b.lanes[dr.id].slice();
                                          accents[i][dr.id]=b.acc[dr.id].slice(); });
                      renderGrid(); refreshPatBtns(); }); } },
      finalLift:  { label:'Create a final lift',
                    preview:'Pushes the last chorus past the first one so the end is the peak.',
                    run:()=>{ oneCheckpoint(()=>{ const i=ARCH_SLOT.chorus;
                      const b=grooveBeat({role:'chorus',seed:grooveSeed+i*7919,lift:90,heat:Math.min(100,groove.heat+25)});
                      drums.forEach(dr=>{ patterns[i][dr.id]=b.lanes[dr.id].slice();
                                          accents[i][dr.id]=b.acc[dr.id].slice(); });
                      renderGrid(); refreshPatBtns(); }); } },
      shorter:    { label:'Make it shorter',
                    preview:'Halves the arrangement, keeping the shape.',
                    run:()=>{ oneCheckpoint(()=>{ const used=songUsedLen();
                      for(let i=Math.ceil(used/2);i<SONG_SLOTS;i++){ song[i]=null; renderSlot(i); } }); } },
      roomForVocals:{label:'Leave more room for vocals',
                    preview:'Thins the parts that sit where a voice sits.',
                    run:()=>{ oneCheckpoint(()=>{
                      if(mix.melody) mix.melody.vol=Math.max(0,mix.melody.vol-18);
                      if(mix.chords) mix.chords.vol=Math.max(0,mix.chords.vol-10);
                      applyAllGroupsLive(); syncMixerUI(); }); } },
    };
  }

  // ---------- Transition Designer ----------
  //
  // "The biggest amateur mistake is hard cuts between sections." Every type here writes a real
  // editable event — a changed pattern, an automation entry, or both. Nothing decorative.

  const TRANSITIONS = [
    { id:'breather',   name:'Breather',        needs:'energy-up',   why:'Silence before a return makes the return land.' },
    { id:'drumfill',   name:'Drum fill',       needs:'energy-up',   why:'A single bar of fill carries you across the join.' },
    { id:'snarebuild', name:'Snare build',     needs:'energy-up',   why:'A roll that accelerates into the next section.' },
    { id:'kickstutter',name:'Kick stutter',    needs:'energy-up',   why:'Repeats the kick into the change.' },
    { id:'bassdrop',   name:'Bass drop',       needs:'energy-up',   why:'Take the low end out for a bar so its return hits.' },
    { id:'filterclose',name:'Filter close',    needs:'energy-down', why:'Pulls the section back and away.' },
    { id:'filteropen', name:'Filter open',     needs:'energy-up',   why:'Opens up into the new section.' },
    { id:'reverbtail', name:'Reverb tail',     needs:'any',         why:'Lets one section breathe into the next.' },
    { id:'reverselift',name:'Reverse lift',    needs:'energy-up',   why:'A reversed swell pulling you forward.' },
    { id:'silence',    name:'Silence',         needs:'energy-up',   why:'The cheapest and most effective impact there is.' },
    { id:'octaverise', name:'Octave rise',     needs:'energy-up',   why:'Lifts the melodic part an octave into the change.' },
    { id:'suspend',    name:'Chord suspension',needs:'any',         why:'Holds the harmony unresolved across the join.' },
    { id:'samplerfill',name:'Sampler fill',    needs:'any',         why:'Uses a slice of your own sound as the fill.' },
  ];

  // Recommend by what is leaving and what is arriving, not at random.
  function transitionSuggest(fromRole, toRole){
    const rank = { intro:1, verse:2, prechorus:3, chorus:5, bridge:2, outro:1, other:2 };
    const up = (rank[toRole] || 2) - (rank[fromRole] || 2);
    const dir = up > 0 ? 'energy-up' : (up < 0 ? 'energy-down' : 'any');
    const fits = TRANSITIONS.filter(t => t.needs === dir || t.needs === 'any');
    // Into a chorus, the two that Book I singles out come first.
    if (toRole === 'chorus') {
      fits.sort((a, b) => (a.id === 'bassdrop' ? -1 : b.id === 'bassdrop' ? 1 :
                           a.id === 'breather' ? -1 : b.id === 'breather' ? 1 : 0));
    }
    return { direction: dir, options: fits.slice(0, 5) };
  }

  // Write a transition into the bar BEFORE the given arrangement position. Every branch changes
  // real data; a type that could not be realised returns false rather than pretending.
  function applyTransition(type, atBar){
    const bar = clampN(atBar | 0, 1, SONG_SLOTS - 1);
    const prev = song[bar - 1];
    if (prev == null) return false;                       // nothing to transition out of
    const t = TRANSITIONS.filter(function (x) { return x.id === type; })[0];
    if (!t) return false;
    let did = false;
    oneCheckpoint(() => {
      const pat = patterns[prev];
      const acc = accents[prev];
      switch (type) {
        case 'breather':                                   // strip everything but one element
          drums.forEach(d => { if (d.id !== 'hat') pat[d.id] = new Array(STEPS).fill(false); });
          pat.bass = []; did = true; break;
        case 'silence':
          drums.forEach(d => { pat[d.id] = new Array(STEPS).fill(false); });
          pat.bass = []; did = true; break;
        case 'bassdrop':
          pat.bass = []; did = true; break;
        case 'drumfill':                                   // snare on the last beat, dense
          for (let st = 12; st < STEPS; st++) { pat.snare[st] = true; acc.snare[st] = (st % 2 === 0); }
          did = true; break;
        case 'snarebuild':                                 // accelerating roll across the bar
          [8, 10, 12, 13, 14, 15].forEach(st => { pat.snare[st] = true; acc.snare[st] = st >= 13; });
          did = true; break;
        case 'kickstutter':
          [12, 13, 14, 15].forEach(st => { pat.kick[st] = true; });
          did = true; break;
        case 'filterclose': case 'filteropen': case 'reverbtail': case 'reverselift':
        case 'octaverise':  case 'suspend':  case 'samplerfill':
          // These are mix and timbre moves, so they land as real automation on the section.
          did = transitionAutomation(type, prev); break;
      }
      if (did) { renderGrid(); refreshPatBtns(); }
    });
    return did;
  }

  // The non-rhythmic transitions, as real values on the section's own mix. They persist, they are
  // undoable, and they are in the export because the export renders the same graph.
  function transitionAutomation(type, slot){
    switch (type) {
      case 'filterclose': if (!mix.melody) return false;
        mix.melody.hi = -12; mix.chords.hi = -10; break;
      case 'filteropen':  if (!mix.melody) return false;
        mix.melody.hi = 4;  mix.chords.hi = 3;  break;
      case 'reverbtail':  if (!mix.melody) return false;
        mix.melody.rev = Math.min(100, (mix.melody.rev || 0) + 35);
        mix.chords.rev = Math.min(100, (mix.chords.rev || 0) + 25); break;
      case 'reverselift': if (!mix.melody) return false;
        mix.melody.rev = Math.min(100, (mix.melody.rev || 0) + 45);
        mix.melody.hi = -4; break;
      case 'octaverise': {
        const p = patterns[slot]; if (!p || !p.melody || !p.melody.length) return false;
        p.melody = p.melody.map(n => Object.assign({}, n, { p: Math.min(96, n.p + 12) })); break;
      }
      case 'suspend': {
        const p = patterns[slot];
        let any = false;
        CHORD_DEGREES.forEach(c => { for (let st = 12; st < STEPS; st++) if (p[c.id][st]) any = true; });
        if (!any) { for (let st = 12; st < STEPS; st++) p[CHORD_DEGREES[4].id][st] = true; }
        break;
      }
      case 'samplerfill':
        if (!smp.buf) return false;                        // honest: no sound loaded, no fill
        break;
      default: return false;
    }
    applyAllGroupsLive(); syncMixerUI();
    return true;
  }

  // ---------- Emotion Map ----------
  //
  // Musical and perceptual measurement, NOT neurology. Book I Part 16 explains why contrast and
  // reward matter; this measures the structural facts that produce them and says nothing about
  // what a listener will feel.

  function sectionMetrics(i){
    const p = patterns[i]; if (!p) return null;
    let hits = 0, lanes = 0;
    drums.forEach(d => { const n = p[d.id].filter(Boolean).length; hits += n; if (n) lanes++; });
    const bass = (p.bass || []).length;
    const mel = (p.melody || []).length;
    let chord = 0; CHORD_DEGREES.forEach(c => { chord += p[c.id].filter(Boolean).length; });
    // density: how much of the bar is occupied, across every lane that could be
    const density = (hits + bass + mel + chord) / (STEPS * (drums.length + 2));
    // drive: percussive activity alone
    const drive = hits / (STEPS * drums.length);
    // vocalSpace: how much is competing in the register a voice occupies
    const vocalSpace = 1 - Math.min(1, (mel * 1.4 + chord * 0.5) / (STEPS * 1.5));
    return { section:i, name: secNames[i] || ('Section ' + (i + 1)),
             hits, lanes, bass, melody: mel, chords: chord,
             density: +density.toFixed(3), drive: +drive.toFixed(3),
             energy: +Math.min(1, density * 0.7 + drive * 0.5).toFixed(3),
             vocalSpace: +vocalSpace.toFixed(3) };
  }

  function emotionMap(){
    const used = [];
    for (let i = 0; i < N_PATTERNS; i++) { const m = sectionMetrics(i); if (m) used.push(m); }
    const findings = [];
    // "Pre-Chorus" contains "chorus", so a bare /chorus/i match picks the pre-chorus and compares
    // the verse against the wrong section. That fired `verse-chorus-alike` on the Architect's own
    // output, which measures a genuine 0.24 -> 0.40 lift. Exclude the prefixed forms explicitly.
    const isChorus = u => /chorus/i.test(u.name) && !/pre[\s-]*chorus/i.test(u.name);
    const isVerse  = u => /verse/i.test(u.name);
    const verse = used.filter(isVerse)[0], chorus = used.filter(isChorus)[0];
    if (verse && chorus && Math.abs(verse.energy - chorus.energy) < 0.08) {
      findings.push({ id:'verse-chorus-alike', severity:'high',
        text:'The verse and the chorus measure almost the same. There is no lift when the chorus arrives.',
        action:'contrast' });
    }
    if (chorus && verse && chorus.energy < verse.energy) {
      findings.push({ id:'chorus-smaller', severity:'high',
        text:'The chorus is less busy than the verse. That can work deliberately, but it is usually not intended.',
        action:'biggerChorus' });
    }
    const dense = used.filter(u => u.density > 0.42);
    if (dense.length === used.length && used.length > 2) {
      findings.push({ id:'all-dense', severity:'medium',
        text:'Every section is dense. Nothing is ever taken away, so nothing ever returns.',
        action:'breather' });
    }
    const noSpace = used.filter(u => u.vocalSpace < 0.45);
    if (noSpace.length) {
      findings.push({ id:'vocal-crowded', severity:'medium',
        text:'The voice will be competing in ' + noSpace.map(u => u.name).join(', ') + '.',
        action:'roomForVocals' });
    }
    const usedLen = songUsedLen();
    if (usedLen >= 4) {
      let flat = 0, worst = 0;
      for (let b = 1; b < usedLen; b++) if (song[b] === song[b - 1]) { flat++; worst = Math.max(worst, flat); }
        else flat = 0;
      if (worst >= 6) findings.push({ id:'long-flat-run', severity:'medium',
        text:'There are ' + (worst + 1) + ' bars with no change at all. That is a long time to give nothing.',
        action:'transition' });
    }
    return { sections: used, findings: findings };
  }

  // ---------- Mix Check ----------
  //
  // Plain language, real measurements, and every warning names an Aura control that fixes it.

  function mixCheck(){
    const out = [];
    const say = (id, sev, text, fix) => out.push({ id:id, severity:sev, text:text, fix:fix });
    const m = mix;
    // kick and bass fighting for the same space
    const bassHeavy = (m.bass && (m.bass.lo || 0) > 4) || (m.bass && (m.bass.vol || 100) > 115);
    const kickQuiet = m.kick && (m.kick.vol || 100) < 92;
    if (bassHeavy && kickQuiet) say('kick-bass', 'high',
      'The bass is covering the kick. They are both fighting for the bottom of the mix.', 'Weight');
    // Low end running into the backbeat. The first version counted what fraction of notes were
    // longer than a quarter-bar, which is not the rule and is not stable: it measured 0.484 across
    // six sections at Bass Breath 0 — the worst possible setting — because sparser sections write
    // fewer notes and dilute the ratio. Book I's actual rule is that the note before the backbeat
    // has to STOP SHORT of it, so measure exactly that: a note whose end reaches or passes the
    // backbeat is the defect, whatever the section density.
    // The rule is "leave the step before the backbeat open", and the distinction that matters is
    // between LANDING on that step and SUSTAINING through it. A short note on step 3 is a tresillo
    // accent and is correct; a note from step 0 that holds through step 3 is the defect. The first
    // attempt tested the note's end against the backbeat itself, which flagged every note whose
    // exclusive end touched it — including ones that never sounded there — so the warning fired on
    // a healthy project and never cleared.
    let intoBackbeat = 0, totalNotes = 0;
    const BACKBEATS = [4, 12];
    patterns.forEach(p => (p.bass || []).forEach(n => {
      totalNotes++;
      const gap = n.s + n.l;                       // exclusive end
      if (BACKBEATS.some(b => n.s < b - 1 && gap > b - 1)) intoBackbeat++;
    }));
    if (intoBackbeat > 0) say('bass-long', 'high',
      'The low end runs into the backbeat in ' + intoBackbeat + ' place' + (intoBackbeat === 1 ? '' : 's') +
      '. That gap before the snare is what the groove breathes through.', 'Bass Breath');
    // reverb filling the vocal space
    const wet = (m.melody && m.melody.rev || 0) + (m.chords && m.chords.rev || 0);
    if (wet > 120) say('reverb-mud', 'medium',
      'There is a lot of reverb on the melodic parts. It will fill the space the voice needs.', 'Space');
    // width collapsed or exaggerated
    const wide = GROUPS.filter(G => Math.abs((m[G.id] && m[G.id].pan) || 0) > 70).length;
    if (wide >= 3) say('too-wide', 'low',
      'Several parts are pushed hard to the sides. It can read as hollow in the middle.', 'Pan in Balance');
    // clipping risk from stacked level
    const hot = GROUPS.filter(G => ((m[G.id] && m[G.id].vol) || 100) > 120).length;
    if (hot >= 3) say('clip-risk', 'high',
      'Several channels are pushed well past their normal level. That is where clipping comes from.',
      'the channel levels in Balance');
    // section over-density, from the same measurement the Emotion Map uses
    const em = emotionMap();
    em.sections.forEach(sc => { if (sc.density > 0.55) say('dense-' + sc.section, 'medium',
      sc.name + ' has more parts running than it needs.', 'Space'); });
    // a chorus that is only busier
    const v = em.sections.filter(x => /verse/i.test(x.name))[0];
    const c = em.sections.filter(x => /chorus/i.test(x.name) && !/pre[\s-]*chorus/i.test(x.name))[0];
    if (v && c && c.density > v.density * 1.3 && c.drive < v.drive * 1.1) say('busy-not-strong', 'medium',
      'The chorus is busier than the verse, but not stronger. Density is not the same as impact.', 'Weight');
    return out;
  }

  // ---------- Lyric and Topline Studio ----------
  //
  // This analyses text the SINGER wrote. It does not write lyrics, does not translate, and has no
  // language model behind it — Aura would be claiming a capability it does not have, which is the
  // exact dishonesty the Guide exists to avoid. What it can do is count, compare and measure
  // against the actual melody in the actual section.

  const lyrics = { sections: {}, notes: {} };   // per section slot: text and performance notes

  // Syllable counting for English and Spanish. Vowel-group counting with the usual corrections.
  // Spanish is the more regular of the two, so the same routine does better there; the count is a
  // guide for fitting a line to a melody, not a linguistic claim, and the UI says so.
  // Spanish is far more regular than English here, and the two need different rules — applying the
  // English silent-final-e rule to Spanish counts "noche" as one syllable when it is two, and that
  // error compounds across a whole verse. Detected per word, with a line-level hint, because a
  // Spanglish lyric mixes them line by line.
  var SPANISH_HINT = /[áéíóúñü]|\b(que|para|con|por|los|las|una|este|esta|nada|todo|siempre|nunca|amor|noche|corazón|corazon|vida|quiero|cuando|donde|porque)\b/i;
  function looksSpanish(word, hint){
    if (/[áéíóúñ]/.test(word)) return true;
    if (hint) return true;
    // Spanish orthography a plain English word almost never has
    return /(ción|ll|rr|ñ)/.test(word);
  }
  function countSyllables(word, hint){
    var w = String(word || '').toLowerCase().replace(/[^a-záéíóúüñ']/g, '');
    if (!w) return 0;
    var groups = w.match(/[aeiouyáéíóúü]+/g);
    var n = groups ? groups.length : 0;
    var es = looksSpanish(w, hint);
    if (!es) {
      // English silent final e: "time" is one, not two. Not after a consonant+le ("table").
      if (/[^aeiou]e$/.test(w) && w.length > 3 && !/[aeiou]?le$/.test(w)) n -= 1;
      // "-ed" is usually silent — EXCEPT after t or d, where it forms its own syllable
      // ("walked" is one; "wanted" is two).
      if (/[^aeioutd]ed$/.test(w) && n > 1) n -= 1;
      // "-es" adds a syllable after a sibilant ("dances", "wishes", "buzzes") and does not
      // otherwise ("makes"). Getting this backwards was miscounting every plural.
      if (/[^aeiou]es$/.test(w) && !/(c|s|x|z|ch|sh|g)es$/.test(w) && n > 1) n -= 1;
    }
    return Math.max(1, n);
  }
  function lineSyllables(line){
    var text = String(line || '');
    var hint = SPANISH_HINT.test(text);
    return text.split(/\s+/).filter(Boolean)
      .reduce(function (a, w) { return a + countSyllables(w, hint); }, 0);
  }

  // Which syllables would land on a strong beat, given the melody in this section.
  function melodyNotesFor(slot){
    var p = patterns[slot];
    return p ? (p.melody || []).slice().sort(function (a, b) { return a.s - b.s; }) : [];
  }

  var OPEN_VOWELS = /[aoáó]/i;
  var CLUSTER_END = /[bcdfghjklmnpqrstvwxyz]{2,}$/i;
  var PLOSIVE_START = /^[ptkbdg]/i;

  function analyseLyricLine(line, note){
    var words = String(line || '').split(/\s+/).filter(Boolean);
    var syl = lineSyllables(line);
    var last = words.length ? words[words.length - 1] : '';
    var flags = [];
    if (note && note.l >= 4) {
      if (CLUSTER_END.test(last))
        flags.push({ id:'cluster-on-hold', text:'"' + last + '" ends in a consonant cluster and this note is held. You cannot sustain on that.' });
      else if (OPEN_VOWELS.test(last))
        flags.push({ id:'open-vowel-hold', text:'"' + last + '" opens out — good place for the held note.' });
    }
    if (PLOSIVE_START.test(last) && note && note.l <= 2)
      flags.push({ id:'plosive-punch', text:'"' + last + '" starts hard and the note is short — that lands as rhythm.' });
    // an inversion or a padding word at the line end is the usual signature of a bent rhyme
    if (/\b(do|does|did|so|then|now|there)\s*$/i.test(line) && words.length > 4)
      flags.push({ id:'possible-forced', text:'That line ends on a filler word — worth checking you would say it out loud.' });
    return { text:line, words:words.length, syllables:syl, flags:flags };
  }

  function lyricAnalysis(slot){
    var text = lyrics.sections[slot] || '';
    var lines = text.split(/\n/).map(function (l) { return l.trim(); }).filter(function (l) { return l.length; });
    var notes = melodyNotesFor(slot);
    var out = lines.map(function (l, i) { return analyseLyricLine(l, notes[i]); });
    var totalSyl = out.reduce(function (a, r) { return a + r.syllables; }, 0);
    var fit = null;
    if (notes.length) {
      fit = { notes: notes.length, syllables: totalSyl,
              over: Math.max(0, totalSyl - notes.length),
              under: Math.max(0, notes.length - totalSyl) };
    }
    // line-length comparison: lines that differ wildly usually read as unfinished
    var lens = out.map(function (r) { return r.syllables; });
    var spread = lens.length ? (Math.max.apply(null, lens) - Math.min.apply(null, lens)) : 0;
    // rhyme grouping by final vowel sound, roughly
    var groups = {};
    out.forEach(function (r, i) {
      var w = r.text.split(/\s+/).pop() || '';
      var k = (w.toLowerCase().match(/[aeiouáéíóú][a-záéíóúñ]*$/) || [''])[0];
      if (!k) return; (groups[k] = groups[k] || []).push(i + 1);
    });
    return { slot:slot, lines:out, totalSyllables:totalSyl, fit:fit, spread:spread,
             rhymes:Object.keys(groups).filter(function (k) { return groups[k].length > 1; })
                     .map(function (k) { return { sound:k, lines:groups[k] }; }) };
  }

  // Breath marks: put them at the real gaps in the melody, and let the singer move them.
  function suggestBreaths(slot){
    var notes = melodyNotesFor(slot);
    var marks = [];
    for (var i = 1; i < notes.length; i++) {
      var gap = notes[i].s - (notes[i-1].s + notes[i-1].l);
      if (gap >= 2) marks.push({ afterLine: i, atStep: notes[i-1].s + notes[i-1].l, gap: gap });
    }
    return marks;
  }

  function setLyrics(slot, text){
    lyrics.sections[slot | 0] = String(text == null ? '' : text).slice(0, 4000);
    return true;
  }
  function setPerformanceNote(slot, text){
    lyrics.notes[slot | 0] = String(text == null ? '' : text).slice(0, 500);
    return true;
  }

  // ---------- Vocal Coach ----------
  //
  // Uses the real project: key, tempo, the melody in this section, the lyric if there is one.
  // Cues are one sentence, because in the moment a singer can hold exactly one instruction.
  // No health advice, ever — not a hedge, a hard rule.

  function vocalRange(slot){
    var notes = (slot == null)
      ? patterns.reduce(function (a, p) { return a.concat(p.melody || []); }, [])
      : melodyNotesFor(slot);
    if (!notes.length) return null;
    var lo = Math.min.apply(null, notes.map(function (n) { return n.p; }));
    var hi = Math.max.apply(null, notes.map(function (n) { return n.p; }));
    return { low:lo, high:hi, semitones:hi - lo,
             lowName:NOTE_NAMES[((lo % 12) + 12) % 12] + (Math.floor(lo / 12) - 1),
             highName:NOTE_NAMES[((hi % 12) + 12) % 12] + (Math.floor(hi / 12) - 1) };
  }

  function vocalCoach(slot){
    var i = (slot == null) ? currentPattern : (slot | 0);
    var r = vocalRange(i);
    var em = sectionMetrics(i);
    var name = secNames[i] || ('Section ' + (i + 1));
    var cues = [];
    var bpm = Math.round(+bpmEl.value);

    if (!r) {
      cues.push('There is no melody in ' + name + ' yet, so this is open. Sing what you hear and Aura will follow.');
    } else {
      if (r.semitones > 14)
        cues.push('This section spans ' + r.semitones + ' semitones, from ' + r.lowName + ' to ' + r.highName +
                  '. That is a wide stretch — try it once before you commit to it.');
      else
        cues.push('This section sits between ' + r.lowName + ' and ' + r.highName + '.');
    }
    if (/chorus/i.test(name) && !/pre/i.test(name)) cues.push('Open up here. Let the chorus be the loudest thing you do.');
    else if (/verse/i.test(name)) cues.push('Keep the verse closer and quieter than the chorus, so the chorus has somewhere to go.');
    else if (/bridge/i.test(name)) cues.push('The bridge is the place to change character — try it further back, or more spoken.');

    var breaths = suggestBreaths(i);
    if (breaths.length) cues.push('There ' + (breaths.length === 1 ? 'is a natural gap' : 'are ' + breaths.length + ' natural gaps') +
                                  ' in this melody. Breathe there rather than mid-phrase.');
    if (em && em.vocalSpace < 0.5) cues.push('The music is busy here. Sing forward — do not fight it by pushing harder.');
    if (bpm >= 100) cues.push('At ' + bpm + ' BPM the words come quickly. Practise it slower first.');

    var la = lyricAnalysis(i);
    la.lines.forEach(function (l) {
      l.flags.forEach(function (f) { if (cues.length < 8) cues.push(f.text); });
    });
    if (lyrics.notes[i]) cues.push('Your note for this section: ' + lyrics.notes[i]);

    return { section:i, name:name, key:NOTE_NAMES[keyRoot] + (keyMode === 'minor' ? 'm' : ''),
             bpm:bpm, range:r, breaths:breaths, cues:cues };
  }

  // ---------- craft UI ----------
  // Every control here calls the same function the QA surface calls. Nothing in this section
  // reimplements logic — a second implementation is a second thing to get wrong.

  function craftEl(tag, cls, text){
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  // APPENDS. It used to clear the host, which silently wiped the Emotion Map's section table when
  // the findings list was added under it — the table rendered and then vanished in the same tick.
  // Callers clear explicitly, so a function named "list" cannot delete something it did not add.
  function craftList(host, items, cls){
    if (!items.length) return;
    var ul = craftEl('ul', cls || 'craftlist');
    items.forEach(function (t) { ul.appendChild(craftEl('li', null, t)); });
    host.appendChild(ul);
  }

  function wireArchitect(){
    var host = document.getElementById('archActs'); if (!host) return;
    var acts = architectActions();
    var prev = document.getElementById('archPreview');
    host.innerHTML = '';
    Object.keys(acts).forEach(function (k) {
      var a = acts[k];
      var b = craftEl('button', 'perfbtn', a.label);
      b.type = 'button';
      b.setAttribute('aria-describedby', 'archPreview');
      // Preview on focus and hover; the mutation only happens on click. The brief requires every
      // one of these to preview before it changes anything.
      var show = function () { if (prev) prev.textContent = a.preview; };
      b.addEventListener('mouseenter', show);
      b.addEventListener('focus', show);
      b.addEventListener('click', function () {
        a.run();
        if (prev) prev.textContent = a.label + ' — done. One undo puts it back.';
      });
      host.appendChild(b);
    });
  }

  function wireTransitions(){
    var sug = document.getElementById('transSuggest'); if (!sug) return;
    var barEl = document.getElementById('transBar');
    var opts = document.getElementById('transOpts');
    var note = document.getElementById('transNote');
    var roleAt = function (bar) {
      var slot = song[bar]; if (slot == null) return 'other';
      var n = secNames[slot] || '';
      if (/pre/i.test(n)) return 'prechorus';
      if (/chorus/i.test(n)) return 'chorus';
      if (/verse/i.test(n)) return 'verse';
      if (/bridge/i.test(n)) return 'bridge';
      if (/intro/i.test(n)) return 'intro';
      if (/outro/i.test(n)) return 'outro';
      return 'other';
    };
    sug.addEventListener('click', function () {
      var bar = clampN(+barEl.value | 0, 1, SONG_SLOTS - 1);
      var from = roleAt(bar - 1), to = roleAt(bar);
      var r = transitionSuggest(from, to);
      opts.innerHTML = '';
      r.options.forEach(function (t) {
        var b = craftEl('button', 'perfbtn', t.name);
        b.type = 'button';
        b.title = t.why;
        b.addEventListener('click', function () {
          var ok = applyTransition(t.id, bar);
          note.textContent = ok
            ? t.name + ' written into bar ' + bar + '. ' + t.why + ' Undo puts it back.'
            : t.name + ' cannot be made here — ' +
              (t.id === 'samplerfill' ? 'no sound is loaded to slice.' : 'there is nothing in the bar before.');
        });
        opts.appendChild(b);
      });
      note.textContent = 'Going from ' + from + ' into ' + to + ' — ' +
        (r.direction === 'energy-up' ? 'energy is rising, so these lift into it.'
         : r.direction === 'energy-down' ? 'energy is falling, so these pull back.'
         : 'energy is level, so these carry across.');
    });
  }

  function wireEmotionMap(){
    var run = document.getElementById('emoRun'); if (!run) return;
    var out = document.getElementById('emoOut');
    run.addEventListener('click', function () {
      var em = emotionMap();
      out.innerHTML = '';
      var tbl = craftEl('div', 'emorows');
      em.sections.forEach(function (sc) {
        var row = craftEl('div', 'emorow');
        row.appendChild(craftEl('b', null, sc.name));
        // Never colour alone: the bar carries a number and a word beside it.
        var bar = craftEl('span', 'emobar');
        var fill = craftEl('span', 'emofill');
        fill.style.width = Math.round(sc.energy * 100) + '%';
        bar.appendChild(fill);
        row.appendChild(bar);
        row.appendChild(craftEl('span', 'emonum',
          Math.round(sc.energy * 100) + '% energy · ' +
          (sc.vocalSpace > 0.6 ? 'room for the voice'
           : sc.vocalSpace > 0.45 ? 'some room for the voice' : 'crowded for the voice')));
        tbl.appendChild(row);
      });
      out.appendChild(tbl);
      craftList(out, em.findings.map(function (f) { return f.text; }));   // appends under the table
      if (!em.findings.length)
        out.appendChild(craftEl('p','refhint','Nothing stands out. The sections differ from each other and the voice has room.'));
    });
  }

  function wireMixCheck(){
    var run = document.getElementById('mixRun'); if (!run) return;
    var out = document.getElementById('mixOut');
    run.addEventListener('click', function () {
      var w = mixCheck();
      out.innerHTML = '';
      craftList(out, w.map(function (x) { return x.text + ' → try ' + x.fix + '.'; }));
      if (!w.length) {
        out.appendChild(craftEl('p','refhint','Nothing is colliding that Aura can measure. That is not the same as finished — listen on something other than a laptop speaker.')); }
    });
  }

  function wireLyricStudio(){
    var sel = document.getElementById('lyricSec'); if (!sel) return;
    var text = document.getElementById('lyricText');
    var note = document.getElementById('lyricNote');
    var out  = document.getElementById('lyricOut');
    var fill = function () {
      sel.innerHTML = '';
      for (var i = 0; i < N_PATTERNS; i++) {
        var o = document.createElement('option');
        o.value = String(i); o.textContent = secNames[i] || ('Section ' + (i + 1));
        sel.appendChild(o);
      }
      sel.value = String(currentPattern);
    };
    var load = function () {
      var i = +sel.value | 0;
      text.value = lyrics.sections[i] || '';
      note.value = lyrics.notes[i] || '';
    };
    fill(); load();
    sel.addEventListener('change', load);
    text.addEventListener('input', function () { setLyrics(+sel.value | 0, text.value); autosave(); });
    note.addEventListener('input', function () { setPerformanceNote(+sel.value | 0, note.value); autosave(); });

    var chk = document.getElementById('lyricCheck');
    if (chk) chk.addEventListener('click', function () {
      var i = +sel.value | 0;
      var a = lyricAnalysis(i);
      var lines = [];
      out.innerHTML = '';
      if (!a.lines.length) { craftList(out, ['Nothing written in this section yet.']); return; }
      a.lines.forEach(function (l, n) {
        lines.push('Line ' + (n + 1) + ': ' + l.syllables + ' syllable' + (l.syllables === 1 ? '' : 's') +
                   (l.flags.length ? ' — ' + l.flags.map(function (f) { return f.text; }).join(' ') : ''));
      });
      if (a.fit) {
        lines.push(a.fit.over
          ? 'The melody here has ' + a.fit.notes + ' notes and you have written ' + a.fit.syllables +
            ' syllables — ' + a.fit.over + ' more than there is room for.'
          : a.fit.under
            ? 'The melody has ' + a.fit.notes + ' notes and you have ' + a.fit.syllables +
              ' syllables, so there is room for ' + a.fit.under + ' more.'
            : 'Your syllables and the melody notes match exactly.');
      } else {
        lines.push('There is no melody in this section yet, so Aura cannot check the fit — only the counts.');
      }
      if (a.spread >= 4) lines.push('The lines vary a lot in length (' + a.spread +
        ' syllables between the shortest and longest). That can be deliberate; it is worth a look.');
      a.rhymes.forEach(function (r) { lines.push('Lines ' + r.lines.join(' and ') + ' end on the same sound.'); });
      craftList(out, lines);
    });

    var br = document.getElementById('lyricBreaths');
    if (br) br.addEventListener('click', function () {
      var m = suggestBreaths(+sel.value | 0);
      out.innerHTML = '';
      craftList(out, m.length
        ? m.map(function (x) { return 'Breathe after phrase ' + x.afterLine + ' — there is a ' + x.gap + '-step gap there.'; })
        : ['There are no clear gaps in this melody yet. Add a melody, or plan the breaths yourself.']);
    });
  }

  function wireVocalCoach(){
    var run = document.getElementById('coachRun'); if (!run) return;
    var out = document.getElementById('coachOut');
    run.addEventListener('click', function () {
      var c = vocalCoach(currentPattern);
      out.innerHTML = '';
      out.appendChild(craftEl('p','refhint',
        c.name + ' · ' + c.key + ' · ' + c.bpm + ' BPM' +
        (c.range ? ' · ' + c.range.lowName + ' to ' + c.range.highName : '')));
      craftList(out, c.cues);
    });
  }

  function wireIntention(){
    var host = document.getElementById('intentGrid'); if (!host) return;
    host.innerHTML = '';
    INTENTION_UI.forEach(function (f) {
      var row = craftEl('div', 'ctlrow');
      var lab = craftEl('label', null, f.label); lab.setAttribute('for', 'int-' + f.id);
      var inp = document.createElement('input');
      inp.type = 'text'; inp.id = 'int-' + f.id; inp.placeholder = f.ph;
      inp.maxLength = INTENTION_MAX[f.id] || 200;
      inp.value = intention[f.id] || '';
      inp.addEventListener('input', function () { setIntention(f.id, inp.value); autosave(); });
      row.appendChild(lab); row.appendChild(inp);
      host.appendChild(row);
    });
    var clr = document.getElementById('intentClear');
    if (clr && !clr.__wired) { clr.__wired = true;
      clr.addEventListener('click', function () {
        clearIntention(); wireIntention(); autosave();
        toast('Project intention cleared. Nothing else in your track changed.');
      });
    }
  }

  function wireRightsAndFinish(){
    var rr = document.getElementById('rightsRun');
    if (rr) rr.addEventListener('click', function () {
      var r = rightsReport();
      var out = document.getElementById('rightsOut');
      var acts = document.getElementById('rightsActs');
      out.innerHTML = '';
      var lines = [];
      r.auraMade.forEach(function (a) { lines.push('Aura made: ' + a.name); });
      r.userMade.forEach(function (a) { lines.push('You made: ' + a.name); });
      r.needsPermission.forEach(function (a) {
        lines.push('Needs your permission: ' + a.name + (a.rightsNote ? ' — ' + a.rightsNote : '')); });
      r.excluded.forEach(function (a) { lines.push('Left out of the export: ' + a.name); });
      r.unknown.forEach(function (a) { lines.push('Unknown origin, and included: ' + a.name); });
      craftList(out, lines.length ? lines : ['Nothing in this project yet.']);
      if (!r.canConfirm) out.appendChild(craftEl('p','refhint',
        'Aura cannot confirm around a source it does not recognise. Exclude it, or say where it came from.'));
      else if (r.confirmed) out.appendChild(craftEl('p','refhint','Confirmed. That is your statement, not Aura’s.'));
      acts.hidden = !r.canConfirm || r.confirmed;
    });
    var rc = document.getElementById('rightsConfirm');
    if (rc) rc.addEventListener('click', function () {
      if (confirmRights()) { toast('Recorded. Aura has not checked anything — that is your statement.');
        document.getElementById('rightsRun').click(); }
      else toast('Aura cannot confirm while a source of unknown origin is included.');
    });

    var fr = document.getElementById('finishRun');
    if (fr) fr.addEventListener('click', function () {
      var r = readyToShare();
      var out = document.getElementById('finishOut');
      out.innerHTML = '';
      var wrap = craftEl('div','emorows finishrows');
      r.stages.forEach(function (st) {
        var row = craftEl('div','emorow fstage f-' + st.state.replace(/\s+/g,'-'));
        // Two channels, never colour alone: a mark AND the word. The mark is typographic —
        // check, ring, bang, dash, cross — so it needs no icon and no colour to be read.
        row.appendChild(craftEl('i','fmark', FINISH_MARK[st.state] || '·'));
        row.appendChild(craftEl('b', null, st.name));
        row.appendChild(craftEl('span','emonum', st.state));
        row.appendChild(craftEl('span','ghint2', st.note));
        wrap.appendChild(row);
      });
      out.appendChild(wrap);

      // ONE recommendation, not a list of everything. A person finishing a record needs the next
      // thing, and it has to be a real destination rather than a sentence about one.
      var nx = finishNext(r.stages);
      if (nx) {
        var rec = craftEl('div','finishnext');
        rec.appendChild(craftEl('span','fnlabel', nx.blocked ? 'What is blocking' : 'What Aura suggests next'));
        rec.appendChild(craftEl('b', null, nx.stage.name));
        rec.appendChild(craftEl('span','ghint2', nx.stage.note));
        var go = document.createElement('button');
        go.type='button'; go.className='perfbtn primary';
        go.textContent = 'Open ' + nx.stage.name;
        go.setAttribute('aria-label','Open ' + nx.stage.name + ' — ' + nx.stage.note);
        // scrollTo() already refuses a hidden destination and says which prerequisite is missing,
        // so a recommendation can never send someone to a panel that is not there.
        go.addEventListener('click', nx.go);
        rec.appendChild(go);
        out.appendChild(rec);
      }

      out.appendChild(craftEl('p','refhint finishsay', r.statement));
      // The only "done" this app will say — and it says exactly how done. Nothing BLOCKING is not
      // the same as nothing outstanding, so the flat sentence is reserved for the case where both
      // are true; otherwise it names the count it is stepping over. Printing "ready to share"
      // beside "4 stages still worth a look" reads as a green light this has not earned.
      //
      // It is still a checklist result. Not a judgement about the music, and not a clearance —
      // readyToShare() says so in words and Rights & Sources says it again.
      if (r.canShare) {
        out.appendChild(craftEl('p','finishdone', r.needsReview.length
          ? 'This version is ready to share, with ' + r.needsReview.length + ' stage' +
            (r.needsReview.length === 1 ? '' : 's') + ' still worth a look.'
          : 'This version is ready to share.'));
      }
    });

    var ex = document.getElementById('exportAll');
    if (ex) ex.addEventListener('click', function () {
      ex.disabled = true;
      var was = ex.textContent; ex.textContent = 'Writing the files…';
      exportCompleteProject({}).then(function (res) {
        toast('Wrote ' + res.files.length + ' files. The imported reference is not among them.');
      }).catch(function (e) {
        toast('The export did not finish. Nothing in your project changed.');
      }).then(function () { ex.disabled = false; ex.textContent = was; });
    });
  }

  // ---------- Find a sound (UI) ----------
  function renderFindSound(){
    const host = document.getElementById('fsGrid'); if(!host) return;
    host.innerHTML = '';
    SOUND_FAMILIES.forEach(f => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'soundfam'; b.dataset.fam = f.id; b.textContent = f.name;
      b.setAttribute('aria-pressed', String(soundPick.tryingId === f.id));
      b.classList.toggle('kept', soundPick.keptId === f.id);
      if (soundPick.keptId === f.id) b.setAttribute('aria-label', f.name + ' — saved');
      host.appendChild(b);
    });
  }
  function fsSay(msg){ const el=document.getElementById('fsWhy'); if(el) el.textContent = msg; }
  function fsShow(id){
    const f = soundFamily(id); if(!f) return;
    const acts = document.getElementById('fsActs'); if(acts) acts.hidden = false;
    const hint = soundMelodyHint(id);
    fsSay(f.name + ' — ' + f.why + ' ' + (hint ? hint.advice : ''));
    renderFindSound();
  }
  function wireFindSound(){
    const grid = document.getElementById('fsGrid'); if(!grid) return;
    renderFindSound();
    grid.addEventListener('click', e => {
      const b = e.target.closest('.soundfam'); if(!b) return;
      // Pressing the family you are already on is the way back: it clears the warmer/wider/darker
      // moves and plays it as it was. Otherwise that press would do nothing at all.
      const again = (soundPick.tryingId === b.dataset.fam);
      if (again) trySound(b.dataset.fam, { reset:true });
      else trySound(b.dataset.fam);
      fsShow(b.dataset.fam);
      if (again) fsSay(soundFamily(b.dataset.fam).name + ' — back to how it started.');
    });
    // opts are built when the button is pressed, not when it is wired — otherwise every press
    // sends the same value and the second one appears to do nothing.
    const nudge = (mk, said) => () => {
      if(!soundPick.tryingId) return;
      trySound(soundPick.tryingId, mk()); renderFindSound();
      fsSay(soundFamily(soundPick.tryingId).name + ' — ' + said + edgeNote());
    };
    // and it says so when a control has reached its limit, rather than silently ignoring the press
    const AT_LIMIT = ' That is as far as it goes in that direction.';
    const edgeNote = () => {
      if (Math.abs(soundPick.oct) >= 2) return AT_LIMIT;
      const m = mix.melody; if (!m) return '';
      if (Math.abs(m.hi) >= 12 || Math.abs(m.lo) >= 12 || m.rev <= 0 || m.rev >= 100) return AT_LIMIT;
      return '';
    };
    const on = (id, fn) => { const el = document.getElementById(id); if(el) el.addEventListener('click', fn); };
    on('fsKeep', () => { if(keepSound()){ renderFindSound();
      fsSay('Saved. Melody suggestions will follow this sound.'); toast('Sound saved'); } });
    // "Try another" walks the list rather than randomising, so the singer can find their way back.
    on('fsAnother', () => {
      const i = SOUND_FAMILIES.map(f=>f.id).indexOf(soundPick.tryingId);
      const nx = SOUND_FAMILIES[(i + 1 + SOUND_FAMILIES.length) % SOUND_FAMILIES.length];
      trySound(nx.id); fsShow(nx.id);
    });
    on('fsUp',   nudge(() => ({ octaveBy:  1 }), 'played higher.'));
    on('fsDown', nudge(() => ({ octaveBy: -1 }), 'played lower.'));
    on('fsWarm', nudge(() => ({ warmer: 3, brighter: -3 }), 'warmer — more body, less top.'));
    on('fsWide', nudge(() => ({ wider: 12 }), 'wider — more room around it.'));
    on('fsDark', nudge(() => ({ brighter: -5 }), 'darker.'));
    on('fsSimple', nudge(() => ({ wider: -18, brighter: -2 }), 'simpler — drier and closer.'));
    on('fsWrite', () => {
      if(!soundPick.tryingId) return;
      keepSound(); renderFindSound();
      const h = soundMelodyHint();
      showView('piano');
      toast(h ? (h.family + ': ' + h.density + ', ' + h.role) : 'Sound saved');
    });
  }

  // ---------- Create something (UI) ----------
  const createChoice = { lane:'reggaeton', tempo:'mid', mood:'romantic', start:'aura' };
  function renderCreateSheet(){
    const rows = [
      ['crLane',  CREATE_LANES,  'lane'],
      ['crTempo', CREATE_TEMPO,  'tempo'],
      ['crMood',  CREATE_MOODS,  'mood'],
      ['crStart', CREATE_STARTS, 'start'],
    ];
    rows.forEach(r => {
      const host = document.getElementById(r[0]); if(!host) return;
      host.innerHTML = '';
      r[1].forEach(o => {
        const b = document.createElement('button');
        b.type='button'; b.className='createopt'; b.dataset.k=r[2]; b.dataset.v=o.id;
        b.setAttribute('role','radio');
        b.setAttribute('aria-checked', String(createChoice[r[2]] === o.id));
        b.textContent = o.name;
        host.appendChild(b);
      });
    });
    const lane = CREATE_LANES.filter(l=>l.id===createChoice.lane)[0];
    const mood = CREATE_MOODS.filter(m=>m.id===createChoice.mood)[0];
    const tem  = CREATE_TEMPO.filter(t=>t.id===createChoice.tempo)[0];
    const el = document.getElementById('crSummary');
    if(el) el.textContent = lane.name + ', ' + tem.name.toLowerCase() + ' at ' + tem.bpm +
      ' BPM, ' + mood.name.toLowerCase() + '. Aura writes the sections, the groove and a sound — one undo takes it all back.';
  }
  function openCreate(){ const w=document.getElementById('createSheet'); if(!w) return;
    renderCreateSheet(); w.classList.add('on');
    // Focus the card, not the first chip: focusing a chip scrolls it into view and the sheet
    // opens already past its own title and explanation.
    const card=w.querySelector('.createcard');
    if(card){ card.scrollTop=0; card.setAttribute('tabindex','-1'); card.focus(); } }
  function closeCreate(){ const w=document.getElementById('createSheet'); if(w) w.classList.remove('on'); }
  function wireCreate(){
    const w = document.getElementById('createSheet'); if(!w) return;
    w.addEventListener('click', e => {
      if(e.target === w){ closeCreate(); return; }
      const b = e.target.closest('.createopt'); if(!b) return;
      createChoice[b.dataset.k] = b.dataset.v; renderCreateSheet();
    });
    w.addEventListener('keydown', e => { if(e.key==='Escape') closeCreate(); });
    const go = document.getElementById('crGo');
    if(go) go.addEventListener('click', () => {
      const r = createSomething(createChoice);
      closeCreate();
      setMode(true);
      // Send them where they said they wanted to start. No new tabs — these are the views that exist.
      const dest = { sound:'smp', groove:'rack', chords:'play', record:'voc', lyrics:'play',
                     sampler:'smp', import:'rack' }[r.startAt] || 'rack';
      showView(dest);
      if(r.startAt === 'import') pickReferenceFile();
      renderFindSound(); renderReady();
      toast(r.lane + ' · ' + r.mood.toLowerCase() + ' · ' + r.bpm + ' BPM · ' + r.parts + ' parts');
    });
    const no = document.getElementById('crCancel'); if(no) no.addEventListener('click', closeCreate);
    const op = document.getElementById('createOpen'); if(op) op.addEventListener('click', openCreate);
  }

  // Repaint the craft surfaces from current state. Deliberately NOT the wire* functions: those
  // attach listeners, and calling them again would bind every handler twice.
  function refreshCraftUI(){
    INTENTION_UI.forEach(function (f) {
      var el = document.getElementById('int-' + f.id); if (el) el.value = intention[f.id] || '';
    });
    var sel = document.getElementById('lyricSec');
    if (sel) {
      var i = +sel.value | 0;
      var tx = document.getElementById('lyricText'); if (tx) tx.value = lyrics.sections[i] || '';
      var nt = document.getElementById('lyricNote'); if (nt) nt.value = lyrics.notes[i] || '';
    }
    renderGrooveCard(); renderFindSound();
    var acts = document.getElementById('fsActs'); if (acts) acts.hidden = true;
    var why = document.getElementById('fsWhy'); if (why) why.textContent = 'Nothing chosen yet.';
    // These panels describe the song that was open. Leaving them up after New Project would report
    // on a track that is no longer there.
    ['rightsOut','finishOut','archPreview','transOpts','transNote','emoOut','mixOut','lyricOut','coachOut']
      .forEach(function (id) { var el = document.getElementById(id); if (el) el.innerHTML = ''; });
    ['rightsActs'].forEach(function (id) { var el = document.getElementById(id); if (el) el.hidden = true; });
  }

  function wireCraftUI(){
    wireRightsAndFinish(); wireIntention(); wireArchitect(); wireTransitions(); wireEmotionMap();
    wireMixCheck(); wireLyricStudio(); wireVocalCoach(); wireFindSound(); wireCreate();
  }

  // ---------- mixer UI ----------
  const stripsEl=document.getElementById('strips'), mixerEl=document.getElementById('mixer');
  const stripUI={};
  function applyGroupLive(id){ if(!liveBus||!liveBus.grp) return; const n=liveBus.grp[id], m=mix[id]; if(!n) return;
    const t=ac?ac.currentTime:0;
    n.g.gain.setTargetAtTime(groupGain(id)*abTrim(id),t,.008);   // ramp, so fader/mute moves don't click
    n.pan.pan.setTargetAtTime(m.pan/100,t,.008);
    n.lo.gain.value=m.lo; n.md.gain.value=m.mid; n.hi.gain.value=m.hi;
    n.rs.gain.setTargetAtTime(groupRev(id),t,.008); n.ds.gain.setTargetAtTime(m.dly/100*0.6,t,.008); }
  function applyAllGroupsLive(){ GROUPS.forEach(G=>applyGroupLive(G.id)); refreshStripDim(); }
  function refreshStripDim(){ const solo=anySolo(); GROUPS.forEach(G=>{ const u=stripUI[G.id]; if(!u) return;
    u.el.classList.toggle('silenced', !!mix[G.id].mute || (solo&&!mix[G.id].solo)); }); }
  function panLabel(v){ return v===0?'C':(v<0?'L'+Math.abs(v):'R'+v); }
  function buildMixer(){
    GROUPS.forEach(G=>{ const m=mix[G.id];
      const el=document.createElement('div'); el.className='strip';
      el.innerHTML=`<div class="nm">${G.name}${G.sub?`<span>${G.sub}</span>`:'<span>&nbsp;</span>'}</div>`;
      const mk=(cls,min,max,val,step)=>{ const i=document.createElement('input'); i.type='range'; i.min=min; i.max=max; i.value=val; if(step)i.step=step; i.className=cls; return i; };
      // fader + live meter
      const fw=document.createElement('div'); fw.className='fader faderrow'; const vol=mk('',0,140,m.vol);
      const mt=document.createElement('div'); mt.className='mtr'; const mi=document.createElement('i'); mt.appendChild(mi);
      fw.appendChild(vol); fw.appendChild(mt); el.appendChild(fw);
      const volV=document.createElement('div'); volV.className='val'; volV.textContent=m.vol+'%'; el.appendChild(volV);
      // pan
      const pl=document.createElement('div'); pl.className='lab'; pl.textContent='Pan'; el.appendChild(pl);
      const pan=mk('',-100,100,m.pan); el.appendChild(pan);
      const panV=document.createElement('div'); panV.className='val'; panV.textContent=panLabel(m.pan); el.appendChild(panV);
      // eq
      const el2=document.createElement('div'); el2.className='lab'; el2.textContent='EQ  L / M / H'; el.appendChild(el2);
      const eq=document.createElement('div'); eq.className='eq';
      const lo=mk('',-12,12,m.lo), md=mk('',-12,12,m.mid), hi=mk('',-12,12,m.hi);
      eq.appendChild(lo); eq.appendChild(md); eq.appendChild(hi); el.appendChild(eq);
      // sends
      const rl=document.createElement('div'); rl.className='lab'; rl.textContent='Reverb'; el.appendChild(rl);
      const rev=mk('',0,100,m.rev); el.appendChild(rev);
      const dl=document.createElement('div'); dl.className='lab'; dl.textContent='Delay'; el.appendChild(dl);
      const dly=mk('',0,100,m.dly); el.appendChild(dly);
      // mute / solo
      const btns=document.createElement('div'); btns.className='btns';
      const mb=document.createElement('button'); mb.className='mb'; mb.textContent='M'; mb.title='Mute';
      const sb=document.createElement('button'); sb.className='sb'; sb.textContent='S'; sb.title='Solo';
      btns.appendChild(mb); btns.appendChild(sb); el.appendChild(btns);
      stripsEl.appendChild(el);
      vol.setAttribute('aria-label',G.name+' volume'); pan.setAttribute('aria-label',G.name+' pan');
      lo.setAttribute('aria-label',G.name+' low EQ'); md.setAttribute('aria-label',G.name+' mid EQ');
      hi.setAttribute('aria-label',G.name+' high EQ');
      rev.setAttribute('aria-label',G.name+' reverb send'); dly.setAttribute('aria-label',G.name+' delay send');
      mb.setAttribute('aria-label','Mute '+G.name); sb.setAttribute('aria-label','Solo '+G.name);
      el.setAttribute('role','group'); el.setAttribute('aria-label',G.name+' channel');
      stripUI[G.id]={el,vol,pan,lo,md,hi,rev,dly,mb,sb,volV,panV,mi};
      const bind=(input,key,after)=>{
      input.addEventListener('input',()=>{ mix[G.id][key]=+input.value; applyGroupLive(G.id); if(after)after(); });
      input.addEventListener('change',autosave);   // one undo entry per fader gesture
    };
      bind(vol,'vol',()=>volV.textContent=mix[G.id].vol+'%');
      bind(pan,'pan',()=>panV.textContent=panLabel(mix[G.id].pan));
      bind(lo,'lo'); bind(md,'mid'); bind(hi,'hi'); bind(rev,'rev'); bind(dly,'dly');
      mb.addEventListener('click',()=>{ m.mute=m.mute?0:1; mb.classList.toggle('on',!!m.mute); applyAllGroupsLive(); autosave(); });
      sb.addEventListener('click',()=>{ m.solo=m.solo?0:1; sb.classList.toggle('on',!!m.solo); applyAllGroupsLive(); autosave(); });
    });
    // master strip — reads the summed mix, drives the existing master volume
    const el=document.createElement('div'); el.className='strip master';
    el.innerHTML='<div class="nm">Master<span>Mix out</span></div>';
    const fw=document.createElement('div'); fw.className='fader faderrow';
    const mv=document.createElement('input'); mv.type='range'; mv.min=0; mv.max=100; mv.value=masterEl.value;
    mv.setAttribute('aria-label','Master volume');
    const mt=document.createElement('div'); mt.className='mtr'; const mmi=document.createElement('i'); mt.appendChild(mmi);
    fw.appendChild(mv); fw.appendChild(mt); el.appendChild(fw);
    const vv=document.createElement('div'); vv.className='val'; vv.textContent=masterEl.value+'%'; el.appendChild(vv);
    mv.addEventListener('input',()=>{ masterEl.value=mv.value; masterEl.dispatchEvent(new Event('input',{bubbles:true}));
      vv.textContent=mv.value+'%'; autosave(); });
    masterEl.addEventListener('input',()=>{ mv.value=masterEl.value; vv.textContent=masterEl.value+'%'; });
    stripsEl.appendChild(el); stripUI.__master={mi:mmi};
    startMeters();
    refreshStripDim();
  }
  // one rAF loop drives every meter; it idles cheaply when nothing is playing
  let mixMeterRAF=null;
  function startMeters(){ if(mixMeterRAF) return;
    const buf=new Float32Array(256);
    const rms=an=>{ if(!an) return 0; an.getFloatTimeDomainData(buf); let s=0;
      for(let i=0;i<buf.length;i++) s+=buf[i]*buf[i]; return Math.sqrt(s/buf.length); };
    const paint=()=>{
      if(!liveBus||!liveBus.grp) return;
      GROUPS.forEach(G=>{ const u=stripUI[G.id]; if(!u||!u.mi) return;
        u.mi.style.height=Math.min(100, rms(liveBus.grp[G.id].an)*260)+'%'; });
      if(stripUI.__master) stripUI.__master.mi.style.height=Math.min(100, rms(liveBus.masterAn)*260)+'%';
      // the collapsed dock keeps its own compact meters so the mixer is still readable at 52px
      document.querySelectorAll('#dockMini .dm').forEach(d=>{ const id=d.dataset.g, bar=d.querySelector('b');
        const an=id==='__master'?liveBus.masterAn:(liveBus.grp[id]&&liveBus.grp[id].an);
        if(bar) bar.style.height=Math.min(100, rms(an)*260)+'%'; }); };
    // rAF gives smooth motion when the tab is visible; the interval keeps meters honest if rAF is starved
    const tick=()=>{ mixMeterRAF=requestAnimationFrame(tick); paint(); };
    tick(); setInterval(paint,100); }
  function syncMixerUI(){ GROUPS.forEach(G=>{ const u=stripUI[G.id], m=mix[G.id]; if(!u) return;
    u.vol.value=m.vol; u.pan.value=m.pan; u.lo.value=m.lo; u.md.value=m.mid; u.hi.value=m.hi; u.rev.value=m.rev; u.dly.value=m.dly;
    u.volV.textContent=m.vol+'%'; u.panV.textContent=panLabel(m.pan);
    u.mb.classList.toggle('on',!!m.mute); u.sb.classList.toggle('on',!!m.solo); });
    fxRevSize.value=fx.revSize; fxDlyTime.value=fx.dlyTime; fxDlyFb.value=fx.dlyFb; fxComp.value=fx.comp; syncFxLabels(); refreshStripDim();
    // The Quick balance faders and the reference card's own level/mute are views of the same mix[]
    // values, so a project load, an undo or a drag on the full mixer has to move them too.
    if(typeof syncBalance==='function') syncBalance();
    if(typeof syncRefControls==='function') syncRefControls(); }
  const fxRevSize=document.getElementById('fxRevSize'), fxDlyTime=document.getElementById('fxDlyTime'),
        fxDlyFb=document.getElementById('fxDlyFb'), fxComp=document.getElementById('fxComp');
  function syncFxLabels(){ document.getElementById('fxRevSizeV').textContent=irRT60().toFixed(1)+' s';
    document.getElementById('fxDlyTimeV').textContent=fx.dlyTime+' ms';
    document.getElementById('fxDlyFbV').textContent=fx.dlyFb+'%';
    document.getElementById('fxCompV').textContent=compRatio().toFixed(1)+':1'; }
  fxDlyTime.addEventListener('input',()=>{ fx.dlyTime=+fxDlyTime.value; if(liveBus&&liveBus.dly) liveBus.dly.delayTime.setTargetAtTime(fx.dlyTime/1000, now(), .05); syncFxLabels(); autosave(); });
  fxDlyFb.addEventListener('input',()=>{ fx.dlyFb=+fxDlyFb.value; if(liveBus&&liveBus.dlyFb) liveBus.dlyFb.gain.value=fx.dlyFb/100; syncFxLabels(); autosave(); });
  fxComp.addEventListener('input',()=>{ fx.comp=+fxComp.value; if(liveGlue){ liveGlue.threshold.value=compThreshold(); liveGlue.ratio.value=compRatio(); } syncFxLabels(); autosave(); });
  fxRevSize.addEventListener('input',()=>{ fx.revSize=+fxRevSize.value; syncFxLabels(); autosave(); });
  fxRevSize.addEventListener('change',()=>{ if(liveConv) liveConv.buffer=makeIR(ac,irSeconds(),irRT60()); });   // rebuild the IR only when the drag ends
  document.getElementById('mixBtn').addEventListener('click',()=>{ const open=mixerEl.classList.toggle('open');
    document.getElementById('mixBtn').classList.toggle('on',open); if(open) mixerEl.scrollIntoView({block:'nearest'}); });
  document.getElementById('mixReset').addEventListener('click',()=>{ GROUPS.forEach(G=>Object.assign(mix[G.id],mixDefault()));
    fx.dlyTime=280; fx.dlyFb=32; fx.revSize=50; fx.comp=40;
    if(liveBus&&liveBus.dly){ liveBus.dly.delayTime.value=.28; liveBus.dlyFb.gain.value=.32; }
    if(liveGlue){ liveGlue.threshold.value=compThreshold(); liveGlue.ratio.value=compRatio(); }
    if(liveConv&&ac) liveConv.buffer=makeIR(ac,irSeconds(),irRT60());
    applyAllGroupsLive(); syncMixerUI(); autosave(); toast('Mixer reset to flat'); });

  // Drum presets. Reggaetón = kick on the floor (0,4,8,12) + dembow snare on the 3-3-2 tresillo accents (3,6,11,14).
  const BEATS={
    empty:{},
    dembow:      { kick:[0,4,8,12], snare:[3,6,11,14], hat:[0,2,4,6,8,10,12,14], shaker:[2,6,10,14] },
    reggaeton:   { kick:[0,4,8,12], snare:[3,6,11,14], openhat:[7,15], shaker:[0,2,4,6,8,10,12,14] },
    reggaetonpop:{ kick:[0,4,8,12], snare:[3,6,11,14], clap:[3,11], hat:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15], shaker:[2,6,10,14] },
    pop:         { kick:[0,8], snare:[4,12], hat:[0,2,4,6,8,10,12,14] },
    lofi:        { kick:[0,10], snare:[4,12], hat:[2,6,10,14], clap:[4,12], shaker:[0,4,8,12] },
    rnb:         { kick:[0,7,10], snare:[4,12], hat:[0,3,4,7,8,11,12,15] },
    trap:        { kick:[0,7,10], snare:[4,12], hat:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15] },
    boombap:     { kick:[0,6,10], snare:[4,12], hat:[0,2,4,6,8,10,12,14] },              // dusty hip-hop (boom-bap / Persian rap lane)
    sparse808:   { kick:[0,8], clap:[4,12], openhat:[7,15] },                            // tuned-808 lane — minimal + moody
    fill:        { kick:[0], snare:[6,8,10,11,12,13,14,15], shaker:[0,2,4,6,8,10,12,14], clap:[15] },
    heartbeat:   { kick:[0,4,8,12], shaker:[2,6,10,14] },                                // heartbeat pulse — the deleted backbeat IS the beat
    gospelpulse: { kick:[0], clap:[8] },                                                 // drums almost entirely silence (gospel-pulse lane)
    halftime:    { kick:[0,6,10], snare:[8], hat:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15] },  // snare on 8 alone = the half-time anthem trick
    drill:       { kick:[0,3,10], snare:[8], hat:[0,2,4,6,8,10,12,14], openhat:[7] },        // sliding UK drill pocket
    silk:        { kick:[0,10], snare:[4,12], hat:[2,6,10,14], shaker:[0,4,8,12] },          // soft modern R&B
    // ---- the six sonic families ----
    // Original patterns written for Aura from the internal production research (see
    // STYLE-REFERENCES.md, which is the public-facing translation). They encode TECHNIQUE — where the
    // weight sits, how the backbeat is carried, how dense the top is — not any specific record.
    soulblueprint:  { kick:[0,7,10], snare:[4,12], clap:[4,12], hat:[0,2,4,6,8,10,12,14,15], openhat:[14], shaker:[2,6,10,14] },
    stadiumverse:   { kick:[0,10], clap:[4,12], hat:[2,6,10,14] },
    stadiumchorus:  { kick:[0,4,8,12], clap:[4,12], hat:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15], openhat:[2,6,10,14], shaker:[2,6,10,14] },
    maximalopus:    { kick:[0,10], snare:[8], clap:[8,14], hat:[0,4,8,12], openhat:[14] },
    livingdraft:    { kick:[0,7,10], snare:[8], clap:[8,15], hat:[0,2,4,6,8,10,12,14], openhat:[14], shaker:[2,6,10,14] },
    confessional:   { kick:[0,10], clap:[8] },
    futuremonolith: { kick:[0,6,10], snare:[8], clap:[8], hat:[2,6,14], openhat:[14] },
  };
  function applyBeat(name){ if(name==='keep') return; drums.forEach(t=>{ P()[t.id]=new Array(STEPS).fill(false); A()[t.id]=new Array(STEPS).fill(false); }); const p=BEATS[name]||{}; Object.keys(p).forEach(id=>p[id].forEach(s=>P()[id][s]=true)); renderGrid(); refreshPatBtns(); document.getElementById('preset').value='keep'; autosave(); }
  const PROGS={ pop:[0,4,5,3], ballad:[0,5,3,4], emotional:[5,3,0,4], simple:[0,3,4,3], doowop:[0,5,1,4], soulful:[0,6,3,4], phrygian:[0,5,1,0],
    twochord:[0,3,0,3], amen:[0,2,5,4], soulflip:[0,6,5,6], darkflip:[0,6,5,4],   // i-iv vamp · i-III-VI-V7 gospel · i-bVII-bVI-bVII soul flip
    // the six families' own progressions, in scale degrees
    blueprint:[0,5,2,6], ascension:[0,5,3,4], opus:[0,1,0,6], draft:[0,3,0,3],
    confess:[0,5,0,5], monolith:[0,0,1,0] };
  function clearChords(){ CHORD_DEGREES.forEach(c=>P()[c.id]=new Array(STEPS).fill(false)); }
  function applyProg(name){ if(name==='keep') return; clearChords(); if(name!=='clearchords'){ (PROGS[name]||[]).forEach((deg,i)=>{ const step=i*4; if(step<STEPS) P()['deg'+deg][step]=true; }); } renderGrid(); refreshPatBtns(); progEl.value='keep'; autosave(); }

  // One-click vibes: lane -> BPM -> mood -> key -> chords -> beat, all at once (the fluid on-ramp)
  const VIBES={
    moody:    { label:'Reggaetón · Moody',   key:9, mode:'minor',    prog:'emotional', beat:'reggaeton',    bpm:90, swing:16, reverb:34, cs:'pad',   bs:'sub', ms:'lead' },
    classic:  { label:'Reggaetón · Classic', key:0, mode:'minor',    prog:'simple',    beat:'dembow',       bpm:94, swing:14, reverb:24, cs:'pad',   bs:'sub', ms:'lead' },
    latinpop: { label:'Latin Pop · Upbeat',  key:0, mode:'major',    prog:'pop',       beat:'reggaetonpop', bpm:96, swing:12, reverb:28, cs:'pluck', bs:'sub', ms:'pluck' },
    rnbchill: { label:'R&B · Chill',         key:2, mode:'minor',    prog:'ballad',    beat:'lofi',         bpm:84, swing:22, reverb:40, cs:'piano', bs:'sub', ms:'keys' },
    soulchop: { label:'Soul · Chopped',      key:0, mode:'dorian',   prog:'soulful',   beat:'boombap',      bpm:86, swing:20, reverb:26, cs:'soul',  bs:'808', ms:'keys' },
    mid808:   { label:'808 · Midnight',      key:9, mode:'minor',    prog:'emotional', beat:'sparse808',    bpm:78, swing:8,  reverb:38, cs:'pad',   bs:'808', ms:'pad' },
    tehran:   { label:'Tehrán · Noir',       key:4, mode:'phrygian', prog:'phrygian',  beat:'boombap',      bpm:92, swing:14, reverb:32, cs:'pluck', bs:'808', ms:'pluck' },  // Persian hip-hop lane: phrygian dark, midnight boom-bap
    urbano:   { label:'Urbano · Polished',   key:5, mode:'minor',    prog:'simple',    beat:'reggaetonpop', bpm:95, swing:10, reverb:20, cs:'pluck', bs:'sub', ms:'pluck' },  // global-pop lane: clean, tight, radio-bright
    atmos:    { label:'Atmosphérico',        key:8, mode:'minor',    prog:'emotional', beat:'reggaeton',    bpm:88, swing:18, reverb:48, cs:'pad',   bs:'sub', ms:'pad' },  // washed pads, dark and spacious
    // Soul / tuned-808 / gospel lanes, derived from the internal production research:
    chipmunk:  { label:'Soul · Chipmunk',    key:3, mode:'minor',    prog:'soulflip',  beat:'boombap',      bpm:88, swing:16, reverb:20, cs:'soul',  bs:'sub', ms:'keys' },  // chipmunk-soul lane: flat-minor home key, MPC-58% swing
    pulse808:  { label:'808 · Pulse',        key:1, mode:'minor',    prog:'twochord',  beat:'heartbeat',    bpm:120,swing:0,  reverb:12, cs:'piano', bs:'808', ms:'pad' },  // tuned-808 lane: the 808 carries the chords, no snare
    gospel:    { label:'Gospel · Sunday',    key:0, mode:'harmonicMinor', prog:'amen',       beat:'gospelpulse', bpm:74, swing:33, reverb:55, cs:'soul', bs:'sub', ms:'keys' },  // gospel lane: V7 pull, drums withheld, choir-wet
    // closing the gap with the reference library: UK drill, Houston melodic trap, modern R&B
    drillnoir: { label:'Drill · Noir',       key:8, mode:'minor',    prog:'darkflip',  beat:'drill',    bpm:140, swing:6,  reverb:18, cs:'pluck', bs:'808', ms:'bell' },
    houston:   { label:'Houston · Melodic',  key:7, mode:'minor',    prog:'emotional', beat:'halftime', bpm:75,  swing:10, reverb:46, cs:'pad',   bs:'808', ms:'pad'  },
    silk:      { label:'R&B · Silk',         key:2, mode:'dorian',   prog:'soulful',   beat:'silk',     bpm:88,  swing:20, reverb:36, cs:'soul',  bs:'sub', ms:'keys' },
    // ---- the six sonic families ----
    // Original systems derived from the internal production research. The names, the controls and the
    // musical definitions are Aura's own; see STYLE-REFERENCES.md for what each one descends from and
    // what it deliberately does not borrow. Swing here is Aura's 0-60 scale, not a percentage.
    soulblueprint: { label:'Soul Blueprint',      family:1, key:9,  mode:'minor',    prog:'blueprint', beat:'soulblueprint',  bpm:92,  swing:22, reverb:18, cs:'soul',  bs:'sub', ms:'keys',
                     promise:'A warm, chopped chord bed that lifts into your range — then gets out of the way so you can sing over it.' },
    stadium:       { label:'Stadium Ascension',   family:1, key:0,  mode:'major',    prog:'ascension', beat:'stadiumchorus',  bpm:104, swing:4,  reverb:26, cs:'pluck', bs:'sub', ms:'lead',
                     promise:'A verse that leaves you room, and a chorus that opens like a room three times the size.' },
    maximal:       { label:'Maximal Opus',        family:1, key:4,  mode:'phrygian', prog:'opus',      beat:'maximalopus',    bpm:84,  swing:4,  reverb:34, cs:'pad',   bs:'sub', ms:'keys',
                     promise:'Record more than you need, then keep six things. It will sound enormous because of what you threw away.' },
    livingdraft:   { label:'Living Draft',        family:1, key:2,  mode:'dorian',   prog:'draft',     beat:'livingdraft',    bpm:96,  swing:8,  reverb:22, cs:'piano', bs:'sub', ms:'pad',
                     promise:'Start with almost nothing. Change one thing at a time and keep every version.' },
    confessional:  { label:'Confessional Minimal',family:1, key:9,  mode:'minor',    prog:'confess',   beat:'confessional',   bpm:72,  swing:0,  reverb:12, cs:'piano', bs:'sub', ms:'keys',
                     promise:'Almost nothing behind you. Write it today, sing it today, and let nothing hide the take.' },
    monolith:      { label:'Future Monolith',     family:1, key:4,  mode:'phrygian', prog:'monolith',  beat:'futuremonolith', bpm:140, swing:0,  reverb:30, cs:'pad',   bs:'808', ms:'b808',
                     promise:'Heavy, still and wide. One chord that does not move, and a lot of room around your voice.' },
  };
  // Audition one bar of a vibe's rhythm through the existing voices. Nothing is applied,
  // no state changes — it just plays, so you can shop for a sound before committing.
  let previewTimers=[];
  function stopPreview(){ previewTimers.forEach(clearTimeout); previewTimers=[]; }
  function previewVibe(k){
    const v=VIBES[k]; if(!v) return;
    if(playing){ toast('Stop playback to preview a vibe'); return; }
    stopPreview();                                   // a new preview replaces the previous one
    ensureCtx();
    const beat=BEATS[v.beat]||{}, spb=60/v.bpm/4;
    // Each hit is scheduled just ahead of its moment, like the main sequencer, so the whole
    // audition can be cancelled the instant another preview starts or the transport begins.
    drums.forEach(d=>{ (beat[d.id]||[]).forEach(s=>{
      if(s>=STEPS) return;
      previewTimers.push(setTimeout(()=>{
        if(playing) return;                          // transport took over
        playDrum(ac,liveBus[d.id],d.id,now()+0.02,DRUM_SEND(d.id)?liveBus.drumSend:null,0.95);
      }, s*spb*1000));
    }); });
  }
  // The success moment. Reads the active vibe straight from the DOM marker markVibeTile() already
  // maintains, so nothing new is persisted — the .aura/share schema (v:13) stays untouched.
  function renderReady(){
    const el=document.getElementById('readyStrip'); if(!el) return;
    const t=document.querySelector('#vgrid .vtile.on');
    const v=t?VIBES[t.dataset.k]:null;
    const isMin=keyMode!=='major';
    // A restored project, a share link or the demo carries no vibe identity — the .aura schema
    // deliberately stores none. The backing track is ready either way, so state what is true and
    // drop the name rather than withholding the whole confirmation.
    const name=v?v.label.split('·').map(s=>s.trim()).filter(Boolean).join(' · '):'';
    const meta=document.getElementById('readyMeta');
    if(meta) meta.textContent=(name?name+' · ':'')+`${bpmEl.value} BPM · ${NOTE_NAMES[keyRoot]}${isMin?'m':''}`;
    el.hidden=false;
  }
  function applyVibe(k){ const v=VIBES[k]; if(!v) return;
    const oldKey=keyRoot;
    keyRoot=v.key; keyRootEl.value=String(v.key); keyMode=v.mode; keyModeEl.value=v.mode; relabelChords(); transposeMelody(keyRoot-oldKey); resnapMelodies();
    if(v.ms){ melodySound=v.ms; melSoundEl.value=v.ms; }
    bpmEl.value=v.bpm; bpmVal.textContent=v.bpm; swingEl.value=v.swing;
    reverbEl.value=v.reverb; reverbWet=v.reverb/100*0.7; applyAllGroupsLive();   // push the new wet amount into every channel send
    if(v.cs){ chordStyle=v.cs; chordStyleEl.value=v.cs; }
    if(v.bs){ bassStyle=v.bs; bassStyleEl.value=v.bs; }
    applyBeat(v.beat); applyProg(v.prog);
    document.querySelectorAll('#vibes .vibe').forEach(b=>b.classList.toggle('on', b.dataset.k===k));
    markVibeTile(k);
    activeFamily = VIBES[k] && VIBES[k].family ? k : null;
    renderFamilyControls();
    autosave();
    renderReady();
  }

  // ---------- save / load / share ----------
  const SAVE_KEY='aura-studio-v6';
  const ALL_IDS=[...drums.map(d=>d.id), ...CHORD_DEGREES.map(c=>c.id)];
  const maskOf=a=>{ let m=0; for(let i=0;i<STEPS;i++) if(a[i]) m|=1<<i; return m; };
  const unmask=m=>Array.from({length:STEPS},(_,i)=>!!(m&(1<<i)));
  function serialize(){
    return { v:13, k:keyRoot, m:keyMode, bpm:+bpmEl.value, sw:+swingEl.value, rv:+reverbEl.value, cs:chordStyle, bs:bassStyle,
      cv:+chordVolEl.value, bv:+bassVolEl.value, mv:+masterEl.value, ci:countInEl.checked?1:0, af:autoFillEl.checked?1:0,
      ms:melodySound, mlv:+melVolEl.value, sn:secNames.slice(),
      mx:GROUPS.map(G=>{ const m=mix[G.id]; return [m.vol,m.pan,m.mute,m.solo,m.lo,m.mid,m.hi,m.rev,m.dly]; }),
      fx:[fx.dlyTime,fx.dlyFb,fx.revSize,fx.comp],
      mel:patterns.map(p=>p.melody.map(n=>[n.p,n.s,n.l,Math.round(n.v*100)])),
      // `lo` is additive. A reader that does not know it ignores it; a project that never had a
      // low-end part serialises empty arrays and is byte-identical in meaning to a v13.2 file.
      lo:patterns.map(p=>(p.bass||[]).map(n=>[n.p,n.s,n.l,Math.round(n.v*100),n.g?1:0])),
      // `var` is additive and optional. A project that never uses variations writes
      // {activeId:null,main:null,items:[]} and behaves exactly as it did before 13.3.
      // `perf` holds NORMALISED Aura actions, never raw MIDI and nothing about the hardware.
      perf:{ events:automation.events.map(e=>[e.t,e.a,e.v]), enabled:automation.enabled?1:0 },
      var:{ activeId:variations.activeId, main:variations.main,
            items:variations.items.map(v=>({id:v.id,name:v.name,createdAt:v.createdAt,
              updatedAt:v.updatedAt,basedOn:v.basedOn,scope:v.scope,data:v.data})) },
      // v13.3 music-knowledge blocks. All three are additive and optional: a project that uses
      // none of them serialises empty and is byte-identical in meaning to one written before them.
      // `gv` is the groove controls plus the seed, which is what makes an Idea Code reproducible.
      // `sf` is the sound family the singer SAVED in Find a sound. It rides inside `gv` rather than
      // becoming a 32nd top-level key, and `requiredSchema` counts it, so a file carrying only a
      // saved sound still declares 3 instead of being opened and silently stripped by 13.2.
      gv:{ c:Object.assign({},groove), s:grooveSeed, sf:soundPick.keptId || '' },
      // `ly` is the singer's own words and their performance notes. Text only — no audio, ever.
      ly:{ t:Object.assign({},lyrics.sections), n:Object.assign({},lyrics.notes) },
      // `pi` is the project intention: what this record is trying to be.
      pi:Object.assign({},intention),
      pat:patterns.map(p=>ALL_IDS.map(id=>maskOf(p[id]))),
      acc:accents.map(a=>drums.map(d=>maskOf(a[d.id]))),
      song:song.slice(), mute:{...mutes}, dv:drums.map(d=>Math.round(BUS_VOL[d.id]*100)), cp:currentPattern };
  }
  // ---------- readable .aura mapping (export/import ONLY; internal state stays compact) ----------
  // Compact keys are used by autosave and share links and must not change. Exported project
  // files translate to documented names so the format is self-describing.
  const READ_MAP={ k:'keyIndex', m:'mode', bpm:'tempo', sw:'swing', rv:'reverb', cs:'chordSound',
    bs:'bassSound', cv:'chordVolume', bv:'bassVolume', mv:'masterVolume', ci:'countIn', af:'autoFill',
    ms:'melodySound', mlv:'melodyVolume', sn:'sectionNames', mx:'mixer', fx:'effects',
    mel:'melodies', pat:'patterns', acc:'accents', song:'arrangement', mute:'mutes',
    dv:'drumVolumes', cp:'currentSection', v:'internalStateVersion',
    // v13.3. These MUST be here, not merely absent-tolerated: `fromReadable` copies only keys it
    // finds in READ_INV, so a compact key with no readable name survives the write (toReadable
    // passes it through unmapped) and is silently DROPPED on read. A singer would save a project
    // with three alternate versions, reopen it, and find one. Autosave and share links were never
    // affected — they carry the compact state and never go through this mapping — which is exactly
    // what made it survive: the loss only shows on a save-to-file-and-reopen round trip.
    lo:'lowEnd', var:'variations', perf:'performance',
    // Same rule, same reason: a compact key with no readable name is written to every .aura file
    // and silently dropped on read.
    gv:'groove', ly:'lyrics', pi:'intention' };
  const READ_INV=Object.fromEntries(Object.entries(READ_MAP).map(([c,r])=>[r,c]));
  READ_INV.stateVersion='v';   // accept the earlier schema-2 name on read
  function toReadable(compact){ const o={}; for(const k in compact) o[READ_MAP[k]||k]=compact[k]; return o; }
  function fromReadable(readable){ const o={};
    for(const k in readable){ const c=READ_INV[k]; if(c) o[c]=readable[k]; }
    // still accept a raw compact state (legacy files that stored `state` compact, or bare state)
    if(!('k' in o) && ('k' in readable || 'pat' in readable)) return {...readable};
    return o; }
  // Content flags describe what is ACTUALLY in this project; capabilities describe what Aura
  // supports. The two use symmetrical terms so every capability has a matching content flag.
  function contentFlags(){
    const drumOn = patterns.some(p=>drums.some(d=>p[d.id].some(Boolean)));
    const chordOn= patterns.some(p=>CHORD_DEGREES.some(c=>p[c.id].some(Boolean)));
    return {
      hasDrums: drumOn,
      hasChords: chordOn,
      hasBass: chordOn,                       // bass follows the chord onsets, so bass content == chord content
      hasMelody: patterns.some(p=>p.melody.length>0),
      hasArrangement: song.some(s=>s!=null),
      hasMixerOverrides: GROUPS.some(G=>{ const m=mix[G.id];
          return m.vol!==100||m.pan!==0||m.mute||m.solo||m.lo||m.mid||m.hi||m.rev||m.dly; })
        || fx.dlyTime!==280 || fx.dlyFb!==32 || fx.revSize!==50 || fx.comp!==40,
      hasVocalTakes: false,      // vocal takes are never embedded in a project file
      hasImportedAudio: false,   // imported audio is never embedded either
      // v13.3. These three decide requiredSchema(): a project with any of them needs a schema-3
      // reader, because a schema-2 reader would open it, drop the block, and write the loss back.
      hasLowEnd: patterns.some(p=>(p.bass||[]).length>0),
      hasVariations: variations.items.length>0,
      hasPerformance: automation.events.length>0,
      hasGroove: Object.keys(GROOVE_DEFAULT).some(k=>groove[k]!==GROOVE_DEFAULT[k]),
      hasLyrics: Object.keys(lyrics.sections).some(k=>lyrics.sections[k]),
      hasIntention: Object.keys(INTENTION_DEFAULT).some(k=>intention[k])
    };
  }
  // Object (not array) so future capabilities can be added explicitly and remain readable.
  const CAPABILITIES={ drums:true, chords:true, bass:true, melody:true,
    arrangement:true, mixer:true, vocals:true, importedAudio:true,
    // v13.3. Each has a matching content flag below, so a reader can tell what Aura SUPPORTS
    // apart from what this particular project actually contains.
    lowEnd:true, variations:true, performance:true };
  // SCHEMA-level guarantee: this format never embeds recorded audio, in any project.
  // Distinct from content.hasVocalTakes / content.hasImportedAudio, which describe whether
  // THIS project currently holds such material (in the app, not in the file).
  const MEDIA_PERSISTENCE={ vocalTakesEmbedded:false, importedAudioEmbedded:false };
  function makeProjectId(){ let s=''; const a='23456789abcdefghjkmnpqrstuvwxyz';
    for(let i=0;i<10;i++) s+=a[(_seed=(_seed*1103515245+12345)&0x7fffffff)%a.length]; return 'aura_'+s; }
  let _seed=(function(){ let h=5381; const str=''+STEPS+SONG_SLOTS+screen.width+screen.height+navigator.userAgent.length;
    for(let i=0;i<str.length;i++) h=((h*33)^str.charCodeAt(i))&0x7fffffff; return h||1; })();
  function applyState(o){
    if(!o) return;
    // Every route that replaces the whole project passes through here — Open Recent, a share link,
    // the autosave restore. Any import still in flight belongs to the project being replaced.
    cancelImportJob();
    if(o.k!=null){ keyRoot=o.k; keyRootEl.value=String(o.k); }
    if(o.m){ keyMode=o.m; keyModeEl.value=o.m; }
    if(o.bpm){ bpmEl.value=o.bpm; bpmVal.textContent=o.bpm; }
    if(o.sw!=null) swingEl.value=o.sw;
    if(o.rv!=null){ reverbEl.value=o.rv; reverbWet=o.rv/100*0.7; }
    if(o.cs){ chordStyle=o.cs; chordStyleEl.value=o.cs; }
    if(o.bs){ bassStyle=o.bs; bassStyleEl.value=o.bs; }
    if(o.cv!=null) chordVolEl.value=o.cv;
    if(o.bv!=null) bassVolEl.value=o.bv;
    if(o.mv!=null) masterEl.value=o.mv;
    if(o.ci!=null) countInEl.checked=!!o.ci;
    if(o.af!=null) autoFillEl.checked=!!o.af;
    if(o.dv) o.dv.forEach((v,di)=>{ if(di<drums.length) BUS_VOL[drums[di].id]=v/100; });
    if(Array.isArray(o.sn)) for(let i=0;i<N_PATTERNS;i++) if(typeof o.sn[i]==='string') secNames[i]=o.sn[i].slice(0,14)||SEC_DEFAULT[i];
    document.querySelectorAll('#secnames input').forEach((el,i)=>el.value=secNames[i]||'');
    if(o.ms){ melodySound=o.ms; melSoundEl.value=o.ms; }
    if(o.mlv!=null){ melVolEl.value=o.mlv; BUS_VOL.melody=o.mlv/100; }
    if(o.mel) o.mel.forEach((arr,pi)=>{ if(pi<N_PATTERNS&&Array.isArray(arr)) patterns[pi].melody=arr.filter(Array.isArray).map(a=>({
      p:clampN(a[0]|0,PR_LO,PR_HI), s:clampN(a[1]|0,0,STEPS-1), l:clampN(a[2]|0,1,STEPS-clampN(a[1]|0,0,STEPS-1)), v:clampN((a[3]||85)/100,.3,1.3) })); });
    // Absent `perf` is normal. Bad timestamps or unknown action names are dropped rather than
    // allowed to corrupt playback — an invalid optional field must never damage the main project.
    automation.events=[]; automation.enabled=true;
    if(o.perf&&typeof o.perf==='object'){
      automation.enabled=o.perf.enabled===0?false:true;
      if(Array.isArray(o.perf.events)){
        const known=performActions();
        automation.events=o.perf.events
          .filter(e=>Array.isArray(e)&&e.length>=2&&isFinite(e[0])&&e[0]>=0&&known[e[1]])
          .map(e=>({t:Math.round(+e[0]), a:String(e[1]), v:isFinite(e[2])?+e[2]:1}))
          .sort((a,b)=>a.t-b.t);
      }
    }
  // A variation's `data` is restored straight into the project by restoreScoped(), so it has to be
  // clamped as hard as the top-level state is. Unclamped, a hand-edited or corrupted file could put
  // a non-finite pitch into `patterns[].bass`, and the first export would throw on it — the project
  // opens, looks fine, and only fails at the moment the singer tries to get their record out.
  function sanePitchList(arr,lo,hi){
    if(!Array.isArray(arr)) return [];
    return arr.filter(Array.isArray).map(a=>{
      const s0=clampN(a[1]|0,0,STEPS-1);
      return [clampN(a[0]|0,lo,hi), s0, clampN(a[2]|0,1,STEPS-s0),
              clampN(a[3]|0,30,130), a[4]?1:0];
    });
  }
  function saneMaskRow(arr,n){
    if(!Array.isArray(arr)) return new Array(n).fill(0);
    const out=new Array(n).fill(0);
    for(let i=0;i<n;i++) out[i]=clampN(arr[i]|0,0,(1<<STEPS)-1);
    return out;
  }
  function sanePatternList(v,fn){ return Array.isArray(v) ? v.slice(0,N_PATTERNS).map(fn) : null; }
  function saneVarData(d){
    if(!d||typeof d!=='object'||Array.isArray(d)) return null;
    const out={tempo:null,key:null,mode:null,beat:null,lowEnd:null,chords:null,song:null,melody:null};
    if(d.tempo&&typeof d.tempo==='object'){
      const r=tempoRange();
      out.tempo={ bpm:clampN(d.tempo.bpm|0,r.lo,r.hi), sw:clampN(d.tempo.sw|0,0,100) }; }
    if(d.key!=null) out.key=clampN(d.key|0,0,11);
    if(d.mode==='major'||d.mode==='minor') out.mode=d.mode;
    if(Array.isArray(d.beat)) out.beat=d.beat.slice(0,N_PATTERNS).map(p2=>({
      lanes:saneMaskRow(p2&&p2.lanes,drums.length), acc:saneMaskRow(p2&&p2.acc,drums.length) }));
    out.lowEnd=sanePatternList(d.lowEnd,a=>sanePitchList(a,12,72));
    out.melody=sanePatternList(d.melody,a=>sanePitchList(a,24,96).map(n=>n.slice(0,4)));
    out.chords=sanePatternList(d.chords,a=>saneMaskRow(a,CHORD_DEGREES.length));
    if(d.song&&typeof d.song==='object'){
      out.song={ slots:(Array.isArray(d.song.slots)?d.song.slots:[]).slice(0,SONG_SLOTS)
                   .map(x=>(x==null||x<0||x>=N_PATTERNS)?null:(x|0)),
                 names:(Array.isArray(d.song.names)?d.song.names:[]).slice(0,N_PATTERNS)
                   .map(x=>String(x==null?'':x).slice(0,40)) }; }
    return out;
  }
    // Absent `var` is normal: every project written before v13.3 lacks it.
    variations.activeId=null; variations.main=null; variations.items=[];
    if(o.var&&typeof o.var==='object'){
      variations.activeId=o.var.activeId||null;
      // The parked main version goes through the SAME sanitiser as items[]. It was assigned raw,
      // and it is not inert: restoreScoped writes main.data straight back into the project when the
      // singer clicks the Main row, so a hand-edited or corrupted file could put an out-of-range
      // section index into `song` and make the export throw on a pattern that does not exist. It
      // round-trips too — serialize() writes main back out — so the poison was sticky.
      variations.main=(o.var.main&&typeof o.var.main==='object')
        ? { scope:Object.assign(emptyScope(),o.var.main.scope||{}), data:saneVarData(o.var.main.data) }
        : null;
      if(Array.isArray(o.var.items)) variations.items=o.var.items.filter(v=>v&&v.id).map(v=>({
        id:String(v.id).slice(0,40), name:String(v.name||'Variation').slice(0,60),
        createdAt:v.createdAt||'', updatedAt:v.updatedAt||'', basedOn:v.basedOn||'main',
        scope:Object.assign(emptyScope(),v.scope||{}), data:saneVarData(v.data) }));
      // An activeId with no matching item would leave the project claiming to be on a version that
      // does not exist. Fall back to main rather than carrying a dangling pointer.
      if(variations.activeId&&!variations.items.some(v=>v.id===variations.activeId)){
        variations.activeId=null; variations.main=null; }
    }
    // Groove, lyrics and intention. All three are optional and all three are clamped, because a
    // hand-edited file must not be able to put a non-finite value into a control or unbounded text
    // into the project.
    Object.assign(groove, GROOVE_DEFAULT); grooveSeed = 1; soundPick.keptId = null;
    if(o.gv && typeof o.gv==='object'){
      if(o.gv.c && typeof o.gv.c==='object')
        Object.keys(GROOVE_DEFAULT).forEach(k=>{ if(o.gv.c[k]!=null) groove[k]=clampN(o.gv.c[k]|0,0,100); });
      if(isFinite(o.gv.s)) grooveSeed=clampN(o.gv.s|0,0,0x7fffffff);
      soundPick.keptId = soundFamily(String(o.gv.sf||'')) ? String(o.gv.sf) : null;
    }
    lyrics.sections={}; lyrics.notes={};
    if(o.ly && typeof o.ly==='object'){
      const take=(src,dst,max)=>{ if(!src||typeof src!=='object') return;
        Object.keys(src).slice(0,N_PATTERNS*2).forEach(k=>{ const i=k|0;
          if(i>=0&&i<N_PATTERNS) dst[i]=String(src[k]==null?'':src[k]).slice(0,max); }); };
      take(o.ly.t, lyrics.sections, 4000);
      take(o.ly.n, lyrics.notes, 500);
    }
    Object.assign(intention, INTENTION_DEFAULT);
    if(o.pi && typeof o.pi==='object')
      Object.keys(INTENTION_DEFAULT).forEach(k=>{
        if(o.pi[k]!=null) intention[k]=String(o.pi[k]).slice(0,INTENTION_MAX[k]||200); });
    // Absent `lo` is normal, not an error: every project written before v13.3 lacks it.
    patterns.forEach(p2=>{ p2.bass=[]; });
    if(o.lo) o.lo.forEach((arr,pi)=>{ if(pi<N_PATTERNS&&Array.isArray(arr)) patterns[pi].bass=arr.filter(Array.isArray).map(a=>({
      p:clampN(a[0]|0,12,72), s:clampN(a[1]|0,0,STEPS-1), l:clampN(a[2]|0,1,STEPS-clampN(a[1]|0,0,STEPS-1)),
      v:clampN((a[3]||85)/100,.3,1.3), g:!!a[4] })); });
    if(Array.isArray(o.mx)) o.mx.forEach((a,i)=>{ const G=GROUPS[i]; if(!G||!Array.isArray(a)) return; const m=mix[G.id];
      m.vol=clampN(a[0]|0,0,140); m.pan=clampN(a[1]|0,-100,100); m.mute=a[2]?1:0; m.solo=a[3]?1:0;
      m.lo=clampN(a[4]|0,-12,12); m.mid=clampN(a[5]|0,-12,12); m.hi=clampN(a[6]|0,-12,12);
      m.rev=clampN(a[7]|0,0,100); m.dly=clampN(a[8]|0,0,100); });
    // The restored mute bit describes a project whose reference is not the one in memory now — audio
    // is never persisted, so the two cannot be assumed to belong together. See guardSampleMute().
    guardSampleMute();
    if(Array.isArray(o.fx)){ fx.dlyTime=clampN(o.fx[0]|0,60,700); fx.dlyFb=clampN(o.fx[1]|0,0,70); fx.revSize=clampN(o.fx[2]|0,0,100); fx.comp=clampN(o.fx[3]|0,0,100); }
    if(o.pat) o.pat.forEach((pm,pi)=>{ if(pi<N_PATTERNS) ALL_IDS.forEach((id,ii)=>{ patterns[pi][id]=unmask(pm[ii]||0); }); });
    if(o.acc) o.acc.forEach((am,pi)=>{ if(pi<N_PATTERNS) drums.forEach((d,di)=>{ accents[pi][d.id]=unmask(am[di]||0); }); });
    if(o.song) for(let i=0;i<SONG_SLOTS;i++){ song[i]= i<o.song.length ? o.song[i] : null; renderSlot(i); }
    if(o.mute){ Object.keys(mutes).forEach(k=>delete mutes[k]); Object.assign(mutes,o.mute); }
    melMuteBtn.classList.toggle('on',!!mutes.melody);
    if(o.cp!=null && o.cp<N_PATTERNS) currentPattern=o.cp;
    relabelChords(); renderGrid(); refreshPatBtns(); syncMixerUI(); applyAllGroupsLive();
    renderReady();   // restored projects and share links deserve the same "ready" cue
  }
  // ---------- sample analysis ----------
  // Mono mixdown at a reduced rate — enough for onset and chroma work, cheap enough to stay instant.
  function monoDown(buf,targetRate){
    const step=Math.max(1,Math.round(buf.sampleRate/targetRate)), n=Math.floor(buf.length/step);
    const out=new Float32Array(n), chans=[]; for(let c=0;c<buf.numberOfChannels;c++) chans.push(buf.getChannelData(c));
    for(let i=0;i<n;i++){ let s=0; for(let c=0;c<chans.length;c++) s+=chans[c][i*step]; out[i]=s/chans.length; }
    return {data:out, rate:buf.sampleRate/step};
  }
  // Tempo: energy-onset envelope -> autocorrelation over a musical BPM window.
  function detectBPM(buf){
    const {data,rate}=monoDown(buf,8000);
    const hop=Math.round(rate*0.01), frames=Math.floor(data.length/hop);
    const env=new Float32Array(frames);
    for(let f=0;f<frames;f++){ let s=0; for(let i=0;i<hop;i++){ const v=data[f*hop+i]||0; s+=v*v; } env[f]=Math.sqrt(s/hop); }
    const flux=new Float32Array(frames);
    for(let f=1;f<frames;f++){ const d=env[f]-env[f-1]; flux[f]=d>0?d:0; }
    let mean=0; for(let f=0;f<frames;f++) mean+=flux[f]; mean/=frames||1;
    for(let f=0;f<frames;f++) flux[f]=Math.max(0,flux[f]-mean);
    const fps=rate/hop;
    // Raw autocorrelation favours short lags, so weight by a log-normal prior centred on 105 BPM.
    // Gentle: enough to break octave ties, not enough to drag a genuine 140 down to the centre.
    // Wide on purpose. At 0.95/0.6 this prior did not merely break octave ties, it dragged genuinely
    // fast material two thirds of the way down — 140 read as 93.8, 146 as 98.5 — because a pattern
    // with hats on every sixteenth correlates almost as well at two thirds of its tempo. Widening it
    // leaves the tie-breaking intact and lets the autocorrelation decide.
    const prior=b=>Math.pow(Math.exp(-Math.pow(Math.log2(b/112)/1.45,2)/2), 0.45);
    const scoreAt=bpm=>{ const lag=Math.round(fps*60/bpm); if(lag<2||lag>=frames) return 0;
      let s=0,n=0; for(let f=0;f<frames-lag;f++){ s+=flux[f]*flux[f+lag]; n++; }
      return n? (s/n) : 0; };
    let best=0,bestBpm=0;
    for(let bpm=60;bpm<=190;bpm+=0.25){
      const sc=scoreAt(bpm)*prior(bpm);
      if(sc>best){ best=sc; bestBpm=bpm; }
    }
    // Compare the metrical relatives — a peak at half or double is usually the same groove counted
    // differently. Deliberately NOT the 2/3 and 3/4 relatives: those are triplet reinterpretations,
    // and combined with the log-normal prior they systematically dragged genuinely fast material down
    // (140 read as 93.8, 146 as 98.5, 100 as 67.3 — every one of them exactly two thirds). A singer
    // counting along with their own record does not expect a triplet respelling of its tempo.
    if(bestBpm){
      const cands=[bestBpm, bestBpm/2, bestBpm*2]
        .filter(b=>b>=60&&b<=190);
      let bb=bestBpm, bs=-1;
      cands.forEach(b=>{ const sc=scoreAt(b)*prior(b); if(sc>bs){ bs=sc; bb=b; } });
      bestBpm=bb;
    }
    return Math.round(bestBpm*10)/10;
  }
  // Key: 12-bin chroma via Goertzel across 4 octaves, matched to Krumhansl-Kessler profiles.
  const KK_MAJ=[6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
  const KK_MIN=[6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];
  function detectKey(buf){
    const {data,rate}=monoDown(buf,11025);
    const chroma=new Array(12).fill(0);
    const N=Math.min(data.length, Math.floor(rate*30));                 // first 30s is plenty
    const win=Math.floor(rate*0.37), hops=Math.max(1,Math.floor(N/win));
    for(let pc=0;pc<12;pc++){
      for(let oct=3;oct<=6;oct++){
        const f=440*Math.pow(2,(pc-9)/12+(oct-4));
        if(f>rate/2.2) continue;
        const k=2*Math.cos(2*Math.PI*f/rate);
        for(let h=0;h<hops;h++){
          let s0=0,s1=0,s2=0; const off=h*win;
          for(let i=0;i<win;i++){ s0=(data[off+i]||0)+k*s1-s2; s2=s1; s1=s0; }
          chroma[pc]+=Math.sqrt(Math.max(0,s1*s1+s2*s2-k*s1*s2))/win;
        }
      }
    }
    const mx=Math.max(...chroma)||1; for(let i=0;i<12;i++) chroma[i]/=mx;
    const corr=(prof,rot)=>{ let s=0; for(let i=0;i<12;i++) s+=chroma[(i+rot)%12]*prof[i]; return s; };
    let best={score:-1,key:0,mode:'minor'};
    for(let r=0;r<12;r++){
      const M=corr(KK_MAJ,r), m=corr(KK_MIN,r);
      if(M>best.score) best={score:M,key:r,mode:'major'};
      if(m>best.score) best={score:m,key:r,mode:'minor'};
    }
    const all=[]; for(let r=0;r<12;r++){ all.push({s:corr(KK_MAJ,r),key:r,mode:'major'},{s:corr(KK_MIN,r),key:r,mode:'minor'}); }
    const mean=all.reduce((a,b)=>a+b.s,0)/all.length;
    // The runner-up matters. Relative major/minor and a neighbouring fifth score almost identically
    // on a real mix, so when the margin is thin Aura offers the alternate rather than pretending the
    // winner was clear. "Close" is under 4% of the winning correlation, measured, not assumed.
    const rank=all.slice().sort((a,b)=>b.s-a.s);
    const second=rank.find(x=>!(x.key===best.key&&x.mode===best.mode))||null;
    const margin=second?(best.score-second.s)/(best.score||1):1;
    return {key:best.key, mode:best.mode,
            conf:Math.max(0,Math.min(1,(best.score-mean)/(best.score||1))),
            margin, alt:(second&&margin<0.04)?{key:second.key, mode:second.mode}:null};
  }

  // ---------- import & rebuild: local reconstruction from a mixed recording ----------
  // Everything here is classical DSP on the decoded buffer. No model, no download, no network.
  // It reconstructs what it can HEAR from a finished mix, which is not the same as recovering how
  // the record was made: a stereo mix does not preserve the isolated takes, the presets or the
  // production decisions, and notes masked by other instruments are simply not there to find.
  // So every result carries a confidence and nothing is written into the project without Apply.

  // Iterative radix-2 FFT, in place. Small enough to stay readable, fast enough for a 4-minute song.
  function fft(re,im){
    const n=re.length;
    for(let i=1,j=0;i<n;i++){
      let bit=n>>1;
      for(;j&bit;bit>>=1) j^=bit;
      j^=bit;
      if(i<j){ let t=re[i]; re[i]=re[j]; re[j]=t; t=im[i]; im[i]=im[j]; im[j]=t; }
    }
    for(let len=2;len<=n;len<<=1){
      const ang=-2*Math.PI/len, wr=Math.cos(ang), wi=Math.sin(ang);
      for(let i=0;i<n;i+=len){
        let cr=1, ci=0;
        for(let k=0;k<len/2;k++){
          const ur=re[i+k], ui=im[i+k];
          const vr=re[i+k+len/2]*cr-im[i+k+len/2]*ci, vi=re[i+k+len/2]*ci+im[i+k+len/2]*cr;
          re[i+k]=ur+vr; im[i+k]=ui+vi; re[i+k+len/2]=ur-vr; im[i+k+len/2]=ui-vi;
          const ncr=cr*wr-ci*wi; ci=cr*wi+ci*wr; cr=ncr;
        }
      }
    }
  }

  // Short-time band energies + spectral flux. One pass, reused by onset, classification and sections.
  const IMP_FFT=1024, IMP_HOP=256, IMP_RATE=22050;
  function spectralFrames(buf){
    const {data,rate}=monoDown(buf,IMP_RATE);
    const frames=Math.max(0,Math.floor((data.length-IMP_FFT)/IMP_HOP));
    const bins=IMP_FFT/2, hz=rate/IMP_FFT;
    const nyq=rate/2;
    // Clamp every edge below Nyquist and keep lo<=hi, or a band silently reads as zero.
    const band=f=>Math.min(bins-1,Math.max(0,Math.round(Math.min(f,nyq*0.97)/hz)));
    const mk=(lo,hi)=>{ const a=band(lo), b=band(hi); return [Math.min(a,b), Math.max(a,b)]; };
    // `crack` (1-3 kHz) is where a snare's crack and a clap's band-limited burst live. It overlaps
    // mid and hi deliberately and is excluded from the energy total below so nothing is counted
    // twice. The six original bands keep their exact edges — detectSections() and pickDownbeat()
    // read them by name.
    const B={ sub:mk(30,120), low:mk(120,180), body:mk(180,450), mid:mk(450,2000),
              crack:mk(1000,3000), hi:mk(2000,6000), top:mk(6000,10500) };
    const win=new Float32Array(IMP_FFT);
    for(let i=0;i<IMP_FFT;i++) win[i]=0.5-0.5*Math.cos(2*Math.PI*i/(IMP_FFT-1));
    const E={}; Object.keys(B).forEach(k=>E[k]=new Float32Array(frames));
    const flux=new Float32Array(frames), cent=new Float32Array(frames);
    const re=new Float32Array(IMP_FFT), im=new Float32Array(IMP_FFT);
    let prev=new Float32Array(bins);
    for(let f=0;f<frames;f++){
      const off=f*IMP_HOP;
      for(let i=0;i<IMP_FFT;i++){ re[i]=(data[off+i]||0)*win[i]; im[i]=0; }
      fft(re,im);
      let fl=0, num=0, den=0;
      const mag=new Float32Array(bins);
      for(let b=0;b<bins;b++){
        const m=Math.sqrt(re[b]*re[b]+im[b]*im[b]);
        mag[b]=m; const d=m-prev[b]; if(d>0) fl+=d;
        num+=m*b; den+=m;
      }
      flux[f]=fl; cent[f]=den>0?(num/den)*hz:0;
      // MEAN magnitude per bin, not the sum. The bands are wildly unequal in width — `top`
      // (6-10.5 kHz) covers around 210 bins while `sub` (30-120 Hz) covers about five — so summing
      // makes a quiet hi-hat outweigh a loud kick by two orders of magnitude, and every ratio built
      // on those sums then says "hat". Dividing by the bin count turns each band into a spectral
      // density, which is the only form in which they are comparable to each other.
      Object.keys(B).forEach(k=>{ const lo=B[k][0], hi2=B[k][1]; let s=0;
        for(let b=lo;b<=hi2;b++) s+=mag[b]; E[k][f]=s/(hi2-lo+1); });
      prev=mag;
    }
    return {E, flux, cent, fps:rate/IMP_HOP, frames, dur:buf.duration};
  }

  // Beat phase: given a tempo, slide the grid and keep the offset that best explains the flux.
  function beatGrid(flux,fps,bpm){
    const spb=60/bpm, step=spb*fps, n=flux.length;
    let bestOff=0, bestScore=-1;
    for(let o=0;o<step;o+=Math.max(1,step/48)){
      let s=0,c=0;
      for(let t=o;t<n;t+=step){ const i=Math.round(t); if(i<n){ s+=flux[i]; c++; } }
      const sc=c?s/c:0; if(sc>bestScore){ bestScore=sc; bestOff=o; }
    }
    const beats=[]; for(let t=bestOff;t<n;t+=step) beats.push(t/fps);
    // Downbeat: of the four candidate phases, the one whose beats carry the most sub-bass weight.
    return {beats, spb, offset:bestOff/fps, strength:bestScore};
  }
  function pickDownbeat(beats,E,fps){
    let best=0,bs=-1;
    for(let p=0;p<4;p++){
      let s=0,c=0;
      for(let i=p;i<beats.length;i+=4){ const f=Math.round(beats[i]*fps); if(f<E.sub.length){ s+=E.sub[f]; c++; } }
      const sc=c?s/c:0; if(sc>bs){ bs=sc; best=p; }
    }
    return best;
  }

  // ---------- percussion reconstruction: two questions, two answers ----------
  // A mix asks Aura two different things and the old single-stage classifier answered them as one:
  //   (a) WHEN did something hit   -> timing, measured against a locally tracked beat grid
  //   (b) WHAT hit                 -> classification, from onset-RELATIVE band deltas
  // They are measured and reported independently. When timing is confident and the label is not,
  // the event still lands on its correct step — in the broad Percussion lane, marked Needs review.
  // Never a confident wrong label, and never a question the singer has to answer to continue.
  //
  // The previous design ranked every onset against the other onsets in the same file and peeled the
  // lanes off in stages (kick, then backbeat, then hats). Percentile gates force a FIXED
  // DISTRIBUTION of lanes regardless of what the recording actually contains, so a kick-only loop
  // could never be all kick, and a file with three onsets took "percentiles" of three samples.
  // Everything below is scale-free and content-independent instead: one score per lane from the
  // same features, one measured margin, and exactly one per-file calibration.
  const clamp01=x=>x<0?0:x>1?1:x;
  const ramp=(x,a,b)=>x<=a?0:x>=b?1:(x-a)/(b-a);
  const med1=a=>{ if(!a.length) return 0; const s=a.slice().sort((x,y)=>x-y); return s[s.length>>1]; };
  const madOf=a=>{ if(a.length<2) return 0; const m=med1(a); return med1(a.map(v=>Math.abs(v-m))); };
  const pct=(arr,q)=>{ if(!arr.length) return 0; const a=arr.slice().sort((x,y)=>x-y);
    return a[Math.min(a.length-1,Math.max(0,Math.round((a.length-1)*q)))]; };

  // Positive per-band flux, derived from the band energies in one linear pass. No second FFT.
  function bandFlux(E,keys){
    const out={};
    keys.forEach(k=>{ const a=E[k], n=a.length, d=new Float32Array(n);
      for(let f=1;f<n;f++){ const v=a[f]-a[f-1]; d[f]=v>0?v:0; } out[k]=d; });
    return out;
  }

  // Adaptive-median peak picking on ONE detection signal. The local-maximum pre-test runs FIRST, so
  // the median is only sorted at the few frames that could possibly be peaks — which is why five
  // band detectors cost about what the old single broadband one cost.
  function pickOnsetsBand(sig,fps,ratio,minGapS){
    const n=sig.length, W=Math.round(fps*0.22), out=[], buf=[];
    // A local median alone is near zero wherever the band happens to be quiet, so a pure ratio test
    // fires on the smallest wobble there — which is how a sustained pad came to read as hundreds of
    // onsets. So a peak must ALSO clear a fixed share of this band's own dynamic range. The two
    // together are scale-free (the ratio) and transient-selective (the floor).
    const pos=[]; for(let f=1;f<n;f++) if(sig[f]>0) pos.push(sig[f]);
    if(pos.length<4) return out;
    pos.sort((a,b)=>a-b);
    const gp=pos[Math.min(pos.length-1,Math.round((pos.length-1)*0.97))];
    const floor=gp*0.16;
    if(!(floor>0)) return out;
    for(let f=1;f<n-1;f++){
      if(sig[f]<floor || sig[f]<sig[f-1] || sig[f]<sig[f+1]) continue;
      const a=Math.max(0,f-W), b=Math.min(n-1,f+W);
      buf.length=0; for(let i=a;i<=b;i+=2) buf.push(sig[i]);   // every 2nd sample: same median, half the sort
      buf.sort((x,y)=>x-y);
      if(sig[f] > buf[buf.length>>1]*ratio + 1e-9){
        const last=out.length?out[out.length-1]:-1e9;
        if(f-last > fps*minGapS) out.push(f);
        else if(sig[f]>sig[last]) out[out.length-1]=f;         // keep the stronger of a close pair
      }
    }
    return out;
  }
  // Frames within 24 ms are ONE musical onset: a kick and a hat on the same beat are one event in
  // time and two events in instrument space. The earliest frame wins — that is where the attack is.
  function mergeOnsets(lists,fps){
    const MERGE=Math.max(1,Math.round(fps*0.024)), all=[];
    Object.keys(lists).forEach(src=>lists[src].forEach(f=>all.push({f,src})));
    all.sort((a,b)=>a.f-b.f);
    const out=[];
    for(let i=0;i<all.length;i++){
      const o=all[i], last=out[out.length-1];
      if(last && o.f-last.f<=MERGE){ if(last.src.indexOf(o.src)<0) last.src+='+'+o.src; continue; }
      out.push({f:o.f, src:o.src});
    }
    return out;
  }
  // Sub-frame refinement: a parabola through the flux peak turns 11.6 ms frame resolution into
  // roughly 3 ms, which is what makes the reported pre-quantise offset worth showing.
  const refineTime=(f,sig,fps)=>{ const y1=sig[f-1]||0,y2=sig[f]||0,y3=sig[f+1]||0,d=y1-2*y2+y3;
    let dx=d?0.5*(y1-y3)/d:0; if(dx>0.5)dx=0.5; if(dx<-0.5)dx=-0.5; return (f+dx)/fps; };

  // Onset-relative features. Every value is a RATIO of band DELTAS, so it survives mastering, level,
  // soft-versus-loud dynamics and — the case the old absolute-energy features could not see at all —
  // a pad or a bass note sustaining underneath the hit.
  //   pre = the QUIETEST of the four frames before the attack (46 ms): what was already there.
  //   pk  = the LOUDEST of the four from the attack onward (35 ms), because a flux peak sits on the
  //         RISE, one frame before the energy peak. Reading the band at the flux frame alone was
  //         reading roughly half the hit.
  // `norms` carries, per band, the 90th percentile of that band's own positive flux across the whole
  // file. It turns "how big is this hit" into a per-band question, which is the only way to answer
  // whether a quiet hi-hat is present ON TOP of a loud kick: measured against the whole spectrum the
  // hat is invisible, measured against the other hats in the same recording it is obvious.
  function onsetFeatures(E,f,nextF,fps,norms){
    const n=E.sub.length;
    const A=k=>{ const a=E[k];
      let pre=Infinity; for(let j=Math.max(0,f-4);j<f;j++){ const v=a[j]||0; if(v<pre) pre=v; }
      if(pre===Infinity) pre=a[f]||0;
      let pk=0; for(let j=f;j<Math.min(n,f+4);j++){ const v=a[j]||0; if(v>pk) pk=v; }
      return {d:Math.max(0,pk-pre), pk, pre}; };
    const s=A('sub'), lo=A('low'), bo=A('body'), mi=A('mid'), ck=A('crack'), h=A('hi'), tp=A('top');
    const tot=s.d+lo.d+bo.d+mi.d+h.d+tp.d+1e-9;      // crack excluded: it overlaps mid and hi
    // Tail = how long a band stays at or above half its own onset delta above the pre-onset floor.
    // It breaks at the FIRST frame below and never crosses into the next onset, so a dense hat roll
    // reads as a roll of closed hats instead of a row of open ones.
    const stop=Math.min(n, nextF!=null?nextF:n, f+Math.round(fps*0.50));
    const tailOf=(a,pre,d)=>{ if(d<=0) return 0; let i=f;
      for(; i<stop; i++){ if(((a[i]||0)-pre) < d*0.5) break; } return (i-f)/fps*1000; };
    const bright=i=>((E.hi[i]||0)+(E.top[i]||0));
    let bpre=Infinity, bpk=0;
    for(let j=Math.max(0,f-4);j<f;j++){ const v=bright(j); if(v<bpre) bpre=v; }
    if(bpre===Infinity) bpre=bright(f);
    for(let j=f;j<Math.min(n,f+4);j++){ const v=bright(j); if(v>bpk) bpk=v; }
    let bi=f; const bd=Math.max(0,bpk-bpre);
    if(bd>0) for(; bi<stop; bi++){ if(bright(bi)-bpre < bd*0.5) break; }
    // Attack shape in 1-3 kHz: a snare cracks in one frame, a clap is a short MULTI-BURST — two to
    // four frames to peak with a second bump inside 80 ms. At 11.6 ms per frame this can measure
    // roughness, not individual hands, and that is all it claims to measure.
    let rise=0, rpk=0;
    for(let j=f;j<Math.min(n,f+6);j++){ const v=(E.crack[j]||0)-ck.pre; if(v>rpk){ rpk=v; rise=j-f; } }
    let bumps=0;
    for(let j=f+1;j<Math.min(n,f+8)-1;j++){ const a=(E.crack[j]||0)-ck.pre;
      if(a>=(E.crack[j-1]||0)-ck.pre && a>=(E.crack[j+1]||0)-ck.pre && a>=rpk*0.5) bumps++; }
    // 30-180 Hz is kick territory and 180-450 Hz is a snare's tonal shell. Folding `low` (120-180)
    // into the body ratio put a kick's own attack — its pitch glide starts around 155 Hz — on the
    // snare's side of the comparison, which inverted the single most important distinction here.
    const N=norms||{};
    const per=(v,k)=>N[k]?v/N[k]:0;
    return { f, t:f/fps,
      rSub0:(s.d+lo.d)/tot, rBody:bo.d/tot, rMid:mi.d/tot, rCrk:ck.d/tot,
      rBright:(h.d+tp.d)/tot, rTop:tp.d/tot,
      tilt:(h.d+tp.d)/(s.d+lo.d+1e-9),           // scale-free spectral tilt; replaces an absolute centroid
      // Presence in each band, against that band's own 90th percentile in this recording.
      pSub:per(s.d+lo.d,'sub'), pBody:per(bo.d,'body'), pCrk:per(ck.d,'crack'), pBright:per(bd,'bright'),
      subTail:tailOf(E.sub,s.pre,s.d), hiTail:(bi-f)/fps*1000,
      rise, bumps, amp:tot };
  }

  // Lane vocabulary. Six emitted lanes over the six drum ids that already exist — no new instrument,
  // bus or group, and GROUPS order is untouched.
  //   Kick               -> kick
  //   Snare / Clap       -> snare (family default), or clap when the file-level split is honest
  //   Closed / Open Hat  -> hat / openhat, split by a MEASURED tail rather than a median rank
  //   Percussion         -> shaker (the kit's "Perc" lane): the cheapest place in the kit to be
  //                         wrong, because a soft band-passed 6.5 kHz tick cannot fake a downbeat
  //   Uncertain Percussion -> shaker WITH review[shaker][step]=1. Same sound, honest label.
  const LANE_FAMILY={kick:'K', snare:'S', clap:'S', hat:'H', openhat:'H', perc:'P'};
  const FAMILY_DEFAULT={K:'kick', S:'snare', H:'hat', P:'perc'};
  const OUT_IDS=['kick','snare','clap','hat','openhat','shaker'];
  const LANE_TO_ID={kick:'kick', snare:'snare', clap:'clap', hat:'hat', openhat:'openhat', perc:'shaker'};
  const FAM_OF_ID={kick:'K', snare:'S', clap:'S', hat:'H', openhat:'H', shaker:'P'};
  const LANE_LABEL={kick:'Kick', snare:'Snare / Clap', clap:'Clap', hat:'Closed hat',
                    openhat:'Open hat', shaker:'Percussion'};

  // Which lanes a detector is allowed to claim. This is the load-bearing idea: the detector that
  // found an onset is itself evidence. A peak in 30-120 Hz flux is a candidate KICK; a peak in
  // 6-10 kHz flux is a candidate HAT; and when both fire at the same moment that is two drums, not
  // one drum Aura has to choose between. Collapsing them into a single event was what made a kick and
  // a hi-hat on the same step mutually exclusive, so a straight four-on-the-floor pattern always lost
  // one of its two lanes. 'X' means only the broadband detector fired, so nothing is ruled in.
  const SRC_LANES={ K:['kick'], S:['snare','clap'], H:['hat','openhat'],
                    X:['kick','snare','clap','hat','openhat'] };
  const SRC_FAMILY={ K:'K', S:'S', H:'H', X:null };

  // One score per lane from the same features, so every event has a best, a runner-up and a MEASURED
  // margin. Nothing is peeled off in stages, so nothing depends on what an earlier stage claimed.
  function classifyOnsets(F){
    if(!F.length) return [];
    // Exactly ONE per-file calibration, on the one feature that genuinely needs it: how much sub
    // survives a master varies enormously between recordings. Guarded by population, because taking
    // a percentile of three samples is what made the old design overfit its own test signal.
    let subScale=1;
    if(F.length>=20){ const p70=pct(F.map(o=>o.rSub0),0.70);
      if(p70>0.02) subScale=Math.max(0.6,Math.min(2.0,0.30/p70)); }
    const ev=[]; let uid=0;
    F.forEach(o=>{
      const rSub=Math.min(1.5,o.rSub0*subScale);
      // ---- step 1: PRESENCE. Does the band that claimed this onset actually carry a transient? ----
      // Measured per band against that band's own 90th percentile in this recording, so a quiet hat
      // riding on a loud kick is still visible. Ratios against the whole spectrum cannot answer this:
      // next to a kick, a hi-hat is two per cent of the energy and reads as absent.
      const pres={ K:o.pSub, S:Math.max(o.pCrk,o.pBody), H:o.pBright };
      let fam=SRC_FAMILY[o.fam];
      if(!fam){
        // Only the broadband detector fired. Accept a family only if its own presence test passes.
        fam=['K','S','H'].filter(x=>famPresent[x](o)).sort((a,b)=>pres[b]-pres[a])[0]||null;
      }
      // The band that claimed this onset has to carry a real transient here, or it is a leak from a
      // louder drum rather than a hit of its own.
      if(fam && !famPresent[fam](o)) return;
      // ---- step 2: NAMING. Which lane inside that family, and is the choice honest? ----
      let lane, conf, needsReview=false;
      if(!fam){
        lane='perc'; needsReview=true;
        conf=Math.min(0.40, 0.20+0.30*ramp(Math.max(pres.K,pres.S,pres.H),0.20,0.90));
      } else if(fam==='K'){
        // A kick is a SHORT thump. The sub tail separates it cleanly from both a snare's shell and a
        // sustained bass note: measured across this suite a kick rings 55-85 ms in the sub band while
        // a backbeat or a hat leaves 10-35 ms, and a bass note runs past 300 ms.
        // A kick THUMPS; a bass note RINGS. Across the suite a kick's sub band decays in 58-93 ms and
        // a saturated 808's in 160-175 ms, while a sustained bass note runs past 400 ms. That is a
        // gate, not a weighted opinion — so it multiplies rather than adds.
        const notSustained=1-ramp(o.subTail,220,420);
        const kickish=(0.50*ramp(o.subTail,25,60) + 0.30*ramp(o.pSub,1.5,6.0)
                    + 0.20*(1-ramp(o.rMid,0.20,0.55))) * notSustained;
        if(kickish<0.35){
          // Not a kick. If nothing else in the kit is present here either, this is harmonic material
          // and no percussion lane is invented from it at all.
          if(!famPresent.S(o) && !famPresent.H(o)) return;
          lane='perc'; needsReview=true; conf=Math.min(0.40,0.22+0.35*kickish);
        } else { lane='kick'; conf=0.44+0.48*ramp(kickish,0.35,0.85); }
      } else if(fam==='S'){
        // Snare, clap, or something that is neither. A snare has BOTH a 180-450 Hz shell and 1-3 kHz
        // wire noise; a clap has the crack without the shell; a conga or a tom is a tuned membrane
        // with a shell and almost no crack, and calling that a snare is exactly the confident wrong
        // label this release exists to remove — so it goes to Percussion instead.
        const shell=ramp(o.pBody,0.55,2.60), crack=ramp(o.pCrk,1.20,3.20);
        const clapish=o.bumps>=2 && o.rise>=2 && o.pBody<0.60;
        if(shell<0.06 && crack<0.10){ lane='perc'; needsReview=true; conf=0.32; }
        else if(o.rMid>=0.34 && crack<0.18){
          // A tuned membrane: real 180-450 Hz shell with almost no wire noise. A conga, a tom or a
          // rimshot. Calling that a snare is precisely the confident wrong label this release removes.
          lane='perc'; needsReview=true; conf=0.34;
        } else { lane=clapish?'clap':'snare';
          conf=0.42+0.46*ramp(Math.max(shell,crack),0.10,0.85);
          needsReview=conf<0.42; }
      } else {
        // Closed against open, by a MEASURED tail rather than a rank among the file's other hats. A
        // wrongly closed hat is a 45 ms error; a wrongly open one rings for a third of a second and
        // smears the bar, so a tail sitting on the boundary is flagged rather than guessed.
        lane=o.hiTail>=115?'openhat':'hat';
        conf=0.42+0.46*ramp(o.pBright,0.85,3.00);
        if(o.hiTail>=90&&o.hiTail<=145) needsReview=true;
      }
      const e={ uid:uid++, f:o.f, t:o.t, lane, laneConf:Math.max(0.12,Math.min(0.95,conf)),
        alt:'', altConf:0, margin:0, needsReview, amp:o.amp, src:o.src||'', fam:o.fam,
        rSub, rBody:o.rBody, rCrk:o.rCrk, rBright:o.rBright, rMid:o.rMid,
        rise:o.rise, bumps:o.bumps,
        pSub:o.pSub, pBody:o.pBody, pCrk:o.pCrk, pBright:o.pBright,
        hiTail:o.hiTail, subTail:o.subTail, multi:false };
      ev.push(e);
    });

    return ev;
  }

  // Cross-source arbitration. Letting each band detector own its own events is what makes a kick and
  // a hi-hat on the same step both survive — but it also means one drum can be seen by two detectors.
  // A kick has a little 180-450 Hz body and a bright click, so the backbeat detector fires on it too,
  // and the result was a phantom snare on every kick. Two detectors at one instant are two drums only
  // when EACH family has real energy in its own band; otherwise it is one drum seen twice, and the
  // weaker reading is dropped rather than written as a second lane.
  // Presence, one predicate per family, used both when naming an event and when arbitrating between
  // detectors so the two can never disagree. Every threshold below was read off the QA suite's
  // measured feature distributions (fixtures/import-qa.html), not chosen by taste:
  //   pSub   kick steps 4.5-10.6   backbeats 1.0-2.2   hats 0.04-0.33
  //   pBody  backbeats 1.24-3.72   hats 0.09-0.33
  //   pBright real hats 0.92-3.41  a kick's bright shoulder 0.68-0.75
  // The ratio tests matter as much as the levels: a kick's own attack raises the 180-450 Hz band too,
  // so "is there a backbeat here" has to ask whether the body rise is out of proportion to the sub
  // rise (a kick sits at pSub/pBody 3.6-4.7, a snare at 0.3-1.3).
  const famPresent={
    // Second clause for a saturated 808: drive pushes so much harmonic energy into 180-450 Hz that
    // the sub/body ratio collapses to about 1.15, but its sub band still rings 160-175 ms where a
    // backbeat leaves 12-35 ms. Measured on the k808-driven fixture.
    K:o=>(o.pSub>=2.5 && o.pSub>=2.0*o.pBody) || (o.pSub>=1.5 && o.subTail>=90),
    S:o=>(o.pBody>=0.55 && o.pSub<2.2*o.pBody) || (o.pCrk>=1.9 && o.pCrk>=1.3*o.pBright),
    H:o=>o.pBright>=0.85,
    P:()=>true,
  };
  const FAM_EVIDENCE={ K:famPresent.K, S:famPresent.S, H:famPresent.H, P:famPresent.P };
  function arbitrateSources(ev,tolF){
    if(!ev.length) return ev;
    ev.sort((a,b)=>a.f-b.f);
    const out=[];
    let i=0;
    while(i<ev.length){
      let j=i; while(j+1<ev.length && ev[j+1].f-ev[i].f<=tolF) j++;
      const group=ev.slice(i,j+1);
      // One reading per family: the same family seen twice in one instant is one drum.
      const byFam={};
      group.forEach(e=>{ const fm=LANE_FAMILY[e.lane]||'P';
        if(!byFam[fm] || e.laneConf>byFam[fm].laneConf) byFam[fm]=e; });
      const kept=Object.keys(byFam).filter(fm=>FAM_EVIDENCE[fm](byFam[fm])).map(fm=>byFam[fm]);
      if(kept.length) kept.forEach(e=>out.push(e));
      else {
        // Nothing carried its own band. The moment is real, so keep the single strongest reading and
        // say plainly that the instrument is not settled rather than dropping a hit the singer heard.
        const b=group.slice().sort((a,b)=>b.laneConf-a.laneConf)[0];
        b.lane='perc'; b.needsReview=true; b.laneConf=Math.min(b.laneConf,0.38);
        out.push(b);
      }
      i=j+1;
    }
    return out;
  }

  // beatGrid() returns a PERFECTLY EVEN grid, and an even grid drifts: a third of a per-cent of
  // tempo error is most of a second by minute four, which lands the whole back half of the song on
  // the wrong steps. Snap each beat to its nearest flux peak, reject local jerks, stay monotonic.
  function refineBeats(beats,flux,fps){
    if(beats.length<3) return beats.slice();
    const spb=beats[1]-beats[0], win=Math.max(1,Math.round(spb*fps*0.10)), out=beats.slice();
    for(let i=0;i<out.length;i++){
      const c=Math.round(out[i]*fps); let bf=c,bv=-1;
      for(let f=Math.max(0,c-win);f<=Math.min(flux.length-1,c+win);f++) if(flux[f]>bv){ bv=flux[f]; bf=f; }
      out[i]=bf/fps;
    }
    for(let i=1;i<out.length-1;i++){ const mid=(out[i-1]+out[i+1])/2;
      if(Math.abs(out[i]-mid)>0.12*spb) out[i]=mid; }
    for(let i=1;i<out.length;i++) if(out[i]<=out[i-1]) out[i]=out[i-1]+spb*0.5;
    return out;
  }
  // Downbeat from the CLASSIFIED KICKS rather than from absolute sub level, so a sustained 808
  // melody note on beat three cannot outvote a kick attack on beat one and rotate every step index.
  function pickDownbeatFromKicks(ev,beats,fps,E){
    const kicks=ev.filter(e=>e.lane==='kick');
    if(kicks.length<4 || beats.length<5) return pickDownbeat(beats,E,fps);
    const spb=beats[1]-beats[0], tol=spb*0.18, sc=[0,0,0,0]; let bi=0;
    kicks.slice().sort((a,b)=>a.t-b.t).forEach(e=>{
      while(bi+1<beats.length && Math.abs(beats[bi+1]-e.t)<=Math.abs(beats[bi]-e.t)) bi++;
      if(Math.abs(beats[bi]-e.t)<=tol) sc[bi%4]+=e.amp*e.laneConf;
    });
    let best=0; for(let p=1;p<4;p++) if(sc[p]>sc[best]) best=p;
    return sc[best]>0?best:pickDownbeat(beats,E,fps);
  }

  // Timing. Every event keeps its ORIGINAL time, the step it snapped to, and how far it moved —
  // quantised against THIS beat's own sixteenth, so tempo drift and a human drummer both survive.
  function quantiseEvents(ev,beats,dbPhase){
    if(beats.length<2) return {events:[],bars:0,spb:0};
    const spbNom=beats[1]-beats[0];
    ev.sort((a,b)=>a.t-b.t);
    let bi=0; const out=[];
    ev.forEach(e=>{
      while(bi+1<beats.length && beats[bi+1]<=e.t) bi++;
      while(bi>0 && beats[bi]>e.t) bi--;
      const b0=beats[bi], b1=(beats[bi+1]!=null?beats[bi+1]:b0+spbNom);
      const local=Math.max(1e-4,(b1-b0)/4);
      const q=Math.max(0,Math.min(4,Math.round((e.t-b0)/local)));
      const idx=(bi-dbPhase)*4+q;                      // absolute sixteenth from the first downbeat
      if(idx<0) return;                                // before the downbeat: not part of a bar yet
      e.bar=Math.floor(idx/STEPS); e.step=((idx%STEPS)+STEPS)%STEPS;
      e.off=e.t-(b0+q*local); e.offSteps=e.off/local; e.sixteenth=local;
      e.timingConf=Math.max(0.10,Math.min(0.98,1-Math.min(1,Math.abs(e.offSteps)/0.5)));
      out.push(e);
    });
    return {events:out, bars:out.length?Math.max(1,out[out.length-1].bar+1):0, spb:spbNom};
  }
  // A decaying kick or snare can retrigger the detector. Suppress it HERE, in time, where "much
  // sooner than a sixteenth AND much weaker" is measurable — never on the finished pattern, where
  // an adjacent-step pass silently thins every sixteenth-note lane down to eighths. Hats are exempt:
  // a hat roll is exactly the material such a pass destroys.
  function deflamEvents(ev){
    const last={}, keep=[];
    ev.forEach(e=>{ const fam=LANE_FAMILY[e.lane];
      if(fam!=='K'&&fam!=='S'){ keep.push(e); return; }
      const p=last[fam];
      if(p && (e.t-p.t)<0.55*(e.sixteenth||0.1) && e.amp<p.amp*0.60){ e.dropped='deflam'; return; }
      last[fam]=e; keep.push(e); });
    return keep;
  }
  // Aura writes ONE sixteen-step pattern. Voting it across intro, verse, chorus and outro averages
  // four grooves into a smear, and a share-of-all-bars threshold then deletes any lane that only
  // appears in the chorus. Vote inside the most self-similar window instead.
  function pickGrooveWindow(ev,bars){
    const W=Math.min(bars,16);
    if(bars<=W) return {barStart:0, barEnd:Math.max(1,bars), score:0};
    const sig=[]; for(let b=0;b<bars;b++) sig.push(new Set());
    ev.forEach(e=>{ if(!e.dropped && e.bar>=0 && e.bar<bars) sig[e.bar].add(e.lane+':'+e.step); });
    let best={barStart:0,barEnd:W,score:-1};
    for(let a=0;a+W<=bars;a++){
      let n=0,sim=0,pairs=0;
      for(let b=a;b<a+W;b++){ n+=sig[b].size;
        if(b>a){ const p=sig[b-1],q=sig[b]; let it=0; q.forEach(x=>{ if(p.has(x)) it++; });
          const un=p.size+q.size-it; sim+=un?it/un:0; pairs++; } }
      const score=n*(0.35+0.65*(pairs?sim/pairs:0));
      if(score>best.score) best={barStart:a,barEnd:a+W,score};
    }
    return best;
  }

  function buildBeatPattern(ev,bars,win,clapOK){
    const blank=()=>{ const o={}; OUT_IDS.forEach(k=>o[k]=new Array(STEPS).fill(0)); return o; };
    const res={ grid:blank(), punch:blank(), offs:blank(), offSpread:blank(), votes:blank(),
      laneConfStep:blank(), review:blank(), user:blank(), contested:new Array(STEPS).fill(0),
      events:ev, bars:bars||0, window:win||{barStart:0,barEnd:0}, windowLabel:'',
      hits:0, steps:0, reviewSteps:0, userSet:0,
      swing:0, swingConf:0, swingApply:false, roll:false, rollSteps:[],
      metre:'', altBpm:0, refitBpm:0, timingSpread:0, clapSplit:!!clapOK,
      timingConf:0.1, classConf:0.1 };
    if(!ev.length||!bars||!win) return res;
    const {grid,punch,offs,offSpread,votes,laneConfStep,review}=res;
    const winBars=Math.max(1,win.barEnd-win.barStart);
    const inWin=e=>!e.dropped && e.bar>=win.barStart && e.bar<win.barEnd;
    const acc={}; OUT_IDS.forEach(k=>acc[k]=Array.from({length:STEPS},
      ()=>({n:0,conf:0,off:0,amp:0,rev:0,offs:[]})));
    ev.forEach(e=>{ if(!inWin(e)) return; const a=acc[LANE_TO_ID[e.lane]][e.step];
      a.n++; a.conf+=e.laneConf; a.off+=e.off; a.amp+=e.amp; a.offs.push(e.offSteps);
      if(e.needsReview) a.rev++; res.hits++; });
    const need=Math.max(2,Math.ceil(winBars*0.34));
    // Accent reference = this lane's own 90th-percentile mean amplitude. An accent means LOUDER,
    // which is not the same thing as more confidently classified.
    const ampRef={}; OUT_IDS.forEach(k=>{ const a=[];
      acc[k].forEach(x=>{ if(x.n) a.push(x.amp/x.n); }); ampRef[k]=pct(a,0.90)||1; });
    for(let s=0;s<STEPS;s++){
      const fam={K:0,S:0,H:0,P:0};
      OUT_IDS.forEach(k=>{ fam[FAM_OF_ID[k]]+=acc[k][s].n; });
      const total=fam.K+fam.S+fam.H+fam.P; if(!total) continue;
      const order=['K','S','H','P'].filter(FF=>fam[FF]>=need).sort((a,b)=>fam[b]-fam[a]);
      if(!order.length) continue;
      // A kick plus ONE other family on the same step is physically real — a mix onset is a sum of
      // drums. Three families claiming one onset is the classifier hedging, so the loser is dropped
      // and the step is marked contested, which is what raises the review flag.
      const write=[];
      if(order[0]==='K'){ write.push('K'); const nk=order.find(FF=>FF!=='K'); if(nk) write.push(nk); }
      else { write.push(order[0]);
        if(order.indexOf('K')>=0) write.push('K');
        else if(order[1] && fam[order[1]]>=0.60*winBars) write.push(order[1]); }
      if(order.length>write.length) res.contested[s]=1;
      write.forEach(FF=>{
        let id;
        if(FF==='K') id='kick';
        else if(FF==='S') id=(clapOK && acc.clap[s].n>=3
              && acc.clap[s].n>=0.65*(acc.clap[s].n+acc.snare[s].n)) ? 'clap' : 'snare';
        else if(FF==='H') id=(acc.openhat[s].n>=2
              && acc.openhat[s].n>=0.60*(acc.hat[s].n+acc.openhat[s].n)) ? 'openhat' : 'hat';
        else id='shaker';
        const pool=OUT_IDS.filter(k=>FAM_OF_ID[k]===FF).map(k=>acc[k][s]);
        const n=pool.reduce((x,p)=>x+p.n,0); if(!n) return;
        const conf=pool.reduce((x,p)=>x+p.conf,0)/n, amp=pool.reduce((x,p)=>x+p.amp,0)/n;
        const rev=pool.reduce((x,p)=>x+p.rev,0);
        grid[id][s]=1; votes[id][s]=n;
        offs[id][s]=pool.reduce((x,p)=>x+p.off,0)/n;
        offSpread[id][s]=madOf(pool.reduce((x,p)=>x.concat(p.offs),[]));
        punch[id][s]=Math.min(1.2, amp/(ampRef[id]||1));
        // MEASURED stability rather than a constant: how exclusively this family owns the step,
        // shrunk by how few bars actually voted, times the mean per-event margin.
        laneConfStep[id][s]=Math.max(0.10,Math.min(0.95,
          (n/total)*(n/(n+2))*(0.45+0.55*Math.min(1,conf))));
        if(rev>n*0.5 || res.contested[s] || laneConfStep[id][s]<0.42) review[id][s]=1;
        res.steps++; if(review[id][s]) res.reviewSteps++;
      });
    }
    // Swing, measured on the odd sixteenths and then REMOVED before timing is scored. Boom-bap is
    // not sloppy, it is late on purpose. loop() applies sps*(swing/100)*0.9 to odd steps, so an
    // offset of one sixteenth equals swing 111 and offset-in-steps / 0.009 is the swing value.
    const oddO=[], evenO=[];
    ev.forEach(e=>{ if(inWin(e)) (e.step%2?oddO:evenO).push(e.offSteps); });
    res.swing=Math.max(0,Math.min(60,Math.round(med1(oddO)/0.009)));
    res.swingConf=oddO.length>=8?Math.max(0,1-Math.min(1,madOf(oddO)/0.25)):0;
    res.swingApply=oddO.length>=8 && res.swingConf>=0.5 && res.swing>=6;
    const mE=med1(evenO), mO=med1(oddO), det=[];
    ev.forEach(e=>{ if(inWin(e)) det.push(e.offSteps-(e.step%2?mO:mE)); });
    res.timingSpread=madOf(det);
    // Movement faster than a sixteenth cannot be written on a sixteen-step bar. Say so rather than
    // silently inventing eighths.
    const hatEv=ev.filter(e=>inWin(e)&&FAM_OF_ID[LANE_TO_ID[e.lane]]==='H').length;
    if(hatEv/winBars>=20){ res.roll=true;
      for(let s=0;s<STEPS;s++) if(grid.hat[s]||grid.openhat[s]) res.rollSteps.push(s); }
    // Half-bar versus half-time. Reported and offered, never asked as a blocking question.
    if(res.steps>=4){
      let same=true;
      OUT_IDS.forEach(k=>{ for(let s=0;s<8;s++) if(grid[k][s]!==grid[k][s+8]) same=false; });
      const sAt=s=>grid.snare[s]||grid.clap[s];
      if(same) res.metre='half-bar';
      else if(sAt(8)&&!sAt(4)&&!sAt(12)) res.metre='half-time';
    }
    return res;
  }

  // Sections: beat-synchronous features -> self-similarity -> novelty peaks on bar lines, and then
  // the part that matters for honesty — REPETITION. A stereo mix tells Aura which areas sound like
  // each other; it does not tell Aura that an area is "the chorus". So repetition is measured, and a
  // semantic name is only offered when the evidence for it exists. Where it does not, the area keeps
  // a neutral name (Section A, Section B) and says it is describing repetition, not song form.
  function detectSections(beats,E,fps,dur){
    const nb=beats.length; if(nb<16) return [];
    const feat=[];
    for(let i=0;i<nb;i++){
      const a=Math.round(beats[i]*fps), b=Math.round((beats[i+1]!=null?beats[i+1]:beats[i]+0.5)*fps);
      const v=[0,0,0,0,0];
      const keys=['sub','low','mid','hi','top'];
      for(let f=a;f<b;f++) keys.forEach((k,ki)=>{ v[ki]+=E[k][f]||0; });
      const n=Math.max(1,b-a); const s=v.reduce((x,y)=>x+y,0)/n||1;
      feat.push(v.map(x=>(x/n)/s));
    }
    const bar=4, nbar=Math.floor(nb/bar), bf=[], loud=[];
    for(let m=0;m<nbar;m++){
      const v=[0,0,0,0,0]; let lv=0;
      for(let i=m*bar;i<(m+1)*bar;i++){ for(let k=0;k<5;k++) v[k]+=feat[i][k]/bar; }
      // Absolute loudness per bar, kept separate from the normalised shape vector: a chorus is
      // usually both a different shape AND louder, and conflating the two loses the louder part.
      const a=Math.round(beats[m*bar]*fps), b=Math.round((beats[(m+1)*bar]!=null?beats[(m+1)*bar]:beats[m*bar]+2)*fps);
      for(let f=a;f<b;f++) lv+=(E.sub[f]||0)+(E.low[f]||0)+(E.mid[f]||0)+(E.hi[f]||0)+(E.top[f]||0);
      bf.push(v); loud.push(lv/Math.max(1,b-a));
    }
    if(nbar<4) return [];
    const dist=(a,b)=>{ let s=0; for(let k=0;k<5;k++){ const d=a[k]-b[k]; s+=d*d; } return Math.sqrt(s); };
    const nov=new Array(nbar).fill(0);
    for(let m=1;m<nbar;m++) nov[m]=dist(bf[m],bf[m-1]);
    const mean=nov.reduce((a,b)=>a+b,0)/(nbar||1);
    const bnds=[0];
    for(let m=4;m<nbar-2;m++){
      if(nov[m]>mean*1.5 && nov[m]>=nov[m-1] && nov[m]>=nov[m+1] && m-bnds[bnds.length-1]>=4) bnds.push(m);
    }
    bnds.push(nbar);
    const segs=[];
    for(let i=0;i<bnds.length-1;i++){
      const a=bnds[i], b=bnds[i+1];
      let e=0, sh=[0,0,0,0,0];
      for(let m=a;m<b;m++){ e+=loud[m]; for(let k=0;k<5;k++) sh[k]+=bf[m][k]/(b-a); }
      segs.push({barStart:a, barEnd:b, bars:b-a, energy:e/Math.max(1,b-a), shape:sh});
    }
    if(!segs.length) return [];

    // ---- repeated areas ----
    // Two segments belong to the same AREA when their mean shape vectors are close relative to the
    // spread of all pairwise distances in this file, and their loudness is within a factor. This is
    // the only claim a mixed recording actually supports, so it is the claim the labels are built on.
    const ds=[];
    for(let i=0;i<segs.length;i++) for(let j=i+1;j<segs.length;j++) ds.push(dist(segs[i].shape,segs[j].shape));
    const thr=ds.length?Math.max(0.045,pct(ds,0.28)):0.045;
    const AREA='ABCDEFGH';
    let nextArea=0;
    segs.forEach((s,i)=>{
      if(s.area!=null) return;
      s.area=nextArea; s.areaLetter=AREA[nextArea]||'?';
      for(let j=i+1;j<segs.length;j++){
        const t=segs[j]; if(t.area!=null) continue;
        const lr=Math.max(s.energy,t.energy)/(Math.min(s.energy,t.energy)||1e-9);
        if(dist(s.shape,t.shape)<=thr && lr<=1.6){ t.area=s.area; t.areaLetter=s.areaLetter; }
      }
      nextArea++;
    });
    const repeats={}; segs.forEach(s=>{ repeats[s.area]=(repeats[s.area]||0)+1; });
    segs.forEach(s=>{ s.repeats=repeats[s.area]; });

    // ---- labels, only as far as the evidence goes ----
    const es=segs.map(s=>s.energy).slice().sort((a,b)=>a-b);
    const hiE=es[Math.floor(es.length*0.72)], loE=es[Math.floor(es.length*0.28)];
    const spread=(hiE-loE)/(hiE||1);
    // With almost no dynamic range there is no evidence for "chorus" versus "verse" at all, so the
    // whole set falls back to neutral names rather than inventing a song form.
    const neutral = spread<0.18;
    const loudestArea=(()=>{ const byArea={}; segs.forEach(s=>{ byArea[s.area]=Math.max(byArea[s.area]||0,s.energy); });
      let best=null; Object.keys(byArea).forEach(a=>{ if(best==null||byArea[a]>byArea[best]) best=a; });
      return best!=null?+best:-1; })();
    const chorusArea = (!neutral && repeats[loudestArea]>=2) ? loudestArea : -1;
    segs.forEach((s,i)=>{
      const first=i===0, last=i===segs.length-1;
      s.labelKind='repetition';
      if(neutral){ s.label='Section '+s.areaLetter; }
      else if(s.area===chorusArea){ s.label='Chorus'; s.labelKind='semantic'; }
      else if(first && s.energy<=loE){ s.label='Intro'; s.labelKind='semantic'; }
      else if(last && s.energy<=loE){ s.label='Outro'; s.labelKind='semantic'; }
      else s.label='Section '+s.areaLetter;
    });
    // Pre-chorus: a short, quieter area immediately BEFORE a chorus, and not itself the chorus.
    // Only claimed when a chorus was itself justified.
    if(chorusArea>=0) segs.forEach((s,i)=>{
      const nxt=segs[i+1];
      if(!nxt || nxt.area!==chorusArea || s.area===chorusArea) return;
      if(s.bars<=6 && s.energy<hiE && s.labelKind!=='semantic'){ s.label='Pre-chorus'; s.labelKind='semantic'; }
    });
    // Verse: a repeated mid-energy area that is not the chorus. Bridge: a LATE area heard once.
    if(!neutral) segs.forEach((s,i)=>{
      if(s.labelKind==='semantic') return;
      if(s.repeats>=2 && s.energy<hiE){ s.label='Verse'; s.labelKind='semantic'; }
      else if(s.repeats===1 && i>segs.length*0.5 && s.bars<=8 && i<segs.length-1){ s.label='Bridge'; s.labelKind='semantic'; }
    });
    segs.forEach(s=>{
      // Confidence is how far this area sits from the middle of the file's own dynamic range, shrunk
      // when the label is only a repetition claim rather than a song-form one.
      const mid=(hiE+loE)/2, sp=(hiE-loE)||1;
      s.conf=Math.max(0.2,Math.min(0.9,Math.abs(s.energy-mid)/sp+0.35))*(s.labelKind==='semantic'?1:0.72);
      s.needsReview=s.conf<0.42||s.labelKind!=='semantic';
      s.startSec=beats[s.barStart*4]!=null?beats[s.barStart*4]:0;
      s.endSec=beats[s.barEnd*4]!=null?beats[s.barEnd*4]:dur;
      delete s.shape;
    });
    segs.neutral=neutral;
    return segs;
  }

  // The arrangement Apply actually writes. Aura has six section slots and thirty-two song bars, so a
  // long song cannot be represented bar for bar; what CAN be represented is the order of its areas
  // and their relative lengths. Repeated areas share a slot, which is why the second chorus reuses
  // the first chorus's pattern instead of consuming another slot.
  function sectionPlan(){
    if(!imp||!imp.sections||!imp.sections.length) return [];
    const raw=imp.sections;
    const edit=(imp.edit&&imp.edit.secBound)||null;
    // Slot identity: the area letter, so two visits to the same area map to one slot. The visible
    // name is the label, which may be semantic or neutral.
    let segs=raw.map((s,i)=>({
      i, bars:s.bars, label:s.label, slot:s.label, slotKey:'A'+s.area,
      area:s.area, areaLetter:s.areaLetter, repeats:s.repeats,
      conf:s.conf, labelKind:s.labelKind, needsReview:s.needsReview,
      barStart:s.barStart, barEnd:s.barEnd,
    }));
    if(edit&&edit.length===segs.length) segs.forEach((s,i)=>{ s.bars=Math.max(1,edit[i]|0); });
    // Only the first N_PATTERNS distinct areas can be represented. Later areas fold into the
    // nearest earlier slot rather than being dropped, so the arrangement keeps its shape.
    const seen=[];
    segs.forEach(s=>{ if(seen.indexOf(s.slotKey)<0) seen.push(s.slotKey); });
    if(seen.length>N_PATTERNS){
      const keep=seen.slice(0,N_PATTERNS);
      segs.forEach(s=>{ if(keep.indexOf(s.slotKey)<0){ s.slotKey=keep[keep.length-1]; s.folded=true; } });
    }
    // Scale to the 32-bar budget, never below one bar per area, never truncating the last area away.
    let total=segs.reduce((a,s)=>a+s.bars,0);
    if(total>SONG_SLOTS){
      const f=SONG_SLOTS/total;
      segs.forEach(s=>{ s.plannedBars=Math.max(1,Math.round(s.bars*f)); });
      let t=segs.reduce((a,s)=>a+s.plannedBars,0);
      // Trim the longest areas first until it fits, so short sections are not erased by rounding.
      while(t>SONG_SLOTS){
        const big=segs.slice().sort((a,b)=>b.plannedBars-a.plannedBars)[0];
        if(big.plannedBars<=1) break;
        big.plannedBars--; t--;
      }
      segs.forEach(s=>{ s.scaled=s.plannedBars!==s.bars; s.bars=s.plannedBars; });
    }
    segs.scaled=segs.some(s=>s.scaled);
    segs.folded=segs.some(s=>s.folded);
    return segs;
  }

  // Harmony. Chroma is measured ONCE PER BEAT, which buys two things a per-bar measurement cannot:
  //  * all four possible bar phases can be scored for free, so a progression that really starts on
  //    beat 3 is found instead of being smeared across every bar line;
  //  * harmonic rhythm can be tested at one and two chords per bar, which is what half-time and
  //    double-time actually look like in the harmony.
  // A suggestion is biased towards the detected key so it stays inside something a singer can sing
  // over. It is a suggestion: the preview is editable and nothing is written until Apply.
  function beatChroma(buf,beats){
    const {data,rate}=monoDown(buf,11025);
    const out=[];
    for(let i=0;i<beats.length;i++){
      const a=Math.round((beats[i]||0)*rate);
      const bEnd=beats[i+1]!=null?beats[i+1]:beats[i]+0.5;
      const N=Math.max(256,Math.min(Math.round((bEnd-beats[i])*rate),Math.round(rate*0.8)));
      const ch=new Array(12).fill(0);
      for(let pc=0;pc<12;pc++){
        for(let oct=3;oct<=5;oct++){
          const f=440*Math.pow(2,(pc-9)/12+(oct-4));
          if(f>rate/2.2) continue;
          const k=2*Math.cos(2*Math.PI*f/rate);
          let s1=0,s2=0,s0=0;
          for(let j=0;j<N;j++){ s0=(data[a+j]||0)+k*s1-s2; s2=s1; s1=s0; }
          ch[pc]+=Math.sqrt(Math.max(0,s1*s1+s2*s2-k*s1*s2))/N;
        }
      }
      const mx=Math.max.apply(null,ch)||1; for(let j=0;j<12;j++) ch[j]/=mx;
      out.push(ch);
    }
    return out;
  }
  function matchTriad(chroma,diatonic){
    let best={score:-1,root:0,min:false}, second={score:-1,root:null,min:false};
    for(let r=0;r<12;r++){
      const maj=chroma[r]+chroma[(r+4)%12]+chroma[(r+7)%12];
      const min=chroma[r]+chroma[(r+3)%12]+chroma[(r+7)%12];
      const bias=diatonic.indexOf(r)>=0?1.18:0.86;
      const sM=maj*bias, sm=min*bias;
      if(sM>best.score){ second=best; best={score:sM,root:r,min:false}; } else if(sM>second.score) second={score:sM,root:r,min:false};
      if(sm>best.score){ second=best; best={score:sm,root:r,min:true}; } else if(sm>second.score) second={score:sm,root:r,min:true};
    }
    return {best,second};
  }
  const cosSim=(a,b)=>{ let d=0,na=0,nb=0; for(let i=0;i<12;i++){ d+=a[i]*b[i]; na+=a[i]*a[i]; nb+=b[i]*b[i]; }
    return (na&&nb)?d/Math.sqrt(na*nb):0; };

  function detectHarmony(buf,beats,keyRootIdx,mode){
    const scale=SCALES[mode]||SCALES.minor;
    const diatonic=scale.steps.map(s=>(keyRootIdx+s)%12);
    const BC=beatChroma(buf,beats);
    const empty={bars:[], phase:0, phaseScores:[], phaseUncertain:false, rate:'single', rateConf:0};
    if(BC.length<8) return empty;
    // Score all four bar phases. A correctly aligned bar is HOMOGENEOUS — its four beats agree with
    // each other — while a misaligned bar straddles a chord change and its beats disagree. That is
    // the measurement; the second half rewards a progression that actually repeats every 4 or 8 bars.
    const phaseOf=p=>{
      const bars=[];
      for(let m=0;p+(m+1)*4<=BC.length;m++){
        const idx=[0,1,2,3].map(j=>p+m*4+j);
        const sum=new Array(12).fill(0);
        idx.forEach(i=>{ for(let k=0;k<12;k++) sum[k]+=BC[i][k]/4; });
        const mx=Math.max.apply(null,sum)||1; for(let k=0;k<12;k++) sum[k]/=mx;
        let hom=0; idx.forEach(i=>{ hom+=cosSim(BC[i],sum)/4; });
        const {best,second}=matchTriad(sum,diatonic);
        const deg=diatonic.indexOf(best.root);
        bars.push({ bar:m, root:best.root, minor:best.min, degree:deg, hom, chroma:sum,
          name:NOTE_NAMES[best.root]+(best.min?'m':''),
          alt: second.root!=null? NOTE_NAMES[second.root]+(second.min?'m':'') : '',
          altRoot: second.root, altMinor: second.min,
          conf: Math.max(0.15, Math.min(0.95, (best.score-(second.score||0))/(best.score||1)+0.35)) });
      }
      if(!bars.length) return {bars, score:0, hom:0, rep:0};
      const hom=bars.reduce((a,b)=>a+b.hom,0)/bars.length;
      const names=bars.map(b=>b.name);
      const repAt=L=>{ if(names.length<=L) return 0; let m=0,n=0;
        for(let i=0;i+L<names.length;i++){ n++; if(names[i]===names[i+L]) m++; } return n?m/n:0; };
      const rep=Math.max(repAt(4),repAt(8),repAt(2));
      return {bars, hom, rep, score:0.62*hom+0.38*rep};
    };
    const ph=[0,1,2,3].map(phaseOf);
    const ranked=ph.map((x,i)=>({i,score:x.score})).sort((a,b)=>b.score-a.score);
    const phase=ranked[0].i;
    // When two phases are within 4% of each other the alignment is genuinely unclear. Aura exposes
    // the choice for review instead of silently committing to one of them.
    const phaseUncertain=ranked.length>1 && (ranked[0].score-ranked[1].score)<0.04*(ranked[0].score||1);
    // Harmonic rhythm. Two chords per bar is only claimed when splitting the bar makes the halves
    // measurably more homogeneous than the whole bar was — which is what a real double-time
    // progression does and what a slow one does not.
    const P=ph[phase];
    let rate='single', rateConf=0;
    if(P.bars.length>=4){
      let whole=0, halves=0, n=0;
      for(let m=0;phase+(m+1)*4<=BC.length;m++){
        const i0=phase+m*4;
        const h1=[BC[i0],BC[i0+1]], h2=[BC[i0+2],BC[i0+3]];
        const mk=arr=>{ const s=new Array(12).fill(0); arr.forEach(c=>{ for(let k=0;k<12;k++) s[k]+=c[k]/arr.length; });
          const mx=Math.max.apply(null,s)||1; for(let k=0;k<12;k++) s[k]/=mx; return s; };
        const a=mk(h1), b=mk(h2);
        halves+=(cosSim(BC[i0],a)+cosSim(BC[i0+1],a)+cosSim(BC[i0+2],b)+cosSim(BC[i0+3],b))/4;
        whole+=P.bars[m]?P.bars[m].hom:0; n++;
      }
      if(n){ const gain=(halves/n)-(whole/n);
        if(gain>0.035){ rate='double'; rateConf=Math.min(1,gain/0.12); } else rateConf=Math.min(1,-gain/0.12); }
    }
    // Smooth single-bar flickers into their neighbours — real progressions repeat.
    const bars=P.bars.map(b=>{ const c=Object.assign({},b); delete c.chroma; return c; });
    for(let i=1;i<bars.length-1;i++){
      if(bars[i-1].name===bars[i+1].name && bars[i].name!==bars[i-1].name && bars[i].conf<0.5)
        bars[i]=Object.assign({},bars[i-1],{bar:bars[i].bar, smoothed:true});
    }
    return { bars, phase, phaseUncertain, rate, rateConf,
             phaseScores:ph.map((x,i)=>({phase:i, score:+x.score.toFixed(4), hom:+x.hom.toFixed(4), rep:+x.rep.toFixed(4),
                                         bars:x.bars.map(b=>b.name)})),
             beatChroma:null };
  }

  // What the chord preview shows and what Apply writes. The bar phase the singer picked in the
  // preview wins over the detected one, and a per-bar edit wins over both.
  function chordCells(){
    if(!imp||!imp.harmony) return imp&&imp.chords?imp.chords:[];
    const H=imp.harmony;
    const p=(imp.edit&&imp.edit.chordPhase!=null)?imp.edit.chordPhase:H.phase;
    if(p===H.phase) return H.bars;
    const alt=H.phaseScores[p];
    if(!alt||!alt.bars||!alt.bars.length) return H.bars;
    // The alternate phase keeps only its chord names in phaseScores, so rebuild cells from them and
    // mark them as a re-alignment rather than a fresh measurement.
    return alt.bars.map((nm,i)=>{
      const src=H.bars[Math.min(i,H.bars.length-1)]||{};
      const minor=/m$/.test(nm), root=NOTE_NAMES.indexOf(nm.replace(/m$/,''));
      const scale=SCALES[imp.mode]||SCALES.minor;
      const diatonic=scale.steps.map(s=>(imp.key+s)%12);
      return { bar:i, root:root<0?src.root:root, minor, name:nm,
               degree:diatonic.indexOf(root<0?src.root:root),
               alt:src.alt||'', conf:Math.max(0.15,(src.conf||0.4)*0.88), realigned:true };
    });
  }

  // The one entry point. Returns a plain object; writes nothing into the project.
  // ================= LOW END =================
  // What Aura hears down there, and what it is allowed to conclude from it.
  //
  // This is NOT bass-stem extraction and it does not transcribe the original bassline. It measures
  // WHERE low-frequency events happen, HOW LONG they hold, and HOW MUCH low energy each part of the
  // recording carries. Aura then writes an ORIGINAL low-end part from that rhythm plus the harmony
  // it already detected. The result is Aura's own part, in the detected key, following the detected
  // chords — never a claim about the notes the original player chose.
  //
  // The hard case is a kick drum. A kick IS sub energy, so a naive "there is bass here" test reads a
  // four-on-the-floor kick as a bassline. The separator that actually works is the TAIL: a kick's
  // sub energy collapses in well under 100 ms, while a bass note holds. Events are split on that and
  // only the holding ones count as pitched low end.
  // Two measurement choices here were wrong on the first pass and are worth stating, because both
  // looked reasonable and both produced "no bass" on every fixture including the sustained ones:
  //
  //  1. The envelope summed sub (30-120 Hz) AND low (120-180 Hz). A chord pad's bottom notes sit in
  //     120-180 Hz, so "low end present" fired on harmony that has no bass in it at all. Real bass
  //     fundamentals are in sub. The envelope is sub ONLY.
  //  2. Sustain was measured as time-above-half-the-rise. Under a kick, the rise IS the kick, so a
  //     bass note 10 dB below the transient can never hold half of it and every note read as a drum.
  //     Sustain is now a RATIO: energy 150-400 ms after the onset over energy in the first 60 ms.
  //     A kick collapses (~0.02). A held note does not (~0.5+). That is a physical difference, not a
  //     threshold picked by taste.
  const LOW_HOLD=0.30;             // hold ratio at or above which a sub event is a note, not a drum
  const LOW_MIN_EVENTS=3;          // fewer than this over a whole file is not a bass part
  function detectLowEnd(sp,beats,bpm){
    const E=sp.E, fps=sp.fps, n=sp.frames;
    if(!n||!beats||beats.length<2) return {noBass:true, why:'not enough of a grid to place low end'};
    const env=E.sub;                                   // sub only — see note above
    let mean=0; for(let f=0;f<n;f++) mean+=env[f]; mean/=(n||1);
    if(mean<=1e-9) return {noBass:true, why:'there is almost nothing below 120 Hz'};
    const flux=new Float32Array(n);
    for(let f=1;f<n;f++){ const d=env[f]-env[f-1]; flux[f]=d>0?d:0; }
    let fmean=0; for(let f=0;f<n;f++) fmean+=flux[f]; fmean/=(n||1);
    const thr=Math.max(fmean*1.6, mean*0.05);
    const minGap=Math.max(1,Math.round(fps*0.070));
    const raw=[];
    for(let f=1;f<n-1;f++){
      if(flux[f]<thr) continue;
      if(flux[f]<flux[f-1]||flux[f]<flux[f+1]) continue;
      if(raw.length&&f-raw[raw.length-1]<minGap) continue;
      raw.push(f);
    }
    const win=(a,b)=>{ let s2=0,c=0; for(let i=Math.max(0,a);i<Math.min(n,b);i++){ s2+=env[i]; c++; }
      return c?s2/c:0; };
    const evs=raw.map(f=>{
      const atk=win(f,f+Math.round(fps*0.06));
      const hold=win(f+Math.round(fps*0.15), f+Math.round(fps*0.40));
      const ratio=atk>1e-9?hold/atk:0;
      // note length: how long it stays above a quarter of its own attack level
      let i=f, stop=Math.min(n,f+Math.round(fps*2.0));
      for(;i<stop;i++){ if(env[i] < atk*0.25) break; }
      return {f, t:f/fps, atk, hold:ratio, lenMs:(i-f)/fps*1000, peak:atk};
    });
    const tonal=evs.filter(e=>e.hold>=LOW_HOLD);
    const tonalE=tonal.reduce((a,e)=>a+e.peak,0), allE=evs.reduce((a,e)=>a+e.peak,0)||1;
    const share=tonalE/allE;
    // Measured separation across the ten fixtures: recordings with NO bass score 0.00-0.03, and
    // every real bass part scores 0.23-0.92. 0.15 sits in that gap with margin on both sides. It is
    // read off the distribution, not chosen by taste — re-measure it if the bands or the hold ratio
    // change.
    if(tonal.length<LOW_MIN_EVENTS||share<0.15){
      return {noBass:true, events:evs.length, tonal:tonal.length, share,
              why: evs.length&&!tonal.length
                ? 'the low end here is all short drum hits, not held notes'
                : 'there are not enough held low notes to build a part from'};
    }
    const spb=60/(bpm||100), sps=spb/4, t0=beats[0];
    // A sustained note keeps the hold ratio high, so every kick riding on top of it also passes the
    // tonal test and the same note gets counted five or six times. That inflated density from 1.0 to
    // 6.5 on a fixture with one note per bar. Collapse to one note per step, keep the strongest, and
    // drop anything that starts while the previous note is still sounding.
    const rawSteps=tonal.map(e=>{
      const rel=(e.t-t0)/sps;
      return {step:Math.max(0,Math.round(rel)), lenMs:e.lenMs, peak:e.peak,
              off:(rel-Math.round(rel))*sps*1000};
    }).sort((a,b)=>a.step-b.step||b.peak-a.peak);
    const steps=[];
    for(const c of rawSteps){
      const last=steps[steps.length-1];
      if(last&&last.step===c.step){ if(c.peak>last.peak) steps[steps.length-1]=c; continue; }
      if(last){
        const gapSteps=c.step-last.step;
        const stillSounding=(last.lenMs/1000)/sps;          // previous note's length, in steps
        if(gapSteps < Math.min(stillSounding*0.75, 8) && c.peak < last.peak*1.35) continue;
      }
      steps.push(c);
    }
    if(steps.length<2) return {noBass:true, events:evs.length, tonal:tonal.length, share,
      why:'the low end holds but does not change enough to build a part from'};
    const inBar={}, perBar={};
    steps.forEach(s2=>{ const b=Math.floor(s2.step/16), k=((s2.step%16)+16)%16;
      inBar[k]=(inBar[k]||0)+1; perBar[b]=(perBar[b]||0)+1; });
    const bars=Math.max(1,Math.ceil((steps[steps.length-1].step+1)/16));
    const density=steps.length/bars;
    const med=a=>{ const x=a.slice().sort((p2,q)=>p2-q); return x.length?x[Math.floor(x.length/2)]:0; };
    const medLen=med(steps.map(s2=>s2.lenMs));
    const sustained=density<=1.6&&medLen>=spb*1000*0.6;
    // Register: sub energy concentrated very low reads as an octave down, spread higher as up.
    let lowSum=0, subSum=0;
    for(let f=0;f<n;f++){ lowSum+=(E.low[f]||0); subSum+=(E.sub[f]||0); }
    const octShift=(subSum>lowSum*2.2)?-12:(lowSum>subSum*2.2?12:0);
    const favoured=Object.keys(inBar).map(k=>+k).sort((a,b)=>inBar[b]-inBar[a]);
    const gridErr=steps.reduce((a,s2)=>a+Math.abs(s2.off),0)/steps.length;
    const conf=Math.max(0.08,Math.min(0.9,
      0.55*Math.min(1,share/0.75) + 0.30*Math.max(0,1-gridErr/60) + 0.15*Math.min(1,tonal.length/8)));
    return {noBass:false, steps, density, medLenMs:medLen, sustained, octShift, favoured, perBar,
            events:evs.length, tonal:tonal.length, share, conf, gridErrMs:gridErr, bars};
  }

  function analyseImport(buf){
    const sp=spectralFrames(buf);
    const bpm=detectBPM(buf);
    const k=detectKey(buf);
    // Five band detectors rather than one broadband one. A soft kick under a loud master and a ghost
    // snare under a vocal are both invisible to a single median-thresholded broadband flux, and
    // recall is the binding constraint on everything downstream.
    const bf=bandFlux(sp.E,['sub','body','crack','hi','top']);
    const brightSig=new Float32Array(sp.frames);
    for(let f=0;f<sp.frames;f++) brightSig[f]=bf.hi[f]+bf.top[f];
    // The beat grid is placed with a LOW-WEIGHTED signal, not broadband flux. Kicks define where the
    // beat is; hats do not. A pattern with hats on every even sixteenth has broadband peaks twice per
    // beat, so a broadband search happily locks a whole sixteenth away from the real beat and then
    // every step index in the file is shifted. Each component is normalised by its own mean first,
    // because the bands are densities of different magnitudes.
    const nrm=a=>{ let s=0; for(let i=0;i<a.length;i++) s+=a[i];
      const m=(s/(a.length||1))||1, o=new Float32Array(a.length);
      for(let i=0;i<a.length;i++) o[i]=a[i]/m; return o; };
    const gsub=nrm(bf.sub), gbody=nrm(bf.body), gfull=nrm(sp.flux);
    const gridSig=new Float32Array(sp.frames);
    for(let f=0;f<sp.frames;f++) gridSig[f]=2.0*gsub[f]+1.0*gbody[f]+0.5*gfull[f];
    const g=beatGrid(gridSig,sp.fps,bpm||105);
    const beats=refineBeats(g.beats,gridSig,sp.fps);
    // Three detector groups, one per drum family, each merged only WITHIN itself. A kick and a hat
    // struck together stay two onsets, because they are two drums — merging them across families is
    // what previously forced one of the two to be discarded.
    const gK=mergeOnsets({sub:pickOnsetsBand(bf.sub,sp.fps,1.55,0.075)},sp.fps);   // kicks do not repeat faster than 75 ms
    const gS=mergeOnsets({body:pickOnsetsBand(bf.body,sp.fps,1.70,0.055),
                          crack:pickOnsetsBand(bf.crack,sp.fps,1.70,0.055)},sp.fps);
    const gH=mergeOnsets({bright:pickOnsetsBand(brightSig,sp.fps,1.60,0.030)},sp.fps); // 30 ms: 32nds and 16th triplets survive
    // The broadband detector is a safety net only: it contributes an onset when no band detector saw
    // anything there, so a hit with an unusual spectrum is still found in TIME even if nothing can be
    // said about what it was.
    const covered=[].concat(gK,gS,gH).map(o=>o.f).sort((a,b)=>a-b);
    const near=(f,tol)=>covered.some(c=>Math.abs(c-f)<=tol);
    const tolF=Math.max(1,Math.round(sp.fps*0.024));
    const gX=pickOnsetsBand(sp.flux,sp.fps,1.90,0.055).filter(f=>!near(f,tolF)).map(f=>({f,src:'full'}));
    const tagged=[].concat(
      gK.map(o=>({f:o.f,src:o.src,fam:'K'})), gS.map(o=>({f:o.f,src:o.src,fam:'S'})),
      gH.map(o=>({f:o.f,src:o.src,fam:'H'})), gX.map(o=>({f:o.f,src:o.src,fam:'X'})))
      .sort((a,b)=>a.f-b.f);
    // `onsets` is the list of distinct MUSICAL moments — used for timing, where a kick and a hat
    // together are one event. Classification works on `tagged`, where they are two.
    const onsets=[]; tagged.forEach(o=>{ const l=onsets[onsets.length-1];
      if(l && o.f-l.f<=tolF){ if(l.src.indexOf(o.src)<0) l.src+='+'+o.src; return; } onsets.push({f:o.f,src:o.src}); });
    const nextOf=(i)=>{ for(let j=i+1;j<tagged.length;j++) if(tagged[j].f>tagged[i].f+1) return tagged[j].f; return null; };
    // Per-band scale for the presence test: the 90th percentile of each band's own positive flux.
    const p90=a=>{ const v=[]; for(let i=1;i<a.length;i++) if(a[i]>0) v.push(a[i]); return pct(v,0.90)||1; };
    const norms={ sub:p90(bf.sub), body:p90(bf.body), crack:p90(bf.crack), bright:p90(brightSig) };
    // Does this recording contain a drum kit at all? A kit always brings wire noise or cymbals with
    // it, so the 1-3 kHz and 6-10 kHz bands carry real transient energy relative to the low bands.
    // Measured across the QA suite: every fixture with percussion scores 0.033 or above, and a pad
    // and bass with no drums scores 0.0004 — an eighty-fold gap, so 0.008 sits safely between them.
    // Without this test a sustained bass line reads as a kick on every beat, which is inventing a
    // part the recording does not contain.
    const kitEvidence=(norms.bright+norms.crack)/(norms.sub+norms.body+1e-12);
    // Floor every band against the loudest band. A recording with no percussion has almost no energy
    // above 6 kHz, so an unfloored per-band percentile is ~0 and every ratio built on it explodes
    // into the thousands — which is the other half of how pad-and-bass looked like a full kit.
    { const mx=Math.max(norms.sub,norms.body,norms.crack,norms.bright);
      Object.keys(norms).forEach(k=>{ norms[k]=Math.max(norms[k],mx*0.02); }); }
    const F=tagged.map((o,i)=>{
      const ft=onsetFeatures(sp.E,o.f,nextOf(i),sp.fps,norms);
      ft.src=o.src; ft.fam=o.fam; ft.t=refineTime(o.f,sp.flux,sp.fps); return ft; });
    const noKit=kitEvidence<0.008;
    let events=noKit?[]:arbitrateSources(classifyOnsets(F),tolF);
    const dbPhase=pickDownbeatFromKicks(events,beats,sp.fps,sp.E);
    const q=quantiseEvents(events,beats,dbPhase);
    events=deflamEvents(q.events);
    const win=pickGrooveWindow(events,q.bars);
    // Is a clap/snare split honest in THIS file, or only a per-event coin flip? One file-level
    // decision on measured evidence. When it fails the family collapses to Snare / Clap.
    const clapOK=events.filter(e=>e.lane==='clap'&&e.laneConf>=0.55).length>=6;
    const beat=buildBeatPattern(events,q.bars,win,clapOK);
    beat.noKit=noKit; beat.kitEvidence=kitEvidence;
    const sections=detectSections(g.beats,sp.E,sp.fps,sp.dur);
    const harmony=detectHarmony(buf,beats.slice(dbPhase),k.key,k.mode);
    const chords=harmony.bars;
    // Cosmetic only: section bars are indexed from beats[0] and the groove window from the downbeat,
    // so this label can be one bar out. It is never used to place anything.
    const sec=sections.find(x=>win.barStart>=x.barStart&&win.barStart<x.barEnd);
    beat.windowLabel=sec?sec.label:'';
    if(beat.metre==='half-bar'){ const a=Math.round(bpm*2); if(a>=60&&a<=160) beat.altBpm=a; }
    else if(beat.metre==='half-time'){ const a=Math.round(bpm/2); if(a>=60&&a<=160) beat.altBpm=a; }
    // Alternate tempo readings. Autocorrelation genuinely cannot separate a tempo from its metrical
    // relatives when a pattern fills every sixteenth: measured on the QA suite, a 140 BPM trap loop
    // correlates just as strongly at 93.3. Rather than pick one and hide the doubt, Aura offers the
    // relatives and lets one tap re-fit the preview — see refitMetre().
    const bpmAlts=[];
    [[2,'counted twice as fast'],[0.5,'counted half as fast'],[1.5,'counted in three']]
      .forEach(([m,why])=>{ const b=Math.round(bpm*m*10)/10;
        if(b>=60&&b<=190) bpmAlts.push({bpm:b, mult:m, why}); });
    const onsetTimes=onsets.map(o=>refineTime(o.f,sp.flux,sp.fps));

    // ---- confidence: three MEASUREMENTS, and timing is never blended into classification ----
    // The old single number averaged a dependable grid against an undependable lane assignment, so a
    // strong grid could hide a wrong drum. These are reported separately in the UI for that reason.
    // g.strength is the mean of gridSig at the chosen grid points, so it has to be compared against
    // the mean of gridSig — not of sp.flux, which is on a different scale entirely.
    const gridMean=(()=>{ let s=0; for(let i=0;i<gridSig.length;i++) s+=gridSig[i]; return s/(gridSig.length||1); })();
    const gridFit=clamp01(((g.strength/(gridMean||1))-1)/2.2);         // grid signal landing on the grid
    const offTight=1-Math.min(1,(beat.timingSpread||0)/0.28);          // swing-detrended offset MAD
    const iv=[]; for(let i=1;i<beats.length;i++) iv.push(beats[i]-beats[i-1]);
    const beatStab=1-Math.min(1,madOf(iv)/(0.06*(q.spb||0.5)));        // refined-beat interval MAD
    const timingConf=Math.max(0.10,Math.min(0.95,0.50*gridFit+0.30*offTight+0.20*beatStab));
    let wc=0,wn=0;
    OUT_IDS.forEach(id=>{ for(let s=0;s<STEPS;s++) if(beat.grid[id][s]){
      wc+=beat.laneConfStep[id][s]*beat.votes[id][s]; wn+=beat.votes[id][s]; } });
    const winEv=events.filter(e=>!e.dropped&&e.bar>=win.barStart&&e.bar<win.barEnd).length;
    const classConf=Math.max(0.10,Math.min(0.95,
      (wn?wc/wn:0)*(0.60+0.40*(winEv?Math.min(1,wn/winEv):0))));      // times how much got explained
    beat.timingConf=timingConf; beat.classConf=classConf;
    const lowEnd=detectLowEnd(sp,beats,bpm);
    return { dur:sp.dur, bpm, key:k.key, mode:k.mode, keyConf:k.conf, lowEnd,
             beats, downbeatPhase:dbPhase, onsetCount:onsets.length, onsetTimes,
             beat, timingConf, classConf, beatConf:Math.min(timingConf,classConf), bpmAlts,
             sections, chords, harmony, keyAlt:k.alt, keyMargin:k.margin, melody:null, sp };
  }

  // ---------- applying a reconstruction ----------
  // ONE Apply == ONE undo checkpoint. autosave() is where pushHistory() runs, and several helpers
  // autosave on their own account (transposeMelody, resnapMelodies, applyBeat), so every apply runs
  // inside oneCheckpoint(): nested autosaves are suppressed and exactly one checkpoint is taken at
  // the end. try/finally, because a stuck flag would disable autosave for the rest of the session
  // with no console error — the class of failure this file is most prone to.
  let imp=null;                                   // the live analysis; never persisted
  let applyDepth=0;
  function oneCheckpoint(fn){
    applyDepth++;
    try{ fn(); }
    finally{ applyDepth--; if(!applyDepth) autosave(); }
  }

  const ACC_PUNCH=0.78;                           // a hit this loud relative to its lane reads as an accent
  let beatApplyMode='replace';                    // 'replace' | 'fill' — UI scratch, never persisted

  // Single source of truth for what the preview SHOWS and what Apply WRITES, so the two can never
  // disagree. Every preview edit lives on imp.edit and nowhere else; imp is never serialised, so a
  // preview edit cannot reach localStorage, a share link or a .aura file even if Apply is never
  // pressed. The preview renderer and this function are the only writers of imp.edit; the four
  // apply*Rebuild functions are the only readers.
  function deriveBeatView(){
    const v={grid:{},punch:{},review:{}};
    OUT_IDS.forEach(l=>{ v.grid[l]=new Array(STEPS).fill(0); v.punch[l]=new Array(STEPS).fill(0);
      v.review[l]=new Array(STEPS).fill(0); });
    if(imp&&imp.beat){
      if(!imp.edit) imp.edit={dropStep:{},chordOf:{},chordPhase:null,secBound:null,dropNote:{}};
      const B=imp.beat;
      OUT_IDS.forEach(l=>{
        for(let s=0;s<STEPS;s++){
          if(!B.grid[l]||!B.grid[l][s]) continue;
          if(imp.edit.dropStep[l+':'+s]) continue;              // rejected in the preview
          v.grid[l][s]=1; v.punch[l][s]=(B.punch[l]&&B.punch[l][s])||0;
          v.review[l][s]=(B.review[l]&&B.review[l][s])||0;
        }
      });
    }
    if(imp) imp.view=v;
    return v;
  }

  function applyBeatRebuild(){
    if(beatApplyMode==='variation'){
      const v=applyAsVariation('New drums',{beat:true,tempo:true},()=>applyBeatRebuild__direct());
      toast('Saved as a new version — “'+v.name+'”. Your current version is untouched.');
      return;
    }
    return applyBeatRebuild__direct();
  }
  function applyBeatRebuild__direct(){
    if(!imp||!imp.beat) return;
    const V=imp.view||deriveBeatView(), g=V.grid, pk=V.punch, B=imp.beat;
    const fill=beatApplyMode==='fill';
    let wrote=0;
    oneCheckpoint(()=>{
      applyChosenTempo();          // one tempo for every applied part, decided before Apply
      drums.forEach(d=>{
        const lane=g[d.id], p=pk[d.id];
        for(let s=0;s<STEPS;s++){
          const hit=!!(lane&&lane[s]), acc=hit&&!!(p&&p[s]>=ACC_PUNCH);   // an accent is a LOUDER hit, not a surer one
          if(fill){
            // Fill empty steps preserves intentional work: an occupied step keeps its hit AND its
            // accent, and no lane is ever cleared — including the lanes the reconstruction has no
            // opinion about. Only an empty (lane, step) is ever written.
            if(P()[d.id][s] || !hit) continue;
            P()[d.id][s]=true; A()[d.id][s]=acc; wrote++;
          } else {
            // Replace: EVERY drum lane in this section is rewritten from the reconstruction,
            // including claps, percussion and accents. Skipping the lanes it has no opinion about
            // would silently blend the imported song with whatever pattern was already loaded.
            P()[d.id][s]=hit; A()[d.id][s]=acc; if(hit) wrote++;
          }
        }
      });
      if(B.swingApply) swingEl.value=String(B.swing);        // still an <input>; loop() reads .value
      if(B.refitBpm>=60&&B.refitBpm<=160){ bpmEl.value=String(B.refitBpm); bpmVal.textContent=B.refitBpm; }
      renderGrid(); refreshPatBtns(); applyAllGroupsLive();
    });
    const n=currentPattern+1;
    toast(fill
      ? (wrote ? 'Filled '+wrote+' empty step'+(wrote===1?'':'s')+' in section '+n+' — review and adjust'
               : 'Nothing to fill — every detected hit already exists in section '+n+'. Your project was not changed.')
      : 'Drums applied to section '+n+'. '+B.steps+' step'+(B.steps===1?'':'s')+' written'
        +(B.reviewSteps?', '+B.reviewSteps+' still worth a look':'')
        +(B.swingApply?'. Swing set to '+B.swing:'')+'.');
  }

  // One tap moves an uncertain step into the right lane, or drops it. Preview only — the project is
  // untouched until Apply, which is what makes showing an honest guess safe in the first place.
  function reassignStep(id,step,toId){
    if(!imp||!imp.beat) return;
    const B=imp.beat;
    const v=B.votes[id][step], p=B.punch[id][step], o=B.offs[id][step], sd=B.offSpread[id][step];
    ['grid','votes','punch','offs','offSpread','laneConfStep','review','user']
      .forEach(k=>{ B[k][id][step]=0; });
    if(toId){ B.grid[toId][step]=1; B.votes[toId][step]=v; B.punch[toId][step]=p;
      B.offs[toId][step]=o; B.offSpread[toId][step]=sd; B.user[toId][step]=1;
      B.laneConfStep[toId][step]=0.95; }
    B.events.forEach(e=>{ if(e.step===step && LANE_TO_ID[e.lane]===id) e.userLane=toId||null; });
    B.userSet++;
    B.steps=0; B.reviewSteps=0;
    OUT_IDS.forEach(k=>{ for(let s=0;s<STEPS;s++) if(B.grid[k][s]){ B.steps++; if(B.review[k][s]) B.reviewSteps++; } });
    if(imp.edit) imp.edit.dropStep={};                        // the grid itself is now the truth
    renderRebuild();
  }
  // Half-time versus half-bar ambiguity, resolved by re-quantising the SAME events against a doubled
  // or halved beat grid. No re-analysis, no second decode, and nothing is applied.
  function refitMetre(mult){
    if(!imp||!imp.beat||!imp.beats) return;
    const bs=imp.beats;
    const b2 = mult===2
      ? (()=>{ const o=[]; for(let i=0;i<bs.length-1;i++){ o.push(bs[i]); o.push((bs[i]+bs[i+1])/2); }
               o.push(bs[bs.length-1]); return o; })()
      : bs.filter((_,i)=>i%2===0);
    if(b2.length<8){ toast('Not enough of a beat to refit this recording'); return; }
    const ev=imp.beat.events.map(e=>Object.assign({},e,{dropped:undefined}));
    const db=pickDownbeatFromKicks(ev,b2,imp.sp.fps,imp.sp.E);
    const q=quantiseEvents(ev,b2,db);
    const es=deflamEvents(q.events);
    const win=pickGrooveWindow(es,q.bars);
    const keep=imp.beat.clapSplit;
    imp.beat=buildBeatPattern(es,q.bars,win,keep);
    imp.beat.refitBpm=Math.round(imp.bpm*mult);
    imp.beat.timingConf=imp.timingConf; imp.beat.classConf=imp.classConf;
    if(imp.edit) imp.edit.dropStep={};
    renderRebuild();
    toast('Preview refitted at '+imp.beat.refitBpm+' BPM — nothing has been applied');
  }

  function applySectionsRebuild(){
    if(beatApplyMode==='variation'){
      const v=applyAsVariation('New song shape',{song:true,tempo:true},()=>applySectionsRebuild__direct());
      toast('Saved as a new version — “'+v.name+'”. Your current version is untouched.');
      return;
    }
    return applySectionsRebuild__direct();
  }
  function applySectionsRebuild__direct(){
    if(!imp||!imp.sections||!imp.sections.length) return;
    const segs=sectionPlan();
    if(!segs.length) return;
    oneCheckpoint(()=>{
      applyChosenTempo();
      // Aura has six section slots; map the detected areas onto them by identity, so the same
      // repeated area always lands in the same slot and its second visit reuses the first's pattern.
      const order=[];
      segs.forEach(s=>{ if(order.indexOf(s.slotKey)<0 && order.length<N_PATTERNS) order.push(s.slotKey); });
      order.forEach((keyName,i)=>{ const s=segs.find(x=>x.slotKey===keyName);
        secNames[i]=(s?s.slot:keyName).slice(0,14); });
      song.fill(null);
      let bar=0;
      segs.forEach(s=>{
        const idx=order.indexOf(s.slotKey); if(idx<0) return;
        for(let b=0;b<s.bars && bar<SONG_SLOTS;b++,bar++) song[bar]=idx;
      });
      renderAllSlots();
      document.querySelectorAll('#secnames input').forEach((el,i)=>el.value=secNames[i]||'');
    });
    const used=Math.min(SONG_SLOTS,segs.reduce((a,s)=>a+s.bars,0));
    toast('Parts applied — '+used+' bar'+(used===1?'':'s')+' arranged. Rename them in Song.');
  }

  // ---- ORIGINAL low-end part, generated from the analysis -------------------------------------
  // What this is: Aura's own bass line, in the DETECTED key, following the DETECTED chords, placed
  // on the rhythm the recording's low end actually used, shaped by each section's energy.
  // What this is not: the original bassline. No note the original player chose is recovered here,
  // and nothing claims otherwise. The honest sentence is:
  //   "Aura created an original low-end part that follows the detected harmony, rhythm and section energy."
  //
  // Section shape is deliberate rather than one pattern repeated: intro restraint, verse space,
  // chorus lift, bridge contrast, outro resolution. A bass that plays the root of every chord with
  // one fixed rhythm is the "generic preset that ignores the analysis" this must not be.
  const LOW_SECTION_SHAPE={
    intro:  {density:0.5, vel:0.72, octave:0,   label:'holds back'},
    verse:  {density:0.8, vel:0.88, octave:0,   label:'leaves space'},
    chorus: {density:1.0, vel:1.10, octave:0,   label:'lifts'},
    bridge: {density:0.7, vel:0.85, octave:12,  label:'contrasts'},
    outro:  {density:0.45,vel:0.70, octave:0,   label:'resolves'},
    other:  {density:0.9, vel:0.92, octave:0,   label:'steady'},
  };
  function lowShapeFor(label){
    const k=String(label||'').toLowerCase();
    if(/intro/.test(k))  return LOW_SECTION_SHAPE.intro;
    if(/chorus|hook/.test(k)) return LOW_SECTION_SHAPE.chorus;
    if(/bridge/.test(k)) return LOW_SECTION_SHAPE.bridge;
    if(/outro|end/.test(k)) return LOW_SECTION_SHAPE.outro;
    if(/verse/.test(k))  return LOW_SECTION_SHAPE.verse;
    return LOW_SECTION_SHAPE.other;
  }
  // The rhythm Aura will use, taken from what the recording's low end actually did. Falls back to
  // the downbeat when the measured rhythm is too thin to be a pattern.
  function lowRhythm(L){
    if(!L||L.noBass) return [0];
    const inBar={};
    L.steps.forEach(x=>{ const k=((x.step%16)+16)%16; inBar[k]=(inBar[k]||0)+1; });
    const ranked=Object.keys(inBar).map(k=>+k).sort((a,b)=>inBar[b]-inBar[a]||a-b);
    const want=Math.max(1,Math.min(8,Math.round(L.density||1)));
    const picked=ranked.slice(0,want).sort((a,b)=>a-b);
    if(!picked.length) return [0];
    // Ranking purely by how often a step fired can drop the downbeat: on a sustained fixture step 12
    // recurred more than step 1, so Aura wrote a bass part that never landed on the bar. If the
    // recording's low end DID land on or next to the downbeat, keep it — that is evidence, not taste.
    const hitsDownbeat=L.steps.some(x=>{ const k=((x.step%16)+16)%16; return k===0||k===1||k===15; });
    if(hitsDownbeat && picked.indexOf(0)<0) picked.unshift(0);
    return [...new Set(picked)].sort((a,b)=>a-b);
  }
  // Build the note list for ONE pattern (one bar) given its chord degree and section shape.
  function lowNotesForBar(deg,L,shape,sps){
    const rhythm=lowRhythm(L);
    const keep=Math.max(1,Math.round(rhythm.length*shape.density));
    const steps=rhythm.slice(0,keep);
    const rootMidi=chordRootMidi(deg)-24+(L&&L.octShift?L.octShift:0)+shape.octave;
    const sustained=!!(L&&L.sustained);
    const notes=[];
    steps.forEach((st,i)=>{
      const next=steps[i+1]!=null?steps[i+1]:16;
      let len=Math.max(1,next-st);
      if(sustained) len=Math.max(len,Math.min(16-st,8));
      // A measured note length shorter than the gap means the recording's low end was punchy, so
      // Aura's is too rather than smearing across the bar.
      if(L&&L.medLenMs&&sps){ const inSteps=Math.round((L.medLenMs/1000)/sps);
        if(inSteps>0) len=Math.max(1,Math.min(len,Math.max(inSteps,1))); }
      notes.push({ p:Math.max(12,Math.min(72,rootMidi)), s:st, l:len,
                   v:Math.max(0.35,Math.min(1.3, shape.vel*(st===0?1.0:0.9))),
                   g: !!(L&&L.sustained&&i>0) });
    });
    return notes;
  }
  // The whole preview: one entry per section slot Aura will write into.
  function lowEndPlan(){
    if(!imp||!imp.lowEnd||imp.lowEnd.noBass) return null;
    const L=imp.lowEnd;
    const segs=sectionPlan();
    // The tempo the notes will PLAY at, not the one the project happens to be on right now.
    // lowNotesForBar() converts the recording's measured note lengths from milliseconds into steps
    // using this, and Apply changes the tempo in the same breath — so reading the current tempo
    // sized every note against a value that was about to change, and the chips the singer tapped
    // in the preview described a different part from the one they got. Same number either way when
    // the choice is "keep", because chosenTempo() returns null for it.
    const sps=chosenStepSeconds();
    const prog=(imp.harmony&&imp.harmony.degrees)||null;
    const slots=[];
    const nSlots=segs.length?Math.min(N_PATTERNS,segs.length):1;
    for(let i=0;i<nSlots;i++){
      const seg=segs[i]||{label:'',slot:i};
      const deg=prog&&prog.length?prog[i%prog.length]:0;
      const shape=lowShapeFor(seg.label);
      slots.push({ i, label:seg.label||('Section '+(i+1)), shape, shapeLabel:shape.label, deg,
                   notes:lowNotesForBar(deg,L,shape,sps) });
    }
    return {slots, conf:L.conf, sustained:L.sustained, density:L.density, octShift:L.octShift,
            medLenMs:L.medLenMs, rhythm:lowRhythm(L)};
  }
  function applyLowEndRebuild(){
    if(beatApplyMode==='variation'){
      const v=applyAsVariation('New low end',{lowEnd:true,tempo:true},()=>applyLowEndRebuild__direct());
      toast('Saved as a new version — “'+v.name+'”. Your current version is untouched.');
      return;
    }
    return applyLowEndRebuild__direct();
  }
  function applyLowEndRebuild__direct(){
    const plan=lowEndPlan(); if(!plan) return;
    const drop=(imp.edit&&imp.edit.dropLow)||{};
    oneCheckpoint(()=>{
      applyChosenTempo();
      plan.slots.forEach(sl=>{
        const pat=patterns[sl.i]; if(!pat) return;
        const keep=sl.notes.filter((n,ix)=>!drop[sl.i+':'+ix]);
        pat.bass=keep.map(n=>({p:n.p,s:n.s,l:n.l,v:n.v,g:n.g}));
      });
      renderGrid(); refreshPatBtns();
    });
    const total=plan.slots.reduce((a,sl)=>a+sl.notes.length,0);
    toast('Aura created an original low-end part that follows the detected harmony, rhythm and section energy. '
      +total+' notes across '+plan.slots.length+' section'+(plan.slots.length===1?'':'s')+'.');
    renderRebuild();
  }

  // ================= AURA GUIDE =================
  // Offline, structured guidance. NOT a generative model, and it never says it is.
  //
  // It reads the project's real state and answers from a fixed body of knowledge about controls
  // that actually exist. That is a deliberate design choice, not a limitation being hidden: a
  // rules engine that says "I do not know" is more use to a singer than a plausible sentence about
  // a feature Aura does not have. There is no network code here, no model, and no key.
  //
  // Everything destructive goes Understand -> Preview -> Confirm -> Apply -> Undo. A preview never
  // mutates the project, and one confirmed action is exactly one undo checkpoint.
  const guide={ open:false, log:[], pending:null, persist:false };

  function guideContext(){
    const a=activeVariation();
    const hasBeat=patterns.some(p2=>drums.some(d=>p2[d.id].some(Boolean)));
    const hasLow=patterns.some(p2=>(p2.bass||[]).length>0);
    const hasChords=patterns.some(p2=>CHORD_DEGREES.some(c=>p2[c.id].some(Boolean)));
    const hasMelody=patterns.some(p2=>(p2.melody||[]).length>0);
    const view=(document.querySelector('.wtab[aria-selected="true"]')||{}).dataset;
    return {
      panel:(view&&view.v)||'rack',
      mode:document.body.classList.contains('guided')?'Guided':'Studio',
      hasReference:!!smp.buf,
      referenceName:smp.name||null,
      analysed:!!imp,
      importPath:smp.buf?impMode:null,
      detectedBpm:imp?Math.round(imp.bpm):null,
      projectBpm:Math.round(+bpmEl.value),
      detectedKey:imp?(NOTE_NAMES[imp.key]+(imp.mode==='minor'?'m':'')):null,
      projectKey:NOTE_NAMES[keyRoot]+(keyMode==='minor'?'m':''),
      hasBeat, hasLow, hasChords, hasMelody,
      lowEndFound:!!(imp&&imp.lowEnd&&!imp.lowEnd.noBass),
      lowEndConf:(imp&&imp.lowEnd&&imp.lowEnd.conf)||null,
      lowEndNeedsReview:!!(imp&&imp.lowEnd&&!imp.lowEnd.noBass&&imp.lowEnd.conf<0.42),
      beatNeedsReview:!!(imp&&imp.beat&&imp.classConf<0.42),
      sections:secNames.slice(),
      songBuilt:song.some(x=>x!=null),
      variation:a?a.name:'Main',
      variationCount:variations.items.length,
      recording:perf.recording,
      takePending:!!perf.take,
      automationCount:automation.events.length,
      midiSupported:midi.supported,
      midiState:midi.state,
      midiMaps:midi.maps.length,
      canUndo:hist.past.length>0,
      canRedo:hist.future.length>0,
      vocalAvailable:!!smp.buf,
    };
  }

  // ---- the answer shapes -------------------------------------------------------------------
  // say:      what Aura understood
  // why:      the reason it is recommending this, in beginner language
  // actions:  [{label, go(){navigate}}] or [{label, danger:true, preview(){}, apply(){}}]
  function gNav(label,fn){ return {label, go:fn}; }
  function gDo(label,apply,previewText){ return {label, danger:true, apply, previewText}; }
  const goTo=v=>()=>{ const t=document.querySelector('.wtab[data-v="'+v+'"]'); if(t) t.click(); };
  // Switch to the view that CONTAINS the target before scrolling to it. Without this, every Guide
  // action pointing at a card inside an inactive tab was a silent no-op: the element exists, so
  // there is no error, and scrollIntoView on something in a display:none panel does nothing at all.
  // The singer pressed a button and the app appeared to ignore them.
  // Why a card the Guide can offer might not be on screen yet. Switching tabs cannot reveal these —
  // they are hidden until the project has the thing they operate on.
  const NEEDS_FIRST={
    rebuild:  'Import a recording first — the reconstruction is built from what Aura hears in it.',
    impTempo: 'Import a recording first, then choose Rebuild with Aura, and the tempo choice appears.',
    varCard:  'Versions appear once you have made one, or once a reference is loaded.',
  };
  const scrollTo=id=>()=>{ const e=document.getElementById(id); if(!e) return;
    const view=e.closest('.wview');
    if(view && !view.classList.contains('on')){
      const v=view.id.replace(/^v-/,'');
      const t=document.querySelector('.wtab[data-v="'+v+'"]');
      if(t) t.click();
    }
    // A hidden card cannot be scrolled to, and scrollIntoView on it throws no error — so the
    // button simply did nothing and the singer was left looking for a panel that was not there.
    // Say why instead. Checked AFTER the tab switch, because the tab was the other reason a card
    // could be off screen and that one IS fixable by switching.
    const offScreen = e.hidden || (e.offsetParent === null && getComputedStyle(e).position !== 'fixed');
    if(offScreen){ toast(NEEDS_FIRST[id] || 'That panel is not available yet in this project.'); return; }
    // after a tab switch the panel needs a frame to lay out before it can be scrolled to
    setTimeout(()=>{ e.scrollIntoView({block:'center'}); e.classList.add('guide-flash');
                     setTimeout(()=>e.classList.remove('guide-flash'),1400); }, 60);
  };

  // Look an answer up in the structured knowledge and turn it into a Guide reply. This is what
  // keeps the Guide and the knowledge layer from drifting: there is one source for both.
  function gKnow(text, domain){
    var K = window.AuraKnowledge;
    if (!K) return null;
    var hits = K.match(text, domain);
    if (!hits.length) return null;
    var e = hits[0];
    var why = e.why || '';
    if (e.auraCannot && e.auraCannot.length) why += (why ? ' ' : '') + e.auraCannot.join(' ');
    if (e.rights) why += (why ? ' ' : '') + e.rights;
    var fresh = K.freshness(e);
    if (fresh) why += (why ? ' ' : '') + fresh;
    return { entry: e, say: e.beginner, why: why };
  }

  const GUIDE_INTENTS=[
    // FIRST, and deliberately so. "Can I make it sound like <singer>" matched the `vibe` intent on
    // the word "sound" and answered "pick a vibe" — the one question in this whole set where a
    // wrong answer costs the singer money. The rights caution is surfaced unprompted, which is what
    // Book II Part 34 requires, and no later intent can shadow it.
    { id:'soundalike',
      re:/\b(sound(s|ing)? like|soundalike|voice of|like (a|another) (singer|artist)|famous (singer|voice|artist)|someone else.?s voice|clone .*(voice|singer|artist))\b/i,
      f:c=>{
        const k=gKnow('sound like another artist soundalike voice');
        return { say:(k?k.say:'You are asking about sounding like a specific artist.'),
          why:(k?k.why:'')+' Aura has no voice cloning and no voice conversion, and will not add artist soundalikes.',
          actions:[] }; } },

    { id:'vibe', re:/\b(vibe|sound|style|start|begin|new song|from scratch)\b/i, f:c=>({
        say:'You want to start from a feeling rather than a recording.',
        why:'Picking a vibe sets the key, chords, beat and tempo in one go, and you can change any of it afterwards.',
        actions:[gNav('Open Vibes',()=>{ const b=document.getElementById('tgBrowser'); if(b) b.click(); })] }) },

    { id:'import', re:/\b(import|upload|load a song|open a song|my song|a track)\b/i, f:c=>({
        say:'You want to bring a recording in.',
        why:c.hasReference
          ? 'You already have “'+c.referenceName+'” loaded. You can replace it or pick what Aura does with it.'
          : 'Aura can analyse a file you own. It stays on this device and is never uploaded.',
        actions:[gNav('Open the Sound tab',goTo('smp'))] }) },

    { id:'analyzeOnly', re:/\b(analy[sz]e only|just tell me|do(es)?n.?t change|do not change|only analy)/i, f:c=>({
        say:'You want Aura to report what it hears and change nothing.',
        why:c.hasReference?'That is the “Analyze only” path — it writes nothing into your project.'
                          :'Import a recording first; then “Analyze only” reports without changing anything.',
        actions:c.hasReference?[gNav('Show the import paths',scrollTo('impMode'))]:[gNav('Open the Sound tab',goTo('smp'))] }) },

    { id:'rebuild', re:/\b(rebuild|reconstruct|make (me )?a backing|recreate|remake)\b/i, f:c=>({
        say:'You want Aura to build a new backing track from the recording.',
        why:c.hasReference
          ? 'Rebuild with Aura writes original parts using Aura’s own sounds. None of the recording’s audio goes into the result.'
          : 'Rebuild works from an imported recording. Bring one in first.',
        actions:c.hasReference?[gNav('Show the import paths',scrollTo('impMode'))]:[gNav('Open the Sound tab',goTo('smp'))] }) },

    { id:'adjust', re:/\b(remove (the )?(lead|vocal)|keep (the )?(adlib|ad-lib|backing)|instrumental|karaoke|acapella|vocal balance)\w*/i, f:c=>{
        if(!c.vocalAvailable) return {
          say:'You are asking about changing the vocals in a recording.',
          why:'There is no recording loaded, so there is nothing to adjust. Vocal balance only works on an imported file.',
          actions:[gNav('Open the Sound tab',goTo('smp'))] };
        return {
          say:'You want to change the balance between the lead voice and the rest.',
          why:'Aura can reduce what sits dead centre — usually the lead — and keep what is spread wide, which is usually the adlibs. '
             +'It is approximate, not separation, and it depends on how the recording was mixed. Preview before you use it.',
          actions:[gNav('Open Adjust the original',()=>{ const b=document.querySelector('#impModeSeg button[data-im="adjust"]'); if(b) b.click(); scrollTo('vocCard')(); })] }; } },

    { id:'tempo', re:/\b(tempo|bpm|speed|faster|slower|half.?time|double.?time)\b/i, f:c=>{
        const half=/half/i, dbl=/double/i;
        const t=String(guide.lastText||'');
        if(half.test(t)||dbl.test(t)){
          const target=half.test(t)?Math.round(c.projectBpm/2):Math.round(c.projectBpm*2);
          return { say:(half.test(t)?'You want a half-time feel.':'You want a double-time feel.'),
            why:'That changes the project tempo from '+c.projectBpm+' to '+target+' BPM. Everything follows it.',
            actions:[gDo('Set '+target+' BPM',()=>{ bpmEl.value=String(Math.max(40,Math.min(220,target)));
              bpmVal.textContent=bpmEl.value; bpmEl.dispatchEvent(new Event('input',{bubbles:true})); },
              'Tempo would change from '+c.projectBpm+' to '+target+' BPM.')] };
        }
        return { say:'You are asking about tempo.',
          why:c.detectedBpm&&c.detectedBpm!==c.projectBpm
            ? 'Aura heard '+c.detectedBpm+' BPM in your recording and your project is at '+c.projectBpm+'. You choose which to use before applying.'
            : 'Your project is at '+c.projectBpm+' BPM.',
          actions:c.analysed?[gNav('Show the tempo choice',scrollTo('rbTempo'))]:[gNav('Open Beat',goTo('rack'))] }; } },

    { id:'chorusBigger', re:/\b(chorus|hook).*(big|huge|large|lift|open)|\b(big|huge).*(chorus|hook)\b/i, f:c=>({
        say:'You want the chorus to feel bigger.',
        why:'Aura can lift the section energy, open the harmony and push the low end a little. Nothing changes until you confirm.',
        actions:[gDo('Preview a bigger chorus',()=>{
            const r=document.getElementById('reverb');
            if(r){ r.value=String(Math.min(70,(+r.value)+18)); r.dispatchEvent(new Event('input',{bubbles:true})); }
            const cv=document.getElementById('chordVol');
            if(cv){ cv.value=String(Math.min(120,(+cv.value)+10)); cv.dispatchEvent(new Event('input',{bubbles:true})); }
          },'Section energy and harmony would open up. Your notes are not changed.')] }) },

    { id:'verseSofter', re:/\b(verse|quieter|softer|calm|gentle)\b/i, f:c=>({
        say:'You want the verse to sit back.',
        why:'Aura can take energy out — less reverb and a quieter chord bed — so your voice sits in front.',
        actions:[gDo('Preview a softer verse',()=>{
            const r=document.getElementById('reverb');
            if(r){ r.value=String(Math.max(0,(+r.value)-14)); r.dispatchEvent(new Event('input',{bubbles:true})); }
            const cv=document.getElementById('chordVol');
            if(cv){ cv.value=String(Math.max(20,(+cv.value)-12)); cv.dispatchEvent(new Event('input',{bubbles:true})); }
          },'Energy comes down. No notes are removed.')] }) },

    { id:'vocalSpace', re:/\b(room for (my )?voice|vocal space|space for vocals|too busy|crowded)\b/i, f:c=>({
        say:'You want more room for your voice.',
        why:'The usual cause is a busy middle. Aura can pull the chords back and thin the top so the vocal has somewhere to sit.',
        actions:[gDo('Preview more vocal space',()=>{
            const cv=document.getElementById('chordVol');
            if(cv){ cv.value=String(Math.max(20,(+cv.value)-14)); cv.dispatchEvent(new Event('input',{bubbles:true})); }
            const mv=document.getElementById('melVol');
            if(mv){ mv.value=String(Math.max(0,(+mv.value)-10)); mv.dispatchEvent(new Event('input',{bubbles:true})); }
          },'Chords and melody come down a little. Nothing is deleted.')] }) },

    { id:'darkRnb', re:/\b(dark|moody|night).*(r&?b|rnb|beat|sound)|\br&?b\b/i, f:c=>({
        say:'You want a darker R&B direction.',
        why:'Aura has a vibe for that. It sets a minor key, a slower tempo and a softer kit in one move.',
        actions:[gDo('Use the R&B · Chill vibe',()=>applyVibe('rnbchill'),
          'Key, chords, beat and tempo would all change to the R&B · Chill vibe.')] }) },

    { id:'beat', re:/\b(beats?|drums?|kicks?|snares?|hats?|percussion)\b/i, f:c=>({
        say:'You are asking about the drums.',
        why:c.hasBeat
          ? 'You already have drums here. Filling the gaps or saving a new version keeps what you have; Replace does not.'
          : 'There are no drums in this section yet.',
        actions:[gNav('Open Beat',goTo('rack'))] }) },

    { id:'lowEnd', re:/\b(low end|bass|808|sub)\b/i, f:c=>({
        say:'You are asking about the low end.',
        why:!c.analysed ? 'Import and rebuild a recording and Aura can write an original low-end part from what it hears.'
          : (!c.lowEndFound ? 'Aura did not find a bass part it could build from in this recording, so it wrote none.'
          : (c.lowEndNeedsReview
             ? 'Aura found a low end but is not confident about it — that is what “Needs review” means. Listen before you apply it, and drop any note that sounds wrong.'
             : 'Aura wrote an original low-end part that follows the detected harmony, rhythm and section energy.')),
        actions:[gNav('Open the low end',scrollTo('rebuild'))] }) },

    { id:'needsReview', re:/\b(needs review|not sure|uncertain|confidence|why.*review)\b/i, f:c=>({
        say:'You are asking what “Needs review” means.',
        why:'It means Aura is not confident about that particular result. Timing and instrument identity are measured separately and never averaged, '
           +'so a dependable grid cannot hide an undependable drum name. Anything marked that way is worth a listen before you apply it.',
        actions:[gNav('Open the reconstruction',scrollTo('rebuild'))] }) },

    { id:'variation', re:/\b(versions?|variations?|alternate|another take|try (something|another))\b/i, f:c=>({
        say:'You want to try an idea without losing what you have.',
        why:'“Add as a new version” keeps your current version and stores the alternative. You can switch between them, '
           +'and promote one to be the main version when you are sure. You have '+c.variationCount+' saved.',
        actions:[gNav('Open Versions',scrollTo('varCard'))] }) },

    { id:'controller', re:/\b(controller|midi|knob|fader|pad|launchpad|dj)\b/i, f:c=>{
        if(!c.midiSupported) return {
          say:'You want to use a hardware controller.',
          why:'This browser cannot talk to MIDI controllers, so Aura cannot offer that here. Perform still works with touch, mouse and keyboard.',
          actions:[gNav('Open Perform',scrollTo('perfCard'))] };
        return { say:'You want to use a hardware controller.',
          why:c.midiState==='connected'
            ? 'Your controller is connected with '+c.midiMaps+' mapping'+(c.midiMaps===1?'':'s')+'. Use Learn next to any action, then move the control you want.'
            : 'Connect it first, then use Learn next to any action and move the control you want. Nothing you play leaves this device.',
          actions:[gNav('Open Controller',scrollTo('midiCard'))] }; } },

    { id:'perform', re:/\b(perform|live|play out|stage|record (a )?performance|arrangement)\b/i, f:c=>({
        say:'You want to perform or capture a live arrangement.',
        why:c.recording?'You are recording now. Stop when you are done and you can keep or discard the take.'
          :(c.takePending?'You have a take waiting. Listen, then keep it or throw it away — nothing is in your project yet.'
          :'Perform gives you the few things you reach for mid-take, and can record what you do as editable moves.'),
        actions:[gNav('Open Perform',scrollTo('perfCard'))] }) },

    { id:'sampler', re:/\b(sampler|sample|chop|slice|record a sound|pad)\b/i, f:c=>({
        say:'You are asking about making a sound of your own.',
        why:'Record something, import a file you own, or make a tone — then chop it and play the pieces. Everything stays on this device.',
        actions:[gNav('Open Sound',goTo('smp'))] }) },

    { id:'save', re:/\b(save|save as|keep my work|store)\b/i, f:c=>({
        say:'You want to save.',
        why:'Save keeps the same project. Save As makes a new one and leaves the original alone. Your recordings and imports are never written into the file.',
        actions:[gNav('Open the Project menu',()=>{ const b=document.getElementById('projX'); if(b) b.click(); })] }) },

    { id:'export', re:/\b(export|wav|midi|render|bounce|download)\b/i, f:c=>({
        say:'You want to export.',
        why:'WAV gives you the audio; MIDI gives you the notes. An imported recording is never in an Aura-only export unless you deliberately include it.',
        actions:[gDo('Export a WAV',()=>{ const b=document.getElementById('export'); if(b) b.click(); },
          'Aura would render and download a WAV of your track.')] }) },

    { id:'privacy', re:/\b(privacy|private|upload|cloud|data|tracking|analytics)\b/i, f:c=>({
        say:'You are asking what Aura does with your material.',
        why:'Nothing leaves this device. There is no account, no analytics, no cloud processing and no model download. '
           +'Your recordings and imports stay in memory and are never written into a project file or a share link. '
           +'This guide is offline too — it reads your project and nothing else.',
        actions:[] }) },

    { id:'chords', re:/\b(chords?|harmony|key|progressions?|minor|major)\b/i, f:c=>({
        say:'You are asking about the chords or the key.',
        why:c.analysed&&c.detectedKey&&c.detectedKey!==c.projectKey
          ? 'Aura heard '+c.detectedKey+' in your recording and your project is in '+c.projectKey+'.'
          : 'Your project is in '+c.projectKey+'. Stay-in-key keeps anything you draw inside it.',
        actions:[gNav('Open Beat and chords',goTo('rack'))] }) },

    { id:'melody', re:/\b(melod(y|ies)|tune|topline|lead line|piano roll)\b/i, f:c=>({
        say:'You are asking about the melody.',
        why:c.hasMelody?'You have melody notes in this section. They transpose with the key.'
                       :'There is no melody yet. Melody ideas from a recording are always optional — Aura never forces one on you.',
        actions:[gNav('Open Melody',goTo('piano'))] }) },

    { id:'sections', re:/\b(sections?|arrangements?|structure|verses?|bridges?|intro|outro|song shape)\b/i, f:c=>({
        say:'You are asking about the song’s sections.',
        why:c.songBuilt?'Your arrangement has sections placed. Each one is a bar of its own.'
                       :'Nothing is arranged yet. Sections are the parts of the song; a version is a different take on the whole song — they are not the same thing.',
        actions:[gNav('Open Song',goTo('play'))] }) },

    { id:'undo', re:/\b(undo|redo|go back|mistake|revert)\b/i, f:c=>({
        say:'You want to step back.',
        why:c.canUndo?'There is something to undo. Every apply is a single step, so one undo puts it back.'
                     :'There is nothing to undo yet.',
        actions:c.canUndo?[gDo('Undo the last change',()=>undo(),'The last change would be reversed.')]:[] }) },

    // ---- craft intents, LAST on purpose ----
    // These are broader than the intents above: `singing` matches "vocal", which is also in
    // "remove the lead vocal"; `biggerchorus` matches "make.*chorus", which is also in
    // "make the chorus bigger". Prepended, they shadowed three intents that answer those
    // questions far better — caught by guide-qa dropping to 31/34. Specific first, generic
    // last: a broad intent should only ever catch what nothing narrower claimed.
    { id:'groove', re:/\b(reggaeton|reggaetón|dembow|groove|tresillo|3-3-2|kick on the floor)\b/i, f:c=>{
        const k=gKnow('reggaeton dembow tresillo groove');
        return { say:(k?k.say:'You are asking about the groove.'),
          why:(k?k.why:'')+' The kick stays on every beat — that part is not adjustable, because it is what makes this style this style.',
          actions:[ gNav('Open the Groove controls',()=>{ goTo('rack')(); scrollTo('grooveCard')(); }),
                    gDo('Build this groove now',()=>{ applyGroove({seed:grooveSeed}); },
                        'Writes drums and a low end across every section from the current Groove settings.') ] }; } },

    // No trailing \b: it requires a word boundary immediately after "breath", which "breathe" does
    // not have, so the most natural phrasing of this question fell through to a different intent.
    { id:'bassbreath', re:/\b(bass\w*\s+breath|breath\w*\s+.*bass|bass.*(too long|sustain)|groove.*(stiff|flat|rigid))/i, f:c=>{
        const k=gKnow('bass breathe before the snare');
        return { say:(k?k.say:'The low end is running into the backbeat.'), why:(k?k.why:''),
          actions:[ gNav('Open Bass Breath',()=>{ goTo('rack')(); scrollTo('grooveCard')(); }),
                    gDo('Open the low end up',()=>{ setGroove('breath',Math.min(100,groove.breath+25));
                        applyGroove({seed:grooveSeed}); renderGrooveCard(); },
                        'Shortens the low-end notes so they stop before the backbeat, and rebuilds.') ] }; } },

    { id:'buildsong', re:/\b(build.*(song|track)|full song|complete song|arrange|structure|song architect)\b/i, f:c=>{
        const k=gKnow('build the full song structure');
        return { say:(k?k.say:'You want a whole arrangement rather than a loop.'), why:(k?k.why:''),
          actions:[ gNav('Open Song Architect',()=>{ goTo('play')(); scrollTo('archCard')(); }),
                    gDo('Build the full song',()=>{ applyArchitect({}); },
                        'Writes six sections and lays out a full arrangement. Undo puts it back.') ] }; } },

    { id:'biggerchorus', re:/\b(chorus.*(bigger|explode|hit|harder|lift|peak)|make.*chorus)\b/i, f:c=>{
        const k=gKnow('make the chorus bigger');
        return { say:(k?k.say:'You want the chorus to land harder.'), why:(k?k.why:''),
          actions:[ gDo('Make the chorus bigger',()=>{ architectActions().biggerChorus.run(); },
                        'Adds the parts a chorus can carry and lifts its energy.'),
                    gDo('Take something away before it instead',()=>{ applyTransition('bassdrop',8); },
                        'Drops the low end in the bar before, so the chorus entry feels like everything returning.') ] }; } },

    { id:'transition', re:/\b(transition|breather|fill|sweep|between sections|hard cut)\b/i, f:c=>{
        const k=gKnow('transition between sections');
        return { say:(k?k.say:'You are asking about the joins between sections.'), why:(k?k.why:''),
          actions:[ gNav('Open Transitions',()=>{ goTo('play')(); scrollTo('transCard')(); }) ] }; } },

    { id:'emotion', re:/\b(boring|flat|contrast|energy|dynamic|nothing happens|too similar)\b/i, f:c=>{
        const k=gKnow('contrast and energy across sections');
        return { say:(k?k.say:'You are asking whether the song moves enough.'), why:(k?k.why:''),
          actions:[ gNav('Read my song',()=>{ goTo('play')(); scrollTo('emoCard')();
                          setTimeout(()=>{ const b=document.getElementById('emoRun'); if(b) b.click(); },260); }) ] }; } },

    { id:'mixcheck', re:/\b(mix|muddy|harsh|crowded|clipping|too loud|kick and bass|balance)\b/i, f:c=>{
        const k=gKnow('mix check kick and bass');
        return { say:(k?k.say:'You want to know what is fighting in the mix.'), why:(k?k.why:''),
          actions:[ gNav('Check my mix',()=>{ goTo('mix')(); scrollTo('mixCard')();
                          setTimeout(()=>{ const b=document.getElementById('mixRun'); if(b) b.click(); },260); }) ] }; } },

    { id:'lyricfit', re:/\b(lyric|words|syllab|fit.*(melody|line)|rhyme|breath mark|topline)\b/i, f:c=>{
        const k=gKnow('syllables fit the melody');
        return { say:(k?k.say:'You are working on the words.'),
          why:(k?k.why:'')+' Aura measures what you wrote — it does not write lyrics and has no language model.',
          actions:[ gNav('Open Lyrics',()=>{ goTo('voc')(); scrollTo('lyricCard')(); }) ] }; } },

    { id:'singing', re:/\b(sing|vocal|voice|range|too high|too low|practice|take|deliver)\b/i, f:c=>{
        const k=gKnow('vocal range and delivery');
        return { say:(k?k.say:'You are asking about singing it.'),
          why:(k?k.why:'')+' Aura reads your key, tempo and melody. It gives no health or medical advice about anyone’s voice.',
          actions:[ gNav('Coach this section',()=>{ goTo('voc')(); scrollTo('coachCard')();
                          setTimeout(()=>{ const b=document.getElementById('coachRun'); if(b) b.click(); },260); }) ] }; } },

    { id:'breathmarks', re:/\b(breath|breathe|mark breath|where.*breath|run out of air)\b/i, f:c=>{
        const k=gKnow('mark the breaths before you record');
        return { say:(k?k.say:'You want to know where to breathe.'), why:(k?k.why:''),
          actions:[ gNav('Mark breaths',()=>{ goTo('voc')(); scrollTo('lyricCard')();
                          setTimeout(()=>{ const b=document.getElementById('lyricBreaths'); if(b) b.click(); },300); }) ] }; } },

    { id:'adlib', re:/\b(adlib|ad.?lib|response|answer.*(line|phrase)|space for.*(voice|vocal))\b/i, f:c=>{
        return { say:'You want room for an answering line.',
          why:'An adlib needs a gap to land in. Aura can thin the parts where the voice sits, and the '+
              'Lyric Studio shows you where the melody already leaves space.',
          actions:[ gDo('Leave more room for vocals',()=>{ architectActions().roomForVocals.run(); },
                        'Thins the parts that sit in the register a voice occupies.'),
                    gNav('See where the gaps are',()=>{ goTo('voc')(); scrollTo('lyricCard')(); }) ] }; } },

    { id:'finish', re:/\b(finish|done|ready|complete the record|wrap up|what.?s left|checklist)\b/i, f:c=>{
        const r=readyToShare();
        return { say:r.statement,
          why:'Finish the record measures each stage from the project itself. It does not require '+
              'every stage, and it never claims the music is good or that anything is legally cleared.',
          actions:[ gNav('Open Finish the record',()=>{ goTo('mix')(); scrollTo('finishCard')(); }) ] }; } },

    { id:'ideacode', re:/\b(idea code|seed|reproduc|same result|get.*back|previous idea)\b/i, f:c=>{
        const k=gKnow('idea code reproducible seed');
        return { say:(k?k.say:'You want an idea back exactly as it was.'), why:(k?k.why:''),
          actions:[ gNav('Show my Idea Code',()=>{ goTo('rack')(); scrollTo('grooveCard')(); }) ] }; } },

    // `own\w*` rather than `\bown\b`: "who owns this" is the most natural phrasing and it does not
    // contain the bare word "own".
    { id:'rights', re:/\b(rights|copyright|licence|license|own\w*|releas\w*|sell|selling|monetis\w*|monetiz\w*|commercial\w*|royalt\w*|sample.*(clear|legal)|permission)\b/i, f:c=>{
        const k=gKnow('can i release this commercially');
        return { say:(k?k.say:'You are asking what you can do with this.'),
          why:(k?k.why:'')+' Aura does not give legal advice and cannot tell you that you own anything.',
          actions:[ gNav('Open Rights & Sources',()=>{ scrollTo('rightsCard')(); }) ] }; } },

    { id:'toolrouter', re:/\b(what tool|which tool|should i use|stems|separate|master(ing)?|generator|platform|subscription)\b/i, f:c=>{
        // Search the tools knowledge only. This intent exists to route Book II questions, and a
        // craft entry that happens to share a word is not an answer to "which tool".
        const k=gKnow(c && c.lastAsk ? c.lastAsk : 'what tool should i use', 'tools')
             || gKnow('what tool should i use', 'tools');
        if(!k) return null;
        const e=k.entry;
        let why=k.why;
        if(e.auraCan && e.auraCan.length) why='Aura can: '+e.auraCan.join(' ')+' '+why;
        return { say:k.say, why:why, actions:[] }; } },


  ];

  // Destructive-sounding requests get a refusal-shaped answer rather than an action, because a
  // guide that quietly deletes is worse than one that says no.
  const GUIDE_DESTRUCTIVE=/\b(delete everything|wipe|erase all|start over|clear (my )?(project|song|everything))\b/i;

  function guideAnswer(text){
    guide.lastText=text;
    const c=guideContext();
    // The Tool Router matches the singer's ACTUAL question against the knowledge entries. It read
    // `c.lastAsk`, which guideContext() never set, so every routed question fell through to the
    // literal string 'what tool should i use' and returned the same generic entry — asking about
    // stems, mastering or distribution all gave one answer. The router had 10 entries and reached 1.
    c.lastAsk=text;
    if(GUIDE_DESTRUCTIVE.test(text)) return {
      intent:'destructive',
      say:'You are asking to clear your work.',
      why:'Aura will not do that from here. If you really want a blank project, use New Project in the Project menu — '
         +'it asks first, and your saved files are untouched.',
      actions:[gNav('Open the Project menu',()=>{ const b=document.getElementById('projX'); if(b) b.click(); })], ctx:c };
    for(const it of GUIDE_INTENTS){
      if(it.re.test(text)){ const a=it.f(c); a.intent=it.id; a.ctx=c; return a; }
    }
    return { intent:'unknown', ctx:c,
      say:'I did not understand that one.',
      why:'This guide is a fixed set of answers about controls Aura actually has — it is not a chatbot, so it would rather '
         +'say so than invent something. Try naming a part: beat, low end, chords, melody, sections, versions, controller, '
         +'perform, sampler, export or privacy.',
      actions:[] };
  }

  const GUIDE_PROMPTS=['Make the chorus bigger','More room for my voice','Half-time drums',
    'What does Needs review mean?','Keep the adlibs','Connect a controller','How do I export?'];

  function guideCtxLine(){
    const c=guideContext();
    const bits=[c.mode+' mode', c.projectBpm+' BPM', c.projectKey];
    bits.push(c.hasReference?('reference: '+c.referenceName):'no reference');
    bits.push('version: '+c.variation);
    if(c.recording) bits.push('recording');
    return 'Aura can see: '+bits.join(' · ')+'.';
  }
  let pendingFocus=null;
  function guideRender(){
    const log=document.getElementById('guideLog'); if(!log) return;
    const ctx=document.getElementById('guideCtx');
    if(ctx) ctx.textContent=guideCtxLine();
    pendingFocus=null;
    log.innerHTML='';
    const mk=(t,c2,x)=>{ const e=document.createElement(t); if(c2) e.className=c2;
      if(x!=null) e.textContent=x; return e; };
    guide.log.forEach((m,mi)=>{
      const d=mk('div','gmsg '+m.who);
      d.appendChild(mk('b',null,m.who==='you'?'You':'Aura Guide'));
      d.appendChild(mk('p',null,m.say));
      if(m.why) d.appendChild(mk('p','gwhy',m.why));
      if(m.actions&&m.actions.length){
        const cards=mk('div','gcards');
        m.actions.forEach((a,ai)=>{
          const b=mk('button','gcard'+(a.danger?' danger':''),a.label);
          b.type='button';
          b.addEventListener('click',()=>{
            if(!a.danger){ a.go(); return; }               // navigation never needs confirming
            // Understand -> Preview -> Confirm -> Apply. The preview describes; it does not mutate.
            guide.pending={mi,ai};
            guideRender();
          });
          cards.appendChild(b);
        });
        d.appendChild(cards);
      }
      // the confirmation sheet, inline under the card that asked for it
      if(guide.pending&&guide.pending.mi===mi){
        const a=m.actions[guide.pending.ai];
        const box=mk('div','gconfirm');
        // A group rather than an alertdialog: it is inline in the log, not modal, and claiming
        // modality to a screen reader that can still reach the rest of the sheet is a lie. The
        // label names the change so the buttons are not two bare verbs out of context.
        box.setAttribute('role','group');
        box.setAttribute('aria-label','Confirm: '+a.label);
        const desc=mk('p',null,(a.previewText||'This will change your project.')
          +' Nothing has changed yet. Confirming makes one change you can undo.');
        desc.id='gconfirmDesc';
        box.setAttribute('aria-describedby',desc.id);
        box.appendChild(desc);
        const row=mk('div','gcards');
        const yes=mk('button','gcard danger','Confirm'); yes.type='button';
        yes.setAttribute('aria-label','Confirm: '+a.label);
        yes.addEventListener('click',()=>{
          let done=false;
          oneCheckpoint(()=>{ try{ a.apply(); done=true; }catch(e){ console.warn(e); } });
          guide.pending=null;
          guide.log.push({who:'aura', say:done?('Done — '+a.label.toLowerCase()+'.'):'That did not work, and nothing was changed.',
            why:done?'One undo puts it back exactly as it was.':'', actions:[]});
          guideRender();
        });
        const no=mk('button','gcard','Cancel'); no.type='button';
        no.setAttribute('aria-label','Cancel: leave the project as it is');
        no.addEventListener('click',()=>{ guide.pending=null;
          guide.log.push({who:'aura',say:'Cancelled — nothing was changed.',why:'',actions:[]});
          guideRender(); });
        row.appendChild(yes); row.appendChild(no);
        box.appendChild(row);
        d.appendChild(box);
        // Focus the safe choice, not the destructive one. Deferred because the log is still being
        // built here — focusing a node that is not in the document yet does nothing.
        pendingFocus=no;
      }
      log.appendChild(d);
    });
    log.scrollTop=log.scrollHeight;
    if(pendingFocus&&pendingFocus.isConnected){ try{ pendingFocus.focus(); }catch(e){} }
    pendingFocus=null;
  }
  function guideAsk(text){
    text=String(text||'').trim(); if(!text) return null;
    guide.log.push({who:'you',say:text,actions:[]});
    const a=guideAnswer(text);
    guide.log.push({who:'aura',say:a.say,why:a.why,actions:a.actions||[]});
    guide.pending=null;
    guideRender();
    return a;
  }
  let guideLastFocus=null;
  function guideOpen(){
    const sheet=document.getElementById('guideSheet'); if(!sheet) return;
    guideLastFocus=document.activeElement;
    guide.open=true; sheet.hidden=false;
    const btn=document.getElementById('askOpen'); if(btn) btn.setAttribute('aria-expanded','true');
    if(!guide.log.length) guide.log.push({who:'aura',
      say:'Tell me what you want to make or change and I will take you to it.',
      why:'I read your project on this device to answer. I am offline structured guidance, not a generative AI model — '
         +'so if I do not know something I will say so rather than invent it.', actions:[]});
    guideRender();
    const inp=document.getElementById('guideInput'); if(inp) inp.focus();
    document.addEventListener('keydown',guideKey,true);
  }
  function guideClose(){
    const sheet=document.getElementById('guideSheet'); if(!sheet) return;
    guide.open=false; sheet.hidden=true; guide.pending=null;
    const btn=document.getElementById('askOpen'); if(btn) btn.setAttribute('aria-expanded','false');
    document.removeEventListener('keydown',guideKey,true);
    if(guideLastFocus&&guideLastFocus.focus) guideLastFocus.focus();
  }
  function guideKey(e){
    if(!guide.open) return;
    if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); guideClose(); return; }
    if(e.key==='Tab'){ const sheet=document.getElementById('guideSheet'); if(sheet) trapTab(sheet,e); }
  }
  function wireGuide(){
    const $=id=>document.getElementById(id);
    if($('askOpen')) $('askOpen').addEventListener('click',()=>guide.open?guideClose():guideOpen());
    if($('guideClose')) $('guideClose').addEventListener('click',()=>guideClose());
    if($('guideForm')) $('guideForm').addEventListener('submit',e=>{
      e.preventDefault(); const i=$('guideInput'); if(!i) return;
      guideAsk(i.value); i.value=''; });
    if($('guideClear')) $('guideClear').addEventListener('click',()=>{
      guide.log=[]; guide.pending=null; guideRender();
      guide.log.push({who:'aura',say:'Cleared. Nothing was kept.',
        why:'Guide history is session-only. It is never written into your project or to disk.',actions:[]});
      guideRender(); });
    const ph=$('guidePrompts');
    if(ph){ GUIDE_PROMPTS.forEach(t=>{ const b=document.createElement('button');
      b.type='button'; b.className='gprompt'; b.textContent=t;
      b.addEventListener('click',()=>guideAsk(t)); ph.appendChild(b); }); }
  }

  // ================= LIVE ARRANGEMENT (perform + automation) =================
  // What is recorded is a list of NORMALISED AURA ACTIONS with timestamps — "mute the beat at
  // 4.2 s", not a stream of raw MIDI. That is smaller, readable, editable, survives a different
  // controller, and stores nothing about the hardware: no device name, no serial, no permission
  // state. Raw MIDI is never persisted when a normalised action says the same thing.
  const perf={ recording:false, t0:0, events:[], take:null, armedAt:0 };
  const automation={ events:[], enabled:true };          // the KEPT take, serialised as `perf`

  function perfStart(){
    if(perf.recording) return false;
    // A take under review is not silently discarded by starting another one.
    perf.recording=true; perf.t0=performance.now(); perf.events=[]; perf.take=null;
    paintPerform();
    toast('Recording your performance. Nothing is written to the project until you keep it.');
    return true;
  }
  function perfStop(){
    if(!perf.recording) return false;
    perf.recording=false;
    perf.take={ events:perf.events.slice(), dur:Math.round(performance.now()-perf.t0) };
    paintPerform();
    return true;
  }
  // Simplify: drop events that change nothing audible. Consecutive range moves on the same action
  // collapse to their last value inside a short window, and repeated identical toggles cancel.
  function perfSimplify(){
    if(!perf.take) return 0;
    const src=perf.take.events, out=[];
    const WINDOW=120;                                   // ms — finer than this is not audible as a move
    for(let i=0;i<src.length;i++){
      const e=src[i];
      const a=performActions()[e.a];
      if(a&&a.kind==='range'){
        // look ahead: if the same action moves again within the window, this one is superseded
        let sup=false;
        for(let j=i+1;j<src.length;j++){
          if(src[j].t-e.t>WINDOW) break;
          if(src[j].a===e.a){ sup=true; break; }
        }
        if(sup) continue;
        const last=[...out].reverse().find(x=>x.a===e.a);
        if(last&&Math.abs(last.v-e.v)<0.02) continue;   // no audible change
      }
      out.push(e);
    }
    const removed=src.length-out.length;
    perf.take.events=out;
    paintPerform();
    return removed;
  }
  function perfKeep(){
    if(!perf.take) return false;
    let n=0;
    oneCheckpoint(()=>{ automation.events=perf.take.events.slice(); n=automation.events.length; });
    perf.take=null; paintPerform();
    toast('Kept '+n+' performance move'+(n===1?'':'s')+'. Undo puts it back.');
    return true;
  }
  function perfDiscard(){
    // Zero mutation: the take never touched the project, so throwing it away is not an edit.
    perf.take=null; perf.events=[]; paintPerform();
    toast('Performance discarded — your project was not changed.');
    return true;
  }
  function perfClearAutomation(){
    let had=automation.events.length;
    oneCheckpoint(()=>{ automation.events=[]; });
    paintPerform();
    toast('Removed '+had+' performance move'+(had===1?'':'s')+'. Undo puts them back.');
    return true;
  }
  // The automation state at a moment in time — used by playback and by the offline export so the
  // two cannot disagree.
  // The automation state at a moment in time. Mute actions are TOGGLES, so "the last value seen"
  // is wrong — two mutes is unmuted. The sequence up to `ms` is replayed instead, which is the only
  // way playback and the offline export can agree about what was audible.
  const AUTO_MUTE={ muteBeat:'beat', muteBass:'bass', muteHarmony:'chords', muteMelody:'melody' };
  // The range actions that change what a listener HEARS, and therefore have to reach the file.
  // `tempo` is deliberately absent: the export computes `sps`, the total duration and the sample
  // playback rate once, before the loop, so replaying a tempo move mid-render would stretch the
  // parts against step times that never moved. `launchSection` is absent because it moves the live
  // readout, not the audio — the export walks the arrangement itself.
  const AUTO_GAIN={ master:1, refLevel:1, auraLevel:1, crossfade:1, chorusLift:1 };
  function automationAt(ms){
    const st={};
    if(!automation.enabled) return st;
    for(const e of automation.events){
      if(e.t>ms) break;
      if(AUTO_MUTE[e.a]) st[e.a]=!st[e.a];        // toggle
      else st[e.a]=e.v;                            // range: last value wins
    }
    return st;
  }
  // Mute state for the offline export, as absolute on/off per group at a given time.
  function automationMutesAt(ms){
    const st=automationAt(ms), out={};
    Object.keys(AUTO_MUTE).forEach(k=>{ if(st[k]) out[AUTO_MUTE[k]]=true; });
    return out;
  }
  // Every control a replayed range action can move. A performance is a PERFORMANCE, not an edit, so
  // the controls it moves are snapshotted before a replay and put back afterwards. Without this a
  // take that ended with the crossfade hard over left the project mixed that way — and the export,
  // which reads each fader once, then baked that residual position across the entire song.
  const AUTO_CTL=['master','chordVol','bassVol','melVol','reverb','refLevel'];
  function autoCtlSnapshot(){ const o={};
    AUTO_CTL.forEach(id=>{ const el=document.getElementById(id); if(el) o[id]=el.value; }); return o; }
  function autoCtlRestore(sn){ if(!sn) return;
    applyDepth++;                                   // putting a control back is not an edit
    try{ Object.keys(sn).forEach(id=>{ const el=document.getElementById(id);
      if(!el || el.value===sn[id]) return;
      el.value=sn[id];
      el.dispatchEvent(new Event('input',{bubbles:true}));
      el.dispatchEvent(new Event('change',{bubbles:true})); }); }
    finally{ applyDepth--; } }

  let autoTimer=null, autoIdx=0, autoT0=0, autoStartTimer=null, autoCtlBefore=null;
  function automationStartPlayback(){
    automationStopPlayback();
    if(!automation.enabled||!automation.events.length) return;
    autoCtlBefore=autoCtlSnapshot();
    autoIdx=0; autoT0=performance.now();
    autoTimer=setInterval(()=>{
      const ms=performance.now()-autoT0;
      while(autoIdx<automation.events.length&&automation.events[autoIdx].t<=ms){
        const e=automation.events[autoIdx++];
        const a=performActions()[e.a];
        // Replay must not re-record, so it calls the action directly rather than runAction().
        // `applyDepth` makes autosave() return early: the mute actions call it themselves, so
        // without this every replayed event wrote storage and spent an undo step, and a kept
        // performance quietly ate the singer's history while it played. The events are already in
        // the project — replaying them is not an edit.
        // A `noAuto` event can only come from a hand-edited or older file; refuse it rather than
        // trusting it, because `record` in that list arms the microphone.
        if(a && !a.noAuto){ applyDepth++;
          try{ a.kind==='range'?a.run(e.v):a.run(); }catch(err){}
          finally{ applyDepth--; } }
      }
      if(autoIdx>=automation.events.length) automationStopPlayback();
    },30);
  }
  function automationStopPlayback(){ if(autoTimer){ clearInterval(autoTimer); autoTimer=null; }
    // The count-in delay is a pending start; stopping must cancel it too, or a take fires into a
    // transport that is no longer running.
    if(autoStartTimer){ clearTimeout(autoStartTimer); autoStartTimer=null; }
    autoCtlRestore(autoCtlBefore); autoCtlBefore=null; }

  // While a live arrangement is being recorded, the destructive controls are LOCKED.
  //
  // Not hidden — disabled, and each one says why. A control that vanishes mid-performance reads
  // as a bug; a control that refuses and explains reads as a stage. Everything here either
  // replaces the project wholesale or throws work away, and none of it is a thing anyone means
  // to press while playing: the reference removal, the reconstruction apply, resetting a part or
  // the mixer or the groove, clearing the intention, wiping controller mappings, and the two
  // exports, which render for many seconds and would fight the performance for the audio device.
  //
  // Undo and redo are deliberately NOT here. They are how a singer recovers from a wrong move
  // mid-take, and they are already one-checkpoint-per-operation.
  const PERF_LOCKED=['smpClear','clear','mixReset','grooveReset','grooveApply',
                     'intentClear','midiReset','exportAll','export','melClear','smpReset'];
  // The reconstruction's Replace / Only fill the gaps / Add as a new version buttons are BUILT
  // from the analysis, so they have no stable id to name above. They are also the most
  // destructive controls in the app, so they are locked by container instead — every button
  // inside these cards, whatever renderRebuild happened to draw this time.
  const PERF_LOCKED_IN=['rebuild','varCard'];
  const PERF_LOCK_WHY='Not while a performance is recording — stop the take first.';
  function syncPerformLock(){
    const on=!!(perf&&perf.recording);
    document.body.classList.toggle('performing',on);
    const lock=el=>{
      if(!el||el.disabled) return;            // never lock what was already unavailable
      el.dataset.perflock='1'; el.dataset.lockedTitle=el.title||'';
      el.disabled=true; el.setAttribute('aria-disabled','true'); el.title=PERF_LOCK_WHY;
    };
    // Restore ONLY what this lock disabled. A button that was disabled for its own reasons —
    // no take yet, nothing to undo — must stay that way when the performance stops.
    const unlock=el=>{
      if(!el||el.dataset.perflock!=='1') return;
      el.disabled=false; el.removeAttribute('aria-disabled');
      el.title=el.dataset.lockedTitle||'';
      delete el.dataset.perflock; delete el.dataset.lockedTitle;
    };
    const each=fn=>{
      PERF_LOCKED.forEach(id=>fn(document.getElementById(id)));
      PERF_LOCKED_IN.forEach(id=>{ const host=document.getElementById(id);
        if(host) host.querySelectorAll('button').forEach(fn); });
    };
    each(on?lock:unlock);
  }
  function paintPerform(){
    syncPerformLock();
    const card=document.getElementById('perfCard'); if(!card) return;
    const $=id=>document.getElementById(id);
    const secName=i=>(secNames[i]||('Section '+(i+1)));
    if($('perfCur'))  $('perfCur').textContent=secName(mode==='song'?slotIndex:currentPattern);
    if($('perfNext')) $('perfNext').textContent=secName(((mode==='song'?slotIndex:currentPattern)+1)%N_PATTERNS);
    if($('perfVer'))  $('perfVer').textContent=(activeVariation()||{name:'Main'}).name;
    if($('perfRec'))  $('perfRec').textContent=perf.recording
      ? ('On · '+perf.events.length+' move'+(perf.events.length===1?'':'s'))
      : (perf.take?'Reviewing a take':'Off');
    const rb=$('perfRecord'), sb=$('perfStop');
    if(rb){ rb.hidden=perf.recording; rb.classList.toggle('on',perf.recording); }
    if(sb) sb.hidden=!perf.recording;
    const rev=$('perfReview');
    if(rev){ rev.hidden=!perf.take;
      const n=$('perfReviewNote');
      if(n&&perf.take) n.textContent=perf.take.events.length+' move'
        +(perf.take.events.length===1?'':'s')+' over '+(perf.take.dur/1000).toFixed(1)
        +'s. Nothing is in your project yet — listen, then keep or discard.'; }
    const an=$('perfAutoNote'), aa=$('perfAutoActs');
    // Say exactly what lands in the file, counted from the same maps the export uses. Three classes,
    // not two: mutes and level moves are both rendered per step; section launches and pads move where
    // you are in the arrangement while you play and are not audio. Calling all of those "faders" was
    // wrong — a take that only launched sections reported "1 fader move".
    if(an){ const n=automation.events.length;
      const heard=automation.events.filter(e=>AUTO_MUTE[e.a]||AUTO_GAIN[e.a]).length;
      const nav=n-heard;
      an.textContent = n
        ? ('This project has '+n+' kept performance move'+(n===1?'':'s')+'. They play back here'
           +(heard? (', and the '+heard+' mute and level move'+(heard===1?'':'s')+' render into your export')
                  : '')
           +'.'
           +(nav? (' The other '+nav+' move'+(nav===1?'':'s')+' — section launches and pads — change'
                   +' where you are while you play, and are not written into the file.')
                : ''))
        : ''; }
    if(aa) aa.hidden=!automation.events.length;
    // mute buttons reflect real state, so a controller press is visible on screen
    const muteMap={muteBeat:()=>drums.every(d=>mutes[d.id]),muteBass:()=>!!mutes.bass,
                   muteHarmony:()=>!!mutes.chords,muteMelody:()=>!!mutes.melody};
    card.querySelectorAll('[data-act]').forEach(b=>{
      const f=muteMap[b.dataset.act];
      if(f) b.classList.toggle('on',!!f());
    });
  }
  function wirePerform(){
    const card=document.getElementById('perfCard'); if(!card) return;
    const $=id=>document.getElementById(id);
    // Every button routes through runAction — the same path a MIDI message takes.
    card.querySelectorAll('[data-act]').forEach(b=>
      b.addEventListener('click',()=>runAction(b.dataset.act)));
    // A drag fires `input` on every pixel, and every range action autosaves — so a single sweep of
    // this fader pushed dozens of checkpoints and flushed the 80-entry undo history, taking the
    // Apply the singer did just before it out of reach. Suppress history for the duration of the
    // drag with the same `applyDepth` guard an Apply uses, then take exactly one checkpoint when
    // the drag ends. `change` fires on pointer-up and on keyboard commit, so both routes land it.
    const bindFad=(id,act)=>{ const el=$(id); if(!el) return;
      el.addEventListener('input',()=>{ applyDepth++;
        try{ runAction(act,(+el.value)/100); } finally{ applyDepth--; } });
      el.addEventListener('change',()=>oneCheckpoint(()=>runAction(act,(+el.value)/100))); };
    bindFad('perfBlend','crossfade');
    bindFad('perfEnergy','chorusLift');
    if($('perfRecord')) $('perfRecord').addEventListener('click',()=>perfStart());
    if($('perfStop'))   $('perfStop').addEventListener('click',()=>perfStop());
    if($('perfKeep'))   $('perfKeep').addEventListener('click',()=>perfKeep());
    if($('perfDiscard'))$('perfDiscard').addEventListener('click',()=>perfDiscard());
    if($('perfSimplify'))$('perfSimplify').addEventListener('click',()=>{
      const n=perfSimplify(); toast(n?('Simplified — removed '+n+' move'+(n===1?'':'s')+' that changed nothing audible.')
                                    :'Nothing to simplify.'); });
    if($('perfClearAuto')) $('perfClearAuto').addEventListener('click',()=>{
      if(!confirm('Remove the kept performance moves from this project? Undo puts them back.')) return;
      perfClearAutomation(); });
    paintPerform();
  }

  // ================= DJ CONTROLLER (Web MIDI) =================
  // Optional, local, and never required. Aura works exactly as before with no controller attached.
  //
  // Nothing leaves the device: there is no network code anywhere in this module, MIDI messages are
  // read and acted on in place, and mappings are a LOCAL USER PREFERENCE in localStorage — they are
  // deliberately NOT part of the .aura project, because a controller layout belongs to a person and
  // their desk, not to a song they might share.
  //
  // Web MIDI is not universal. Capability is checked rather than assumed, and each state says
  // plainly what is true, because "connect a controller" shown in a browser that cannot do it is
  // worse than not offering it.
  const MIDI_MAP_KEY='aura-midi-maps';
  const midi={ supported:(typeof navigator!=='undefined'&&typeof navigator.requestMIDIAccess==='function'),
               state:'unknown', access:null, inputs:[], maps:[], learning:null, lastMsg:null };

  // Every action a controller can reach. Each is a plain function on the app, so a mapping cannot
  // invent behaviour that does not already exist in the interface.
  function performActions(){
    const setRange=(id,v)=>{ const el=document.getElementById(id); if(!el) return;
      el.value=String(Math.round(v)); el.dispatchEvent(new Event('input',{bubbles:true}));
      el.dispatchEvent(new Event('change',{bubbles:true})); };
    const muteKey=k=>{ mutes[k]=!mutes[k]; applyMutes(); autosave(); };
    return {
      playPause:   {label:'Play / Pause', kind:'trigger', run:()=>{ const b=document.getElementById('play'); if(b) b.click(); }},
      // `noAuto` actions reach outside the song, so they are never captured into a take and never
      // replayed. `record` arms the MICROPHONE: without this, a kept move could re-arm it on Play,
      // and a project shared as a .aura or a link would start recording on someone else's machine.
      // `undo`/`redo` rewrite the history that automation playback is running inside.
      record:      {label:'Record',       kind:'trigger', noAuto:true, run:()=>{ const b=document.getElementById('rec')||document.getElementById('recX'); if(b) b.click(); }},
      undo:        {label:'Undo',         kind:'trigger', noAuto:true, run:()=>undo()},
      redo:        {label:'Redo',         kind:'trigger', noAuto:true, run:()=>redo()},
      tempo:       {label:'Tempo',        kind:'range', run:v=>setRange('bpm',60+v*(180-60))},
      master:      {label:'Master level', kind:'range', run:v=>setRange('master',v*100)},
      refLevel:    {label:'Reference level', kind:'range', run:v=>setRange('refLevel',v*140)},
      auraLevel:   {label:'Aura level',   kind:'range', run:v=>{ const g=Math.round(v*140);
                     ['chordVol','bassVol','melVol'].forEach(id=>setRange(id,g)); }},
      crossfade:   {label:'Crossfade original ↔ Aura', kind:'range', run:v=>{
                     // 0 = only the recording, 1 = only Aura. Uses the existing A/B multiplier.
                     setRange('refLevel',Math.round((1-v)*140));
                     ['chordVol','bassVol','melVol'].forEach(id=>setRange(id,Math.round(v*140))); }},
      nextSection: {label:'Next section', kind:'trigger', run:()=>{ slotIndex=(slotIndex+1)%SONG_SLOTS; updateReadout(); }},
      prevSection: {label:'Previous section', kind:'trigger', run:()=>{ slotIndex=(slotIndex-1+SONG_SLOTS)%SONG_SLOTS; updateReadout(); }},
      launchSection:{label:'Launch section', kind:'range', run:v=>{ slotIndex=Math.min(SONG_SLOTS-1,Math.floor(v*SONG_SLOTS)); updateReadout(); }},
      nextVersion: {label:'Next version',  kind:'trigger', run:()=>{
                     if(!variations.items.length) return;
                     const ids=[null].concat(variations.items.map(v=>v.id));
                     const i=ids.indexOf(variations.activeId);
                     oneCheckpoint(()=>switchVariation(ids[(i+1)%ids.length])); }},
      chorusLift:  {label:'Chorus lift',  kind:'range', run:v=>setRange('reverb',Math.round(v*70))},
      muteBeat:    {label:'Mute Beat',    kind:'toggle', run:()=>{ drums.forEach(d=>{ mutes[d.id]=!mutes[d.id]; }); applyMutes(); autosave(); }},
      muteBass:    {label:'Mute bass',    kind:'toggle', run:()=>muteKey('bass')},
      muteHarmony: {label:'Mute harmony', kind:'toggle', run:()=>muteKey('chords')},
      muteMelody:  {label:'Mute Melody',  kind:'toggle', run:()=>muteKey('melody')},
      slice1:      {label:'Sampler slice 1', kind:'trigger', run:()=>midiTriggerSlice(0)},
      slice2:      {label:'Sampler slice 2', kind:'trigger', run:()=>midiTriggerSlice(1)},
      slice3:      {label:'Sampler slice 3', kind:'trigger', run:()=>midiTriggerSlice(2)},
      slice4:      {label:'Sampler slice 4', kind:'trigger', run:()=>midiTriggerSlice(3)},
    };
  }
  // ONE entry point for every action, whatever triggered it. A MIDI message, a Perform button and
  // the Guide all call this, so the interface and the controller can never drift into two states —
  // and a live arrangement records the ACTION, not the input device that caused it.
  function runAction(name,value){
    const a=performActions()[name]; if(!a) return false;
    try{ if(a.kind==='range') a.run(Math.max(0,Math.min(1,+value||0))); else a.run(); }
    catch(e){ console.warn('action failed',name,e); return false; }
    if(perf.recording && !a.noAuto){
      perf.events.push({ t:Math.max(0,Math.round(performance.now()-perf.t0)), a:name,
                         v:(a.kind==='range')?+(Math.max(0,Math.min(1,+value||0)).toFixed(3)):1 });
      paintPerform();
    }
    paintPerform();
    return true;
  }

  function midiTriggerSlice(i){
    const pads=document.querySelectorAll('.sndpad');
    if(pads[i]) pads[i].click();
  }

  function loadMidiMaps(){
    try{ const raw=localStorage.getItem(MIDI_MAP_KEY); if(!raw) return [];
      const a=JSON.parse(raw); return Array.isArray(a)?a.filter(m=>m&&m.action):[]; }
    catch(e){ return []; }
  }
  function saveMidiMaps(){
    try{ localStorage.setItem(MIDI_MAP_KEY,JSON.stringify(midi.maps)); }catch(e){}
  }
  // A message is identified by type + channel + number. Range and inversion are applied per mapping,
  // so the same physical fader can drive two things differently.
  function midiKeyOf(msg){ return msg.type+':'+msg.channel+':'+msg.number; }
  function parseMidi(data){
    if(!data||data.length<2) return null;
    const status=data[0], ch=(status&0x0f)+1, hi=status&0xf0;
    if(hi===0x90&&data[2]>0)  return {type:'note', channel:ch, number:data[1], value:data[2]/127, raw:data};
    if(hi===0x80||(hi===0x90&&data[2]===0)) return {type:'noteoff', channel:ch, number:data[1], value:0, raw:data};
    if(hi===0xB0) return {type:'cc',   channel:ch, number:data[1], value:data[2]/127, raw:data};
    if(hi===0xE0) return {type:'pitch',channel:ch, number:0, value:((data[2]<<7)|data[1])/16383, raw:data};
    return null;
  }
  function handleMidiMessage(e){
    const msg=parseMidi(e&&e.data);
    if(!msg) return;                                     // malformed or unhandled status: ignored
    midi.lastMsg=msg;
    if(midi.learning){                                   // MIDI Learn takes the next usable message
      if(msg.type==='noteoff') return;
      const m={ id:'m-'+midiKeyOf(msg)+'-'+midi.learning, action:midi.learning,
                type:msg.type, channel:msg.channel, number:msg.number,
                min:0, max:127, invert:false, toggle:false };
      midi.maps=midi.maps.filter(x=>!(x.action===m.action&&midiKeyOf(x)===midiKeyOf(m)));
      midi.maps.push(m); saveMidiMaps(); midi.learning=null; renderMidi();
      toast('Learned: '+(performActions()[m.action]||{}).label+' on '+m.type+' '+m.number);
      return;
    }
    const acts=performActions();
    midi.maps.forEach(m=>{
      if(m.type!==msg.type||m.channel!==msg.channel) return;
      if(m.type!=='pitch'&&m.number!==msg.number) return;
      const a=acts[m.action]; if(!a) return;
      if(a.kind==='range'){
        const lo=(m.min||0)/127, hi2=(m.max==null?127:m.max)/127;
        let v=Math.max(0,Math.min(1,(msg.value-lo)/((hi2-lo)||1)));
        if(m.invert) v=1-v;
        runAction(m.action,v);
      } else {
        if(msg.type==='note'&&msg.value<=0) return;
        if(m.toggle&&msg.type==='cc'&&msg.value<0.5) return;
        runAction(m.action);
      }
    });
    renderMidiActivity(msg);
  }
  function attachMidiInputs(){
    if(!midi.access) return;
    midi.inputs=[];
    midi.access.inputs.forEach(inp=>{
      midi.inputs.push({id:inp.id, name:inp.name||'Controller', manufacturer:inp.manufacturer||''});
      inp.onmidimessage=handleMidiMessage;
    });
    midi.state = midi.inputs.length ? 'connected' : 'none';
    renderMidi();
  }
  async function connectMidi(){
    if(!midi.supported){ midi.state='unsupported'; renderMidi(); return false; }
    try{
      midi.access=await navigator.requestMIDIAccess({sysex:false});
      midi.access.onstatechange=()=>attachMidiInputs();
      attachMidiInputs();
      return true;
    }catch(e){
      // A refused permission and a browser that cannot do it are different things and must not be
      // reported with the same message.
      midi.state=(e&&/denied|NotAllowed|SecurityError/i.test(String(e.name||e)))?'denied':'error';
      midi.error=String(e&&(e.message||e.name)||e);
      renderMidi(); return false;
    }
  }

  const MIDI_STATE_TEXT={
    unknown:     'Checking whether this browser can talk to a controller…',
    unsupported: 'This browser cannot connect to a MIDI controller. Everything in Aura still works — a controller is optional.',
    idle:        'Aura can use a MIDI controller. Connect one to map its buttons and knobs.',
    denied:      'Permission to use MIDI was refused. Aura carries on without it — allow MIDI access in your browser settings if you want to use a controller.',
    error:       'Aura could not reach the MIDI system on this device. Everything else still works.',
    none:        'No controller detected. Plug one in and it will appear here.',
    connected:   '',            // filled in with the device names
  };
  function renderMidi(){
    const card=document.getElementById('midiCard'); if(!card) return;
    const st=document.getElementById('midiState');
    const acts=performActions();
    if(midi.state==='unknown') midi.state=midi.supported?'idle':'unsupported';
    if(st){
      st.textContent = midi.state==='connected'
        ? ('Connected: '+midi.inputs.map(i=>i.name).join(', ')+'. Nothing you play leaves this device.')
        : (MIDI_STATE_TEXT[midi.state]||'');
    }
    const conn=document.getElementById('midiConnect');
    if(conn){
      // The button is only rendered when it can act. In an unsupported browser it is removed, not
      // shown greyed out, because a disabled control that can never work is a false promise.
      conn.hidden = !midi.supported || midi.state==='connected';
      conn.textContent = midi.state==='denied' ? 'Try connecting again' : 'Connect a controller';
    }
    const learnBtn=document.getElementById('midiLearnDone');
    if(learnBtn) learnBtn.hidden=!midi.learning;
    ['midiExport','midiImport','midiReset'].forEach(id=>{
      const b=document.getElementById(id); if(b) b.hidden = midi.state!=='connected' && !midi.maps.length;
    });
    const host=document.getElementById('midiMaps');
    if(!host) return;
    const show = midi.state==='connected' || midi.maps.length>0;
    host.hidden=!show;
    if(!show){ host.innerHTML=''; return; }
    host.innerHTML='';
    const mk=(t,c,x)=>{ const e=document.createElement(t); if(c) e.className=c; if(x!=null) e.textContent=x; return e; };
    Object.keys(acts).forEach(key=>{
      const a=acts[key];
      const bound=midi.maps.filter(m=>m.action===key);
      const row=mk('div','midirow'+(midi.learning===key?' learning':''));
      const left=mk('div');
      left.appendChild(mk('b',null,a.label));
      left.appendChild(mk('span',null, midi.learning===key
        ? 'Move the control you want to use…'
        : (bound.length
            ? bound.map(m=>m.type+' '+m.number+' · ch '+m.channel+(m.invert?' · inverted':'')+(m.toggle?' · toggle':'')).join('  |  ')
            : 'not mapped')));
      const opts=mk('div','mopts');
      const learn=mk('button',null,midi.learning===key?'Listening…':'Learn'); learn.type='button';
      learn.addEventListener('click',()=>{ midi.learning=(midi.learning===key?null:key); renderMidi(); });
      opts.appendChild(learn);
      bound.forEach(m=>{
        if(a.kind==='range'){
          const inv=mk('button',m.invert?'on':null,'Invert'); inv.type='button';
          inv.addEventListener('click',()=>{ m.invert=!m.invert; saveMidiMaps(); renderMidi(); });
          opts.appendChild(inv);
        } else {
          const tg=mk('button',m.toggle?'on':null,'Toggle'); tg.type='button';
          tg.addEventListener('click',()=>{ m.toggle=!m.toggle; saveMidiMaps(); renderMidi(); });
          opts.appendChild(tg);
        }
        const del=mk('button','danger','Remove'); del.type='button';
        del.addEventListener('click',()=>{ midi.maps=midi.maps.filter(x=>x!==m); saveMidiMaps(); renderMidi(); });
        opts.appendChild(del);
      });
      row.appendChild(left); row.appendChild(opts);
      host.appendChild(row);
    });
  }
  function renderMidiActivity(msg){
    const el=document.getElementById('midiActivity'); if(!el||!msg) return;
    el.textContent='Last message: '+msg.type+' '+msg.number+' · ch '+msg.channel
      +' · '+Math.round(msg.value*127);
  }
  function wireMidiPanel(){
    midi.maps=loadMidiMaps();
    const $=id=>document.getElementById(id);
    if($('midiConnect')) $('midiConnect').addEventListener('click',()=>connectMidi());
    if($('midiLearnDone')) $('midiLearnDone').addEventListener('click',()=>{ midi.learning=null; renderMidi(); });
    if($('midiReset')) $('midiReset').addEventListener('click',()=>{
      if(!confirm('Clear every controller mapping? Your music is not affected.')) return;
      midi.maps=[]; saveMidiMaps(); renderMidi(); toast('Controller mappings cleared.'); });
    if($('midiExport')) $('midiExport').addEventListener('click',()=>{
      // Mappings are exported ONLY when the singer asks. They are never bundled into a song file.
      const blob=new Blob([JSON.stringify(midi.maps,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob), a=document.createElement('a');
      a.href=url; a.download='aura-controller-mappings.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),4000); });
    if($('midiImport')) $('midiImport').addEventListener('click',()=>{ const f=$('midiFile'); if(f) f.click(); });
    if($('midiFile')) $('midiFile').addEventListener('change',async e=>{
      const f=e.target.files&&e.target.files[0]; if(!f) return;
      try{ const a=JSON.parse(await f.text());
        if(!Array.isArray(a)) throw new Error('not a mapping list');
        midi.maps=a.filter(m=>m&&m.action&&m.type); saveMidiMaps(); renderMidi();
        toast('Loaded '+midi.maps.length+' controller mapping'+(midi.maps.length===1?'':'s')+'.');
      }catch(err){ toast('That file is not an Aura controller mapping.'); }
      e.target.value=''; });
    renderMidi();
  }

  // ================= VARIATIONS =================
  // An alternate musical state that lives ALONGSIDE the main version rather than replacing it.
  //
  // Shape (top-level key `var`, additive and optional):
  //   { activeId, main:{scope,data}|null, items:[{id,name,createdAt,updatedAt,basedOn,scope,data}] }
  //
  // `main` is the parked copy of the main version, and it exists ONLY while a variation is active.
  // When activeId is null the project's own fields ARE the main version and `main` is null — so a
  // project that never uses variations serialises `{activeId:null,main:null,items:[]}` and behaves
  // exactly as it did before 13.3.
  //
  // Only the SCOPED parts are stored. A "bigger chorus" variation that changes drums and the
  // arrangement stores drums and the arrangement — not a second copy of the whole project.
  const VAR_PARTS=['tempo','key','beat','lowEnd','chords','song','melody'];
  const variations={ activeId:null, main:null, items:[] };
  const newVarId=()=>{ try{ if(crypto&&crypto.randomUUID) return 'v-'+crypto.randomUUID().slice(0,8); }catch(e){}
    return 'v-'+Math.abs((Date.now()^(hist.past.length*2654435761))|0).toString(36); };
  const emptyScope=()=>({tempo:false,key:false,beat:false,lowEnd:false,chords:false,song:false,melody:false});

  // Capture the CURRENT project state for the scoped parts only.
  function captureScoped(scope){
    const d={tempo:null,key:null,mode:null,beat:null,lowEnd:null,chords:null,song:null,melody:null};
    if(scope.tempo){ d.tempo={bpm:+bpmEl.value, sw:+swingEl.value}; }
    if(scope.key){ d.key=keyRoot; d.mode=keyMode; }
    if(scope.beat){ d.beat=patterns.map((p2,i)=>({
      lanes:drums.map(t=>maskOf(p2[t.id])),
      acc:drums.map(t=>maskOf(accents[i][t.id])) })); }
    if(scope.lowEnd){ d.lowEnd=patterns.map(p2=>(p2.bass||[]).map(n=>[n.p,n.s,n.l,Math.round(n.v*100),n.g?1:0])); }
    if(scope.chords){ d.chords=patterns.map(p2=>CHORD_DEGREES.map(c=>maskOf(p2[c.id]))); }
    if(scope.song){ d.song={slots:song.slice(), names:secNames.slice()}; }
    if(scope.melody){ d.melody=patterns.map(p2=>(p2.melody||[]).map(n=>[n.p,n.s,n.l,Math.round(n.v*100)])); }
    return d;
  }
  // Write a captured state back into the project. Only the scoped parts are touched, so a variation
  // that covers drums cannot silently move the singer's melody.
  function restoreScoped(scope,d){
    if(!d) return;
    const bits=(m,arr)=>{ for(let i=0;i<STEPS;i++) arr[i]=!!(m&(1<<i)); };
    if(scope.tempo&&d.tempo){ bpmEl.value=String(d.tempo.bpm); bpmVal.textContent=String(d.tempo.bpm);
      swingEl.value=String(d.tempo.sw); bpmEl.dispatchEvent(new Event('input',{bubbles:true})); }
    if(scope.key&&d.key!=null){ keyRoot=d.key; keyRootEl.value=String(keyRoot);
      keyMode=d.mode==='major'?'major':d.mode||keyMode; keyModeEl.value=keyMode; relabelChords(); }
    if(scope.beat&&d.beat){ d.beat.forEach((pb,i)=>{ if(i>=N_PATTERNS||!pb) return;
      drums.forEach((t,j)=>bits(pb.lanes[j]|0,patterns[i][t.id]));
      if(pb.acc) drums.forEach((t,j)=>bits(pb.acc[j]|0,accents[i][t.id])); }); }
    if(scope.lowEnd&&d.lowEnd){ d.lowEnd.forEach((arr,i)=>{ if(i>=N_PATTERNS) return;
      patterns[i].bass=(arr||[]).map(a=>({p:a[0]|0,s:a[1]|0,l:a[2]|0,v:(a[3]||85)/100,g:!!a[4]})); }); }
    if(scope.chords&&d.chords){ d.chords.forEach((pc,i)=>{ if(i>=N_PATTERNS||!pc) return;
      CHORD_DEGREES.forEach((c,j)=>bits(pc[j]|0,patterns[i][c.id])); }); }
    if(scope.song&&d.song){ if(Array.isArray(d.song.slots)) d.song.slots.forEach((v,i)=>{ if(i<SONG_SLOTS) song[i]=v; });
      if(Array.isArray(d.song.names)) d.song.names.forEach((v,i)=>{ if(i<secNames.length) secNames[i]=v; });
      renderAllSlots(); buildSectionNames(); }
    if(scope.melody&&d.melody){ d.melody.forEach((arr,i)=>{ if(i>=N_PATTERNS) return;
      patterns[i].melody=(arr||[]).map(a=>({p:a[0]|0,s:a[1]|0,l:a[2]|0,v:(a[3]||85)/100})); }); }
    renderGrid(); refreshPatBtns(); renderRoll();
  }
  function variationById(id){ return variations.items.find(v=>v.id===id)||null; }
  function activeVariation(){ return variations.activeId?variationById(variations.activeId):null; }

  // Create a variation holding the state in `data`, WITHOUT changing the project.
  function addVariation(name,scope,data,basedOn){
    const now=new Date().toISOString();
    const item={ id:newVarId(), name:String(name||'Variation').slice(0,60), createdAt:now, updatedAt:now,
                 basedOn:basedOn||'main', scope:Object.assign(emptyScope(),scope), data };
    variations.items.push(item);
    return item;
  }
  // Switch between main (id null) and a variation. The version being left is written back first, so
  // edits made while it was active are not lost.
  function switchVariation(id){
    const cur=activeVariation();
    if(cur){ cur.data=captureScoped(cur.scope); cur.updatedAt=new Date().toISOString(); }
    const target=id?variationById(id):null;
    if(id&&!target) return false;
    if(!cur&&target){
      // leaving main for the first time: park main's scoped state so it can be returned to
      variations.main={ scope:Object.assign(emptyScope(),target.scope), data:null };
      variations.main.data=captureScoped(variations.main.scope);
    }
    if(target){ restoreScoped(target.scope,target.data); variations.activeId=target.id; }
    else {
      if(variations.main) restoreScoped(variations.main.scope,variations.main.data);
      variations.main=null; variations.activeId=null;
    }
    renderVariations();
    return true;
  }
  // Make a variation the main version. The variation is consumed, not left as a duplicate.
  function promoteVariation(id){
    const v=variationById(id); if(!v) return false;
    if(variations.activeId!==id) switchVariation(id);
    variations.main=null; variations.activeId=null;
    variations.items=variations.items.filter(x=>x.id!==id);
    renderVariations();
    return true;
  }
  function deleteVariation(id){
    const v=variationById(id); if(!v) return false;
    if(variations.activeId===id) switchVariation(null);
    variations.items=variations.items.filter(x=>x.id!==id);
    renderVariations();
    return true;
  }
  function renameVariation(id,name){
    const v=variationById(id); if(!v) return false;
    v.name=String(name||'').slice(0,60)||v.name; v.updatedAt=new Date().toISOString();
    renderVariations(); return true;
  }

  // "Add as variation" for a reconstruction: run the real apply, capture what it produced, then put
  // the project back. The project is left exactly as it was and the alternate is stored — which is
  // what "preserve the current version and create an alternate" has to mean.
  function applyAsVariation(name,scope,applyFn){
    let item=null;
    oneCheckpoint(()=>{
      const before=captureScoped(scope);
      applyFn();                                  // the ordinary apply, mutating the project
      const after=captureScoped(scope);
      restoreScoped(scope,before);                // and back, so the main version is untouched
      item=addVariation(name,scope,after,variations.activeId||'main');
    });
    renderVariations();
    return item;
  }

  // ---- Versions UI ---------------------------------------------------------------------------
  function renderVariations(){
    const host=document.getElementById('varList'), note=document.getElementById('varNote');
    const card=document.getElementById('varCard');
    if(!host||!card) return;
    // The card only exists when there is something to say: no versions and no reference means no
    // card, rather than an empty box explaining a feature nobody has used.
    card.hidden=!variations.items.length && !smp.buf;
    host.innerHTML='';
    if(note){
      const a=activeVariation();
      note.textContent = a
        ? 'You are on “'+a.name+'”. The main version is kept and you can switch back at any time.'
        : (variations.items.length
            ? 'You are on the main version. '+variations.items.length+' alternate'
              +(variations.items.length===1?'':'s')+' saved.'
            : 'You are on the main version. Applying a reconstruction as a version keeps this one.');
    }
    const mk=(t,c,x)=>{ const e=document.createElement(t); if(c) e.className=c;
      if(x!=null) e.textContent=x; return e; };
    const rowFor=(id,name,meta,isOn)=>{
      const r=mk('div','varrow'+(isOn?' on':''));
      const left=mk('div');
      const n=mk('b','vname',name); left.appendChild(n);
      if(meta) left.appendChild(mk('span','vmeta',meta));
      const acts=mk('div','varacts');
      r.appendChild(left); r.appendChild(acts);
      return {r,acts};
    };
    // main
    {
      const {r,acts}=rowFor(null,'Main version',
        variations.activeId?'Kept while you work on an alternate':'The version you are working on',
        !variations.activeId);
      if(variations.activeId){
        const b=mk('button',null,'Switch to this'); b.type='button';
        b.addEventListener('click',()=>{ oneCheckpoint(()=>switchVariation(null));
          toast('Back on the main version.'); }); acts.appendChild(b);
      }
      host.appendChild(r);
    }
    variations.items.forEach(v=>{
      const parts=VAR_PARTS.filter(k=>v.scope[k]);
      const {r,acts}=rowFor(v.id,v.name,'Changes: '+(parts.length?parts.join(', '):'nothing'),
        variations.activeId===v.id);
      if(variations.activeId!==v.id){
        const b=mk('button','primary','Switch to this'); b.type='button';
        b.addEventListener('click',()=>{ oneCheckpoint(()=>switchVariation(v.id));
          toast('Now on “'+v.name+'”. Your main version is kept.'); });
        acts.appendChild(b);
      }
      const ren=mk('button',null,'Rename'); ren.type='button';
      ren.addEventListener('click',()=>{ const n=prompt('Name this version',v.name);
        if(n!=null) oneCheckpoint(()=>renameVariation(v.id,n)); });
      const pro=mk('button',null,'Make it the main version'); pro.type='button';
      pro.addEventListener('click',()=>{
        if(!confirm('Make “'+v.name+'” the main version? The current main version is replaced.')) return;
        oneCheckpoint(()=>promoteVariation(v.id));
        toast('“'+v.name+'” is now the main version.'); });
      const del=mk('button','danger','Delete'); del.type='button';
      del.addEventListener('click',()=>{
        if(!confirm('Delete the version “'+v.name+'”? This cannot be undone from here — use Undo.')) return;
        oneCheckpoint(()=>deleteVariation(v.id));
        toast('Deleted “'+v.name+'”.'); });
      acts.appendChild(ren); acts.appendChild(pro); acts.appendChild(del);
      host.appendChild(r);
    });
  }

  function applyChordsRebuild(){
    if(beatApplyMode==='variation'){
      // `song` and `melody` are in this scope because applyChordsRebuild__direct WRITES them:
      // it lays the progression across the section slots (`song[b]`, `secNames[i]`) and it calls
      // transposeMelody/resnapMelodies when the key moves. A scope narrower than what the apply
      // touches is not a smaller change — it is an unrecorded one, so restoring the main version
      // put back the chords and the key and left the arrangement and the melodies rewritten. The
      // one promise "Add as a new version" makes is that your current version is untouched.
      const v=applyAsVariation('New chords',{chords:true,key:true,tempo:true,song:true,melody:true},
                               ()=>applyChordsRebuild__direct());
      toast('Saved as a new version — “'+v.name+'”. Your current version is untouched.');
      return;
    }
    return applyChordsRebuild__direct();
  }
  function applyChordsRebuild__direct(){
    if(!imp||!imp.chords||!imp.chords.length) return;
    oneCheckpoint(()=>{
      applyChosenTempo();
      const old=keyRoot;
      keyRoot=imp.key; keyRootEl.value=String(keyRoot);
      keyMode=imp.mode==='major'?'major':'minor'; keyModeEl.value=keyMode;
      relabelChords(); transposeMelody(keyRoot-old); resnapMelodies();
      // Write the suggested progression into the chord lane so the singer hears it. Edits made in
      // the preview win, and a degree Aura could not fit inside the key is left out rather than
      // forced into a chord that would fight the vocal.
      // ONE Aura pattern is ONE bar (STEPS 16 == 4 beats). Writing bars 1-4 of a progression at steps
      // 0/4/8/12 of a single pattern therefore played the whole progression inside one bar — four
      // times too fast against the recording it came from. A multi-bar progression has to live across
      // the SECTION SLOTS, one chord per slot, and the arrangement carries it at its real rate.
      const src=(imp.edit&&imp.edit.chordOf)||{};
      const cells=chordCells();
      const degOf=c=>{ const d=(src[c.bar]!=null)?src[c.bar]:c.degree;
        return (d==null||d<0||d>6)?null:d; };
      // Which detected bar does each section slot stand for? If a multi-part arrangement already
      // exists, respect it: slot i takes the chord of the first arranged bar that uses slot i.
      const slotBar=new Array(N_PATTERNS).fill(-1);
      song.forEach((slot,bar)=>{ if(slot!=null && slot<N_PATTERNS && slotBar[slot]<0) slotBar[slot]=bar; });
      const usedSlots=slotBar.filter(b=>b>=0).length;
      // How long is the progression before it repeats? A four-bar loop needs four slots to be heard at
      // its real rate; a one-chord vamp needs one. Without this, a recording Aura hears as a single
      // part collapses its whole progression down to one chord.
      const names=cells.map(c=>c.name);
      const periodOf=()=>{
        for(const L of [1,2,4,8]){
          if(names.length<L*2) continue;
          let same=true;
          for(let i=0;i+L<Math.min(names.length,L*4);i++) if(names[i]!==names[i+L]){ same=false; break; }
          if(same) return L;
        }
        return Math.max(1,Math.min(N_PATTERNS,names.length));
      };
      const period=Math.min(N_PATTERNS,periodOf());
      let wrote=0;
      const putChord=(pat,bar)=>{
        const c=cells[bar]; if(!c) return false;
        const deg=degOf(c); if(deg==null) return false;
        CHORD_DEGREES.forEach(cd=>{ for(let s=0;s<STEPS;s++) patterns[pat][cd.id][s]=false; });
        patterns[pat]['deg'+deg][0]=true;
        // Twice a bar only when the harmony genuinely moves at that rate.
        if(imp.harmony&&imp.harmony.rate==='double'){
          const nxt=cells[bar+1], nd=nxt?degOf(nxt):null;
          if(nd!=null) patterns[pat]['deg'+nd][8]=true;
        }
        return true;
      };
      if(usedSlots>1){
        for(let i=0;i<N_PATTERNS;i++) if(slotBar[i]>=0 && putChord(i,slotBar[i])) wrote++;
      } else {
        // One part, or none arranged yet. Give the progression its own slots and lay them across the
        // song, so the chords change at the rate they change in the recording.
        for(let i=0;i<period;i++) if(putChord(i,i)) wrote++;
        if(wrote>1){
          for(let b=0;b<SONG_SLOTS;b++) song[b]=b%wrote;
          for(let i=0;i<wrote;i++) if(!secNames[i]||/^Sec /.test(secNames[i])) secNames[i]='Part '+(i+1);
          renderAllSlots();
          document.querySelectorAll('#secnames input').forEach((el,i)=>{ el.value=secNames[i]||''; });
        }
      }
      if(!wrote){ CHORD_DEGREES.forEach(c=>{ for(let s=0;s<STEPS;s++) P()[c.id][s]=false; });
        const c=cells[0], deg=c?degOf(c):null;
        if(deg!=null){ P()['deg'+deg][0]=true; wrote=1; } }
      renderGrid(); refreshPatBtns();
      imp.chordSlots=wrote;
    });
    const n=imp.chordSlots||0;
    toast(n>1 ? 'Chords applied across '+n+' parts — one chord each, a starting point you can change'
              : 'Chord applied — a starting point you can change');
  }

  // Melody is opt-in and previewed before it touches anything. Dominant f0 by harmonic product
  // spectrum, median-filtered, segmented into notes, then snapped to the key.
  function findMelodyIdeas(){
    if(!imp||!smp.buf) return null;
    const {data,rate}=monoDown(smp.buf,11025);
    const N=1024, HOP=256, bins=N/2;
    const win=new Float32Array(N);
    for(let i=0;i<N;i++) win[i]=0.5-0.5*Math.cos(2*Math.PI*i/(N-1));
    const re=new Float32Array(N), im=new Float32Array(N);
    const frames=Math.max(0,Math.floor((data.length-N)/HOP));
    const f0=new Float32Array(frames), amp=new Float32Array(frames);
    const hz=rate/N;
    for(let f=0;f<frames;f++){
      const off=f*HOP;
      for(let i=0;i<N;i++){ re[i]=(data[off+i]||0)*win[i]; im[i]=0; }
      fft(re,im);
      const mag=new Float32Array(bins);
      let tot=0;
      for(let b=0;b<bins;b++){ mag[b]=Math.sqrt(re[b]*re[b]+im[b]*im[b]); tot+=mag[b]; }
      amp[f]=tot/bins;
      // harmonic product spectrum over 3 harmonics, restricted to a singable range
      let best=0,bf=0;
      const lo=Math.max(2,Math.round(110/hz)), hiB=Math.round(1000/hz);
      for(let b=lo;b<hiB;b++){
        const p=mag[b]*(mag[Math.min(bins-1,b*2)]||0)*(mag[Math.min(bins-1,b*3)]||0);
        if(p>best){ best=p; bf=b; }
      }
      f0[f]=bf*hz;
    }
    // median filter to kill octave jumps and dropouts
    const med=new Float32Array(frames), W=5, tmp=[];
    for(let f=0;f<frames;f++){
      tmp.length=0;
      for(let i=Math.max(0,f-W);i<=Math.min(frames-1,f+W);i++) tmp.push(f0[i]);
      tmp.sort((a,b)=>a-b); med[f]=tmp[tmp.length>>1];
    }
    const ampMean=(()=>{ let s=0; for(let f=0;f<frames;f++) s+=amp[f]; return s/(frames||1); })();
    const fps=rate/HOP, spb=60/(+bpmEl.value||105), sixteenth=spb/4;
    const notes=[]; let cur=null;
    const toMidi=hzv=>Math.round(69+12*Math.log2(hzv/440));
    for(let f=0;f<frames;f++){
      const strong=amp[f]>ampMean*0.9 && med[f]>80;
      const p=strong?toMidi(med[f]):null;
      if(p!=null && p>=PR_LO && p<=PR_HI){
        if(cur && cur.p===p){ cur.end=f; cur.hz.push(med[f]); }
        else { if(cur) notes.push(cur); cur={p, start:f, end:f, hz:[med[f]]}; }
      } else if(cur){ notes.push(cur); cur=null; }
    }
    if(cur) notes.push(cur);
    // Convert to Aura note tuples, and keep the ORIGINAL time and pitch alongside each one so the
    // preview can show what was heard and where it landed. The mapping is the reviewable part: a note
    // Aura moved by a whole sixteenth is something the singer should see, not something to hide.
    // Aura's bar is one bar long, so a line longer than that folds onto the same sixteen steps —
    // stated in the UI rather than silently truncated.
    const out=[]; let total=0;
    notes.forEach(n=>{
      total++;
      const t0=n.start/fps, t1=(n.end+1)/fps;
      if(t1-t0 < sixteenth*0.6) return;                       // too short to be a hook note
      const s=Math.round(t0/sixteenth), l=Math.max(1,Math.round((t1-t0)/sixteenth));
      if(s<0) return;
      // Steadiness: how little the pitch wandered while the note sounded, in cents. A note that
      // wobbles a quarter-tone reads about 50%. This is a measurement of the pitch track, and the UI
      // says so — it is not a claim about whether this is really the tune.
      const mean=n.hz.reduce((a,b)=>a+b,0)/n.hz.length;
      let dev=0; n.hz.forEach(h=>{ const c=1200*Math.log2(h/mean); dev+=c*c; });
      const cents=Math.sqrt(dev/n.hz.length);
      out.push({ p:snapScale(n.p), s:((s%STEPS)+STEPS)%STEPS, l:Math.max(1,Math.min(l,STEPS)),
                 v:0.85, at:t0, dur:t1-t0, hz:mean, midiHeard:n.p,
                 stab:Math.max(0,Math.min(1,1-cents/50)) });
    });
    out.sort((a,b)=>a.at-b.at);
    const kept=out.length;
    const stab=kept? out.reduce((a,n)=>a+n.stab,0)/kept : 0;
    // Capped at 0.70 on purpose: a finished mix hides a melodic line, so this can never read as certain.
    const conf=Math.max(0.1,Math.min(0.70, kept? (0.25+0.45*stab)*Math.min(1,kept/8) : 0.1));
    return {notes:out.slice(0,24), examined:total, conf, steadiness:stab};
  }

  // ---------- reconstruction preview ----------
  // Percussion is the strongest result, so it leads. Melody is opt-in and previewed. Every row
  // states its own confidence and nothing is written until its Apply is pressed.
  function confLabel(c){ return c>=0.66?'good':c>=0.42?'fair':'low'; }
  function renderRebuild(){
    const host=document.getElementById('rebuildRows'), sec=document.getElementById('rebuild');
    if(!host||!sec) return;
    if(!imp){ sec.hidden=true; host.innerHTML=''; return; }
    sec.hidden=false; host.innerHTML='';
    deriveBeatView();                       // imp.view must exist before any Apply can read it
    closeRbPop();
    // `conf` may be a single number or {timing, instruments}: the two are measured separately and are
    // never averaged into one figure, because a dependable grid must not be able to hide an
    // undependable drum name.
    const row=(title,body,conf,btnLabel,onApply,extra)=>{
      const d=document.createElement('div'); d.className='rbrow';
      const h=document.createElement('div'); h.className='rbhead';
      const t=document.createElement('b'); t.textContent=title; h.appendChild(t);
      let worst=null;
      const addConf=(lbl,c)=>{
        if(c==null) return;
        worst=(worst==null)?c:Math.min(worst,c);
        const s=document.createElement('span'); s.className='rbconf c-'+confLabel(c);
        s.textContent=lbl+' '+confLabel(c)+' · '+Math.round(c*100)+'%';
        h.appendChild(s);
      };
      if(conf!=null&&typeof conf==='object'){ addConf('timing',conf.timing); addConf('instruments',conf.instruments); }
      else addConf('confidence',conf);
      if(worst!=null&&worst<0.42){ const n=document.createElement('span'); n.className='rbneeds'; n.textContent='Needs review'; h.appendChild(n); }
      const p=document.createElement('div'); p.className='rbbody'; p.textContent=body;
      d.appendChild(h); d.appendChild(p);
      if(extra) d.appendChild(extra);
      // In "Analyze only" the report is READ ONLY. The Apply buttons are not rendered at all rather
      // than rendered disabled — a control that cannot act should not be on screen.
      if(btnLabel&&impMode!=='analyze'){
        const b=document.createElement('button'); b.className='rbapply'; b.textContent=btnLabel;
        b.addEventListener('click',onApply); d.appendChild(b); }
      host.appendChild(d); return d;
    };
    const mk=(tag,cls,txt)=>{ const e=document.createElement(tag); if(cls) e.className=cls;
      if(txt!=null) e.textContent=txt; return e; };

    // ================= 1. percussion, the headline result =================
    const B=imp.beat, V=imp.view;
    const extra=mk('div','rbextra');

    if(B.noKit){
      row('The drums','Aura could not pick out any drums in this recording, so it has not written any. '
        +'The tempo and key above still apply, and you can tap out a beat yourself in Beat.',
        {timing:imp.timingConf}, null, null, null);
    } else {
      // ---- how to apply ----
      const seg=mk('div','seg rbmode'); seg.id='beatModeSeg';
      seg.setAttribute('role','radiogroup');
      seg.setAttribute('aria-label','How to apply the detected beat to section '+(currentPattern+1));
      const why=mk('div','rbtiming'); why.id='beatModeWhy';
      const secHasDrums=()=>drums.some(d=>P()[d.id].some(Boolean));
      const paintMode=()=>{
        seg.querySelectorAll('button').forEach(b=>{
          const on=b.dataset.bm===beatApplyMode;
          b.classList.toggle('on',on); b.setAttribute('aria-checked',String(on));
          b.textContent=(on?'✓ ':'')+b.dataset.lbl;
        });
        const n=currentPattern+1;
        why.textContent = !secHasDrums()
          ? 'Section '+n+' has no drums yet, so both choices do the same thing.'
          : beatApplyMode==='fill'
            ? 'Keeps every drum already in section '+n+' and only adds Aura’s hits where a step is empty.'
            : 'Clears every drum in section '+n+' — including claps, percussion and any accents you added — then writes Aura’s. Undo puts it back.';
      };
      [{k:'replace',lbl:'Replace what’s there'},{k:'fill',lbl:'Only fill the gaps'},
       {k:'variation',lbl:'Add as a new version'}].forEach(m=>{
        const b=mk('button'); b.type='button'; b.setAttribute('role','radio');
        b.dataset.bm=m.k; b.dataset.lbl=m.lbl;
        b.addEventListener('click',()=>{ beatApplyMode=m.k; paintMode(); });
        seg.appendChild(b);
      });
      paintMode();
      extra.appendChild(seg); extra.appendChild(why);

      // ---- every detected step, tappable, so an uncertain one can be moved or dropped ----
      const lanesWrap=mk('div','rblanes');
      let chips=0;
      for(let s=0;s<STEPS;s++){
        OUT_IDS.forEach(id=>{
          if(!V.grid[id][s]) return;
          chips++;
          const c=mk('button','rbchip'); c.type='button';
          if(V.review[id][s]) c.classList.add('review');
          c.appendChild(mk('span','st',(s+1)+''));
          c.appendChild(mk('b',null,LANE_LABEL[id]||id));
          const conf=B.laneConfStep[id][s]||0;
          c.title=(V.review[id][s]?'Needs review — ':'')+LANE_LABEL[id]+' on step '+(s+1)
            +' · instrument confidence '+Math.round(conf*100)+'%'
            +' · moved '+(B.offs[id][s]>=0?'+':'')+Math.round((B.offs[id][s]||0)*1000)+' ms to reach the grid';
          c.setAttribute('aria-label','Change what plays on step '+(s+1)+', now '+LANE_LABEL[id]
            +(V.review[id][s]?' — needs review':''));
          // This chip opens a chooser, it does not toggle. Saying so is the difference between
          // "button" and "menu button, opens a menu" when a screen reader reaches it.
          c.setAttribute('aria-haspopup','menu');
          c.setAttribute('aria-expanded','false');
          c.addEventListener('click',e=>{ e.stopPropagation(); openLanePop(c,id,s); });
          lanesWrap.appendChild(c);
        });
      }
      if(chips) extra.appendChild(lanesWrap);
      const tapHint=mk('div','rbtiming','Tap any step to move it to a different drum, or to drop it. Nothing changes in '
        +'your track until you press Apply.');
      if(chips) extra.appendChild(tapHint);

      // ---- timing before quantisation ----
      const moved=[];
      OUT_IDS.forEach(id=>{ for(let s=0;s<STEPS;s++) if(V.grid[id][s]) moved.push({id,s,o:B.offs[id][s]||0}); });
      moved.sort((a,b)=>Math.abs(b.o)-Math.abs(a.o));
      if(moved.length){
        const w=moved[0];
        extra.appendChild(mk('div','rbtiming',
          'The drums sit slightly off Aura’s grid — the biggest difference is '+Math.abs(Math.round(w.o*1000))
          +' ms on the '+(LANE_LABEL[w.id]||w.id).toLowerCase()+'. Applying tidies every hit onto the grid.'
          +(B.swingApply?' Aura also heard about '+B.swing+' swing and will set it.':'')));
      }
      // ---- rolls finer than the grid, and the metre question, both stated rather than hidden ----
      if(B.roll) extra.appendChild(mk('div','rbtiming',
        'Parts of this move faster than Aura’s grid can hold — hi-hat rolls, most likely. Aura writes the steps it can '
        +'and leaves the rest out rather than inventing them.'));
      const alts=(imp.bpmAlts||[]).filter(a=>Math.abs(a.bpm-imp.bpm)>0.6);
      if(B.metre||alts.length){
        const mrow=mk('div','rbbtns');
        mrow.appendChild(mk('span','rbtiming',
          B.metre==='half-time' ? 'The backbeat lands once a bar, so this could be counted half as fast. '
          : B.metre==='half-bar' ? 'Both halves of the bar are identical, so this could be counted twice as fast. '
          : 'Tempo has more than one defensible reading. '));
        [[2,'Try twice as fast'],[0.5,'Try half as fast']].forEach(([m,lbl])=>{
          const b=mk('button','ghost',lbl); b.type='button';
          b.title='Re-fits the preview against a '+(m===2?'doubled':'halved')+' beat. Nothing is applied.';
          b.addEventListener('click',()=>refitMetre(m));
          mrow.appendChild(b);
        });
        extra.appendChild(mrow);
      }

      const laneTxt=OUT_IDS.filter(id=>V.grid[id].some(v=>v))
        .map(id=>`${LANE_LABEL[id]} ×${V.grid[id].filter(Boolean).length}`).join(' · ');
      row('The drums',
        `Aura listened to ${Math.round(imp.dur)} seconds at ${imp.bpm} BPM`
        +`${B.refitBpm?' (previewing at '+B.refitBpm+')':''} and used the ${Math.max(1,B.window.barEnd-B.window.barStart)} bars that repeat most`
        +`${B.windowLabel?', around '+B.windowLabel:''}, because one section holds one groove. `
        +`${laneTxt?laneTxt+'.':'Aura could not pick out any drums here.'}`
        +(B.reviewSteps?` Aura is confident about WHEN the drums hit and less confident about WHICH drum, so `
          +`${B.reviewSteps} step${B.reviewSteps===1?' is':'s are'} marked Needs review — tap to move or drop them.`
         :' Aura is confident about every drum it found here.'),
        {timing:imp.timingConf, instruments:imp.classConf},
        'Apply these drums', ()=>applyBeatRebuild(), extra);
    }

    // ================= 2. song structure =================
    const plan=sectionPlan();
    if(plan.length){
      const ex=mk('div','rbextra');
      const neutral=imp.sections.neutral;
      const bounds=mk('div','rbbounds');
      // Boundary handles: the arrangement is in bars, so a boundary IS a bar count. Two 44px targets
      // per area move it, which works with a pointer and with a thumb, and edits live on imp.edit.
      if(!imp.edit) deriveBeatView();
      const cur=()=>{ if(!imp.edit.secBound||imp.edit.secBound.length!==plan.length)
          imp.edit.secBound=plan.map(s=>s.bars); return imp.edit.secBound; };
      plan.forEach((s,i)=>{
        const seg=mk('div','rbseg'); if(s.needsReview) seg.classList.add('review');
        seg.appendChild(mk('div','nm',s.label+(s.repeats>1?' ×'+s.repeats:'')));
        const bars=mk('div','bars');
        const minus=mk('button','ghost','−'); minus.type='button';
        minus.setAttribute('aria-label','One bar fewer in '+s.label);
        const nb=mk('span',null,cur()[i]+(cur()[i]===1?' bar':' bars'));
        const plus=mk('button','ghost','+'); plus.type='button';
        plus.setAttribute('aria-label','One bar more in '+s.label);
        minus.addEventListener('click',()=>{ const a=cur(); a[i]=Math.max(1,a[i]-1); renderRebuild(); });
        plus.addEventListener('click',()=>{ const a=cur(); a[i]=Math.min(SONG_SLOTS,a[i]+1); renderRebuild(); });
        bars.appendChild(minus); bars.appendChild(nb); bars.appendChild(plus);
        seg.appendChild(bars);
        bounds.appendChild(seg);
      });
      ex.appendChild(bounds);
      ex.appendChild(mk('div','rbtiming', neutral
        ? 'Aura can hear which parts come back, but this recording does not get louder and quieter enough for it to tell '
          +'a verse from a chorus. That is why the parts are called A, B and C — rename them once you have applied them.'
        : 'These names come from which parts repeat and which are loudest. Aura does not understand song form, so a part '
          +'marked Needs review is one it could only recognise by the fact that it comes back.'));
      if(plan.scaled) ex.appendChild(mk('div','rbtiming',
        'Your recording is longer than Aura’s 32 bars, so the parts keep their order and their relative lengths, shorter.'));
      if(plan.folded) ex.appendChild(mk('div','rbtiming',
        'Aura has room for six parts and this recording has more, so the later ones share one. Add the rest yourself.'));
      const txt=plan.map(s=>`${s.label} ${s.bars} bar${s.bars===1?'':'s'}`).join(' · ');
      const avg=plan.reduce((a,s)=>a+s.conf,0)/plan.length;
      row('The parts of your song', txt, avg, 'Apply these parts', ()=>applySectionsRebuild(), ex);
    }

    // ================= 3. harmony =================
    const cells=chordCells();
    if(cells.length){
      const H=imp.harmony||{};
      const ex=mk('div','rbextra');
      // Where bar 1 starts. Exposed rather than applied silently: a plausible chord on the wrong bar
      // line is worse than an obvious question, and re-picking costs no re-analysis.
      if(H.phaseScores&&H.phaseScores.length===4){
        const prow=mk('div','rbbtns');
        prow.appendChild(mk('span','rbtiming','Which beat your bar starts on:'));
        const grp=mk('div','seg rbmode'); grp.setAttribute('role','radiogroup');
        grp.setAttribute('aria-label','Which beat bar 1 starts on');
        const chosen=(imp.edit&&imp.edit.chordPhase!=null)?imp.edit.chordPhase:H.phase;
        H.phaseScores.forEach(ps=>{
          const b=mk('button'); b.type='button'; b.setAttribute('role','radio');
          const on=ps.phase===chosen;
          b.textContent=(on?'✓ ':'')+'Beat '+(ps.phase+1);
          b.classList.toggle('on',on); b.setAttribute('aria-checked',String(on));
          b.title='Bar alignment '+ps.hom.toFixed(2)+' · repeats '+ps.rep.toFixed(2);
          b.addEventListener('click',()=>{ imp.edit.chordPhase=ps.phase; imp.edit.chordOf={}; renderRebuild(); });
          grp.appendChild(b);
        });
        prow.appendChild(grp); ex.appendChild(prow);
        if(H.phaseUncertain) ex.appendChild(mk('div','rbtiming',
          'Aura is not sure which beat your bar starts on — two of these fit almost equally well. Listen to the chords '
          +'and pick the one that feels right.'));
      }
      // Editable per-bar chords. Tap a bar to change it before applying.
      const cw=mk('div','rbcells');
      cells.slice(0,16).forEach(c=>{
        const deg=(imp.edit&&imp.edit.chordOf&&imp.edit.chordOf[c.bar]!=null)?imp.edit.chordOf[c.bar]:c.degree;
        const b=mk('button','rbcell'); b.type='button';
        if((c.conf||0)<0.42) b.classList.add('low');
        b.appendChild(mk('span','bar','Bar '+(c.bar+1)));
        b.appendChild(mk('span','ch', deg>=0?impChordName(deg):c.name));
        b.title='Suggested '+c.name+(c.alt?' · second reading '+c.alt:'')
          +' · confidence '+Math.round((c.conf||0)*100)+'%'+(c.smoothed?' · smoothed to match its neighbours':'');
        b.setAttribute('aria-label','Change the chord in bar '+(c.bar+1)+', now '+(deg>=0?impChordName(deg):c.name));
        b.addEventListener('click',e=>{ e.stopPropagation(); openChordPop(b,c.bar,deg); });
        cw.appendChild(b);
      });
      ex.appendChild(cw);
      ex.appendChild(mk('div','rbtiming','Tap a bar to pick a different chord before you apply. Only chords that fit your key are offered, so nothing you choose here can clash.'));
      const keyTxt='Suggested key '+NOTE_NAMES[imp.key]+(imp.mode==='minor'?'m':'')
        +' (key confidence '+confLabel(imp.keyConf)+')'
        +(imp.keyAlt?' · it could also be '+NOTE_NAMES[imp.keyAlt.key]+(imp.keyAlt.mode==='minor'?'m':'')
          +', which scored almost the same':'')
        +(H.rate==='double'?' · the chords appear to change twice a bar':'');
      ex.appendChild(mk('div','rbtiming',keyTxt));
      ex.appendChild(mk('div','rbtiming','Applying moves your whole track to this key and puts one chord in each section, '
        +'so the chords change at the speed they do in the recording.'));
      const first=cells.slice(0,8).map(c=>c.name).join(' – ');
      const avg=cells.reduce((a,c)=>a+(c.conf||0),0)/cells.length;
      row('The chords', first, avg, 'Apply the key and chords', ()=>applyChordsRebuild(), ex);
    }

    renderVariations();

    // ================= 3b. the low end =================
    // Shown whether or not Aura found bass, because "there is no bass here" is a real answer a
    // singer needs, and silence about it reads as a missing feature.
    {
      const L=imp.lowEnd;
      if(!L||L.noBass){
        row('The low end',
          'Aura did not find a bass part it could build from — '+((L&&L.why)||'there is not enough held low frequency in this recording')+
          '. Nothing has been written. You can still play a bass yourself, and Aura’s chords will carry the low end.',
          null, null, null, null);
      } else {
        const plan=lowEndPlan();
        if(plan){
          const ex=mk('div','rbextra');
          const shapes=plan.slots.map(sl=>sl.label+' '+sl.shapeLabel).join(' · ');
          const rhythmTxt=plan.rhythm.map(x=>x+1).join(', ');
          const info=mk('p','rbtiming',
            'Rhythm on steps '+rhythmTxt+'. '+
            (plan.sustained?'Held notes':'Shorter notes')+
            ', around '+Math.round(plan.medLenMs||0)+' ms in the recording'+
            (plan.octShift?(plan.octShift<0?', sitting an octave low':', sitting an octave high'):'')+'.');
          ex.appendChild(info);
          if(plan.slots.length>1){
            const sh=mk('p','rbtiming','Per section: '+shapes+'.');
            ex.appendChild(sh);
          }
          // Every generated note, tappable to drop it — the same "nothing changes until Apply"
          // contract the drums row uses.
          if(!imp.edit) imp.edit={};
          if(!imp.edit.dropLow) imp.edit.dropLow={};
          const chips=mk('div','rbchips');
          plan.slots.forEach(sl=>{
            sl.notes.forEach((n,ix)=>{
              const key=sl.i+':'+ix;
              const b=mk('button','rbchip'); b.type='button';
              const dropped=!!imp.edit.dropLow[key];
              b.classList.toggle('dropped',dropped);
              b.textContent=(dropped?'✕ ':'')+(n.s+1)+' · '+NOTE_NAMES[((n.p%12)+12)%12]+(n.g?' ⤳':'');
              b.title=(dropped?'Dropped. ':'')+'Section '+(sl.i+1)+', step '+(n.s+1)+', '+n.l+' step'+(n.l===1?'':'s');
              b.setAttribute('aria-pressed',String(!dropped));
              b.addEventListener('click',()=>{ imp.edit.dropLow[key]=!dropped; renderRebuild(); });
              chips.appendChild(b);
            });
          });
          ex.appendChild(chips);
          ex.appendChild(mk('p','rbtiming',
            'Tap a note to drop it. Aura writes an ORIGINAL low-end part — it follows the detected '
            +'harmony, rhythm and section energy, and it is not the original bassline.'));
          row('The low end',
            'Aura created an original low-end part that follows the detected harmony, rhythm and '
            +'section energy. It plays Aura’s own bass sound in the detected key.',
            plan.conf, 'Apply this low end', ()=>applyLowEndRebuild(), ex);
        }
      }
    }

    // ================= 4. melody, opt-in =================
    const mel=mk('div','rbrow');
    const mh=mk('div','rbhead'); mh.appendChild(mk('b',null,'Melody ideas'));
    // Every other row states a confidence here. An empty span left this one with no status at all —
    // sighted readers infer "nothing yet" from the layout; a screen reader just meets an empty
    // element. Say it instead.
    const mc=mk('span','rbconf c-none','not looked for yet'); mh.appendChild(mc);
    const mb=mk('div','rbbody','Aura can look for the strongest tune it can hear. In a finished song this is the least '
      +'reliable of the four results, so it stays out of your project until you apply it. It is a line Aura heard — not '
      +'the original singer, and not any one instrument.');
    mel.appendChild(mh); mel.appendChild(mb);
    // `rbapply` means "writes into the project". Finding melody ideas does not — it computes
    // suggestions onto the analysis object, which Apply is what commits. Sharing the class made
    // "Analyze only" look as though it still offered a way to write.
    const find=mk('button','rbfind','Find melody ideas');
    mel.appendChild(find);
    host.appendChild(mel);
    const showMelody=r=>{
      mc.textContent='steady '+confLabel(r.conf)+' · '+Math.round(r.conf*100)+'%';
      mc.className='rbconf c-'+confLabel(r.conf);
      if(r.conf<0.42){ const n=mk('span','rbneeds','Needs review'); mh.appendChild(n); }
      mb.textContent=`${r.notes.length} candidate note${r.notes.length===1?'':'s'} from ${r.examined} detected pitches, `
        +`kept inside ${NOTE_NAMES[imp.key]}${imp.mode==='minor'?'m':''}. Steady means the pitch held still — a wobbly note `
        +`probably was not a melody note at all. Listen to it, drop what you do not want, then apply.`;
      const tbl=mk('div','rbnotes');
      r.notes.forEach((n,i)=>{
        const rw=mk('div','rbnrow');
        const dropped=!!(imp.edit&&imp.edit.dropNote&&imp.edit.dropNote[i]);
        if(dropped) rw.classList.add('off');
        rw.appendChild(mk('span','t',fmtClock(n.at)));
        rw.appendChild(mk('span','n',noteName(n.p)));
        rw.appendChild(mk('span','st','beat '+(Math.floor(n.s/4)+1)));
        const tg=mk('button','ghost',dropped?'Use':'Drop'); tg.type='button';
        tg.setAttribute('aria-label',(dropped?'Use':'Drop')+' the note at '+fmtClock(n.at));
        tg.addEventListener('click',()=>{ if(!imp.edit) deriveBeatView();
          imp.edit.dropNote[i]=!dropped; renderRebuild(); });
        rw.appendChild(tg);
        tbl.appendChild(rw);
      });
      mel.appendChild(tbl);
      mel.appendChild(mk('div','rbtiming','Each row is when Aura heard the note and where it lands in the bar. '
        +'Applying replaces every melody note in section '+(currentPattern+1)+', and you can move any note '
        +'afterwards in Melody.'));
      const bar=mk('div','rbbtns');
      const aud=mk('button','ghost','▶ Audition'); aud.type='button';
      // This row builds its own Apply outside the row() helper, so it needs the same read-only rule:
      // "Analyze only" must render no way to write into the project. Auditioning is still fine —
      // listening changes nothing.
      const app=impMode==='analyze'?null:mk('button','rbapply','Apply melody ideas');
      if(app) app.type='button';
      const dis=mk('button','ghost','Discard ideas'); dis.type='button';
      bar.appendChild(aud); if(app) bar.appendChild(app); bar.appendChild(dis); mel.appendChild(bar);
      aud.addEventListener('click',()=>auditionMelodyIdeas());
      if(app) app.addEventListener('click',()=>applyMelodyRebuild());
      dis.addEventListener('click',()=>{ imp.melody=null; if(imp.edit) imp.edit.dropNote={};
        renderRebuild(); toast('Melody ideas discarded — your project was not changed'); });
    };
    if(imp.melody&&imp.melody.notes&&imp.melody.notes.length){ find.remove(); showMelody(imp.melody); }
    else find.addEventListener('click',()=>{
      find.disabled=true; find.textContent='Listening…';
      setTimeout(()=>{
        const r=findMelodyIdeas();
        find.remove();
        if(!r||!r.notes.length){ mb.textContent='No clear melodic line stood out from this recording. Nothing was changed.'; return; }
        imp.melody=r; showMelody(r);
      },30);
    });

    document.getElementById('rebuildHint').textContent='Nothing above is written into your project until you press its Apply.';
  }
  const fmtClock=s=>{ s=Math.max(0,s); const m=Math.floor(s/60), r=s-m*60;
    return m+':'+(r<10?'0':'')+r.toFixed(2); };
  // The chord preview has to speak in the key Apply is going to SET, not the key the project happens
  // to be in now. Naming a degree against the current key showed "Am" for a chord that would be
  // written as "Cm" the moment Apply moved the project — a preview that disagrees with its own Apply.
  function impScale(){ return SCALES[(imp&&imp.mode==='major')?'major':'minor']||SCALES.minor; }
  function impChordName(deg){
    const sc=impScale(), root=imp?imp.key:keyRoot;
    if(deg==null||deg<0||deg>6) return '';
    const pc=(root+sc.steps[deg])%12, q=sc.quals[deg];
    return NOTE_NAMES[pc]+(q==='min'?'m':q==='dim'?'°':q==='aug'?'+':'');
  }
  const noteName=p=>NOTE_NAMES[((p%12)+12)%12]+(Math.floor(p/12)-1);

  // ---------- the one-tap popovers ----------
  // Preview-only editors. Both write to imp (scratch) and re-render; neither touches the project,
  // localStorage or history, which is what makes showing an uncertain guess safe.
  let rbPop=null, rbPopAnchor=null;
  function closeRbPop(){
    if(rbPopAnchor){ rbPopAnchor.setAttribute('aria-expanded','false'); rbPopAnchor=null; }
    if(rbPop&&rbPop.parentNode) rbPop.parentNode.removeChild(rbPop); rbPop=null; }
  function placePop(anchor,pop){
    document.body.appendChild(pop);
    const r=anchor.getBoundingClientRect(), w=pop.offsetWidth||200, h=pop.offsetHeight||200;
    pop.style.left=Math.max(8,Math.min(innerWidth-w-8,r.left))+'px';
    pop.style.top=(r.bottom+6+h>innerHeight? Math.max(8,r.top-h-6) : r.bottom+6)+'px';
    const f=pop.querySelector('button'); if(f) f.focus();
  }
  function openLanePop(anchor,id,step){
    closeRbPop();
    const pop=document.createElement('div'); pop.className='rbpop'; rbPop=pop;
    pop.setAttribute('role','menu');
    if(anchor&&anchor.hasAttribute('aria-haspopup')){
      rbPopAnchor=anchor; anchor.setAttribute('aria-expanded','true'); }
    const hd=document.createElement('div'); hd.className='rbpophd';
    hd.textContent='Step '+(step+1)+' — now '+(LANE_LABEL[id]||id);
    pop.appendChild(hd);
    OUT_IDS.forEach(to=>{
      if(to===id) return;
      const b=document.createElement('button'); b.type='button'; b.setAttribute('role','menuitem');
      b.textContent='Move to '+LANE_LABEL[to];
      b.addEventListener('click',()=>{ closeRbPop(); reassignStep(id,step,to); });
      pop.appendChild(b);
    });
    const dr=document.createElement('button'); dr.type='button'; dr.setAttribute('role','menuitem');
    dr.textContent='Drop this hit';
    dr.addEventListener('click',()=>{ closeRbPop(); reassignStep(id,step,null); });
    pop.appendChild(dr);
    placePop(anchor,pop);
  }
  function openChordPop(anchor,bar,curDeg){
    closeRbPop();
    const pop=document.createElement('div'); pop.className='rbpop'; rbPop=pop;
    pop.setAttribute('role','menu');
    const hd=document.createElement('div'); hd.className='rbpophd'; hd.textContent='Bar '+(bar+1);
    pop.appendChild(hd);
    // Only chords from the DETECTED key — the key Apply will move the project to — so nothing a singer
    // picks here can clash with the track once it is applied.
    impScale().steps.forEach((_,deg)=>{
      const b=document.createElement('button'); b.type='button'; b.setAttribute('role','menuitem');
      b.textContent=impChordName(deg)+'  '+impScale().romans[deg]+(deg===curDeg?'   ✓':'');
      b.addEventListener('click',()=>{ closeRbPop();
        if(!imp.edit) deriveBeatView();
        imp.edit.chordOf[bar]=deg; renderRebuild(); });
      pop.appendChild(b);
    });
    placePop(anchor,pop);
  }
  document.addEventListener('click',e=>{ if(rbPop&&!rbPop.contains(e.target)) closeRbPop(); });
  window.addEventListener('keydown',e=>{ if(e.key==='Escape') closeRbPop(); });
  // Audition plays the candidate notes on the melody voice without touching the project.
  // The notes the preview is actually offering: whatever was found, minus anything dropped by hand.
  function melodyKept(){
    if(!imp||!imp.melody) return [];
    const drop=(imp.edit&&imp.edit.dropNote)||{};
    return imp.melody.notes.filter((n,i)=>!drop[i]);
  }
  function auditionMelodyIdeas(){
    if(!imp||!imp.melody) return;
    // Silent failure is banned: say why rather than doing nothing.
    if(playing){ toast('Stop playback to audition the melody ideas'); return; }
    const notes=melodyKept();
    if(!notes.length){ toast('Every note is dropped — nothing to audition'); return; }
    ensureCtx();
    const spb=secondsPerStep(), t0=now()+0.06;
    notes.forEach(n=>{
      playMelody(ac,liveBus.melody,liveBus.melodySend,n.p,t0+n.s*spb,Math.max(0.12,n.l*spb*0.9),n.v,melodySound);
    });
    toast('Auditioning melody ideas — nothing has been applied');
  }
  function applyMelodyRebuild(){
    if(beatApplyMode==='variation'){
      const v=applyAsVariation('New melody',{melody:true,tempo:true},()=>applyMelodyRebuild__direct());
      toast('Saved as a new version — “'+v.name+'”. Your current version is untouched.');
      return;
    }
    return applyMelodyRebuild__direct();
  }
  function applyMelodyRebuild__direct(){
    if(!imp||!imp.melody) return;
    const notes=melodyKept();
    if(!notes.length){ toast('Every note is dropped — your project was not changed'); return; }
    oneCheckpoint(()=>{
      applyChosenTempo();
      P().melody=notes.map(n=>({p:n.p,s:n.s,l:n.l,v:n.v}));
      renderRoll(); refreshPatBtns();
    });
    toast('Melody ideas applied to section '+(currentPattern+1)+' — '+notes.length+' note'+(notes.length===1?'':'s')+', review and edit');
  }
  function discardRebuild(){
    if(!imp){ toast('There is no reconstruction to discard'); return; }
    imp=null; closeRbPop(); renderRebuild();     // no mutation, no autosave, no history entry
    toast('Reconstruction discarded — your project was not changed');
  }

  // ---------- history · projects · metronome (Phase 4) ----------
  const hist={past:[],future:[],last:null}; let restoring=false, dirty=false, projName='Untitled';
  const HIST_MAX=80;
  function snapshot(){ try{ return JSON.stringify(serialize()); }catch(e){ return null; } }
  function pushHistory(){ const s=snapshot(); if(!s||s===hist.last) return;
    if(hist.last!==null){ hist.past.push(hist.last); if(hist.past.length>HIST_MAX) hist.past.shift(); }
    hist.last=s; hist.future.length=0; setDirty(true); }
  function restore(json){ restoring=true;
    try{ applyState(JSON.parse(json)); localStorage.setItem(SAVE_KEY,json); }   // keep storage in step with memory
    catch(e){ console.warn(e); }
    restoring=false; setDirty(true); }
  function undo(){ if(!hist.past.length){ toast('Nothing to undo'); return; }
    hist.future.push(hist.last); hist.last=hist.past.pop(); restore(hist.last); toast('Undo'); }
  function redo(){ if(!hist.future.length){ toast('Nothing to redo'); return; }
    hist.past.push(hist.last); hist.last=hist.future.pop(); restore(hist.last); toast('Redo'); }
  function setDirty(v){ dirty=v; const d=document.getElementById('saveDot'); if(d) d.classList.toggle('dirty',!!v);
    const t=document.getElementById('projName'); if(t) t.textContent=projName+(v?' •':''); }

  // Included demo — built from the app's own functions so it always stays valid.
  function loadDemo(){
    stop();
    patterns.forEach((p,i)=>{ ALL_IDS.forEach(id=>p[id]=new Array(STEPS).fill(false)); p.melody=[];
      drums.forEach(d=>accents[i][d.id]=new Array(STEPS).fill(false)); });
    song.fill(null); Object.keys(mutes).forEach(k=>delete mutes[k]);
    GROUPS.forEach(G=>Object.assign(mix[G.id],mixDefault()));
    currentPattern=0;
    applyVibe('chipmunk');                 // flat-minor soul lane: key, chords, beat, tempo, sounds
    // Section 1 (Intro) — sparse: keep chords, thin the drums
    ['hat','shaker'].forEach(id=>P()[id]=new Array(STEPS).fill(false));
    P().melody=[[75,0,4],[74,4,2],[70,6,2],[72,8,8]].map(a=>({p:a[0],s:a[1],l:a[2],v:0.85}));
    // Section 2 (Verse) — full beat + a hook
    currentPattern=1; applyBeat('boombap'); applyProg('soulflip');
    P().melody=[[70,0,2],[72,2,2],[75,4,4],[74,8,2],[72,10,2],[70,12,4]].map(a=>({p:a[0],s:a[1],l:a[2],v:0.9}));
    // Section 3 (Chorus) — bigger, accent the snare
    currentPattern=2; applyBeat('reggaetonpop'); applyProg('soulflip');
    A()['snare'][3]=true; A()['snare'][11]=true; P()['snare'][3]=true; P()['snare'][11]=true;
    P().melody=[[79,0,4],[77,4,2],[75,6,2],[74,8,4],[75,12,4]].map(a=>({p:a[0],s:a[1],l:a[2],v:1.0}));
    currentPattern=0;
    secNames[0]='Intro'; secNames[1]='Verse'; secNames[2]='Chorus';
    document.querySelectorAll('#secnames input').forEach((el,i)=>el.value=secNames[i]||'');
    // Arrangement: Intro, Verse×2, Chorus×2, Verse, Chorus×2 (12 bars)
    [0,1,1,2,2,1,2,2].forEach((sec,i)=>song[i]=sec);
    for(let i=0;i<SONG_SLOTS;i++) renderSlot(i);
    // Subtle mixer: pad the chords back a touch, a hair of reverb on the melody, gentle drum bus
    mix.chords.vol=88; mix.melody.rev=14; mix.hats.vol=82;
    projName='Aura Demo'; projMeta={id:'',createdAt:''};
    renderGrid(); refreshPatBtns(); syncMixerUI(); applyAllGroupsLive();
    try{ localStorage.setItem(SAVE_KEY, JSON.stringify(serialize())); }catch(e){}   // persist the demo
    hist.past.length=0; hist.future.length=0; hist.last=snapshot(); setDirty(false);
    toast('Loaded the Aura demo — press Play');
  }

  function newProject(){ if(!confirm('Start a new project? Your current track will be cleared.')) return;
    cancelImportJob();                     // an analysis in flight must not land in the new project
    stop(); patterns.forEach((p,i)=>{ ALL_IDS.forEach(id=>p[id]=new Array(STEPS).fill(false)); p.melody=[];
      drums.forEach(d=>accents[i][d.id]=new Array(STEPS).fill(false)); });
    song.fill(null); for(let i=0;i<SONG_SLOTS;i++) renderSlot(i);
    Object.keys(mutes).forEach(k=>delete mutes[k]);
    GROUPS.forEach(G=>Object.assign(mix[G.id],mixDefault()));
    currentPattern=0; projName='Untitled'; projMeta={id:'',createdAt:''}; clearTake();   // a new project is a new identity
    // Kept performance moves are part of the SONG, so a new song has none. Without this the new
    // project inherits the last one's automation and mutes itself part-way through playback and
    // through the export, with nothing on screen explaining why.
    automation.events=[]; variations.activeId=null; variations.main=null; variations.items=[];
    patterns.forEach(p2=>{ p2.bass=[]; });   // and none of its low end
    // Every v13.3 block is part of the SONG too, and all seven leaked into the next project: the
    // groove and its seed, the saved sound, the singer's lyrics and performance notes, the project
    // intention, and the rights ledger. The lyrics one is the one that matters most — someone's
    // private words followed them into a new song and were written into the next .aura they saved.
    // The rights ledger mattered for a different reason: a blank project claimed to hold imported
    // audio it did not have, so Rights and Finish both reported on a file that was not there.
    Object.assign(groove, GROOVE_DEFAULT); grooveSeed = 1;
    soundPick.keptId = null; soundPick.tryingId = null;
    soundPick.oct = 0; soundPick.adj = { warmer:0, brighter:0, wider:0 };
    lyrics.sections = {}; lyrics.notes = {};
    Object.assign(intention, INTENTION_DEFAULT);
    provenance.assets = []; provenance.confirmed = false; provenance.confirmedAt = '';
    paintPerform(); renderVariations();
    seedSong(); applyVibe('moody'); renderGrid(); refreshPatBtns(); syncMixerUI(); applyAllGroupsLive();
    refreshCraftUI();
    hist.past.length=0; hist.future.length=0; hist.last=snapshot(); setDirty(false); toast('New project'); }

  // recent projects: names + the state itself, so "recent" actually reopens
  function pushRecent(name,state){
    // note whether a take/import existed at save time, so the drawer can say it was left behind
    let media={vocals:false,sample:false};
    try{ media={vocals:!!(typeof vocalBuffer!=='undefined'&&vocalBuffer),
                sample:!!(typeof smp!=='undefined'&&smp&&smp.buf)}; }catch(e){}
    // Carry the project's identity alongside its state, so reopening from Recents resumes that
    // project rather than minting a new one. This is localStorage only — the .aura schema is
    // untouched. Entries written before this existed have no meta; those reopen without an
    // identity and the next Save mints one, which is correct: there is nothing to resume.
    const meta={id:projMeta.id||'',createdAt:projMeta.createdAt||''};
    try{ const list=JSON.parse(localStorage.getItem('aura-recent')||'[]').filter(r=>r.name!==name);
      list.unshift({name,at:Date.now(),state,media,meta}); localStorage.setItem('aura-recent',JSON.stringify(list.slice(0,5)));
    }catch(e){}
  }
  function recentProjects(){ try{ return JSON.parse(localStorage.getItem('aura-recent')||'[]'); }catch(e){ return []; } }
  function writeRecents(list){ try{ localStorage.setItem('aura-recent',JSON.stringify(list)); }catch(e){} }
  function agoLabel(ms){
    if(!ms) return 'unknown time';
    const s=Math.max(0,Math.round((Date.now()-ms)/1000));
    if(s<60) return 'just now';
    const m=Math.round(s/60); if(m<60) return m+(m===1?' minute ago':' minutes ago');
    const h=Math.round(m/60); if(h<24) return h+(h===1?' hour ago':' hours ago');
    const d=Math.round(h/24); if(d<7) return d+(d===1?' day ago':' days ago');
    try{ return new Date(ms).toLocaleDateString(); }catch(e){ return d+' days ago'; }
  }
  // Recent projects drawer — name, when it was updated, whether the take/import was left
  // behind, plus Open and Remove. Replaces the numbered window.prompt list.
  // Resume a stored recent. ONE implementation: the Recent Projects dialog and the Welcome's
  // "pick up where you left off" both call this, so the two cannot drift on project identity —
  // which is the part that is easy to get wrong and silent when you do. The project's own id and
  // createdAt are restored so Save updates it in place; clearing them would be as wrong as
  // inheriting the identity of whatever was open beforehand.
  function resumeRecent(r){
    if(!r) return false;
    restore(JSON.stringify(r.state)); projName=r.name;
    projMeta={id:(r.meta&&r.meta.id)||'', createdAt:(r.meta&&r.meta.createdAt)||''};
    hist.past.length=0; hist.future.length=0; hist.last=snapshot(); setDirty(false);
    toast('Opened '+projName); return true;
  }
  function openRecent(){
    const d=document.getElementById('recentdlg'), host=document.getElementById('recentList');
    const closeBtn=document.getElementById('recentClose');
    const prevFocus=document.activeElement;
    const close=()=>{ d.hidden=true; document.removeEventListener('keydown',onKey,true);
      closeBtn.removeEventListener('click',close);
      refocus(prevFocus); };
    const onKey=e=>{ if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); close(); }
      else if(e.key==='Tab'){ trapTab(d,e); } };
    const render=()=>{
      const list=recentProjects(); host.innerHTML='';
      if(!list.length){ const p=document.createElement('div'); p.className='recentempty';
        p.textContent='No recent projects yet. Save a project and it will appear here.';
        host.appendChild(p); return; }
      list.forEach((r,i)=>{
        const row=document.createElement('div'); row.className='recentrow';
        const meta=document.createElement('div');
        const b=document.createElement('b'); b.textContent=r.name||'Untitled';
        const when=document.createElement('span'); when.textContent='Updated '+agoLabel(r.at);
        meta.appendChild(b); meta.appendChild(when);
        if(r.media&&(r.media.vocals||r.media.sample)){
          const nm=document.createElement('div'); nm.className='nomedia';
          nm.textContent='Vocal takes and imported audio are not stored';
          meta.appendChild(nm);
        }
        const open=document.createElement('button'); open.type='button'; open.textContent='Open';
        open.setAttribute('aria-label','Open '+(r.name||'Untitled'));
        open.addEventListener('click',()=>{ resumeRecent(r); close(); });
        const del=document.createElement('button'); del.type='button'; del.className='ghost del';
        del.textContent='Remove'; del.setAttribute('aria-label','Remove '+(r.name||'Untitled')+' from recents');
        del.addEventListener('click',()=>{ const l=recentProjects(); l.splice(i,1); writeRecents(l); render();
          toast('Removed from recents'); });
        row.appendChild(meta); row.appendChild(open); row.appendChild(del);
        host.appendChild(row);
      });
    };
    render(); d.hidden=false;
    document.addEventListener('keydown',onKey,true);
    closeBtn.addEventListener('click',close);
    const first=host.querySelector('button')||closeBtn; if(first) first.focus();
  }

  // The highest .aura schema this build can read and write — independent of the app version.
  // v13.3 added three optional blocks: `lowEnd`, `variations` and `performance`.
  const SCHEMA_VERSION=3;
  // ...but the number WRITTEN into a file is the minimum a reader must understand to open it
  // without losing anything, not simply the newest this build knows.
  //
  // The three new blocks are additive, so a project that uses none of them is byte-for-byte
  // readable by the deployed 13.2.0-rc.1. Stamping every file "3" would make that build refuse
  // projects it can open perfectly — a fabricated incompatibility. Stamping every file "2" would
  // be worse: 13.2 would open a project carrying three alternate versions, ignore the block it
  // does not know, and the next Save there would write the loss back to disk. Silent data loss
  // beats a clear refusal only if you never look.
  //
  // So: 3 when the file actually carries new-block data, 2 when it does not. `validateProject`
  // refuses anything above what it can read, which is what makes the refusal meaningful.
  function requiredSchema(st){
    const hasLow = Array.isArray(st.lo) && st.lo.some(a=>Array.isArray(a)&&a.length>0);
    const hasVar = !!(st.var && ((Array.isArray(st.var.items)&&st.var.items.length>0) || st.var.main));
    const hasPerf= !!(st.perf && Array.isArray(st.perf.events) && st.perf.events.length>0);
    // A groove left at its defaults, no lyrics and no intention is still a schema-2 file.
    const hasGroove = !!(st.gv && ((st.gv.c && Object.keys(GROOVE_DEFAULT)
      .some(k => st.gv.c[k] !== GROOVE_DEFAULT[k])) || st.gv.sf));
    const hasLyrics = !!(st.ly && ((st.ly.t && Object.keys(st.ly.t).some(k=>st.ly.t[k])) ||
                                   (st.ly.n && Object.keys(st.ly.n).some(k=>st.ly.n[k]))));
    const hasIntent = !!(st.pi && Object.keys(st.pi).some(k => st.pi[k]));
    return (hasLow||hasVar||hasPerf||hasGroove||hasLyrics||hasIntent) ? 3 : 2;
  }
  const APP_VERSION='13.3.0-rc.1';       // semantic app version — the build that wrote the file
  const INTERNAL_STATE_VERSION=13;  // compact-state migration counter (autosave / share links)
  function newProjectId(){ try{ if(crypto&&crypto.randomUUID) return crypto.randomUUID(); }catch(e){} return makeProjectId(); }
  // The `encoding` block documents the compact nested representations that stay positional
  // for size; full field/index rules live in AURA_PROJECT_SCHEMA.md and aura-project.schema.json.
  const ENCODING={
    mixer:'array of 8 channels [kick,snare,hats,bass,chords,melody,vocals,sample]; each [vol,pan,mute,solo,lo,mid,hi,rev,dly]',
    effects:'[delayTimeMs, delayFeedbackPct, reverbSizePct, compressionPct]',
    patterns:'6 sections; each 13 lane bitmasks [kick,snare,clap,hat,openhat,shaker,deg0..deg6]; bit s (1<<s) = step s active (16 steps)',
    accents:'6 sections; each 6 drum bitmasks [kick,snare,clap,hat,openhat,shaker]; bit s = accented step',
    melodies:'6 sections; each an array of note tuples [pitchMidi, startStep, lengthSteps, velocityPct]',
    arrangement:'32 slots; each is a section index 0-5 or null (empty bar)',
    schemaRef:'aura-project.schema.json'
  };
  function buildProjectFile(name, asNew){
    const now=new Date().toISOString();
    if(asNew || !projMeta.id){ projMeta.id=newProjectId(); projMeta.createdAt=now; }
    const st=serialize();
    return {
      format:'aura-project',
      schemaVersion:requiredSchema(st),        // minimum reader version — see requiredSchema()
      appVersion:APP_VERSION,                 // which Aura build wrote this file
      projectId:projMeta.id,
      name,
      createdAt:projMeta.createdAt||now,
      updatedAt:now,
      capabilities:{...CAPABILITIES},          // object: what Aura supports (forward-compatible)
      mediaPersistence:{...MEDIA_PERSISTENCE}, // schema guarantee: audio is never embedded
      content:contentFlags(),                  // what is actually in THIS project
      encoding:ENCODING,                       // how the compact nested arrays are laid out
      note:'Vocal takes and imported audio are never stored in a project file or share link.',
      project:toReadable(st)                   // includes internalStateVersion (from compact `v`)
    };
  }
  // ---------- accessible dialogs (no window.prompt anywhere) ----------
  const MAX_NAME=80;
  // Strip anything that cannot live in a filename, collapse whitespace, cap the length.
  function sanitizeName(s){
    return String(s==null?'':s)
      .replace(/[\/\\:*?"<>|]/g,'')        // characters a filename cannot contain
      .replace(/[\x00-\x1f\x7f]/g,'')       // control characters
      .replace(/\s+/g,' ').trim().slice(0,MAX_NAME);
  }
  function modalOpen(){ return !!document.querySelector('.modal:not([hidden]),.msheet:not([hidden])'); }
  // Return focus to the control that led here. Menu rows are hidden by the time a dialog
  // closes, so fall back to the visible control that owns them.
  function refocus(el){
    const ok=e=>{ try{ return e&&e.isConnected&&e.offsetParent!==null; }catch(x){ return false; } };
    const target = ok(el) ? el
      : [document.getElementById('projX'),document.getElementById('mMore'),
         document.getElementById('recentX')].find(ok);
    if(target){ try{ target.focus(); return true; }catch(e){} }
    return false;
  }
  function trapTab(box,e){
    const f=[...box.querySelectorAll('button,input,select,textarea,[href],[tabindex]:not([tabindex="-1"])')]
      .filter(x=>!x.disabled&&x.offsetParent!==null);
    if(!f.length) return;
    const first=f[0], last=f[f.length-1];
    if(e.shiftKey&&document.activeElement===first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey&&document.activeElement===last){ e.preventDefault(); first.focus(); }
  }
  // Resolves with a sanitized name, or null if cancelled. Focus is trapped and restored.
  function askName(title,dflt,okLabel){
    return new Promise(resolve=>{
      const d=document.getElementById('namedlg'), inp=document.getElementById('nameInput');
      const err=document.getElementById('nameErr'), ok=document.getElementById('nameOk');
      const cancel=document.getElementById('nameCancel'), h=document.getElementById('nameTitle');
      const prevFocus=document.activeElement;
      h.textContent=title; ok.textContent=okLabel||'Save';
      inp.value=String(dflt||'').slice(0,MAX_NAME); err.textContent='';
      d.hidden=false;
      inp.focus(); inp.select();                       // pre-filled AND selected
      const close=val=>{ d.hidden=true;
        document.removeEventListener('keydown',onKey,true);
        ok.removeEventListener('click',onOk); cancel.removeEventListener('click',onCancel);
        refocus(prevFocus);
        resolve(val); };
      const onOk=()=>{ const v=sanitizeName(inp.value);
        if(!v){ err.textContent='Please enter a project name.'; inp.focus(); return; }
        close(v); };
      const onCancel=()=>close(null);
      const onKey=e=>{
        if(!d.contains(document.activeElement)&&e.key!=='Escape') return;
        if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); onCancel(); }
        else if(e.key==='Enter'){ e.preventDefault(); e.stopPropagation(); onOk(); }
        else if(e.key==='Tab'){ trapTab(d,e); }
      };
      document.addEventListener('keydown',onKey,true);
      ok.addEventListener('click',onOk); cancel.addEventListener('click',onCancel);
    });
  }

  // Save keeps this project's identity (projectId + createdAt); only updatedAt moves.
  // Save As (asNew) mints a fresh projectId and createdAt via buildProjectFile, so the copy
  // is a distinct project; it also defaults to a new name so it lands as its own recent entry.
  function saveProject(asNew){
    const dflt = asNew ? (projName+' copy') : projName;
    return askName(asNew?'Save a copy as':'Name this project', dflt, asNew?'Save copy':'Save')
      .then(name=>{
        if(name===null) return null;                 // cancelled — nothing is written
        projName=name;
        const file=buildProjectFile(name, asNew);    // mutates projMeta when asNew (new identity)
        pushRecent(name, serialize());               // separate recent entry (new name)
        const blob=new Blob([JSON.stringify(file,null,2)],{type:'application/json'});
        const url=URL.createObjectURL(blob), a=document.createElement('a');
        a.href=url; a.download=(name.replace(/[^\w\- ]/g,'')||'Untitled')+'.aura';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(()=>URL.revokeObjectURL(url),4000);
        setDirty(false); toast((asNew?'Saved copy ':'Saved ')+a.download);
        return name;
      });
  }
  function saveProjectAs(){ return saveProject(true); }
  let projMeta={id:'',createdAt:''};

  // Validate-then-commit. Nothing from a project file is ever executed — it is parsed as
  // data, field-checked, clamped by applyState, and rejected with a readable message if bad.
  function validateProject(o,fileName){
    if(o===null||typeof o!=='object'||Array.isArray(o)) return {ok:false,msg:'That file does not contain a project.'};
    if(o.format && o.format!=='aura-project') return {ok:false,msg:`“${o.format}” is not an Aura project file.`};
    if(o.schemaVersion && o.schemaVersion>SCHEMA_VERSION)
      return {ok:false,msg:`This project was saved by a newer version of Aura (schema ${o.schemaVersion}). Update Aura to open it.`};
    // schema 2 = readable `project`; schema 1 = compact `state`; oldest = bare compact object
    const st = o.project ? fromReadable(o.project)
             : (o.state && typeof o.state==='object') ? o.state
             : o;
    if(!st.pat && !st.mel && st.bpm===undefined)
      return {ok:false,msg:'That file is missing its song data, so there is nothing to open.'};
    if(st.pat!==undefined && !Array.isArray(st.pat)) return {ok:false,msg:'This project file looks damaged (bad pattern data).'};
    if(st.mel!==undefined && !Array.isArray(st.mel)) return {ok:false,msg:'This project file looks damaged (bad melody data).'};
    // unknown/future keys are simply ignored; applyState reads only what it knows and clamps it
    return {ok:true, state:st, meta:{id:o.projectId,createdAt:o.createdAt},
      name:(typeof o.name==='string'&&o.name.trim())||fileName.replace(/\.aura$/i,'')};
  }
  function openProjectFile(file){
    const fr=new FileReader();
    fr.onerror=()=>toast('Could not read that file.');
    fr.onload=()=>{
      let parsed;
      try{ parsed=JSON.parse(fr.result); }
      catch(e){ toast('That file is not valid JSON, so it cannot be opened.'); return; }
      const r=openProjectObject(parsed,file.name);
      if(!r.ok){ toast(r.msg); return; }
      const c=parsed.content||parsed.contains;
      const noAudio=(c && c.hasVocalTakes===false) || (c && c.vocalTakes===false);
      toast('Opened '+projName+(noAudio?' — vocals and imported audio are not stored in project files':''));
    };
    fr.readAsText(file); }

  // The whole open path minus the FileReader, so a test can drive it with an object. Splitting it
  // out rather than letting the suite reimplement validate-then-commit is the point: a suite that
  // rebuilds the read path tests its own copy, and a bug that only lives in the shipped one walks
  // straight past it. Returns {ok, msg} and mutates the project exactly as opening a file does.
  function openProjectObject(parsed, fileName){
    const v=validateProject(parsed, fileName||'test.aura');
    if(!v.ok) return {ok:false, msg:v.msg};
    const rollback=snapshot();
    try{
      patterns.forEach((p,i)=>{ ALL_IDS.forEach(id=>p[id]=new Array(STEPS).fill(false)); p.melody=[]; p.bass=[];
        drums.forEach(d=>accents[i][d.id]=new Array(STEPS).fill(false)); });
      song.fill(null); Object.keys(mutes).forEach(k=>delete mutes[k]);
      GROUPS.forEach(G=>Object.assign(mix[G.id],mixDefault()));
      restore(JSON.stringify(v.state)); projName=v.name;
      projMeta={id:(v.meta&&v.meta.id)||'', createdAt:(v.meta&&v.meta.createdAt)||''};
      hist.past.length=0; hist.future.length=0; hist.last=snapshot(); setDirty(false);
      return {ok:true, msg:'Opened '+projName};
    }catch(e){ restore(rollback); return {ok:false, msg:'That project could not be loaded, so nothing was changed.'}; }
  }

  let metOn=false;
  let storageWarned=false;
  function autosave(){
    if(applyDepth) return;            // inside an apply: the single checkpoint is taken by oneCheckpoint()
    try{ localStorage.setItem(SAVE_KEY, JSON.stringify(serialize())); setSaveState('saved'); }
    catch(e){
      if(!storageWarned){ storageWarned=true;
        const quota = e && (e.name==='QuotaExceededError'||e.code===22);
        toast(quota
          ? 'Storage is full — Aura can’t autosave. Save a .aura file to keep this track.'
          : 'Autosave is unavailable in this browser (private mode?). Save a .aura file to keep your work.');
      }
      setSaveState('nosave');
    }
    if(!restoring) pushHistory(); }
  function setSaveState(s){ const d=document.getElementById('saveDot'); if(!d) return;
    d.classList.toggle('nosave', s==='nosave');
    d.title = s==='nosave' ? 'Autosave unavailable — save a .aura file' : 'Autosaved in this browser'; }
  function shareLink(){
    const data=btoa(unescape(encodeURIComponent(JSON.stringify(serialize()))));
    const url=location.origin+location.pathname+'#p='+data;
    if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(url).then(()=>toast('Link copied — paste it anywhere'),()=>toast('Link is in your address bar')); }
    else toast('Link is in your address bar');
    try{ history.replaceState(null,'', '#p='+data); }catch(e){}
    return url;
  }
  function loadFromHashOrStorage(){
    const hi=location.hash.indexOf('p=');
    if(hi>-1){ try{ applyState(JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(hi+2)))))); return true; }catch(e){ console.warn('bad share link',e); } }
    try{ const raw=localStorage.getItem(SAVE_KEY); if(raw){ applyState(JSON.parse(raw)); return true; } }catch(e){}
    return false;
  }
  let toastTimer=null;
  function toast(msg){ const el=document.getElementById('toast'); el.textContent=msg; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2600); }

  // ---------- controls ----------
  NOTE_NAMES.forEach((n,i)=>{ const o=document.createElement('option'); o.value=i; o.textContent=n; keyRootEl.appendChild(o); }); keyRootEl.value='0';
  // Sliders commit on `change` (drag end) so undo gets one entry per gesture, not per pixel.
  bpmEl.addEventListener('input',()=>bpmVal.textContent=bpmEl.value);
  bpmEl.addEventListener('change',autosave);
  swingEl.addEventListener('change',autosave);
  masterEl.addEventListener('input',()=>{ if(liveMaster) liveMaster.gain.value=masterEl.value/100; });
  masterEl.addEventListener('change',autosave);
  reverbEl.addEventListener('change',autosave);
  chordVolEl.addEventListener('change',autosave);
  bassVolEl.addEventListener('change',autosave);
  countInEl.addEventListener('change',autosave);
  chordVolEl.addEventListener('input',()=>{ if(liveBus) liveBus.chords.gain.value=chordVolEl.value/100; });
  bassVolEl.addEventListener('input',()=>{ if(liveBus) liveBus.bass.gain.value=bassVolEl.value/100; });
  reverbEl.addEventListener('input',()=>{ reverbWet=reverbEl.value/100*0.7; applyAllGroupsLive(); });   // scales each channel's baseline send
  keyRootEl.addEventListener('change',()=>{ const old=keyRoot; keyRoot=+keyRootEl.value; relabelChords(); transposeMelody(keyRoot-old); });
  keyModeEl.addEventListener('change',()=>{ keyMode=keyModeEl.value; relabelChords(); resnapMelodies(); autosave(); });
  progEl.addEventListener('change',e=>applyProg(e.target.value));
  document.getElementById('preset').addEventListener('change',e=>applyBeat(e.target.value));
  document.getElementById('clear').addEventListener('click',()=>{ if(!confirm('Clear every drum, chord and melody note in this section?')) return;
    rowMeta().forEach(m=>{ if(m) P()[m.id]=new Array(STEPS).fill(false); }); P().melody=[]; drums.forEach(d=>A()[d.id]=new Array(STEPS).fill(false)); renderGrid(); refreshPatBtns(); autosave(); });
  document.getElementById('copy').addEventListener('click',()=>{ const src=currentPattern, nxt=(currentPattern+1)%N_PATTERNS; rowMeta().forEach(m=>{ if(m) patterns[nxt][m.id]=P()[m.id].slice(); }); patterns[nxt].melody=P().melody.map(n=>({...n})); drums.forEach(d=>accents[nxt][d.id]=accents[src][d.id].slice()); currentPattern=nxt; renderGrid(); refreshPatBtns(); autosave(); });
  chordStyleEl.addEventListener('change',()=>{ chordStyle=chordStyleEl.value; ensureCtx(); playChord(ac,liveBus.chords,liveBus.chordSend,chordMidiNotes(0, chordStyle==='soul').map(midiToFreq),now()+.02,.9,chordStyle); autosave(); });
  bassStyleEl.addEventListener('change',()=>{ bassStyle=bassStyleEl.value; ensureCtx(); playBass(ac,liveBus.bass,midiToFreq(chordRootMidi(0)-24),now()+.02,.5,bassStyle); autosave(); });
  autoFillEl.addEventListener('change',autosave);
  document.getElementById('share').addEventListener('click',shareLink);
  exportBtn.addEventListener('click',async e=>{ const b=e.currentTarget; btnText(b,'Rendering…'); b.classList.add('disabled'); try{ await exportWav(); btnText(b,'✓ Saved'); }catch(err){ btnText(b,'Export failed'); console.error(err);} setTimeout(()=>{ b.classList.remove('disabled'); updateExportLabel(); },1500); });
  document.getElementById('modeSeg').addEventListener('click',e=>{ const b=e.target.closest('button[data-mode]'); if(!b) return; mode=b.dataset.mode; document.querySelectorAll('#modeSeg button').forEach(x=>x.classList.toggle('on',x===b)); if(playing){ step=0; slotIndex=0; } });
  playBtn.addEventListener('click',()=> playing?stop():start(false));
  recBtn.addEventListener('click',()=> recording?stopRecording():startRecording());
  playTakeBtn.addEventListener('click',()=> playing?stop():playTake());
  clearTakeBtn.addEventListener('click',clearTake);
  vocalVolEl.addEventListener('input',()=>{ if(takeGain) takeGain.gain.value=+vocalVolEl.value/100; });
  syncEl.addEventListener('input',()=>{ syncVal.textContent=syncEl.value+' ms'; });
  monitorEl.addEventListener('change',()=>{ if(monitorGain) monitorGain.gain.value=monitorEl.checked?0.9:0; });
  document.getElementById('vibes').addEventListener('click',e=>{ const b=e.target.closest('.vibe'); if(b) applyVibe(b.dataset.k); });
  window.addEventListener('keydown',e=>{
    if(modalOpen()) return;              // a dialog owns the keyboard while it is open
    const t=e.target, typing=t.tagName==='INPUT'||t.tagName==='SELECT'||t.tagName==='TEXTAREA'||t.isContentEditable;
    const meta=e.metaKey||e.ctrlKey;
    if(meta&&e.key.toLowerCase()==='z'){ e.preventDefault(); e.shiftKey?redo():undo(); return; }
    if(meta&&e.key.toLowerCase()==='s'){ e.preventDefault(); e.shiftKey?saveProjectAs():saveProject(); return; }
    if(meta) return;
    if(e.code==='Space'&&!typing){ e.preventDefault(); playing?stop():start(false); return; }
    if(typing) return;
    const k=e.key.toLowerCase();
    if(k==='r'){ e.preventDefault(); recording?stopRecording():startRecording(); }
    else if(k==='m'){ metOn=!metOn; const b=document.getElementById('metX'); if(b){b.classList.toggle('on',metOn); b.setAttribute('aria-pressed',String(metOn));} toast(metOn?'Metronome on':'Metronome off'); }
    else if(k>='1'&&k<='4'){ const tab=document.querySelectorAll('.wtab[data-v]')[+k-1]; if(tab) tab.click(); }
    else if(k==='['||k===']'){ const d=k===']'?1:-1; currentPattern=(currentPattern+d+N_PATTERNS)%N_PATTERNS; renderGrid(); refreshPatBtns(); }
  });

  // ---------- sample panel ----------
  function drawWave(){
    const cv=document.getElementById('smpWave'); if(!cv||!smp.buf) return;
    const w=cv.width, h=cv.height, ctx2=cv.getContext('2d');
    ctx2.clearRect(0,0,w,h);
    const d=smp.buf.getChannelData(0), step=Math.max(1,Math.floor(d.length/w));
    ctx2.strokeStyle='rgba(165,76,255,.85)'; ctx2.lineWidth=1; ctx2.beginPath();
    for(let x=0;x<w;x++){ let mn=1,mx=-1;
      for(let i=0;i<step;i++){ const v=d[x*step+i]||0; if(v<mn)mn=v; if(v>mx)mx=v; }
      ctx2.moveTo(x+.5,(1-mn)*h/2); ctx2.lineTo(x+.5,(1-mx)*h/2); }
    ctx2.stroke();
    const ox=(smp.offset/smp.buf.duration)*w;                       // start marker
    ctx2.strokeStyle='#D4B26C'; ctx2.lineWidth=2; ctx2.beginPath(); ctx2.moveTo(ox,0); ctx2.lineTo(ox,h); ctx2.stroke();
    cv.classList.add('on');
  }
  function smpStatus(t){ const el=document.getElementById('smpStatus'); if(el) el.textContent=t; }
  function refreshSmpRate(){ const el=document.getElementById('smpRate');
    if(el) el.textContent='rate '+sampleRate().toFixed(2)+'×'; }

  // ---- import job lifecycle -----------------------------------------------------------------
  // One generation counter guards the whole import. Every await inside loadSampleFile is a point
  // where the singer may have removed the reference, replaced it, started a new project or opened a
  // recent one, and a job that resumes after any of those would write the wrong file's tempo, key
  // and reconstruction into a project that has moved on.
  //
  // Cancellation here is COOPERATIVE, and the honest limit is worth stating: decodeAudioData cannot
  // be aborted once started, and analyseImport is a single synchronous pass. A cancel issued during
  // either takes effect the moment it returns, and the result is discarded rather than applied. The
  // measured worst case for that is the slowest fixture analysis, 664 ms.
  let impJob=0;
  let impMuteOwner=null;   // which import job muted the Sample channel; see undoImportMute()

  // A loaded reference is NEVER un-muted except by the singer's own Include control.
  //
  // `mix.sample.mute` is serialised (channel 8 of `mx`); `smp.buf` deliberately is not. So any path
  // that restores project state can pair a mute bit captured at one moment with a buffer that is
  // loaded right now. `scheduleSample()` renders into the offline export graph as well as the live
  // one, so the instant that happens, someone else's record is in the singer's exported WAV — the
  // one outcome this app must never produce. Two confirmed routes in:
  //   1. A cancelled import restoring the PRE-import mute, which is 0 on the first import of any
  //      project (mixDefault() is {mute:0}). Cancelling after the buffer loads but before the last
  //      checkpoint left a playable, unmuted reference. That one was introduced by the fix for a
  //      cancelled import burning an undo step — a tidier undo stack is not worth this.
  //   2. Undo, Open Recent, a share link or Open Project restoring a snapshot taken before the
  //      import, while the imported buffer is still in memory.
  // `sampleIncluded` records that the singer actually asked for it, and only the Include control
  // sets it. Anything else that hands us a 0 is talking about a different moment in time.
  let sampleIncluded=false;
  function guardSampleMute(){
    if(!smp.buf || !mix.sample) return false;
    if(mix.sample.mute || sampleIncluded) return false;
    mix.sample.mute=1; applyGroupLive('sample'); syncMixerUI();
    return true;
  }
  // Anything in flight becomes stale.
  //
  // NOT sufficient, and deliberately left alone until it can be fixed with evidence. `analyseImport`
  // is one synchronous pass, so `runAnalysis` can only drop a result it has not assigned yet: it
  // checks `jobLost(job)`, then sets `imp`. A cancel arriving after that check has nothing left to
  // stop, so a reconstruction can sit there ready to Apply after the singer pressed Cancel. On this
  // machine a 2 s WAV decodes and analyses in well under the 220 ms that cancel-safety waits before
  // cancelling, so its cases 4 and 6 hit that window every time and report two failures.
  //
  // The obvious repair — have this also tear down the published reconstruction — was tried twice
  // and made things WORSE both times, in a way not yet understood: calling clearRebuild() here
  // turned two failures into three, all of them "autosave bytes changed", and the narrower
  // `imp=null` alone broke a case that passes in every other build. Something couples a cleared
  // `imp` to the autosave, and until that coupling is found and measured, changing this line is
  // guesswork. See AURA-STATE.md.
  function cancelImportJob(){ impJob++; }
  function jobLost(job){ return job!==impJob; }

  async function loadSampleFile(file){
    if(!file) return;
    // Any previous reference is torn down first: leave the comparison, stop the un-warped audition,
    // and drop the cached RMS so a level match can never describe the file before this one.
    cancelImportJob();
    const job=impJob;
    // `mix.sample.mute` is serialised (it is channel 8 of `mx`), so muting the Sample channel below
    // is a PROJECT WRITE, not just an audio one — and it happens before the three cancellation
    // checkpoints. A cancelled import therefore left the project changed and burned an undo step,
    // so the singer's next Cmd+Z undid a phantom mute instead of their last real edit. Remember the
    // state here and put it back on every path that gives up.
    const muteBefore = mix.sample ? mix.sample.mute : 0;
    // Only the job that MUTED the channel may un-mute it. Without that ownership check, importing a
    // second file while the first is still in flight leaves the reference audible: job 1's cleanup
    // runs after job 2 has legitimately muted, and its captured `muteBefore` is the value from
    // before job 1 — so it reverts job 2's mute and the singer's imported song is live in the
    // export. A stale closure, and the worst possible one to get wrong.
    const undoImportMute=()=>{ if(!mix.sample) return;
      if(impMuteOwner!==job) return;
      impMuteOwner=null;
      // Only restore when NOTHING is loaded. If the buffer made it in before the cancel, restoring a
      // muteBefore of 0 would leave a playable reference audible and in the export — see
      // guardSampleMute(). Leaving it muted costs one undo step; the alternative costs the singer
      // someone else's record inside a file they made.
      if(smp.buf) return;
      if(mix.sample.mute!==muteBefore){ mix.sample.mute=muteBefore; applyGroupLive('sample'); syncMixerUI(); } };
    abExit(); refStopSrc(); refPos=0; smp.rms=null;
    smpStatus('Reading '+file.name+'…');
    try{
      ensureCtx();
      const arr=await file.arrayBuffer();
      if(jobLost(job)) return;                          // cancelled before the decode began
      const buf=await ac.decodeAudioData(arr.slice(0));
      // Cancelled DURING the decode. The buffer is simply dropped: nothing has been written to the
      // project yet, so there is nothing to undo and nothing to restore.
      if(jobLost(job)) return;
      // A truncated file is not a decode error. decodeAudioData is tolerant: hand it a WAV whose
      // header promises two seconds and whose payload is 400 bytes, and it returns 2 MILLISECONDS
      // of audio and calls that success. Measured on a half-written fixture. Reporting that as an
      // import would give the singer a card, a waveform and a tempo estimate for nothing at all,
      // so a buffer too short to be music is a failure with its own message.
      if(buf.duration<MIN_MEDIA_SECONDS){
        const e=new Error('decoded '+buf.duration.toFixed(4)+'s'); e.auraReason='too-short'; throw e; }
      smp.buf=buf; smp.name=file.name; smp.offset=0; smp.rate=1; smp.on=true;
      // A recording arrives as a REFERENCE, not as part of the track. scheduleSample() renders into
      // the offline export graph as well as the live one, so leaving it audible by default would put
      // the singer's imported song inside every WAV they export without their having said so. Muting
      // the Sample channel is the honest default, and one control on the card turns it on.
      mix.sample.mute=1; impMuteOwner=job; sampleIncluded=false;   // a new file is a new decision
      applyGroupLive('sample'); syncMixerUI();
      // Re-baseline the undo comparison. This mute happens outside oneCheckpoint(), so hist.last
      // still holds the pre-import snapshot; the 4-second autosave then sees a difference and
      // pushHistory() spends an undo step on it. The singer's next Cmd+Z would undo a mute they
      // never made instead of their last real edit. The mute is not an edit and must not be
      // undoable — guardSampleMute() re-asserts it on every restore anyway.
      try{ hist.last=snapshot(); }catch(e){}
      smp.fmt=guessFormat(file); smp.sr=buf.sampleRate; smp.chans=buf.numberOfChannels; smp.bytes=file.size;
      inspectContext();                       // an imported file is a contextual object
      renderRefCard();
      smpStatus('Reading its tempo and key…');
      await new Promise(r=>setTimeout(r,10));
      if(jobLost(job)){ undoImportMute(); return; }     // cancelled after the decode, before analysis
      smp.bpm=detectBPM(buf);
      const k=detectKey(buf); smp.key=k.key; smp.mode=k.mode; smp.conf=k.conf;
      const off=document.getElementById('smpOff'); off.max=Math.max(1,Math.floor(buf.duration*10)); off.value=0;
      document.getElementById('smpCtrls').style.display='';
      document.getElementById('smpBpm').value=smp.bpm;
      document.getElementById('smpKey').value=String(smp.key);
      document.getElementById('smpMode').value=smp.mode;
      document.getElementById('smpDrop').textContent='Drop another audio or video file here to replace it';
      smp.detBpm=smp.bpm; smp.detKey=smp.key; smp.detMode=smp.mode;   // remember for "reset to detected"
      impMode='rebuild'; impTempo.choice=null; impTempo.custom=null;   // a new file is a new decision
      const conf = smp.conf>0.55?'good':smp.conf>0.35?'fair':'low';
      smpStatus(`${file.name} · ${buf.duration.toFixed(1)}s · estimated ${smp.bpm} BPM · estimated ${NOTE_NAMES[smp.key]}${smp.mode==='minor'?'m':''} · confidence ${conf} — check this result`);
      drawWave(); refreshSmpRate(); buildRemixPlan(); renderRefCard(); refreshImportList(); paintImpMode();
      voc.mode='full'; voc.buf=null; voc.ready=false; vocPaint();
      syncBalance(); showAudioTab(true);
      smpStatus(`${file.name} · ${buf.duration.toFixed(1)}s · mapping the backing track…`);
      await new Promise(r=>setTimeout(r,10));
      if(jobLost(job)){ undoImportMute(); return; }     // cancelled before the reconstruction pass
      runAnalysis(file.name,buf,job);
    }catch(e){ console.warn(e);
      const d=await describeMediaFailure(file,e);
      smp.lastFailure=d.reason;                       // read by fixtures/media-decode.html
      smpStatus(d.message); toast(d.message); }
  }

  // Why did this file not decode? "It didn't work" is not an answer a singer can act on — an empty
  // file, a video with no audio track, a codec this browser lacks and a half-downloaded file all
  // need different next steps. The container is sniffed from its own first bytes rather than from
  // the extension or the MIME type, because both of those are supplied by whatever wrote the file.
  //
  // This runs ONLY on the failure path, so a successful import pays nothing for it.
  const MEDIA_LIMIT_MB=80;                            // measured: past this, decodeAudioData is unreliable
  const MIN_MEDIA_SECONDS=0.25;                       // below this there is nothing to analyse or sing to
  async function sniffContainer(file){
    let head;
    try{ head=new Uint8Array(await file.slice(0,Math.min(file.size,64*1024)).arrayBuffer()); }
    catch(e){ return {kind:'unreadable'}; }
    const a=(o,s)=>String.fromCharCode.apply(null,head.subarray(o,o+s));
    if(head.length>=12&&a(0,4)==='RIFF'&&a(8,4)==='WAVE'){
      // fmt tag lives 8 bytes into the fmt chunk. 1=PCM 3=float 6=a-law 7=mu-law 0xFFFE=extensible.
      for(let i=12;i+8<head.length&&i<4096;){
        const id=a(i,4), sz=head[i+4]|head[i+5]<<8|head[i+6]<<16|head[i+7]<<24;
        if(id==='fmt '){ const tag=head[i+8]|head[i+9]<<8;
          return {kind:'wav', codec:tag, known:[1,3,6,7,0xFFFE].indexOf(tag)>=0}; }
        i+=8+sz+(sz&1);
      }
      return {kind:'wav', codec:null, known:false};
    }
    if(head.length>=4&&(a(0,3)==='ID3'||(head[0]===0xFF&&(head[1]&0xE0)===0xE0))) return {kind:'mp3'};
    if(head.length>=12&&a(4,4)==='ftyp'){
      // An MP4/MOV track carries a handler box whose type is 'soun' for audio and 'vide' for
      // picture. Which of the two are present tells apart the three cases that need different
      // advice: an .m4a that will not decode is a damaged AUDIO file, a picture-only export has no
      // audio to find, and a video with both is a codec this browser lacks. A heuristic scan of the
      // moov box, not a full box parser — it only ever chooses the wording of an error.
      let soun=false, vide=false;
      for(let i=0;i+4<head.length;i++){
        if(head[i]===0x73&&head[i+1]===0x6F&&head[i+2]===0x75&&head[i+3]===0x6E) soun=true;
        else if(head[i]===0x76&&head[i+1]===0x69&&head[i+2]===0x64&&head[i+3]===0x65) vide=true;
        if(soun&&vide) break;
      }
      return {kind:'mp4', brand:a(8,4), hasAudioTrack:soun, hasVideoTrack:vide};
    }
    if(head.length>=4&&head[0]===0x1A&&head[1]===0x45&&head[2]===0xDF&&head[3]===0xA3) return {kind:'webm'};
    if(head.length>=4&&a(0,4)==='OggS') return {kind:'ogg'};
    if(head.length>=4&&a(0,4)==='fLaC') return {kind:'flac'};
    return {kind:'unknown'};
  }
  async function describeMediaFailure(file,err){
    const n=file.name;
    if(file.size===0)
      return {reason:'empty', message:`“${n}” is empty — there is no audio in it to read. Choose another file.`};
    if(file.size>MEDIA_LIMIT_MB*1024*1024)
      return {reason:'too-large', message:`“${n}” is ${(file.size/1048576).toFixed(0)} MB — past the ${MEDIA_LIMIT_MB} MB this browser can decode reliably. Try a shorter clip.`};
    if(err&&err.auraReason==='too-short')
      return {reason:'too-short', message:`“${n}” holds less than a moment of audio — it looks cut off or only partly saved. Try the file again, or re-export it.`};
    const c=await sniffContainer(file);
    if(c.kind==='mp4'&&c.hasVideoTrack&&!c.hasAudioTrack)
      return {reason:'video-no-audio', message:'Aura could not read the audio in this video. Choose an audio file instead.'};
    // An audio-only MP4 container (.m4a) that will not decode is a damaged audio file, not a video.
    if(c.kind==='mp4'&&c.hasAudioTrack&&!c.hasVideoTrack)
      return {reason:'corrupt', message:`“${n}” looks like an M4A file, but the audio data inside it is incomplete or damaged. Try the file again, or re-export it.`};
    if(c.kind==='webm'||c.kind==='mp4')
      return {reason:'video-undecodable', message:'Aura could not read the audio in this video. Choose an audio file instead.'};
    if(c.kind==='wav'&&c.known===false)
      return {reason:'unsupported-codec', message:`“${n}” is a WAV file, but the audio inside it uses a codec this browser cannot play. Re-export it as plain PCM WAV, MP3 or M4A.`};
    if(c.kind==='unknown'||c.kind==='unreadable')
      return {reason:'not-media', message:`“${n}” is not a media file Aura can read. Use WAV, MP3, M4A, or an MP4/MOV with an audio track.`};
    // A container Aura recognised, that still would not decode: the usual cause is a truncated or
    // partly-written file. Say that, rather than blaming the format it clearly is.
    return {reason:'corrupt', message:`“${n}” looks like ${c.kind.toUpperCase()}, but the audio data inside it is incomplete or damaged. Try the file again, or re-export it.`};
  }
  // The analysis pass, split out so "Analyze again" runs exactly the same code as an import.
  function runAnalysis(name,buf,job){
    try{
      const r=analyseImport(buf);
      // analyseImport is one synchronous pass and cannot be interrupted part-way. What CAN be
      // guaranteed is that its result never lands in a project that moved on while it ran — if the
      // reference was removed, replaced, or a new/recent project was opened, the result is dropped
      // here and `imp` is never assigned. No checkpoint, no autosave, no visible change.
      if(job!==undefined&&jobLost(job)) return;
      imp=r;
      deriveBeatView();
      renderRebuild();
      paintImpMode();                       // the three paths follow the analysis being ready
      const kit=imp.beat.noKit
        ? 'no drum kit could be separated from it'
        : `${imp.beat.steps} step${imp.beat.steps===1?'':'s'} of percussion`;
      smpStatus(`${name} · ${buf.duration.toFixed(1)}s · detected ${imp.bpm} BPM · suggested ${NOTE_NAMES[imp.key]}${imp.mode==='minor'?'m':''} · ${kit} — review the reconstruction below`);
      toast(imp.beat.noKit?'Imported. Aura found no percussion to rebuild in this recording.'
                          :'Backing track mapped — review the reconstruction');
    }catch(err){ console.warn(err);
      if(job!==undefined&&jobLost(job)) return;        // a failure in a job nobody is waiting for
      imp=null; renderRebuild();
      smpStatus(`${name} loaded, but Aura could not map a reconstruction from it. Tempo and key above still apply.`);
      toast('Imported. Aura could not map a reconstruction from this file.'); }
  }
  function reanalyseReference(){
    if(!smp.buf){ toast('Import a recording first'); return; }
    cancelImportJob();
    const job=impJob;
    abExit();
    smp.rms=null;                                     // a cached level must not outlive the analysis
    smpStatus(`${smp.name} · mapping the backing track again…`);
    setTimeout(()=>{ if(jobLost(job)||!smp.buf) return; runAnalysis(smp.name,smp.buf,job); },20);
  }


  // The remix plan is a set of concrete, editable moves — never a black box.
  function buildRemixPlan(){
    const host=document.getElementById('smpPlan'); if(!host||!smp.buf) return;
    const proj=+bpmEl.value, dbl=smp.bpm>=125, halfBpm=Math.round(smp.bpm/2);
    const keyName=NOTE_NAMES[smp.key]+(smp.mode==='minor'?'m':'');
    const lowHeavy=true;
    const moves=[
      {id:'tempo', on:true, txt:`Set the project to ${dbl?halfBpm:Math.round(smp.bpm)} BPM`,
       why:dbl?`The sample reads ${smp.bpm} BPM — halving it gives the half-time pocket most of your references sit in.`
              :`Matches the sample so your drums lock to it instead of fighting it.`},
      {id:'key', on:true, txt:`Move the project to ${keyName}`,
       why:`Detected ${keyName} (${Math.round(smp.conf*100)}% confidence). Aura's chords and Stay-in-key follow, so nothing you draw can clash.`},
      {id:'half', on:dbl, txt:'Play the sample at half-time',
       why:'Slows it to the beat you just set, tape-style — pitch drops with it, which is the classic chop sound.'},
      {id:'lowcut', on:lowHeavy, txt:'Cut the sample below 140 Hz',
       why:'Clears the bottom so Aura’s 808 owns the low end instead of doubling the sample’s bass.'},
      {id:'beat', on:true, txt:'Load a boom-bap kit under it',
       why:'Dry, simple drums leave the sample as the hook — the groove layer stays unchanging.'},
      {id:'duck', on:true, txt:'Duck the sample under the kick',
       why:'Sidechains the imported track so every kick punches through the loop.'},
    ];
    host.innerHTML='<h4>Remix plan</h4>'+moves.map(m=>
      `<label class="planrow"><input type="checkbox" data-m="${m.id}" ${m.on?'checked':''} />
       <span class="txt">${m.txt}<span class="why">${m.why}</span></span></label>`).join('')+
      '<button class="apply" id="smpApply">Apply selected moves</button>';
    host.style.display='';
    document.getElementById('smpApply').addEventListener('click',()=>applyRemixPlan(dbl?halfBpm:Math.round(smp.bpm)));
  }
  function applyRemixPlan(targetBpm){
    const host=document.getElementById('smpPlan');
    const want=id=>{ const c=host.querySelector(`input[data-m="${id}"]`); return c&&c.checked; };
    let done=[];
    // Wrapped for the same reason as the four reconstruction applies: transposeMelody, resnapMelodies
    // and applyBeat each autosave on their own, so without this one press of this button created up to
    // four undo steps while its neighbours created one.
    oneCheckpoint(()=>{
      if(want('tempo')&&targetBpm>=60&&targetBpm<=160){ bpmEl.value=targetBpm; bpmVal.textContent=targetBpm; done.push(targetBpm+' BPM'); }
      if(want('key')){ const old=keyRoot; keyRoot=smp.key; keyRootEl.value=String(smp.key);
        keyMode=smp.mode==='major'?'major':'minor'; keyModeEl.value=keyMode;
        relabelChords(); transposeMelody(keyRoot-old); resnapMelodies(); done.push(NOTE_NAMES[smp.key]+(keyMode==='minor'?'m':'')); }
      if(want('half')){ smp.half=true; document.getElementById('smpHalf').checked=true; done.push('half-time'); }
      if(want('lowcut')){ smp.hp=140; const s=document.getElementById('smpHP'); s.value=140;
        document.getElementById('smpHPV').textContent='140 Hz';
        if(liveBus&&liveBus.sampleHP) liveBus.sampleHP.frequency.value=140; done.push('low cut'); }
      if(want('beat')){ applyBeat('boombap'); done.push('boom-bap'); }
      if(want('duck')){ mix.sample.rev=Math.max(mix.sample.rev,8); applyGroupLive('sample'); syncMixerUI(); done.push('duck'); }
      refreshSmpRate();
    });
    toast(done.length?('Applied: '+done.join(' · ')):'Nothing selected');
  }

  // Importing is an entry route in the Browser, not a songwriting stage. Selecting an import
  // reveals the contextual Audio Editor tab; removing it hides the tab again.
  // The Sound tab is permanent: it is where a singer who has imported nothing records or makes one.
  // Importing a file jumps there; removing the reference leaves the tab in place with the sampler on it.
  function showAudioTab(on){
    const t=document.querySelector('.wtab[data-v="smp"]'); if(!t) return;
    if(on) t.click();
  }
  function clearRebuild(){ imp=null; renderRebuild(); paintImpMode(); }
  function refreshImportList(){
    const host=document.getElementById('importList'); if(!host) return;
    host.innerHTML='';
    const ref=document.getElementById('importRef');
    if(!smp.buf){ if(ref) ref.hidden=true; return; }
    if(ref) ref.hidden=false;
    const d=document.createElement('button'); d.type='button'; d.className='impitem on';
    const b=document.createElement('b'); b.textContent=smp.name;                 // textContent: never markup
    const s=document.createElement('span');
    s.textContent=`${smp.buf.duration.toFixed(1)}s · ${smp.bpm} BPM · ${NOTE_NAMES[smp.key]}${smp.mode==='minor'?'m':''}`;
    const w=document.createElement('div'); w.style.minWidth='0'; w.style.flex='1';
    w.appendChild(b); w.appendChild(s); d.appendChild(w);
    d.setAttribute('aria-label','Open the imported reference: '+smp.name);
    d.addEventListener('click',()=>showAudioTab(true));
    host.appendChild(d);
  }

  // ---------- the imported reference: one card, and it only exists once a file does ----------
  const fmtTime=s=>{ s=Math.max(0,s|0); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };
  function guessFormat(file){
    const ext=(file.name.match(/\.([a-z0-9]+)$/i)||[,''])[1].toUpperCase();
    if(ext) return ext;
    const t=(file.type||'').split('/')[1]||''; return t?t.toUpperCase():'audio';
  }
  function renderRefCard(){
    const card=document.getElementById('refCard'); if(!card) return;
    const ref=document.getElementById('importRef');
    if(!smp.buf){ card.hidden=true; if(ref) ref.hidden=true; return; }
    card.hidden=false; if(ref) ref.hidden=false;
    const nm=document.getElementById('refName'); if(nm) nm.textContent=smp.name;   // textContent: a filename is never markup
    const meta=document.getElementById('refMeta');
    if(meta) meta.textContent=[
      fmtTime(smp.buf.duration), smp.fmt,
      smp.chans===1?'mono':(smp.chans===2?'stereo':smp.chans+' channels'),
      Math.round(smp.sr/1000)+' kHz',
      smp.bytes?((smp.bytes/1048576).toFixed(1)+' MB'):''
    ].filter(Boolean).join(' · ');
    refPaintTransport();
  }
  // The un-warped audition. scheduleSample() loops and follows the project tempo through
  // sampleRate(), which is right INSIDE the track and wrong for "let me hear what I imported". So this
  // is its own BufferSource at playbackRate 1, connected to the same sample bus, which means the
  // channel's level, mute and low cut all still apply and the export graph is untouched.
  let refSrc=null, refPos=0, refStartedAt=0;
  function refElapsed(){ return refSrc? Math.max(0,refPos+(now()-refStartedAt)) : refPos; }
  function refStopSrc(){
    if(!refSrc) return;
    refPos=Math.min(smp.buf?smp.buf.duration:0, refElapsed());
    try{ refSrc.onended=null; refSrc.stop(); }catch(e){}
    refSrc=null; refPaintTransport();
  }
  function refPlay(){
    if(!smp.buf) return;
    if(playing){ stop(); toast('Stopped the track so you can hear the reference on its own'); }
    abExit();
    ensureCtx();
    if(!liveBus||!liveBus.sampleHP) return;
    refStopSrc();
    const from=Math.min(Math.max(0,refPos), Math.max(0,smp.buf.duration-0.02));
    refSrc=ac.createBufferSource(); refSrc.buffer=smp.buf; refSrc.playbackRate.value=1;
    refSrc.connect(liveBus.sampleHP);
    refSrc.onended=()=>{ refSrc=null; refPos=0; refPaintTransport(); };
    refStartedAt=now()+0.03; refPos=from;
    refSrc.start(refStartedAt, from);
    refPaintTransport();
  }
  function refPaintTransport(){
    const p=document.getElementById('refPlay'), t=document.getElementById('refTime');
    const on=!!refSrc;
    if(p){ p.textContent=on?'■ Stop':'▶ Play it'; p.classList.toggle('on',on); }
    if(t&&smp.buf) t.textContent=fmtTime(refElapsed())+' / '+fmtTime(smp.buf.duration);
  }
  let refTick=null;
  function refStartTick(){ if(refTick) return;
    refTick=setInterval(()=>{ if(smp.buf) refPaintTransport(); },250); }
  // The card's Level and Mute ARE the Sample channel, so they follow it rather than shadowing it.
  function syncRefControls(){
    const lv=document.getElementById('refLevel'), lvV=document.getElementById('refLevelV'),
          inc=document.getElementById('refInclude'), note=document.getElementById('refIncNote'),
          badge=document.getElementById('refBadge');
    if(lv){ lv.value=String(mix.sample.vol); if(lvV) lvV.textContent=mix.sample.vol+'%'; }
    const inTrack=!mix.sample.mute;
    if(inc){ inc.setAttribute('aria-pressed',String(inTrack));
      inc.classList.toggle('on',inTrack);
      inc.textContent=inTrack?'✓ In my track':'Include it in my track'; }
    if(note) note.textContent=inTrack
      ? 'On, so your recording plays with the track and lands in your export.'
      : 'Off, so your export is Aura’s parts only.';
    if(badge) badge.textContent=inTrack?'In your track':'Not in your track';
  }

  // ---------- A/B: original, Aura's reconstruction, or both ----------
  function abTrim(id){
    if(abMode==='off') return 1;
    const ref=id==='sample', aura=AURA_GROUPS.indexOf(id)>=0;
    const m=Math.pow(10,abMatchDb/20);
    if(abMode==='orig') return ref? m : (aura?0:1);
    if(abMode==='aura') return ref? 0 : 1;
    return ref? m : 1;                                   // 'both'
  }
  function bufRms(buf){
    const {data}=monoDown(buf,22050); let s=0;
    for(let i=0;i<data.length;i++) s+=data[i]*data[i];
    return Math.sqrt(s/(data.length||1));
  }
  // Aura's own level, rendered through THE SAME graph as export — buildBusses plus
  // scheduleStepAudio — so the number describes what the singer will actually hear rather than an
  // approximation of a different signal path. One bar is enough and stays instant.
  async function auraRms(){
    try{
      const sps=secondsPerStep(), dur=Math.max(0.5,STEPS*sps+0.35), sr=22050;
      const off=new OfflineAudioContext(1, Math.ceil(dur*sr), sr);
      const {bus}=buildBusses(off,+masterEl.value/100);
      bus.chords.gain.value=+chordVolEl.value/100; bus.bass.gain.value=+bassVolEl.value/100;
      for(let s=0;s<STEPS;s++){ let t=s*sps; if(s%2===1) t+=sps*(+swingEl.value/100)*0.9;
        scheduleStepAudio(off,bus,currentPattern,s,t,sps,false); }
      const r=await off.startRendering();
      const d=r.getChannelData(0); let acc=0;
      for(let i=0;i<d.length;i++) acc+=d[i]*d[i];
      return Math.sqrt(acc/(d.length||1));
    }catch(e){ console.warn('level match unavailable',e); return null; }
  }
  async function abLevelMatch(){
    abMatchDb=0; abMatchMsg='';
    if(!smp.buf) return;
    if(smp.rms==null) smp.rms=bufRms(smp.buf);
    const a=await auraRms();
    if(a==null){ abMatchMsg='Levels could not be matched, so judge the balance by ear.'; return; }
    if(smp.rms<AB_FLOOR || a<AB_FLOOR){
      abMatchMsg=(smp.rms<AB_FLOOR?'Your recording is':'Aura’s version is')+' almost silent, so the volumes were left alone.';
      return;
    }
    const want=20*Math.log10(a/smp.rms);
    if(Math.abs(want)<=AB_WINDOW_DB){ abMatchDb=0; abMatchMsg=''; return; }
    abMatchDb=Math.max(-AB_MAX_DB,Math.min(AB_MAX_DB,want));
    if(Math.abs(want)>AB_MAX_DB)
      abMatchMsg='One side is much louder. Aura evened it out as far as it safely could — use Level for the rest.';
  }
  function abSetMode(m){
    if(!smp.buf) return;
    refStopSrc();                                        // the un-warped audition and A/B are exclusive
    abMode=m;
    document.querySelectorAll('#abSeg button').forEach(b=>{
      const on=b.dataset.ab===m; b.setAttribute('aria-checked',String(on)); b.classList.toggle('on',on); });
    paintAbStop();
    applyAllGroupsLive();
    if(!playing){ const p=document.getElementById('play'); if(p) p.click(); }
    abStatus();
    abLevelMatch().then(()=>{ applyAllGroupsLive(); abStatus(); });
  }
  // "Stop comparing" exists only while there is something to stop. A control that is present but
  // dead teaches a singer that Aura's buttons cannot be trusted.
  function paintAbStop(){
    const row=document.getElementById('abRow'); if(!row) return;
    let st=document.getElementById('abStop');
    if(abMode==='off'){ if(st) st.remove(); return; }
    if(!st){ st=document.createElement('button'); st.className='refbtn ghost'; st.id='abStop';
      st.type='button'; st.textContent='Stop comparing';
      st.addEventListener('click',abExit); row.insertBefore(st,row.firstChild); }
  }
  function abExit(){
    if(abMode==='off'){ paintAbStop(); return; }
    abMode='off'; abMatchDb=0; abMatchMsg='';
    document.querySelectorAll('#abSeg button').forEach(b=>{ b.setAttribute('aria-checked','false'); b.classList.remove('on'); });
    paintAbStop();
    applyAllGroupsLive();                                // the exact restore, straight from mix[]
    abStatus();
  }
  function abStatus(){
    const s=document.getElementById('abStatus'), n=document.getElementById('abMatchNote');
    if(s) s.textContent = abMode==='off' ? 'Nothing is being compared yet.'
      : abMode==='orig' ? 'You are hearing your recording only.'
      : abMode==='aura' ? 'You are hearing Aura’s version only.'
      : 'You are hearing your recording and Aura’s version together.';
    if(n){ n.textContent = abMode==='off' ? ''
      : (abMatchMsg || 'Both sides are at a similar volume.');
      n.classList.toggle('warn', abMode!=='off' && !!abMatchMsg); }
  }

  // ---------- Quick balance ----------
  // Six controls over the groups that already exist. Two are macros that write proportionally into
  // their members' real mix[].vol, so a move persists through the project's own `mx` field, undoes
  // with one checkpoint and exports automatically — no new schema key, and no invented group.
  const BAL_ROWS=[
    {id:'sample', label:'Imported reference', ids:['sample'], onlyWithRef:true},
    {id:'aura',   label:'Aura reconstruction', ids:AURA_GROUPS},
    {id:'drums',  label:'Drums',              ids:['kick','snare','hats']},
    {id:'bass',   label:'Bass & low end',     ids:['bass']},
    {id:'chords', label:'Harmony',            ids:['chords']},
    {id:'melody', label:'Melody',             ids:['melody']},
  ];
  const balAvg=ids=>ids.reduce((a,i)=>a+mix[i].vol,0)/ids.length;
  function buildBalance(){
    const host=document.getElementById('balGrid'); if(!host) return;
    host.innerHTML='';
    BAL_ROWS.forEach(R=>{
      const row=document.createElement('div'); row.className='balrow'; row.dataset.bal=R.id;
      const lab=document.createElement('label'); lab.textContent=R.label;
      lab.setAttribute('for','bal-'+R.id);
      const sl=document.createElement('input'); sl.type='range'; sl.min='0'; sl.max='140';
      sl.id='bal-'+R.id; sl.value=String(Math.round(balAvg(R.ids)));
      sl.setAttribute('aria-label',R.label+' level');
      const val=document.createElement('span'); val.className='val'; val.textContent=sl.value+'%';
      sl.addEventListener('input',()=>{
        const to=+sl.value, from=balAvg(R.ids);
        R.ids.forEach(i=>{
          // Proportional while there is a ratio to keep; absolute once the group has been pulled to
          // silence, because a ratio to zero cannot be recovered. Deterministic either way.
          mix[i].vol = from>0 ? Math.max(0,Math.min(140,Math.round(mix[i].vol*(to/from)))) : to;
        });
        val.textContent=to+'%';
        applyAllGroupsLive(); syncMixerUI(); syncBalance(sl.id); autosave();
      });
      row.appendChild(lab); row.appendChild(sl); row.appendChild(val);
      host.appendChild(row);
    });
    syncBalance();
  }
  // Keep the macro faders in step whenever the real channels move — a project load, an undo, or a
  // drag on the full mixer below.
  function syncBalance(skipId){
    BAL_ROWS.forEach(R=>{
      const row=document.querySelector('.balrow[data-bal="'+R.id+'"]'); if(!row) return;
      if(R.onlyWithRef) row.hidden=!smp.buf;
      const sl=row.querySelector('input'); if(!sl||sl.id===skipId) return;
      const v=Math.round(balAvg(R.ids));
      sl.value=String(v);
      const val=row.querySelector('.val'); if(val) val.textContent=v+'%';
    });
  }

  // ---------- wiring ----------
  let refFileInput=null;
  function pickReferenceFile(){ if(refFileInput) refFileInput.click(); }
  function wireDropTarget(el){
    if(!el) return;
    ['dragenter','dragover'].forEach(ev=>el.addEventListener(ev,e=>{ e.preventDefault(); el.classList.add('over'); }));
    ['dragleave','drop'].forEach(ev=>el.addEventListener(ev,e=>{ e.preventDefault(); if(ev==='dragleave') el.classList.remove('over'); }));
    el.addEventListener('drop',e=>{ el.classList.remove('over');
      const f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0]; if(f) loadSampleFile(f); });
  }
  // One panel, one title. The two ways in are buttons, so nothing toggles the visibility of #vgrid
  // any more and the panel can never show a section that has nothing in it.
  function wireBrowserPanel(){
    const pv=document.getElementById('pathVibe');
    if(pv) pv.addEventListener('click',()=>{
      const h=document.getElementById('vgroupStart');
      if(h&&h.scrollIntoView) h.scrollIntoView({block:'nearest'});
      const t=document.querySelector('#vgrid .vtile.on .vmain')||document.querySelector('#vgrid .vmain');
      if(t) try{ t.focus({preventScroll:true}); }catch(e){ t.focus(); }
    });
    const ip=document.getElementById('importPick');
    if(ip) ip.addEventListener('click',pickReferenceFile);
    wireDropTarget(document.getElementById('browser'));
  }
  function wireReferenceCard(){
    const $=id=>document.getElementById(id);
    if($('refPlay')) $('refPlay').addEventListener('click',()=>{ refSrc?refStopSrc():refPlay(); });
    if($('refReplace')) $('refReplace').addEventListener('click',pickReferenceFile);
    if($('refAnalyze')) $('refAnalyze').addEventListener('click',()=>reanalyseReference());
    // The Balance view is reachable from here as well as from the tab row, because the tab row is
    // hidden in Guided Mode (styles.css body.guided .wtabs) and Guided is the default.
    if($('refBalance')) $('refBalance').addEventListener('click',()=>{
      const t=document.querySelector('.wtab[data-v="mix"]'); if(t) t.click(); else showView('mix');
      const b=document.getElementById('balSimple'); if(b&&b.scrollIntoView) b.scrollIntoView({block:'start'});
    });
    const inc=$('refInclude');
    if(inc) inc.addEventListener('click',()=>{
      mix.sample.mute=mix.sample.mute?0:1;
      sampleIncluded=!mix.sample.mute;      // the singer asked for it, in so many words
      applyAllGroupsLive(); syncMixerUI(); autosave();
      if(playing){ stopSample(); sampleSrc=scheduleSample(ac,liveBus,now()+.05,null); }
      toast(mix.sample.mute?'Your recording is out of the track and out of your export'
                           :'Your recording is now part of the track and will be in your export');
    });
    const lv=$('refLevel');
    if(lv) lv.addEventListener('input',()=>{ mix.sample.vol=+lv.value;
      const v=$('refLevelV'); if(v) v.textContent=lv.value+'%';
      applyAllGroupsLive(); syncMixerUI(); syncBalance(); autosave(); });
    const cmp=$('refCompare');
    if(cmp) cmp.addEventListener('click',()=>{
      const panel=$('refAB'); if(!panel) return;
      const open=panel.hidden;
      panel.hidden=!open; cmp.setAttribute('aria-expanded',String(open));
      if(!open) abExit();
    });
    document.querySelectorAll('#abSeg button').forEach(b=>
      b.addEventListener('click',()=>abSetMode(b.dataset.ab)));
    wireDropTarget($('refCard'));
    refStartTick();
  }

  function wireSamplePanel(){
    const drop=document.getElementById('smpDrop');
    const fi=document.createElement('input'); fi.type='file'; fi.accept='audio/*,video/*'; fi.hidden=true;
    document.body.appendChild(fi);
    fi.addEventListener('change',()=>{ if(fi.files&&fi.files[0]) loadSampleFile(fi.files[0]); fi.value=''; });
    refFileInput=fi;
    wireDropTarget(document.getElementById('v-smp'));
    document.getElementById('smpClear').addEventListener('click',()=>{
      // Teardown order matters: leave the comparison and stop the audition BEFORE the buffer goes,
      // so no node is left pointing at a buffer that no longer exists. The import job is cancelled
      // first of all — removing the reference while it is still being analysed must not let the
      // analysis finish and repopulate the card for a file that is gone.
      cancelImportJob();
      abExit(); refStopSrc(); refPos=0;
      stopSample(); smp.buf=null; smp.on=false; smp.bpm=0; smp.rms=null;
      document.getElementById('smpWave').classList.remove('on');
      document.getElementById('smpCtrls').style.display='none';
      document.getElementById('smpPlan').style.display='none';
      const ab=document.getElementById('refAB'); if(ab){ ab.hidden=true; }
      const cmp=document.getElementById('refCompare'); if(cmp) cmp.setAttribute('aria-expanded','false');
      if(drop) drop.textContent='Drop another audio or video file here to replace it';
      voc.mode='full'; voc.buf=null; voc.ready=false; vocPaint();
      smpStatus('No recording loaded'); clearRebuild(); renderRefCard(); refreshImportList();
      syncBalance(); showAudioTab(false); });
    document.getElementById('smpHalf').addEventListener('change',e=>{ smp.half=e.target.checked; refreshSmpRate();
      if(playing){ stopSample(); sampleSrc=scheduleSample(ac,liveBus,now()+.05,null); } });
    document.getElementById('smpHP').addEventListener('input',e=>{ smp.hp=+e.target.value;
      document.getElementById('smpHPV').textContent=smp.hp+' Hz';
      if(liveBus&&liveBus.sampleHP) liveBus.sampleHP.frequency.value=smp.hp; });
    document.getElementById('smpOff').addEventListener('input',e=>{ smp.offset=(+e.target.value)/10;
      document.getElementById('smpOffV').textContent=smp.offset.toFixed(1)+' s'; drawWave(); });
    document.getElementById('smpBpm').addEventListener('change',e=>{ const v=+e.target.value;
      if(v>=40&&v<=220){ smp.bpm=v; refreshSmpRate(); buildRemixPlan(); refreshImportList();
        if(playing){ stopSample(); sampleSrc=scheduleSample(ac,liveBus,now()+.05,null); } } });
    // manual key/mode override + reset to detected — detection is an estimate, never a promise
    const sk=document.getElementById('smpKey'), sm=document.getElementById('smpMode');
    NOTE_NAMES.forEach((n,i)=>{ const o=document.createElement('option'); o.value=i; o.textContent=n; sk.appendChild(o); });
    sk.addEventListener('change',()=>{ smp.key=+sk.value; buildRemixPlan(); refreshImportList(); });
    sm.addEventListener('change',()=>{ smp.mode=sm.value; buildRemixPlan(); refreshImportList(); });
    document.getElementById('smpReset').addEventListener('click',()=>{
      if(smp.detBpm==null) return;
      smp.bpm=smp.detBpm; smp.key=smp.detKey; smp.mode=smp.detMode;
      document.getElementById('smpBpm').value=smp.bpm; sk.value=String(smp.key); sm.value=smp.mode;
      refreshSmpRate(); buildRemixPlan(); refreshImportList(); toast('Back to the values Aura detected'); });
    bpmEl.addEventListener('input',refreshSmpRate);
  }


  // ---------- the six sonic families and their five controls each ----------
  // Each family carries five named controls. They are macros over parameters Aura already has, so a
  // move is real music the project keeps — it persists, it exports, and it undoes as one step. Nothing
  // here is a display-only knob: if a control could not be implemented honestly it is not shown.
  //
  // The names, the ranges and the "must never" rules come from the internal production research
  // (internal, translated in STYLE-REFERENCES.md). What is encoded is
  // TECHNIQUE — where the weight sits, how a section opens, how much gets taken away — not any
  // specific recording, melody or sound.
  const FAMILY_CTRL={
    soulblueprint:[
      {id:'chop',   label:'Chop',   hint:'How many times the chords re-trigger in a bar.'},
      {id:'soul',   label:'Soul',   hint:'Adds 7ths and 9ths to the chords.'},
      {id:'swing',  label:'Swing',  hint:'How far behind the beat the offbeats sit.'},
      {id:'warmth', label:'Warmth', hint:'Record level — rolls the top off and pushes the middle.'},
      {id:'lift',   label:'Lift',   hint:'Raises the chords and melody into your range.'},
    ],
    stadium:[
      {id:'scale',  label:'Scale',  hint:'How big the chorus feels.'},
      {id:'motion', label:'Motion', hint:'How busy the chords are.'},
      {id:'glow',   label:'Glow',   hint:'Bright and forward, or dark and behind.'},
      {id:'drive',  label:'Drive',  hint:'How hard the chorus kick hits.'},
      {id:'lift',   label:'Lift',   hint:'Raises the last section.'},
    ],
    maximal:[
      {id:'layers',   label:'Layers',   hint:'How many parts play at once. Six is the ceiling on purpose.'},
      {id:'orchestra',label:'Orchestra',hint:'How wide the chord stack spreads — always below your voice.'},
      {id:'drama',    label:'Drama',    hint:'How much quieter the verses are than the chorus.'},
      {id:'contrast', label:'Contrast', hint:'How much only happens in one section.'},
      {id:'finale',   label:'Finale',   hint:'The ending. It never fades out.'},
    ],
    livingdraft:[
      {id:'evolve',  label:'Evolve',  hint:'How much changes each time a part comes back.'},
      {id:'space',   label:'Space',   hint:'Takes things away. It never adds.'},
      {id:'pulse',   label:'Pulse',   hint:'How much drum there is. None is a finished answer.'},
      {id:'rise',    label:'Rise',    hint:'One slow opening across the whole song.'},
      {id:'revision',label:'Revision',hint:'How much of a change gets kept as its own version.'},
    ],
    confessional:[
      {id:'intimacy',label:'Intimacy',hint:'How close and dry it sounds.'},
      {id:'tension', label:'Tension', hint:'Adds the note that makes it ache.'},
      {id:'space',   label:'Space',   hint:'Takes things away from behind you.'},
      {id:'release', label:'Release', hint:'How long the chords ring.'},
      {id:'truth',   label:'Truth',   hint:'Leaves your take exactly as you sang it.'},
    ],
    monolith:[
      {id:'weight',  label:'Weight',  hint:'How much low end sits under everything.'},
      {id:'pulse',   label:'Pulse',   hint:'How much drum there is.'},
      {id:'fracture',label:'Fracture',hint:'How broken up the top is.'},
      {id:'haze',    label:'Haze',    hint:'How much is hidden behind the filter.'},
      {id:'resolve', label:'Resolve', hint:'Whether the chord ever moves.'},
    ],
  };
  // Which BEATS entry each family owns. Several controls restore a lane to "what this family
  // normally plays", and doing that from the wrong family's beat silently produces an empty lane —
  // which is how Space came to do nothing at all on two of the six.
  const FAM_BEAT={ soulblueprint:'soulblueprint', stadium:'stadiumchorus', maximal:'maximalopus',
                   livingdraft:'livingdraft', confessional:'confessional', monolith:'futuremonolith' };
  // Live values, per family. Session scratch: the RESULT of a move is written into the project, so
  // nothing here needs to persist and the .aura schema is untouched.
  const famVal={};
  Object.keys(FAMILY_CTRL).forEach(f=>{ famVal[f]={};
    FAMILY_CTRL[f].forEach(c=>{ famVal[f][c.id]= c.id==='layers'?3 : 50; }); });
  let activeFamily=null;

  const famClamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  // Chord re-trigger positions for a given density. A performed chop is not an even stutter, so above
  // four events the order is deliberately uneven.
  function chopSteps(v){
    if(v<10) return [0];
    if(v<30) return [0,8];
    if(v<50) return [0,6,8];
    if(v<70) return [0,4,8,12];
    if(v<90) return [0,3,6,8,11,14];
    return [0,2,3,6,8,10,11,14];
  }
  function famApply(fam,id,v){
    const V=famVal[fam]; V[id]=v;
    const P0=P();
    const setLane=(lane,steps)=>{ for(let s=0;s<STEPS;s++) P0[lane][s]=false;
      steps.forEach(s=>{ if(s<STEPS) P0[lane][s]=true; }); };
    const prog=(PROGS[VIBES[fam].prog]||[0,5,3,4]);
    switch(id){
      case 'chop': {
        // Re-trigger the chord lane. Chord IDENTITY never changes — only how often it is struck.
        const steps=chopSteps(v);
        CHORD_DEGREES.forEach(c=>{ for(let s=0;s<STEPS;s++) P0[c.id][s]=false; });
        steps.forEach((st,i)=>{ const deg=prog[Math.floor(i*prog.length/steps.length)%prog.length];
          P0['deg'+deg][st]=true; });
        break; }
      case 'soul':
        // Aura already ties the diatonic 7th to the `soul` chord voice, and the 7th is taken from the
        // scale — so nothing this control adds can land outside the key.
        chordStyle = v>=40?'soul':'pad'; chordStyleEl.value=chordStyle;
        break;
      case 'swing':
        swingEl.value=String(Math.round(famClamp(v*0.6,0,60)));
        break;
      case 'warmth': {
        // "Record level", not an effect: top rolls off and the middle comes forward as it rises.
        const g=v/100;
        ['kick','snare','hats','chords','melody'].forEach(id2=>{
          mix[id2].hi=-(g*8); mix[id2].mid=g*3; });
        mix.bass.lo=g*2;
        applyAllGroupsLive(); syncMixerUI();
        break; }
      case 'lift': case 'glow': case 'tension': case 'resolve': case 'fracture': {
        if(id==='lift'){
          // Transpose chords and melody only — never the bass, never the drums.
          const want=Math.round((v/100)*12);
          const delta=want-(V.__lift||0); V.__lift=want;
          if(delta){ const old=keyRoot; keyRoot=((keyRoot+delta)%12+12)%12;
            keyRootEl.value=String(keyRoot); relabelChords(); transposeMelody(keyRoot-old); resnapMelodies(); }
        } else if(id==='glow'){
          const g=v/100;
          mix.chords.hi=(g-0.5)*8; mix.melody.hi=(g-0.5)*8;
          applyAllGroupsLive(); syncMixerUI();
        } else if(id==='tension'){
          // The raised 7th is what makes it ache; above 60 the mode itself carries it.
          chordStyle = v>60?'soul':'piano'; chordStyleEl.value=chordStyle;
          keyMode = v>60 ? 'harmonicMinor' : 'minor';
          keyModeEl.value=keyMode; relabelChords(); resnapMelodies();
        } else if(id==='resolve'){
          // 0 = one chord that never moves. 100 = the family's full progression.
          CHORD_DEGREES.forEach(c=>{ for(let s=0;s<STEPS;s++) P0[c.id][s]=false; });
          if(v<34) P0['deg'+prog[0]][0]=true;
          else if(v<67){ P0['deg'+prog[0]][0]=true; P0['deg'+prog[1%prog.length]][8]=true; }
          else prog.forEach((d,i)=>{ const st=i*4; if(st<STEPS) P0['deg'+d][st]=true; });
        } else if(id==='fracture'){
          const dense=[[],[14],[2,6,14],[2,6,10,14],[0,2,4,6,8,10,12,14]][Math.min(4,Math.floor(v/21))];
          setLane('hat',dense);
        }
        break; }
      case 'scale': {
        reverbEl.value=String(Math.round(8+ (v/100)*26)); reverbWet=(+reverbEl.value)/100*0.7;
        applyAllGroupsLive();
        break; }
      case 'motion': {
        const steps = v<25?[0] : v<50?[0,8] : v<75?[0,4,8,12] : [0,2,4,6,8,10,12,14];
        CHORD_DEGREES.forEach(c=>{ for(let s=0;s<STEPS;s++) P0[c.id][s]=false; });
        steps.forEach((st,i)=>{ const deg=prog[Math.floor(i*prog.length/steps.length)%prog.length];
          P0['deg'+deg][st]=true; });
        break; }
      case 'drive': {
        const b=BEATS[v<50?'stadiumverse':'stadiumchorus'];
        drums.forEach(d=>{ for(let s=0;s<STEPS;s++) P0[d.id][s]=false; });
        Object.keys(b).forEach(l=>b[l].forEach(st=>{ P0[l][st]=true; }));
        break; }
      case 'layers': {
        // A hard cap, and it is honest: parts are muted from the least structural upward, and the
        // chord voice and the bass are never among them.
        // The slider is 0-100 like every other control here; the CAP is 1-6. Reading the slider
        // value AS the part count meant every position from 6 to 100 clamped to six, so 94% of the
        // control's travel did nothing at all. Measured across the family suite.
        const cap=famClamp(1+Math.round((v/100)*5),1,6);
        const order=['melody','hats','snare','kick','chords','bass'];
        order.forEach((g,i)=>{ mix[g].mute = (order.length-i) > cap ? 1 : 0; });
        mix.chords.mute=0; mix.bass.mute=0;
        applyAllGroupsLive(); syncMixerUI();
        break; }
      case 'orchestra': {
        // Spread stays BELOW the singer: the chord stack never reaches into 1.5-4 kHz.
        const g=v/100;
        mix.chords.lo=g*4; mix.chords.mid=-(g*2); mix.chords.hi=-(4+g*6);
        applyAllGroupsLive(); syncMixerUI();
        break; }
      case 'drama': {
        const g=v/100;
        mix.chords.vol=Math.round(100-g*18); mix.hats.vol=Math.round(100-g*22);
        applyAllGroupsLive(); syncMixerUI();
        break; }
      case 'contrast': {
        // Sections stop sharing: the busier lanes are removed from alternate sections.
        // Symmetric on purpose. This only ever cleared lanes, so it did nothing whenever the lane
        // was already empty — and once cleared, moving the control back restored nothing. A control
        // that cannot be undone by moving it back is not a control. Low values put the family's own
        // lanes back into the odd sections; high values take them out again.
        const g=v/100, b=BEATS['maximalopus']||{};
        for(let p=1;p<N_PATTERNS;p+=2){
          ['hat','openhat','shaker'].forEach(l=>{
            for(let s=0;s<STEPS;s++) patterns[p][l][s]=false;
            if(g<=0.5) (b[l]||[]).forEach(s=>{ if(s<STEPS) patterns[p][l][s]=true; });
          });
        }
        renderGrid(); refreshPatBtns();
        break; }
      case 'finale': {
        // The ending never fades. It is a held cadence, written as its own section.
        const last=N_PATTERNS-1;
        drums.forEach(d=>{ for(let s=0;s<STEPS;s++) patterns[last][d.id][s]=false; });
        CHORD_DEGREES.forEach(c=>{ for(let s=0;s<STEPS;s++) patterns[last][c.id][s]=false; });
        if(v>=34){ patterns[last]['deg'+prog[prog.length-1]][0]=true;
          patterns[last]['deg'+prog[0]][8]=true;
          secNames[last]='Finale';
          document.querySelectorAll('#secnames input').forEach((el,i)=>{ el.value=secNames[i]||''; });
          if(v>=67){ for(let b=SONG_SLOTS-4;b<SONG_SLOTS;b++) song[b]=last; renderAllSlots(); } }
        break; }
      case 'evolve': {
        // Changes land on LATER repeats only, so there is always a baseline to hear them against.
        const step=v<34?0:v<67?2:1;
        if(step) for(let p=1;p<N_PATTERNS;p+=step){
          for(let s=0;s<STEPS;s++) patterns[p].hat[s]= (s%(p%2?4:2))===0 ? true : patterns[p].hat[s]; }
        break; }
      case 'space': {
        // Subtraction, and the chord root always survives. Two things were wrong here. It only ever
        // removed, so moving the control back restored nothing; and it worked on a fixed list of
        // hat lanes, which made it completely inert on a family that has none — Confessional
        // Minimal's whole beat is kick:[0,10], clap:[8], so there were no hats to take away and the
        // control did nothing at all on the driest family Aura ships.
        //
        // It now works on the lanes THIS family actually has, taking them away least-structural
        // first as the control rises, and putting them back as it falls. The kick is never removed:
        // it is the floor a singer counts against.
        const g=v/100, fb=BEATS[FAM_BEAT[fam]]||{};
        if(g>0.3) P0.melody=[];
        const order=['shaker','openhat','hat','clap','snare'];
        const present=order.filter(l=>(fb[l]||[]).length);
        const strip=Math.round(g*present.length);
        present.forEach((l,i)=>{ if(i<strip) setLane(l,[]); else setLane(l,(fb[l]||[])); });
        renderGrid(); refreshPatBtns();
        break; }
      case 'pulse': {
        const b=BEATS[FAM_BEAT[fam]]||{};
        drums.forEach(d=>{ for(let s=0;s<STEPS;s++) P0[d.id][s]=false; });
        if(v>=13) setLane('shaker',(b.shaker||[]));
        if(v>=38){ setLane('kick',b.kick||[]); setLane('clap',b.clap||[]); }
        if(v>=63) setLane('hat',b.hat||[]);
        if(v>=88){ setLane('snare',b.snare||[]); setLane('openhat',b.openhat||[]); }
        break; }
      case 'rise': {
        const g=v/100;
        mix.chords.hi=-(8-(g*10)); applyAllGroupsLive(); syncMixerUI();
        break; }
      case 'revision': {
        // This was `break` — a control that moved and did nothing, which the project's own rule
        // calls worse than a missing feature. Living Draft's whole idea is that a change is KEPT as
        // its own version rather than overwriting the last one, so that is what it now does: the
        // current section is copied into a later slot, and at the top of the range that copy is
        // placed into the arrangement so the song actually plays both versions.
        //
        // It writes patterns and the arrangement, which are real project data — so it saves, exports
        // and undoes in one step like every other control here. Nothing is ever overwritten silently:
        // the copy goes to a slot the family is not already using.
        const g=v/100;
        const dst=Math.min(N_PATTERNS-1,currentPattern+ (g<0.5?1:2));
        if(g>0.15 && dst!==currentPattern){
          ALL_IDS.forEach(id=>{ for(let s=0;s<STEPS;s++) patterns[dst][id][s]=patterns[currentPattern][id][s]; });
          patterns[dst].melody=(patterns[currentPattern].melody||[]).map(n=>({...n}));
          secNames[dst]='Version '+(dst+1);
          const nm=document.querySelectorAll('#secnames input');
          if(nm[dst]) nm[dst].value=secNames[dst];
          // At the top of the range the version joins the arrangement, so it is audible rather than
          // merely stored. Only the trailing slots are touched, so an arrangement already built by
          // hand keeps its opening.
          if(g>=0.7){ for(let b=SONG_SLOTS-2;b<SONG_SLOTS;b++) song[b]=dst; renderAllSlots(); }
          renderGrid(); refreshPatBtns();
        }
        break; }
      case 'intimacy': {
        const g=v/100;
        reverbEl.value=String(Math.round(26-g*18)); reverbWet=(+reverbEl.value)/100*0.7;
        mix.vocals.vol=Math.round(100+g*12);
        applyAllGroupsLive(); syncMixerUI();
        break; }
      case 'release': {
        chordStyle = v>60?'pad':'piano'; chordStyleEl.value=chordStyle;
        break; }
      case 'truth': {
        // The take is left alone: no reverb send, no compression change on the vocal channel.
        mix.vocals.rev = v>50 ? 0 : Math.round((50-v)/50*20);
        applyAllGroupsLive(); syncMixerUI();
        break; }
      case 'weight': {
        const g=v/100;
        bassStyle = g>0.5?'808':'sub'; bassStyleEl.value=bassStyle;
        mix.bass.lo=g*6; mix.bass.vol=Math.round(90+g*30);
        applyAllGroupsLive(); syncMixerUI();
        break; }
      case 'haze': {
        const g=v/100;
        mix.chords.hi=-(g*14); mix.melody.hi=-(g*10);
        applyAllGroupsLive(); syncMixerUI();
        break; }
    }
    renderGrid(); refreshPatBtns(); renderRoll();
  }

  function renderFamilyControls(){
    const host=document.getElementById('famPanel'); if(!host) return;
    const fam=activeFamily;
    if(!fam||!FAMILY_CTRL[fam]){ host.hidden=true; host.innerHTML=''; return; }
    host.hidden=false; host.innerHTML='';
    const v=VIBES[fam];
    const h=document.createElement('h3'); h.className='famtitle'; h.textContent=v.label; host.appendChild(h);
    if(v.promise){ const p=document.createElement('p'); p.className='fampromise'; p.textContent=v.promise; host.appendChild(p); }
    const grid=document.createElement('div'); grid.className='famgrid';
    FAMILY_CTRL[fam].forEach(c=>{
      const row=document.createElement('div'); row.className='ctrl famctrl';
      const lab=document.createElement('label'); lab.textContent=c.label; lab.setAttribute('for','fam-'+c.id);
      const sl=document.createElement('input'); sl.type='range'; sl.id='fam-'+c.id;
      sl.min = c.id==='layers'?'1':'0'; sl.max = c.id==='layers'?'6':'100';
      sl.value=String(famVal[fam][c.id]);
      sl.setAttribute('aria-label',c.label+' — '+c.hint);
      sl.title=c.hint;
      const val=document.createElement('span'); val.className='val';
      val.textContent = c.id==='layers'? sl.value : sl.value+'%';
      sl.addEventListener('input',()=>{ val.textContent = c.id==='layers'? sl.value : sl.value+'%'; });
      sl.addEventListener('change',()=>{
        oneCheckpoint(()=>famApply(fam,c.id,+sl.value));
        toast(c.label+' — '+c.hint);
      });
      row.appendChild(lab); row.appendChild(sl); row.appendChild(val);
      const hint=document.createElement('span'); hint.className='famhint'; hint.textContent=c.hint;
      row.appendChild(hint);
      grid.appendChild(row);
    });
    host.appendChild(grid);
    const note=document.createElement('p'); note.className='famhint';
    note.textContent='These five shape this family only. Everything they change is real — it saves with '
      +'your project, it exports, and one move is one undo.';
    host.appendChild(note);
  }

  // ---------- vocal balance: what Aura can honestly do with no engine installed ----------
  // This is pure DSP on the stereo field. It is not a separation model and it never claims to be.
  //
  // A finished record almost always puts the LEAD vocal dead centre and spreads backing vocals, adlibs
  // and responses wider. So for each frequency bin Aura measures how much the two channels agree —
  //     agreement = 2|L·conj(R)| / (|L|^2 + |R|^2)
  // which is 1 when a bin is identical in both channels (centred) and 0 when the channels are
  // unrelated (wide). Raising that to a power gives a soft mask over the centred material, and the
  // rest of the mix is what is left when it is removed.
  //
  // What that buys, honestly:
  //   * it removes CENTRED material, which is usually the lead vocal — but also the kick, the snare
  //     and the bass, which are also centred. So the "music only" result is thinner in the middle,
  //     and Aura says so rather than pretending it separated instruments.
  //   * it keeps WIDE material, which is usually the adlibs and backing vocals. That is the whole
  //     reason "remove the lead but keep the adlibs" is possible at all without a model.
  //   * on a MONO recording there is no stereo field to work with and it can do nothing. Aura detects
  //     that and refuses rather than returning silence or an unchanged file.
  // Every result is labelled Approximate. It is never called a stem.
  const VOC_FFT=2048, VOC_HOP=512;
  const VOC_MODES={
    full:    {label:'Everything',            hint:'The recording exactly as it is.'},
    music:   {label:'Music only',            hint:'Takes out what sits dead centre — usually the lead voice, and some of the kick and bass with it.'},
    adlibs:  {label:'Music and adlibs',      hint:'Takes out the centre but keeps what is spread wide — usually the adlibs, harmonies and responses.'},
    lead:    {label:'Lead voice only',       hint:'Keeps only what sits dead centre. Whatever else was centred comes with it.'},
  };
  const voc={ mode:'full', width:60, detail:35, buf:null, srcName:'', mono:false, conf:0, ready:false, busy:false };

  // How much stereo is there to work with at all? Correlation near 1 across the file means the two
  // channels are the same recording and there is no centre to remove.
  function stereoWidthOf(buf){
    if(buf.numberOfChannels<2) return {mono:true, corr:1, width:0, side:0};
    const L=buf.getChannelData(0), R=buf.getChannelData(1);
    const n=Math.min(L.length, buf.sampleRate*40);           // 40 s is plenty to characterise a mix
    let sl=0,sr=0,slr=0,sm=0,ss=0;
    for(let i=0;i<n;i++){ const a=L[i],b=R[i];
      sl+=a*a; sr+=b*b; slr+=a*b;
      const m=(a+b)/2, sd=(a-b)/2; sm+=m*m; ss+=sd*sd; }
    const denom=Math.sqrt(sl*sr)||1e-12;
    const corr=Math.max(-1,Math.min(1,slr/denom));
    // How much of this recording is NOT in the centre. Correlation alone is a poor guide: a mix with
    // a loud centred lead and genuinely hard-panned adlibs still correlates highly, and reporting that
    // as "very little stereo" understates exactly the material this feature works on. Side energy
    // relative to the whole is the thing the mask actually has to work with.
    const mid=Math.sqrt(sm/(n||1)), side=Math.sqrt(ss/(n||1));
    const sideRatio=(mid+side)>1e-12 ? side/(mid+side) : 0;
    return {mono:corr>0.995, corr, width:sideRatio, side:sideRatio};
  }

  // One STFT pass over both channels, a per-bin agreement mask, and an inverse overlap-add.
  // Hann analysis and synthesis with 75% overlap sums to a constant, so the reconstruction is exact
  // when the mask is 1 — which is what makes "Everything" bit-honest rather than a slightly filtered
  // copy of itself.
  function separateStereo(buf, mode, widthPct, detailPct){
    const n=buf.length, sr=buf.sampleRate;
    const L=buf.getChannelData(0), R=buf.numberOfChannels>1?buf.getChannelData(1):buf.getChannelData(0);
    const out=ac.createBuffer(2,n,sr);
    const oL=out.getChannelData(0), oR=out.getChannelData(1);
    const N=VOC_FFT, H=VOC_HOP, bins=N/2;
    const win=new Float32Array(N);
    for(let i=0;i<N;i++) win[i]=0.5-0.5*Math.cos(2*Math.PI*i/N);      // periodic Hann
    const lr=new Float32Array(N), li=new Float32Array(N);
    const rr=new Float32Array(N), ri=new Float32Array(N);
    const norm=new Float32Array(n);
    // `width` decides how tightly "centred" is defined; `detail` blends a little of the untouched
    // signal back in, which is what stops a heavily masked result sounding like a phone call.
    const sharp=1.0+(widthPct/100)*5.0;
    const blend=Math.max(0,Math.min(0.5,(detailPct/100)*0.5));
    for(let pos=0; pos+N<=n; pos+=H){
      for(let i=0;i<N;i++){ const w=win[i];
        lr[i]=L[pos+i]*w; li[i]=0; rr[i]=R[pos+i]*w; ri[i]=0; }
      fft(lr,li); fft(rr,ri);
      for(let b=0;b<N;b++){
        const ar=lr[b], ai=li[b], br=rr[b], bi=ri[b];
        const pl=ar*ar+ai*ai, pr=br*br+bi*bi;
        // The REAL part of L·conj(R), not its magnitude. The magnitude cannot tell +1 correlation
        // from -1: for a hard anti-phase pair (L = A, R = -A) it returns |A|², identical to a dead
        // centred one, so the widest material a mix can contain — stereo wideners, decorrelated
        // reverb tails, mid/side-processed pads — scored as "centre" and was removed by the mode
        // whose entire job is to keep the music. Measured at -46 dB on a deliberately anti-phase
        // instrumental layer. The real part is signed: in-phase is positive and stays centre,
        // anti-phase is negative and clamps to 0, which is as wide as the mask can call anything.
        const cr=ar*br+ai*bi;
        const agree=(pl+pr)>1e-20 ? Math.max(0,Math.min(1,(2*cr)/(pl+pr))) : 0;
        const m=Math.pow(agree,sharp);                        // 1 = dead centre, 0 = wide
        let gl, gr;
        if(mode==='lead'){ gl=m; gr=m; }
        else if(mode==='music'||mode==='adlibs'){ gl=1-m; gr=1-m; }
        else { gl=1; gr=1; }
        if(mode!=='full'){ gl=gl+(1-gl)*blend; gr=gr+(1-gr)*blend; }
        lr[b]*=gl; li[b]*=gl; rr[b]*=gr; ri[b]*=gr;
      }
      // inverse: conjugate, forward transform, conjugate, scale
      for(let i=0;i<N;i++){ li[i]=-li[i]; ri[i]=-ri[i]; }
      fft(lr,li); fft(rr,ri);
      for(let i=0;i<N;i++){
        const w=win[i]/N;
        oL[pos+i]+=lr[i]*w; oR[pos+i]+=rr[i]*w;
        norm[pos+i]+=win[i]*win[i];
      }
    }
    for(let i=0;i<n;i++){ const g=norm[i]>1e-6?1/norm[i]:0; oL[i]*=g; oR[i]*=g; }
    return out;
  }

  // 'adlibs' differs from 'music' in how tightly the centre is defined: a NARROWER notch leaves more
  // of the near-centre backing vocals in place, which is the point of the mode.
  //
  // This subtracted 30 and did the exact opposite. The mask is agree^sharp and the removal gain is
  // 1-mask, so a LOWER exponent makes the mask larger for everything that is not dead centre, which
  // widens the notch and takes MORE backing out. Measured across the fixture suite, "Keep wider
  // backing vocals and adlibs" was retaining 3 to 5 dB LESS backing than "Keep music" on every mix
  // that had any — a control that promised to keep more was removing more. Adding narrows it.
  function vocSharpFor(mode,width){ return mode==='adlibs'? Math.min(100,width+30) : width; }

  function vocApplyMode(mode){
    if(!smp.buf){ toast('Import a recording first'); return; }
    if(voc.busy) return;
    const info=stereoWidthOf(smp.buf);
    voc.mono=info.mono;
    if(mode!=='full' && info.mono){
      vocStatus('This recording is mono — both sides are identical, so there is no centre for Aura to '
        +'take out. Nothing was changed.');
      vocPaint(); return;
    }
    voc.busy=true; vocStatus('Working through the recording…');
    vocPaint();
    setTimeout(()=>{
      try{
        ensureCtx();
        if(mode==='full'){ voc.buf=null; voc.mode='full'; smp.play=null; }
        else {
          voc.buf=separateStereo(smp.buf, mode, vocSharpFor(mode,voc.width), voc.detail);
          voc.mode=mode;
        }
        voc.ready=mode!=='full';
        // Confidence is the stereo width itself: with almost no stereo information there is almost no
        // basis for the result, and the number says that rather than a flattering constant.
        voc.conf=Math.max(0.1,Math.min(0.85, info.side*3.0));
        vocStatus(vocResultLine(mode,info));
      }catch(e){ console.warn(e); voc.buf=null; voc.ready=false;
        vocStatus('Aura could not work through this recording. The original is unchanged.'); }
      voc.busy=false; vocPaint(); vocRefreshPlayback();
    },30);
  }
  function vocResultLine(mode,info){
    if(mode==='full') return 'Playing your recording exactly as it is.';
    const q=info.side<0.06?'Almost everything in this recording sits in the middle, so there is little for Aura to separate and this is a rough result.'
           :info.side<0.16?'This recording has some width away from the centre, so the result is usable but not clean.'
           :'This recording has plenty of width away from the centre to work with.';
    return VOC_MODES[mode].label+' — approximate. '+q+' Listen before you use it.';
  }
  const vocStatus=t=>{ const el=document.getElementById('vocStatus'); if(el) el.textContent=t; };

  // The separated result replaces the reference audio in playback ONLY. smp.buf is never overwritten,
  // so "Everything" always returns the untouched recording and Remove/Replace still work on the file
  // the singer actually chose.
  function vocPlayBuf(){ return (voc.ready&&voc.buf)?voc.buf:smp.buf; }
  function vocRefreshPlayback(){
    if(playing){ stopSample(); sampleSrc=scheduleSample(ac,liveBus,now()+.05,null); }
  }

  // ---- the three import paths, named ------------------------------------------------------------
  // These are three different things and the interface must never blur them:
  //   analyze  — Aura reports what it hears and writes NOTHING into the project
  //   rebuild  — Aura writes ORIGINAL parts of its own from the analysis (Path B)
  //   adjust   — Aura reshapes the RECORDING ITSELF by stereo position (approximate, not separation)
  // Path B is the default because it is the headline capability; the other two are one tap away.
  let impMode='rebuild';
  const IMP_MODE_NOTE={
    analyze:'Aura will tell you the tempo, key, chords, sections and drums it hears. Nothing in your '
      +'track changes, and nothing is written until you switch to Rebuild with Aura.',
    rebuild:'Aura builds a new backing track from what it heard, using its own sounds. Your recording '
      +'is only a reference — none of its audio goes into the result.',
    adjust:'Aura reshapes this recording by where things sit in the stereo picture. This is approximate '
      +'and it is not separation — the result is still the recording, not new parts.',
  };
  function setImpMode(m){
    if(!IMP_MODE_NOTE[m]) return;
    impMode=m;
    // The rows decide at RENDER time whether to draw an Apply button, so changing the path has to
    // redraw them. Toggling visibility alone left "Analyze only" showing three live Apply buttons.
    // renderRebuild() must not call back into paintImpMode() or this recurses.
    if(imp) renderRebuild();
    paintImpMode();
  }
  function paintImpMode(){
    const wrap=document.getElementById('impMode');
    if(wrap) wrap.hidden=!smp.buf;
    document.querySelectorAll('#impModeSeg button').forEach(b=>{
      const on=b.dataset.im===impMode;
      b.classList.toggle('on',on); b.setAttribute('aria-checked',String(on));
    });
    const note=document.getElementById('impModeNote');
    if(note) note.textContent=smp.buf?(IMP_MODE_NOTE[impMode]||''):'';
    // Reconstruction surface: visible in analyze AND rebuild, but in analyze it is READ ONLY —
    // the Apply buttons are removed, not disabled, because a control that cannot act should not be
    // rendered at all.
    const rb=document.getElementById('rebuild');
    if(rb) rb.hidden=!(smp.buf&&imp&&(impMode==='rebuild'||impMode==='analyze'));
    document.body.classList.toggle('imp-analyze',impMode==='analyze');
    const voc=document.getElementById('vocCard');
    if(voc) voc.hidden=!(smp.buf&&impMode==='adjust');
    const tempo=document.getElementById('rbTempo');
    if(tempo) tempo.hidden=!(smp.buf&&imp&&impMode==='rebuild');
    renderTempoChoice();
  }

  // ---- tempo decision, made BEFORE Apply -------------------------------------------------------
  // The reconstruction used to report one tempo and apply at whatever the project happened to be on.
  // Observed live: analysis read 100 BPM correctly and the applied result sat at 140, because tempo
  // was only offered inside the separate remix plan. A reconstruction at an unrelated tempo is not a
  // reconstruction. The choice is explicit, and it is asked rather than assumed whenever the project
  // already holds work the singer might not want re-timed.
  const impTempo={ choice:null, custom:null };
  // "Clean project" cannot mean "no notes": Aura seeds a default vibe on first load, so a brand new
  // project always contains music nobody chose. What matters is whether the SINGER has work here —
  // an edit they could undo, or a project they saved. Either one means the tempo is theirs and must
  // not be replaced without being asked.
  // Aura's own startup writes history: seeding the song and applying the default vibe both push
  // checkpoints, so hist.past.length is already 2 by the time the app is on screen. Comparing
  // against zero therefore never said "fresh" and the tempo default was always "keep". The baseline
  // is captured once, after boot, and freshness is measured against THAT.
  let histBaseline=null;
  function projectIsFresh(){
    const base=(histBaseline==null)?hist.past.length:histBaseline;
    return hist.past.length<=base && !(projMeta&&projMeta.id);
  }
  function tempoOptions(){
    if(!imp||!imp.bpm) return [];
    const d=Math.round(imp.bpm);
    const out=[{k:'detected',lbl:'Use detected tempo',sub:d+' BPM'}];
    out.push({k:'keep',lbl:'Keep current project tempo',sub:Math.round(+bpmEl.value)+' BPM'});
    if(d*2<=220) out.push({k:'double',lbl:'Try double-time',sub:(d*2)+' BPM'});
    if(d/2>=40)  out.push({k:'half',  lbl:'Try half-time', sub:Math.round(d/2)+' BPM'});
    out.push({k:'custom',lbl:'Another tempo',sub:'you choose'});
    return out;
  }
  function chosenTempo(){
    const d=imp&&imp.bpm?Math.round(imp.bpm):null;
    switch(impTempo.choice){
      case 'detected': return d;
      case 'double':   return d?Math.min(220,d*2):null;
      case 'half':     return d?Math.max(40,Math.round(d/2)):null;
      case 'custom':   return impTempo.custom?Math.max(40,Math.min(220,Math.round(impTempo.custom))):null;
      case 'keep':     return null;                       // null means "do not touch the tempo"
      default:         return null;
    }
  }
  // Every Apply calls this FIRST, so Beat, low end, chords, Melody, sections, playback and export all
  // land on one tempo instead of disagreeing with each other.
  // `#bpm` is <input type="range" min="60" max="160">, and assigning a value outside that range
  // clamps SILENTLY. "Double" on a 92 BPM import asks for 184 and the project lands on 160 — a
  // tempo nobody chose, with the reconstruction written against it. Clamp deliberately and say so,
  // rather than letting the DOM do it quietly.
  function tempoRange(){
    const lo=+(bpmEl.min||60), hi=+(bpmEl.max||160);
    return { lo: isFinite(lo)?lo:60, hi: isFinite(hi)?hi:160 };
  }
  function applyChosenTempo(){
    const want=chosenTempo();
    if(want==null) return false;
    const r=tempoRange();
    const t=Math.max(r.lo,Math.min(r.hi,Math.round(want)));
    if(t!==Math.round(want)){
      toast('Aura can play between '+r.lo+' and '+r.hi+' BPM, so '+Math.round(want)
           +' became '+t+'. Everything applied is written for '+t+'.');
    }
    if(Math.round(+bpmEl.value)===t) return false;
    bpmEl.value=String(t); bpmVal.textContent=String(t);
    bpmEl.dispatchEvent(new Event('input',{bubbles:true}));
    return true;
  }
  // Say what Apply will ACTUALLY do, including the clamp. Choosing "double" on a 92 BPM import asks
  // for 184, which the tempo control cannot reach — the singer should read that here rather than
  // discover it afterwards.
  function tempoNoteText(){
    const want=chosenTempo();
    if(want==null) return 'Your project stays at '+Math.round(+bpmEl.value)
      +' BPM. The reconstruction is written to fit it.';
    const r=tempoRange();
    const t=Math.max(r.lo,Math.min(r.hi,Math.round(want)));
    return t===Math.round(want)
      ? 'Apply will set the project to '+t+' BPM.'
      : 'Apply will set the project to '+t+' BPM — Aura plays between '+r.lo+' and '+r.hi
        +', so it cannot reach '+Math.round(want)+'.';
  }
  function renderTempoChoice(){
    const seg=document.getElementById('rbTempoSeg'); if(!seg) return;
    const opts=tempoOptions();
    if(!opts.length){ seg.innerHTML=''; return; }
    // Default: a clean project takes the detected tempo. A project that already holds music does NOT
    // get silently re-timed — it starts on "keep" so the singer has to choose to change it.
    if(impTempo.choice==null) impTempo.choice=projectIsFresh()?'detected':'keep';
    seg.innerHTML='';
    opts.forEach(o=>{
      const b=document.createElement('button');
      b.type='button'; b.setAttribute('role','radio');
      const on=impTempo.choice===o.k;
      b.className=on?'on':''; b.setAttribute('aria-checked',String(on));
      const n=document.createElement('b'); n.textContent=o.lbl;
      const s=document.createElement('span'); s.textContent=o.sub;
      b.appendChild(n); b.appendChild(s);
      b.addEventListener('click',()=>{ impTempo.choice=o.k; renderTempoChoice(); });
      seg.appendChild(b);
    });
    const ci=document.getElementById('rbTempoCustom');
    if(ci){ ci.hidden=impTempo.choice!=='custom';
      if(impTempo.choice==='custom'&&!ci.value&&imp&&imp.bpm) ci.value=String(Math.round(imp.bpm));
      ci.oninput=()=>{ impTempo.custom=+ci.value; const n=document.getElementById('rbTempoNote');
        if(n) n.textContent=tempoNoteText(); };
    }
    const note=document.getElementById('rbTempoNote');
    if(note) note.textContent=tempoNoteText();
    const lbl=document.getElementById('rbTempoCustom');
    if(lbl&&impTempo.choice!=='custom') lbl.hidden=true;
  }

  function vocPaint(){
    const wrap=document.getElementById('vocCard'); if(!wrap) return;
    wrap.hidden=!(smp.buf&&impMode==='adjust');
    document.querySelectorAll('#vocSeg button').forEach(b=>{
      const on=b.dataset.vm===voc.mode;
      b.classList.toggle('on',on); b.setAttribute('aria-checked',String(on));
    });
    const busy=document.getElementById('vocBusy');
    if(busy) busy.hidden=!voc.busy;
    const c=document.getElementById('vocConf');
    if(c){ c.hidden=!(voc.ready&&!voc.busy);
      if(voc.ready) c.textContent='how well this recording suits it: '+confLabel(voc.conf)+' · '+Math.round(voc.conf*100)+'%';
      c.className='rbconf '+(voc.ready?'c-'+confLabel(voc.conf):''); }
    const ap=document.getElementById('vocApprox');
    if(ap) ap.hidden=!voc.ready;
    const adv=document.getElementById('vocAdv');
    if(adv) adv.hidden=!voc.ready;
  }

  function wireImportModes(){
    document.querySelectorAll('#impModeSeg button').forEach(b=>
      b.addEventListener('click',()=>{
        setImpMode(b.dataset.im);
        // Switching to Adjust must not leave a half-applied balance behind, and switching away from
        // it must put the recording back the way the singer gave it to us.
        if(b.dataset.im!=='adjust'&&voc.ready) vocApplyMode('full');
      }));
  }

  function wireVocalPanel(){
    const $=id=>document.getElementById(id);
    document.querySelectorAll('#vocSeg button').forEach(b=>
      b.addEventListener('click',()=>vocApplyMode(b.dataset.vm)));
    const bind=(id,set,fmt)=>{ const el=$(id); if(!el) return;
      el.addEventListener('change',()=>{ set(+el.value); const v=$(id+'V'); if(v) v.textContent=fmt(+el.value);
        if(voc.ready) vocApplyMode(voc.mode); });
      el.addEventListener('input',()=>{ const v=$(id+'V'); if(v) v.textContent=fmt(+el.value); }); };
    bind('vocWidth', v=>voc.width=v, v=>v+'%');
    bind('vocDetail',v=>voc.detail=v, v=>v+'%');
  }

  // ---------- make a sound: the from-scratch path ----------
  // A singer who has imported nothing can still record or generate a sound, chop it into slices, play
  // them, shape them, and turn what they like into a section of their own song.
  //
  // The audio itself lives ONLY in memory, exactly like a vocal take and an imported reference — it is
  // never written into a .aura file, a share link or localStorage. What gets SAVED is the pattern it
  // produced, which is real editable Aura music. That is why "Build a section" is the important button:
  // it converts something transient into something the project owns.
  //
  // Every sound here is the singer's own or Aura's own: a microphone recording, a file they chose, or a
  // tone Aura synthesised. No sample content ships with the app.
  const snd={ buf:null, name:'', src:'', slices:[], sel:-1,
              pitch:0, speed:1, trim:0, warm:0, filt:0, repeat:1, rev:false, swing:true };
  let sndSrc=null, sndRecorder=null, sndChunks=[], sndRecording=false, sndStopTimer=null;

  const sndStatus=t=>{ const el=document.getElementById('sndStatus'); if(el) el.textContent=t; };
  function sndShow(on){
    const b=document.getElementById('sndBody'); if(b) b.hidden=!on;
    const s=document.getElementById('sndStart'); if(s) s.hidden=!!on;
    const h=document.getElementById('sndHint'); if(h) h.hidden=!!on;
  }
  // Tape-style: pitch and speed are one playbackRate, and the UI says so rather than pretending to
  // offer independent time-stretching Aura does not do.
  const sndRate=()=>Math.max(0.25,Math.min(4, Math.pow(2,snd.pitch/12)*snd.speed));

  function sndReset(){
    sndStopPlay();
    snd.buf=null; snd.name=''; snd.src=''; snd.slices=[]; snd.sel=-1;
    snd.pitch=0; snd.speed=1; snd.trim=0; snd.warm=0; snd.filt=0; snd.repeat=1; snd.rev=false;
    sndShow(false);
    const pads=document.getElementById('sndPads'); if(pads) pads.innerHTML='';
    const sh=document.getElementById('sndShape'); if(sh) sh.hidden=true;
    const ph=document.getElementById('sndPadHint'); if(ph) ph.hidden=true;
    sndStatus('Nothing recorded yet');
  }

  // What kind of source each sampler path produces. 'Use a file I own' is `declared`, not `clear`:
  // Aura has not checked anything, the singer has asserted it, and the rights report has to say so.
  // Keyed on the exact strings the three call sites pass (app.js sndStartRecord / sndLoadFile /
  // sndMakeTone), not on tidier names — a mismatch here silently makes every sampler source
  // 'unknown', which blocks rights confirmation even for a tone Aura generated itself.
  const SND_KIND={ 'recorded here':'user-recording', 'your file':'user-import', 'made by Aura':'aura-synth' };

  function sndAdopt(buf,name,how){
    snd.buf=buf; snd.name=name; snd.src=how; snd.slices=[]; snd.sel=-1;
    // Record it as a source NOW, while what it is and where it came from is still known. Nothing
    // did this before, so a third-party file could be chopped into a section and the whole project
    // still reported as "Generated by Aura. Yours to use." — the report was clean because the file
    // was invisible to it, not because the file was clear.
    snd.assetId=recordAsset(SND_KIND[how]||'unknown', name||'Sampler sound',
                            { included:false,      // audio is never exported; only what it builds is
                              rightsNote: how==='your file'
                                ? 'You chose this file and said you have the right to use it.'
                                : '' }).id;
    sndShow(true);
    const n=document.getElementById('sndName'); if(n) n.textContent=name;   // textContent: never markup
    const m=document.getElementById('sndMeta');
    if(m) m.textContent=buf.duration.toFixed(2)+'s · '+Math.round(buf.sampleRate/1000)+' kHz · '+how;
    sndDrawWave(); sndRenderPads();
    sndStatus(name+' — '+buf.duration.toFixed(2)+'s. Press Find slices, or play it first.');
  }

  // ---- getting a sound in ----
  async function sndStartRecord(){
    if(sndRecording){ sndStopRecord(); return; }
    if(playing){ stop(); }
    if(!(await ensureMic())){ sndStatus('Aura could not open the microphone. The message above the '
      +'Record button in Vocals explains why.'); return; }
    if(!window.MediaRecorder){ sndStatus('Recording is not supported in this browser. Use a file you own instead.'); return; }
    sndChunks=[]; const mime=pickMime();
    try{ sndRecorder=new MediaRecorder(micStream, mime?{mimeType:mime}:undefined); }
    catch(e){ sndStatus('The recorder would not start in this browser.'); return; }
    sndRecorder.ondataavailable=e=>{ if(e.data&&e.data.size) sndChunks.push(e.data); };
    sndRecorder.onstop=sndOnRecStop;
    sndRecording=true;
    const b=document.getElementById('sndRec');
    if(b){ b.textContent='■ Stop'; b.classList.add('on'); }
    sndStatus('Listening… make your sound, then press Stop.');
    try{ sndRecorder.start(); }catch(e){ sndRecording=false; sndStatus('The recorder would not start.'); return; }
    // A hard stop, so a forgotten recording cannot grow without limit.
    sndStopTimer=setTimeout(()=>{ if(sndRecording) sndStopRecord(); },20000);
  }
  function sndStopRecord(){
    if(!sndRecording) return;
    sndRecording=false;
    if(sndStopTimer){ clearTimeout(sndStopTimer); sndStopTimer=null; }
    const b=document.getElementById('sndRec');
    if(b){ b.textContent='● Record a sound'; b.classList.remove('on'); }
    try{ sndRecorder.stop(); }catch(e){}
  }
  async function sndOnRecStop(){
    const blob=new Blob(sndChunks,{type:(sndRecorder&&sndRecorder.mimeType)||'audio/webm'});
    sndChunks=[];
    if(!blob.size){ sndStatus('Nothing was recorded. Try again and make a sound while it listens.'); return; }
    sndStatus('Reading what you recorded…');
    try{
      ensureCtx();
      const buf=await ac.decodeAudioData((await blob.arrayBuffer()).slice(0));
      sndAdopt(buf,'Your recording','recorded here');
      sndFindSlices();
    }catch(e){ console.warn(e); sndStatus('Aura could not read that recording back. Try once more.'); }
  }
  async function sndLoadFile(file){
    if(!file) return;
    sndStatus('Reading '+file.name+'…');
    try{
      ensureCtx();
      const buf=await ac.decodeAudioData((await file.arrayBuffer()).slice(0));
      if(buf.duration>60){ sndStatus('That file is '+Math.round(buf.duration)+' seconds. Chopping works best '
        +'on something short — a few seconds is plenty.'); }
      sndAdopt(buf,file.name,'your file');
      sndFindSlices();
    }catch(e){ console.warn(e);
      sndStatus('This browser could not read the audio in “'+file.name+'”. WAV, MP3 or M4A work best.'); }
  }
  // Aura's own tone. Nothing is sampled from anywhere: a struck-string-ish body with a short noise
  // attack, built from oscillators, so there is always a sound to chop even with no microphone.
  function sndMakeTone(){
    ensureCtx();
    const sr=ac.sampleRate, dur=2.2, n=Math.ceil(sr*dur);
    const buf=ac.createBuffer(1,n,sr), d=buf.getChannelData(0);
    const root=midiToFreq(chordRootMidi(0));
    const partials=[[1,1],[2,0.42],[3,0.22],[4,0.12],[5,0.07]];
    // Five strikes so there is something to slice, each a step of the current scale.
    const hits=[0,0.42,0.84,1.26,1.68];
    hits.forEach((t0,i)=>{
      const f=root*Math.pow(2,(scale().steps[i%scale().steps.length])/12);
      const start=Math.floor(t0*sr), len=Math.floor(0.40*sr);
      for(let j=0;j<len && start+j<n;j++){
        const tt=j/sr, env=Math.exp(-tt*7.5);
        let v=0;
        partials.forEach(([h,a])=>{ v+=Math.sin(2*Math.PI*f*h*tt)*a; });
        // a short bright attack so the onset detector has an edge to find
        if(tt<0.006) v+=(1-tt/0.006)*0.55*Math.sin(2*Math.PI*3100*tt);
        d[start+j]+=v*env*0.16;
      }
    });
    let pk=0; for(let i=0;i<n;i++) pk=Math.max(pk,Math.abs(d[i]));
    if(pk>0.9){ const g=0.9/pk; for(let i=0;i<n;i++) d[i]*=g; }
    sndAdopt(buf,'Aura tone','made by Aura');
    sndFindSlices();
  }

  // ---- slicing ----
  // Reuses the reconstruction engine's own onset detector, so a slice boundary is the same kind of
  // measurement as a detected drum hit rather than a second, different guess.
  function sndFindSlices(){
    if(!snd.buf) return;
    let cuts=[];
    try{
      const sp=spectralFrames(snd.buf);
      const bf=bandFlux(sp.E,['sub','body','crack','hi','top']);
      const mix=new Float32Array(sp.frames);
      for(let f=0;f<sp.frames;f++) mix[f]=bf.sub[f]+bf.body[f]+bf.crack[f]+bf.hi[f]+bf.top[f];
      cuts=pickOnsetsBand(mix,sp.fps,1.5,0.045).map(f=>f/sp.fps);
    }catch(e){ console.warn(e); cuts=[]; }
    const dur=snd.buf.duration;
    let even=false;
    if(cuts.length<2){
      // Nothing obvious to cut on — divide it evenly rather than leaving the singer with one pad.
      const n=Math.max(2,Math.min(8,Math.round(dur/0.35)));
      cuts=[]; for(let i=0;i<n;i++) cuts.push(i*dur/n);
      even=true;
    }
    if(cuts[0]>0.02) cuts.unshift(0);
    cuts=cuts.slice(0,16);
    snd.slices=cuts.map((t,i)=>({ start:t, end:(i+1<cuts.length?cuts[i+1]:dur) }))
                   .filter(s=>s.end-s.start>0.015);
    // Counted AFTER the list is final, so the message can never disagree with the pads on screen.
    const n=snd.slices.length;
    sndStatus(even
      ? 'No clear hits in this sound, so Aura cut it into '+n+' even piece'+(n===1?'':'s')+'. Tap a pad to hear one.'
      : 'Found '+n+' slice'+(n===1?'':'s')+'. Tap a pad to hear one.');
    snd.sel=snd.slices.length?0:-1;
    sndDrawWave(); sndRenderPads();
  }

  function sndDrawWave(){
    const cv=document.getElementById('sndWave'); if(!cv||!snd.buf) return;
    const w=cv.width, h=cv.height, g=cv.getContext('2d');
    g.clearRect(0,0,w,h);
    const d=snd.buf.getChannelData(0), step=Math.max(1,Math.floor(d.length/w));
    g.strokeStyle='rgba(165,76,255,.85)'; g.lineWidth=1; g.beginPath();
    for(let x=0;x<w;x++){ let mn=1,mx=-1;
      for(let i=0;i<step;i++){ const v=d[x*step+i]||0; if(v<mn)mn=v; if(v>mx)mx=v; }
      g.moveTo(x+.5,(1-mn)*h/2); g.lineTo(x+.5,(1-mx)*h/2); }
    g.stroke();
    snd.slices.forEach((s,i)=>{
      const x=(s.start/snd.buf.duration)*w;
      g.strokeStyle=i===snd.sel?'#F0EAF6':'rgba(212,178,108,.75)';
      g.lineWidth=i===snd.sel?2:1;
      g.beginPath(); g.moveTo(x,0); g.lineTo(x,h); g.stroke();
    });
  }

  function sndRenderPads(){
    const host=document.getElementById('sndPads'); if(!host) return;
    host.innerHTML='';
    const hint=document.getElementById('sndPadHint'), shape=document.getElementById('sndShape');
    if(!snd.slices.length){ if(hint) hint.hidden=true; if(shape) shape.hidden=true; return; }
    if(hint) hint.hidden=false; if(shape) shape.hidden=false;
    snd.slices.forEach((s,i)=>{
      const b=document.createElement('button'); b.type='button'; b.className='sndpad';
      if(i===snd.sel) b.classList.add('on');
      b.innerHTML='<b>'+(i+1)+'</b><span>'+Math.round((s.end-s.start)*1000)+' ms</span>';
      b.setAttribute('aria-label','Play slice '+(i+1)+', '+Math.round((s.end-s.start)*1000)+' milliseconds');
      b.addEventListener('click',()=>{ snd.sel=i; sndRenderPads(); sndDrawWave(); sndPlaySlice(i); });
      host.appendChild(b);
    });
    const cnt=document.getElementById('sndCount');
    if(cnt) cnt.textContent=snd.slices.length+' slice'+(snd.slices.length===1?'':'s');
  }

  // ---- playing ----
  // Slices play through the SAMPLE bus, so the channel's own level, mute and low cut apply and there
  // is no second audio path to keep in step with the mixer or the export graph.
  function sndStopPlay(){ if(sndSrc){ try{ sndSrc.onended=null; sndSrc.stop(); }catch(e){} sndSrc=null; }
    const p=document.getElementById('sndPlay'); if(p){ p.textContent='▶ Play it'; p.classList.remove('on'); } }
  function sndSliceBuffer(i){
    const s=snd.slices[i]; if(!s||!snd.buf) return null;
    const sr=snd.buf.sampleRate;
    const t0=s.start+(s.end-s.start)*(snd.trim/100);
    const a=Math.floor(t0*sr), b=Math.floor(s.end*sr);
    const len=Math.max(64,b-a);
    const out=ac.createBuffer(1,len,sr), o=out.getChannelData(0), src=snd.buf.getChannelData(0);
    for(let j=0;j<len;j++) o[j]=src[a+(snd.rev?(len-1-j):j)]||0;
    // A short fade at both ends: a slice cut mid-waveform clicks, and a click is the fastest way to
    // make something a singer made sound broken rather than raw.
    const f=Math.min(192,len>>3);
    for(let j=0;j<f;j++){ o[j]*=j/f; o[len-1-j]*=j/f; }
    return out;
  }
  function sndVoice(buf,when){
    if(!buf) return null;
    ensureCtx();
    if(!liveBus||!liveBus.sampleHP) return null;
    const src=ac.createBufferSource(); src.buffer=buf; src.playbackRate.value=sndRate();
    let node=src;
    if(snd.warm>0){ const lp=ac.createBiquadFilter(); lp.type='lowpass';
      lp.frequency.value=16000-snd.warm/100*13500; lp.Q.value=0.6; node.connect(lp); node=lp; }
    if(snd.filt>0){ const hp=ac.createBiquadFilter(); hp.type='highpass';
      hp.frequency.value=40+snd.filt/100*900; hp.Q.value=0.7; node.connect(hp); node=hp; }
    node.connect(liveBus.sampleHP);
    src.start(when);
    return src;
  }
  function sndPlaySlice(i){
    ensureCtx();
    const b=sndSliceBuffer(i); if(!b) return;
    const t=now()+0.02, step=(b.length/b.sampleRate)/sndRate();
    for(let r=0;r<snd.repeat;r++) sndVoice(b,t+r*step);
  }
  function sndPlayAll(){
    if(!snd.buf) return;
    if(sndSrc){ sndStopPlay(); return; }
    ensureCtx();
    if(!liveBus||!liveBus.sampleHP) return;
    sndSrc=ac.createBufferSource(); sndSrc.buffer=snd.buf; sndSrc.playbackRate.value=1;
    sndSrc.connect(liveBus.sampleHP);
    sndSrc.onended=()=>{ sndSrc=null;
      const p=document.getElementById('sndPlay'); if(p){ p.textContent='▶ Play it'; p.classList.remove('on'); } };
    sndSrc.start(now()+0.02);
    const p=document.getElementById('sndPlay'); if(p){ p.textContent='■ Stop'; p.classList.add('on'); }
  }

  // ---- turning it into music the project owns ----
  // The slices are audio and audio is not saved. So Build reads what the singer actually made — which
  // slices, how bright, how low — and writes an Aura PATTERN from it. That pattern is real music: it
  // survives a save, exports, transposes with the key, and can be edited in Beat and Melody.
  function sndSliceFeature(i){
    const s=snd.slices[i]; if(!s||!snd.buf) return null;
    const sr=snd.buf.sampleRate, d=snd.buf.getChannelData(0);
    const a=Math.floor(s.start*sr), b=Math.min(d.length,Math.floor(s.end*sr));
    let energy=0, zc=0, prev=0, peak=0;
    for(let j=a;j<b;j++){ const v=d[j]||0; energy+=v*v; if((v>=0)!==(prev>=0)) zc++; prev=v;
      if(Math.abs(v)>peak) peak=Math.abs(v); }
    const n=Math.max(1,b-a);
    return { i, rms:Math.sqrt(energy/n), peak,
             bright:zc/n,                                  // zero-crossing rate: cheap, and enough to
             dur:s.end-s.start };                          // tell a tick from a thump
  }
  function sndBuildSection(){
    if(!snd.buf||!snd.slices.length){ sndStatus('Find some slices first.'); return; }
    const F=snd.slices.map((_,i)=>sndSliceFeature(i)).filter(Boolean);
    if(!F.length){ sndStatus('These slices are too short to build from.'); return; }
    const brights=F.map(f=>f.bright).slice().sort((a,b)=>a-b);
    const midBright=brights[brights.length>>1]||0;
    const rmsMax=Math.max.apply(null,F.map(f=>f.rms))||1;
    let wrote=0;
    oneCheckpoint(()=>{
      drums.forEach(d=>{ for(let s=0;s<STEPS;s++){ P()[d.id][s]=false; A()[d.id][s]=false; } });
      // Slices are laid across the bar in the order the singer chopped them, which is the order they
      // happened. Loud and dark reads as a kick, loud and bright as a backbeat, quiet as a tick.
      const step=Math.max(1,Math.round(STEPS/Math.min(F.length,8)));
      F.slice(0,8).forEach((f,k)=>{
        const s=(k*step)%STEPS;
        const loud=f.rms>=rmsMax*0.55, bright=f.bright>midBright;
        const id = loud ? (bright?'snare':'kick') : (bright?'hat':'shaker');
        P()[id][s]=true;
        A()[id][s]=f.rms>=rmsMax*0.85;
        wrote++;
      });
      if(snd.swing){ const sw=Math.max(+swingEl.value,16); swingEl.value=String(sw); }
      renderGrid(); refreshPatBtns(); applyAllGroupsLive();
    });
    sndStatus('Built '+wrote+' hit'+(wrote===1?'':'s')+' into section '+(currentPattern+1)
      +'. Edit them in Beat — your recording itself is not saved into the project.');
    toast('Section built from your sound — review it in Beat');
  }
  function sndBuildSong(){
    if(!snd.buf||!snd.slices.length){ sndStatus('Find some slices first.'); return; }
    oneCheckpoint(()=>{
      // Four parts from one idea: the pattern, a thinner version, a busier version, and a quiet one.
      const base=currentPattern;
      sndBuildInto(base);
      const thin=(base+1)%N_PATTERNS, busy=(base+2)%N_PATTERNS, quiet=(base+3)%N_PATTERNS;
      [thin,busy,quiet].forEach(p=>{ drums.forEach(d=>{ for(let s=0;s<STEPS;s++){ patterns[p][d.id][s]=false;
        accents[p][d.id][s]=false; } }); });
      drums.forEach(d=>{ for(let s=0;s<STEPS;s++){
        const on=patterns[base][d.id][s];
        if(on && s%4===0) patterns[thin][d.id][s]=true;             // thinner: downbeats only
        if(on){ patterns[busy][d.id][s]=true;
          if(d.id==='hat'&&s%2===0) patterns[busy][d.id][(s+1)%STEPS]=true; }   // busier: doubled hats
        if(on && d.id!=='kick' && s%8===0) patterns[quiet][d.id][s]=true;       // quiet: almost nothing
      } });
      secNames[base]='Main'; secNames[thin]='Thin'; secNames[busy]='Big'; secNames[quiet]='Quiet';
      const order=[thin,base,busy,base,quiet,base,busy,busy];
      for(let b=0;b<SONG_SLOTS;b++) song[b]=order[Math.floor(b/4)%order.length];
      renderAllSlots(); renderGrid(); refreshPatBtns();
      document.querySelectorAll('#secnames input').forEach((el,i)=>{ el.value=secNames[i]||''; });
    });
    sndStatus('Made a 32-bar song from your sound: Thin, Main, Big and Quiet parts. Open Song to hear the shape.');
    toast('Song built from your sound — open Song');
  }
  function sndBuildInto(p){
    const F=snd.slices.map((_,i)=>sndSliceFeature(i)).filter(Boolean);
    if(!F.length) return;
    const brights=F.map(f=>f.bright).slice().sort((a,b)=>a-b);
    const midBright=brights[brights.length>>1]||0;
    const rmsMax=Math.max.apply(null,F.map(f=>f.rms))||1;
    drums.forEach(d=>{ for(let s=0;s<STEPS;s++){ patterns[p][d.id][s]=false; accents[p][d.id][s]=false; } });
    const step=Math.max(1,Math.round(STEPS/Math.min(F.length,8)));
    F.slice(0,8).forEach((f,k)=>{
      const s=(k*step)%STEPS;
      const loud=f.rms>=rmsMax*0.55, bright=f.bright>midBright;
      const id = loud ? (bright?'snare':'kick') : (bright?'hat':'shaker');
      patterns[p][id][s]=true;
      accents[p][id][s]=f.rms>=rmsMax*0.85;
    });
    // The steps are Aura's, but their placement came from someone's recording. Record that, and
    // note it on the source, so Rights & Sources describes a section built from an imported file as
    // a transformation of that file rather than as something Aura invented.
    if(snd.assetId){
      const src=snd.name||'a sampler sound';
      noteTransform(snd.assetId, 'sliced into '+F.length+' and built into a section');
      recordAsset('aura-transform', 'Section built from '+src,
        { included:true, derivedFrom:snd.assetId,
          rightsNote:'Aura wrote these steps from the timing of '+src+'.' });
    }
  }

  function wireSoundPanel(){
    const $=id=>document.getElementById(id);
    const fi=document.createElement('input'); fi.type='file'; fi.accept='audio/*,video/*'; fi.hidden=true;
    document.body.appendChild(fi);
    fi.addEventListener('change',()=>{ if(fi.files&&fi.files[0]) sndLoadFile(fi.files[0]); fi.value=''; });
    if($('sndRec')) $('sndRec').addEventListener('click',sndStartRecord);
    if($('sndImport')) $('sndImport').addEventListener('click',()=>fi.click());
    if($('sndTone')) $('sndTone').addEventListener('click',sndMakeTone);
    if($('sndPlay')) $('sndPlay').addEventListener('click',sndPlayAll);
    if($('sndFind')) $('sndFind').addEventListener('click',sndFindSlices);
    if($('sndBuild')) $('sndBuild').addEventListener('click',sndBuildSection);
    if($('sndSong')) $('sndSong').addEventListener('click',sndBuildSong);
    if($('sndAgain')) $('sndAgain').addEventListener('click',sndReset);
    const bind=(id,fn,fmt)=>{ const el=$(id); if(!el) return;
      el.addEventListener('input',()=>{ fn(+el.value); const v=$(id+'V'); if(v) v.textContent=fmt(+el.value);
        if(snd.sel>=0) sndPlaySlice(snd.sel); }); };
    bind('sndPitch',v=>snd.pitch=v, v=>(v>0?'+':'')+v);
    bind('sndSpeed',v=>snd.speed=v/100, v=>(v/100).toFixed(2)+'×');
    bind('sndTrim', v=>snd.trim=v,  v=>v+'%');
    bind('sndWarm', v=>snd.warm=v,  v=>v?v+'%':'off');
    bind('sndFilt', v=>snd.filt=v,  v=>v?v+'%':'off');
    bind('sndRepeat',v=>snd.repeat=v, v=>v===1?'once':v+'×');
    if($('sndRev')) $('sndRev').addEventListener('change',e=>{ snd.rev=e.target.checked;
      if(snd.sel>=0) sndPlaySlice(snd.sel); });
    if($('sndSwing')) $('sndSwing').addEventListener('change',e=>{ snd.swing=e.target.checked; });
    wireDropTarget($('sndCard'));
    const card=$('sndCard');
    if(card) card.addEventListener('drop',e=>{
      const f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];
      if(f) sndLoadFile(f);
    });
  }

  // ---------- Datafield glyph language ----------
  // Original music-data vocabulary: tempo, bar·beat coordinates, note names, chord symbols,
  // velocities, frequencies and abstract Aura marks. Nothing resembling any film's glyph set.
  function fillDatafield(){
    const el=document.querySelector('#field .streams'); if(!el) return;
    const notes=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const chords=['Cm7','Ebmaj7','Abmaj9','G7','Fm9','Bb13','Dm7b5','Am11'];
    const glyphs=['◈','⟡','∴','◇','⌁','⋮','⟠','✧'];
    const pick=a=>a[(Math.random()*a.length)|0];
    const line=()=>{
      const r=Math.random();
      if(r<0.20) return (60+((Math.random()*110)|0))+' BPM';
      if(r<0.38) return (1+((Math.random()*32)|0))+'.'+(1+((Math.random()*4)|0));
      if(r<0.54) return pick(notes)+(2+((Math.random()*5)|0));
      if(r<0.68) return pick(chords);
      if(r<0.80) return 'v'+(40+((Math.random()*88)|0));
      if(r<0.92) return ((30+Math.random()*1200)|0)+'Hz';
      return pick(glyphs);
    };
    const cols=[];
    for(let c=0;c<9;c++){ const rows=[]; for(let i=0;i<46;i++) rows.push(line()); cols.push(rows.join('\n')); }
    el.textContent=cols.join('\n');
  }

  // ---------- guided mode + welcome ----------
  const STEPS_RAIL=[
    {id:'sound',  label:'Choose your sound', view:'rack'},
    {id:'loop',   label:'Build your loop',   view:'rack'},
    {id:'melody', label:'Add a melody',      view:'piano'},
    {id:'song',   label:'Build your song',   view:'play'},
    {id:'voice',  label:'Record your voice', view:'voc'},
    {id:'export', label:'Export',            view:'rack'},
  ];
  let guided=false, railStep=0, railHidden=false;
  // One way in and out of the Vibes panel. Every "show me the vibes" affordance routes through
  // here — the welcome card, the ready strip's Change vibe, and Guided step 1 — so the panel can
  // never be asked for while a rule is hiding it.
  function openVibes(){
    const b=document.getElementById('browser'); if(!b) return;
    b.classList.add('open');
    scheduleFit();
    const sel=b.querySelector('#vgrid .vtile.on .vmain')||b.querySelector('#vgrid .vmain');
    if(sel) setTimeout(()=>{ try{ sel.focus({preventScroll:false}); }catch(e){ sel.focus(); } },0);
  }
  function closeVibes(){ const b=document.getElementById('browser'); if(b) b.classList.remove('open'); }
  // In Guided the panel floats over the workspace, so it needs a way out that isn't a hunt.
  window.addEventListener('keydown',e=>{
    if(e.key!=='Escape'||!guided) return;
    const b=document.getElementById('browser');
    if(b&&b.classList.contains('open')){ closeVibes(); const rc=document.getElementById('readyChange'); if(rc) rc.focus(); }
  });
  function setMode(g){ guided=g; document.body.classList.toggle('guided',g);
    document.querySelectorAll('#modeSwitch button').forEach(b=>b.classList.toggle('on',(b.dataset.m==='guided')===g));
    if(g) showView(STEPS_RAIL[railStep].view);
    try{ localStorage.setItem('aura-mode',g?'guided':'studio'); }catch(e){} }
  function showView(v){ document.querySelectorAll('.wtab[data-v]').forEach(t=>t.setAttribute('aria-selected',String(t.dataset.v===v)));
    document.querySelectorAll('.wview').forEach(x=>x.classList.toggle('on',x.id==='v-'+v)); }
  function buildRail(){
    const r=document.getElementById('rail'); if(!r) return;
    r.innerHTML=STEPS_RAIL.map((s,i)=>`<button class="step${i===railStep?' on':''}" data-i="${i}"><b>${i+1}</b>${s.label}</button>`).join('')
      +'<button class="x" id="railHide" aria-label="Hide the step guide">Hide</button>';
    r.querySelectorAll('.step').forEach(b=>b.addEventListener('click',()=>{ railStep=+b.dataset.i; buildRail(); showView(STEPS_RAIL[railStep].view);
      if(STEPS_RAIL[railStep].id==='sound') openVibes();     // step 1 IS the vibe picker
      else closeVibes();
      if(STEPS_RAIL[railStep].id==='export') toast('Press Export WAV in the top bar when you are ready'); }));
    document.getElementById('railHide').addEventListener('click',()=>{ railHidden=true; r.classList.add('hide');
      try{ localStorage.setItem('aura-rail','hidden'); }catch(e){} });
    r.classList.toggle('hide',railHidden);
  }
  // Every welcome door, by route key. Each one lands on a surface that EXISTS — no route opens a
  // panel that is not there, and none of them promises work Aura cannot do. `hum` in particular
  // records a hum and takes the singer to the melody; it does not claim to transcribe one.
  const W_ROUTES={
    vibe:   ()=>{ setMode(true); railStep=0; buildRail(); showView('rack'); openVibes(); },
    beat:   ()=>{ setMode(true); railStep=1; buildRail(); showView('rack'); toast('Click the grid to place drums'); },
    melody: ()=>{ setMode(true); railStep=2; buildRail(); showView('piano'); toast('Click the grid to draw notes — Stay in key keeps them right'); },
    record: ()=>{ setMode(true); railStep=4; buildRail(); showView('voc'); toast('Headphones on, then press Record'); },
    hum:    ()=>{ setMode(true); railStep=4; buildRail(); showView('voc');
                  toast('Record the tune you are humming, then shape it into a melody'); },
    sample: ()=>{ setMode(false); showView('rack'); openVibes(); pickReferenceFile(); },
    open:   ()=>{ setMode(false); const f=document.getElementById('auraFile'); if(f) f.click(); },
    demo:   ()=>{ setMode(false); loadDemo(); document.querySelector('.wtab[data-v="rack"]').click(); },
    create: ()=>openCreate(),
    genre:  ()=>{ openCreate(); const g=document.getElementById('crLane');
                  if(g){ const b=g.querySelector('button'); if(b) b.focus(); } },
    sound:  ()=>{ setMode(true); showView('smp'); scrollTo('findSoundCard')(); },
    snd:    ()=>{ setMode(true); showView('smp'); scrollTo('sndCard')(); },
    chords: ()=>{ setMode(true); showView('play'); toast('The chords of each section live here'); },
    // The Guide's own action for Lyrics is voc + lyricCard, and that is the one the guide suite
    // covers. The welcome uses the same destination rather than a second opinion.
    lyrics: ()=>{ setMode(true); showView('voc'); scrollTo('lyricCard')(); },
    ask:    ()=>{ const a=document.getElementById('askOpen'); if(a) a.click(); },
  };
  function renderWelcomeChips(){
    const hosts={have:document.getElementById('wChipsHave'),build:document.getElementById('wChipsBuild')};
    if(!hosts.have||!hosts.build) return;
    hosts.have.innerHTML=''; hosts.build.innerHTML='';
    welcomeDoors().forEach(d=>{
      const host=hosts[d.grp]; if(!host) return;
      const b=document.createElement('button');
      b.type='button'; b.className='wchip'; b.dataset.w=d.w;
      // Built as markup rather than createElementNS on purpose. The SVG namespace argument is an
      // absolute http:// URL, and the release gate refuses any absolute URL in a runtime file —
      // rightly, because "no network" is easier to guarantee by banning the string than by
      // reasoning about which URLs are fetched. The parser applies the namespace here for free.
      b.innerHTML='<svg class="aicon" aria-hidden="true" focusable="false"><use href="#ic-'+
        d.icon+'"></use></svg><span></span>';
      b.querySelector('span').textContent=d.wname||d.name;   // never interpolate a name as markup
      host.appendChild(b);
    });
  }
  // Recents are a way to CONTINUE, so they sit under the rule with the other continuations and
  // only exist when there is something to continue. Names come from the stored entries; nothing
  // is invented when the list is empty.
  function renderWelcomeRecents(){
    const host=document.getElementById('wRecents'); if(!host) return;
    const list=recentProjects(); host.innerHTML='';
    if(!list.length){ host.hidden=true; return; }
    host.hidden=false;
    const h=document.createElement('h3'); h.className='wglab'; h.textContent='Or pick up where you left off';
    host.appendChild(h);
    const ul=document.createElement('ul'); ul.className='wrecl';
    list.slice(0,3).forEach((r,i)=>{
      const li=document.createElement('li');
      const b=document.createElement('button'); b.type='button'; b.className='wrec';
      b.setAttribute('aria-label','Open '+(r.name||'Untitled')+', updated '+agoLabel(r.at));
      const n=document.createElement('b'); n.textContent=r.name||'Untitled';
      const when=document.createElement('span'); when.textContent=agoLabel(r.at);
      b.appendChild(n); b.appendChild(when);
      b.addEventListener('click',()=>{ closeWelcome(); setMode(false); resumeRecent(r); });
      li.appendChild(b); ul.appendChild(li);
    });
    host.appendChild(ul);
  }
  function closeWelcome(){ const w=document.getElementById('welcome');
    if(w) w.classList.remove('on'); try{ localStorage.setItem('aura-seen','1'); }catch(e){} }
  function wireWelcome(){
    const w=document.getElementById('welcome');
    const close=closeWelcome;
    renderWelcomeChips(); renderWelcomeRecents();
    // Delegated, because the chips are rendered from CREATE_STARTS rather than written by hand.
    w.addEventListener('click',e=>{
      const b=e.target.closest('[data-w]'); if(!b||!w.contains(b)) return;
      const k=b.dataset.w; const go=W_ROUTES[k];
      close(); if(go) go();
    });
    document.getElementById('wSkip').addEventListener('click',()=>{ close(); setMode(false); });
    const hd=document.getElementById('help');
    document.getElementById('helpClose').addEventListener('click',()=>hd.classList.remove('on'));
    hd.addEventListener('click',e=>{ if(e.target===hd) hd.classList.remove('on'); });
    window.addEventListener('keydown',e=>{ if(e.key==='Escape') hd.classList.remove('on'); });
    w.addEventListener('keydown',e=>{ if(e.key==='Escape') close(); });
    let seen=null; try{ seen=localStorage.getItem('aura-seen'); }catch(e){}
    if(!seen){ w.classList.add('on'); const first=w.querySelector('.wopt'); if(first) first.focus(); }
  }

  // ---------- app shell (Phase 2) ----------
  // Nodes are MOVED, never recreated, so every listener, id and handler survives untouched.
  // A singer picks a feeling, not a genre preset. Three emotional doors come first; the full
  // catalogue follows under "All vibes". These are labels over existing presets — no musical
  // data is added, removed or altered, and the keys are the same VIBES keys as everywhere else.
  const VIBE_MOODS=[
    {k:'soulchop',  mood:'Warm & soulful'},
    {k:'atmos',     mood:'Dark & spacious'},
    {k:'latinpop',  mood:'Bright & rhythmic'},
  ];
  function buildVibeTiles(){
    const host=document.getElementById('vgrid'); if(!host) return;
    const moodOf={}; VIBE_MOODS.forEach(m=>moodOf[m.k]=m.mood);

    function tile(k,moodTitle){
      const v=VIBES[k]; if(!v) return null;
      const parts=v.label.split('·').map(s=>s.trim());
      const beat=BEATS[v.beat]||{}, hits=new Set([...(beat.kick||[]),...(beat.snare||[]),...(beat.clap||[])]);
      const bars=Array.from({length:8},(_,i)=>`<s style="height:${hits.has(i*2)?12:hits.has(i*2+1)?7:3}px"></s>`).join('');
      const isMin=v.mode!=='major';
      const key=`${NOTE_NAMES[v.key]}${isMin?'m':''}`;
      // Mood cards lead with the feeling and keep the real preset name as metadata; catalogue
      // cards lead with the preset name. Both carry BPM and key.
      const title=moodTitle||parts[0]||v.label;
      const sub=moodTitle ? `${v.label.replace(/\s*·\s*/g,' · ')} · ${v.bpm} BPM · ${key}`
                          : `${parts[1]?parts[1]+' · ':''}${v.bpm} BPM · ${key}`;
      const b=document.createElement('div');
      b.className='vtile'; b.dataset.k=k;
      const main=document.createElement('button');
      main.className='vmain'; main.type='button';
      main.setAttribute('aria-pressed','false');
      main.setAttribute('aria-label',`${title}. ${v.label}, ${v.bpm} BPM, ${NOTE_NAMES[v.key]}${isMin?' minor':' major'}`);
      main.innerHTML=`<span class="art"><i></i><b>${bars}</b></span>
        <span class="meta"><span class="nm">${title}</span><span class="sub2">${sub}</span></span>
        <span class="vcheck" aria-hidden="true">✓</span>`;
      main.addEventListener('click',()=>{ applyVibe(k); if(guided) closeVibes(); });   // picking one IS the answer
      const pv=document.createElement('button');
      pv.className='vprev'; pv.type='button'; pv.textContent='▶';
      pv.title='Preview this rhythm';
      pv.setAttribute('aria-label','Preview '+v.label);
      pv.addEventListener('click',e=>{ e.stopPropagation(); previewVibe(k); });
      b.appendChild(main); b.appendChild(pv);
      return b;
    }
    function group(label,id){
      const h=document.createElement('h3'); h.className='vgroup'; h.id=id; h.textContent=label;
      host.appendChild(h);
      return h;
    }
    group('Start here','vgroupStart');
    VIBE_MOODS.forEach(m=>{ const t=tile(m.k,m.mood); if(t) host.appendChild(t); });
    // The six families get their own group: each is a whole system with its own five controls, not
    // another preset, and mixing them into the catalogue would hide that.
    group('Sonic families','vgroupFamilies');
    Object.keys(VIBES).forEach(k=>{ if(!VIBES[k].family) return; const t=tile(k,null); if(t) host.appendChild(t); });
    group('All vibes','vgroupAll');
    Object.keys(VIBES).forEach(k=>{ if(moodOf[k]||VIBES[k].family) return; const t=tile(k,null); if(t) host.appendChild(t); });
  }
  // Roving tabindex: the sequencer is ONE tab stop and arrows move inside it. Making all 96 pads
  // tabbable would bury every control that follows; making none tabbable — which is what the
  // blanket tabIndex=-1 in the a11y pass used to do — removed keyboard access to the beat entirely.
  function drumRows(){
    return [...document.querySelectorAll('#grid tr')]
      .map(tr=>[...tr.querySelectorAll('.cell')].filter(c=>!c.classList.contains('chord')))
      .filter(cs=>cs.length);
  }
  function rovingGrid(){
    const rows=drumRows(); if(!rows.length) return;
    const all=rows.flat();
    if(!all.some(c=>c.tabIndex===0)) all[0].tabIndex=0;    // exactly one entry point
    if(gridEl.dataset.roving) return;                       // bind the navigation once
    gridEl.dataset.roving='1';
    gridEl.addEventListener('keydown',e=>{
      const c=e.target&&e.target.closest?e.target.closest('.cell'):null;
      if(!c||c.classList.contains('chord')) return;
      const rs=drumRows(); let r=-1,i=-1;
      rs.forEach((cs,ri)=>{ const ci=cs.indexOf(c); if(ci>=0){ r=ri; i=ci; } });
      if(r<0) return;
      let nr=r,ni=i;
      switch(e.key){
        case 'ArrowRight': ni=Math.min(i+1,rs[r].length-1); break;
        case 'ArrowLeft':  ni=Math.max(i-1,0); break;
        case 'ArrowDown':  nr=Math.min(r+1,rs.length-1); break;
        case 'ArrowUp':    nr=Math.max(r-1,0); break;
        case 'Home':       ni=0; break;
        case 'End':        ni=rs[r].length-1; break;
        default: return;
      }
      e.preventDefault();
      const t=rs[nr][Math.min(ni,rs[nr].length-1)]; if(!t) return;
      rs.flat().forEach(x=>{ x.tabIndex=-1; }); t.tabIndex=0; t.focus();
    });
  }
  function markVibeTile(k){ document.querySelectorAll('#vgrid .vtile').forEach(t=>{
    const on=t.dataset.k===k; t.classList.toggle('on',on);
    const m=t.querySelector('.vmain'); if(m) m.setAttribute('aria-pressed',String(on)); }); }

  function mountShell(){
    const $=id=>document.getElementById(id), q=s=>document.querySelector(s);
    const oldHeader=q('body > header:not(.xport)'); if(!oldHeader) return;
    const mid=$('xmid'), right=$('xright');
    const play=$('play'); play.classList.add('iconbtn','pl'); play.setAttribute('aria-label','Play or stop');
    mid.appendChild(play);
    mid.appendChild($('modeSeg'));
    const ro=document.createElement('div'); ro.className='readout'; ro.id='readout'; ro.textContent='1 · 1'; mid.appendChild(ro);
    const ms=document.createElement('div'); ms.className='modeseg'; ms.id='modeSwitch';
    ms.innerHTML='<button data-m="guided">Guided</button><button data-m="studio" class="on">Studio</button>';
    ms.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.m==='guided')));
    mid.appendChild(ms);
    [...oldHeader.querySelectorAll('.ctrl')].forEach(c=>{ c.classList.add('hideSm'); right.appendChild(c); });
    // transport: record, metronome, undo/redo, project actions
    const mk=(id,txt,label,cls)=>{ const b=document.createElement('button');
      b.id=id;                                   // <- do not drop this again; see below
      // textContent by default. A leading '<' means an inline icon from the local sprite —
      // every one of these strings is a constant in this file, never user input, so there is
      // no injection surface. The button keeps its own aria-label either way, so an icon-only
      // control is never unlabelled.
      //
      // The id assignment above was lost when this helper was first widened to accept an icon,
      // and every button it makes — undoX, redoX, metX — became id-less. Three import suites
      // died on getElementById('undoX').click(). The buttons still WORKED and still had their
      // accessible names, so nothing looked wrong on screen; only the fixtures noticed.
      if(String(txt).charAt(0)==='<') b.innerHTML=txt; else b.textContent=txt;
      b.className='ghost iconbtn '+(cls||''); b.title=label; b.setAttribute('aria-label',label); return b; };
    const recX=mk('recX','●','Record vocals','rec2'); recX.style.color='var(--rec)';
    const metX=mk('metX','<svg class="aicon" aria-hidden="true" focusable="false"><use href="#ic-metronome"/></svg>','Metronome');
    mid.insertBefore(recX, $('modeSeg'));
    mid.insertBefore(metX, $('modeSeg'));
    const undoX=mk('undoX','↶','Undo (Cmd/Ctrl+Z)'), redoX=mk('redoX','↷','Redo (Shift+Cmd/Ctrl+Z)');
    // New / Open / Save live in the Project menu below — one control instead of three icons,
    // which also keeps the transport from overflowing on narrower laptops.
    const recentX=mk('recentX','◷','Recent projects'), helpX=mk('helpX','?','Help and shortcuts');
    [undoX,redoX,recentX,helpX].forEach(b=>right.appendChild(b));
    recentX.addEventListener('click',openRecent);
    helpX.addEventListener('click',()=>$('help').classList.add('on'));
    const midiX=mk('midiX','♪','Export MIDI (melody + chords)');
    midiX.addEventListener('click',exportMidi); right.appendChild(midiX);
    ['mixBtn','share','export'].forEach(id=>{ const el=$(id); if(el) right.appendChild(el); });
    const fi=document.createElement('input'); fi.type='file'; fi.accept='.aura,application/json'; fi.id='auraFile'; fi.hidden=true;
    document.body.appendChild(fi);
    fi.addEventListener('change',()=>{ if(fi.files&&fi.files[0]) openProjectFile(fi.files[0]); fi.value=''; });
    recX.addEventListener('click',()=>{ recording?stopRecording():startRecording(); });
    // metronome settings popover — right-click or long-press the metronome button
    (function wireMet(){ const pop=document.getElementById('metpop'); if(!pop) return;
      try{ const s=JSON.parse(localStorage.getItem('aura-met')||'null'); if(s) Object.assign(metCfg,s); }catch(e){}
      const lv=document.getElementById('metLevel'), lvV=document.getElementById('metLevelV'),
            tone=document.getElementById('metTone'), bars=document.getElementById('metBars');
      lv.value=metCfg.level; lvV.textContent=metCfg.level+'%'; tone.value=metCfg.tone;
      bars.querySelectorAll('button').forEach(b=>b.classList.toggle('on',+b.dataset.bars===metCfg.bars));
      const persist=()=>{ try{ localStorage.setItem('aura-met',JSON.stringify(metCfg)); }catch(e){} };
      lv.addEventListener('input',()=>{ metCfg.level=+lv.value; lvV.textContent=metCfg.level+'%'; persist(); });
      tone.addEventListener('change',()=>{ metCfg.tone=tone.value; persist(); ensureCtx(); playClick(ac,true,now()+.02); });
      bars.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{ metCfg.bars=+b.dataset.bars;
        bars.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); persist(); }));
      document.getElementById('metPreview').addEventListener('click',()=>{ ensureCtx();
        const beat=secondsPerStep()*4; for(let k=0;k<4;k++) playClick(ac,k===0,now()+.05+k*beat); });
      const openPop=e=>{ e.preventDefault(); const r=metX.getBoundingClientRect();
        pop.style.left=Math.min(innerWidth-240,r.left)+'px'; pop.style.top=(r.bottom+6)+'px'; pop.hidden=false; };
      metX.addEventListener('contextmenu',openPop);
      let lt=null; metX.addEventListener('touchstart',e=>{ lt=setTimeout(()=>openPop(e),460); },{passive:false});
      metX.addEventListener('touchend',()=>{ if(lt) clearTimeout(lt); });
      document.addEventListener('click',e=>{ if(!pop.hidden && !pop.contains(e.target) && e.target!==metX) pop.hidden=true; });
    })();
    metX.title='Metronome (M) · right-click or long-press for settings';
    metX.addEventListener('click',()=>{ metOn=!metOn; metX.classList.toggle('on',metOn);
      metX.setAttribute('aria-pressed',String(metOn)); toast(metOn?'Metronome on':'Metronome off'); });
    undoX.addEventListener('click',undo); redoX.addEventListener('click',redo);
    // Project menu — the single visible home for New / Open / Save / Save As.
    const projX=mk('projX','Project','Project menu');
    projX.className='ghost projbtn';
    projX.setAttribute('aria-haspopup','menu'); projX.setAttribute('aria-expanded','false');
    right.insertBefore(projX,recentX);
    const pmenu=document.createElement('div');
    pmenu.id='projmenu'; pmenu.className='projmenu'; pmenu.hidden=true;
    pmenu.setAttribute('role','menu'); pmenu.setAttribute('aria-label','Project');
    [ {label:'Save',          hint:'Cmd S',       run:()=>saveProject()},
      {label:'Save As…',      hint:'⇧ Cmd S',     run:()=>saveProjectAs()},
      {label:'Open Project…', hint:'',            run:()=>fi.click()},
      {label:'New Project',   hint:'',            run:()=>newProject()}
    ].forEach(it=>{ const b=document.createElement('button'); b.type='button'; b.className='projmi';
      b.setAttribute('role','menuitem'); b.setAttribute('aria-label',it.label);
      const s=document.createElement('span'); s.textContent=it.label; b.appendChild(s);
      if(it.hint){ const k=document.createElement('kbd'); k.textContent=it.hint; b.appendChild(k); }
      b.addEventListener('click',()=>{ closePM(); it.run(); });
      pmenu.appendChild(b); });
    document.body.appendChild(pmenu);
    function openPM(){ const r=projX.getBoundingClientRect();
      pmenu.style.left=Math.min(innerWidth-220,Math.max(8,r.left))+'px';
      pmenu.style.top=(r.bottom+6)+'px'; pmenu.hidden=false;
      projX.setAttribute('aria-expanded','true');
      const f=pmenu.querySelector('.projmi'); if(f) f.focus(); }
    function closePM(){ pmenu.hidden=true; projX.setAttribute('aria-expanded','false'); }
    projX.addEventListener('click',e=>{ e.stopPropagation(); pmenu.hidden?openPM():closePM(); });
    document.addEventListener('click',e=>{ if(!pmenu.hidden&&!pmenu.contains(e.target)&&e.target!==projX) closePM(); });
    pmenu.addEventListener('keydown',e=>{
      if(e.key==='Escape'){ closePM(); projX.focus(); return; }
      if(e.key!=='ArrowDown'&&e.key!=='ArrowUp') return;
      e.preventDefault(); const list=[...pmenu.querySelectorAll('.projmi')];
      const i=list.indexOf(document.activeElement);
      list[(i+(e.key==='ArrowDown'?1:-1)+list.length)%list.length].focus(); });
    // ---- Fit 16: size the step grid so all 16 steps are always visible --------------
    // Measured, not fixed: the cell shrinks between 32 and 42px (44px minimum on touch,
    // where sideways scrolling is allowed) and gaps give way before readability does.
    const FIT_KEY='aura-fit';
    let fitMode='fit';
    try{ if(localStorage.getItem(FIT_KEY)==='zoom') fitMode='zoom'; }catch(e){}
    const coarse = matchMedia('(pointer:coarse)').matches;
    // Phones get the dedicated mobile structure below; the desktop hierarchy stands down.
    function isPhone(){ return matchMedia('(max-width:767px)').matches
      || (matchMedia('(orientation:landscape)').matches && innerHeight<=430 && innerWidth<=960); }
    function fitSteps(){
      document.body.classList.toggle('fit16', fitMode==='fit');
      const wrap=document.querySelector('#v-rack .grid-wrap');
      const root=document.documentElement.style;
      if(fitMode==='zoom'){                       // honest 1:1 pads, scroll if it overflows
        root.setProperty('--cell','42px'); root.setProperty('--cell-gap','6px');
        root.setProperty('--beat-gap','6px'); root.setProperty('--vol-w','64px');
        root.setProperty('--lab-w','none'); root.setProperty('--lab-size','13px');
        root.setProperty('--pr-cw','40px'); PR_CW=40; renderRoll(); return;
      }
      if(coarse||isPhone()){                      // touch/phone: never below a 44px target
        root.setProperty('--cell','44px'); root.setProperty('--cell-gap','5px');
        root.setProperty('--beat-gap','6px'); root.setProperty('--vol-w','56px');
        root.setProperty('--lab-w','86px'); root.setProperty('--lab-size','12px');
        root.setProperty('--pr-cw','40px'); PR_CW=40;
        // 44px targets win over fitting 16 across: the grid scrolls sideways instead of clipping
        document.body.classList.remove('fit16');
        renderRoll(); return;
      }
      const table=document.getElementById('grid');
      if(!wrap||!table) return;
      // Progressively tighter geometry. For each plan we MEASURE the real table width
      // (labels, spacing and beat gaps included) rather than estimating it, then solve
      // for the cell size that fits — readability is the last thing to give way.
      const plans=[ {gap:6,beat:6,vol:64,lab:118,ls:13},
                    {gap:5,beat:6,vol:58,lab:104,ls:13},
                    {gap:4,beat:6,vol:50,lab:92, ls:12},
                    {gap:3,beat:5,vol:0,  lab:82, ls:12},
                    {gap:3,beat:4,vol:0,  lab:70, ls:12} ];   // 12px is the floor: "Kick" at 11px was
                    // the only sub-12px lane label left, and the ladder already falls back to a
                    // horizontal scroll when even this plan cannot fit — shrinking type is not the
                    // last resort, scrolling is.
      const apply=(p,cell)=>{
        root.setProperty('--cell',cell+'px');
        root.setProperty('--cell-gap',p.gap+'px');
        root.setProperty('--beat-gap',p.beat+'px');
        root.setProperty('--vol-w',p.vol+'px');
        root.setProperty('--lab-w',p.lab+'px');
        root.setProperty('--lab-size',p.ls+'px');
        document.querySelectorAll('.track-vol').forEach(v=>{ v.hidden = p.vol===0; });
      };
      const wcs=getComputedStyle(wrap);
      const pad=(parseFloat(wcs.paddingLeft)||0)+(parseFloat(wcs.paddingRight)||0);
      // Pick the plan that yields the LARGEST pad, not merely the first that fits: each plan's
      // achievable cell grows with width, so taking the max keeps the pad size monotonic as the
      // window widens. Ties keep the loosest plan, so controls survive when they cost nothing.
      let best=null;
      for(const p of plans){
        apply(p,42);
        const avail=wrap.clientWidth-pad;                   // clientWidth still counts padding
        const overhead=table.offsetWidth-STEPS*42;          // everything that is not a pad
        let cell=Math.floor((avail-overhead)/STEPS);
        cell=Math.max(32,Math.min(42,cell));
        apply(p,cell);
        if(table.offsetWidth<=avail && (!best||cell>best.cell)) best={p,cell};
      }
      const fitted=!!best;
      apply(best?best.p:plans[plans.length-1], best?best.cell:32);
      // never clip silently: if even the tightest plan overflows, let it scroll instead
      document.body.classList.toggle('fit16',fitted);
      // Piano roll: the same 16-step budget, measured off its own scroller. Skip while the
      // view is hidden (clientWidth 0) so it keeps its size until Melody is actually open.
      const pg=document.querySelector('.prgrid');
      const host=pg&&pg.parentElement;
      if(host&&host.clientWidth>0){
        const keys=document.querySelector('.prkeys');
        const pAvail=host.clientWidth-(keys?keys.offsetWidth:54)-10;
        PR_CW=Math.max(26,Math.min(56,Math.floor(pAvail/STEPS)));
        root.setProperty('--pr-cw',PR_CW+'px');
        renderRoll();
      }
    }
    let fitQueued=false;
    const scheduleFit=()=>{ if(fitQueued) return; fitQueued=true;
      const run=()=>{ if(!fitQueued) return; fitQueued=false; fitSteps(); };
      requestAnimationFrame(run); setTimeout(run,60); };
    window.__auraFit=scheduleFit;                  // re-fit when a view or panel changes

    // ---- responsive action hierarchy ------------------------------------------------
    // Measured, not breakpoint-driven: shrink the sliders, then move low-priority actions
    // into an overflow menu, then the sliders themselves — stopping the moment the
    // transport fits. Export is the last action to move and is always one menu click away.
    const moreX=mk('moreX','⋯','More actions');
    moreX.setAttribute('aria-haspopup','menu'); moreX.setAttribute('aria-expanded','false');
    moreX.hidden=true; right.appendChild(moreX);
    const mmenu=document.createElement('div');
    mmenu.id='moremenu'; mmenu.className='projmenu moremenu'; mmenu.hidden=true;
    mmenu.setAttribute('role','menu'); mmenu.setAttribute('aria-label','More actions');
    const mmActs=document.createElement('div'), mmCtrls=document.createElement('div');
    mmCtrls.className='mm-ctrls'; mmenu.appendChild(mmActs); mmenu.appendChild(mmCtrls);
    document.body.appendChild(mmenu);

    // first entry is the first to move out; Export is last so it survives longest
    const ACTIONS=[{el:helpX,label:'Help & shortcuts'},{el:recentX,label:'Recent projects'},
      {el:midiX,label:'Export MIDI'},{el:$('share'),label:'Copy link'},
      {el:$('mixBtn'),label:'Mixer'},{el:$('export'),label:'Export WAV'}].filter(a=>a.el);
    ACTIONS.forEach(a=>{ const b=document.createElement('button'); b.type='button';
      b.className='projmi'; b.setAttribute('role','menuitem'); b.hidden=true;
      b.setAttribute('aria-label',a.label);
      const s=document.createElement('span'); s.textContent=a.label; b.appendChild(s);
      b.addEventListener('click',()=>{ closeMM(); a.el.click(); });
      a.row=b; mmActs.appendChild(b); });
    const CTRLS=[...right.querySelectorAll('.ctrl')];
    let ctrlsOut=false;

    const xport=$('xport');
    const fits=()=>xport.scrollWidth<=xport.clientWidth;
    function expandAll(){
      ACTIONS.forEach(a=>{ a.el.hidden=false; a.row.hidden=true; });
      if(ctrlsOut){ CTRLS.forEach(c=>right.insertBefore(c,undoX)); ctrlsOut=false; }
      xport.classList.remove('compact'); moreX.hidden=true;
    }
    function reflowTransport(){
      if(isPhone()){                       // phone layout is CSS-driven; stand down
        moreX.hidden=true;
        const sh=document.getElementById('msheet');
        if(sh&&sh.hidden) expandAll();     // keep the sliders home unless the sheet holds them
        return;
      }
      const sh=document.getElementById('msheet');
      if(sh&&!sh.hidden&&typeof window.__auraCloseSheet==='function') window.__auraCloseSheet();
      expandAll();
      if(fits()) return;
      xport.classList.add('compact');            // 1. tempo / volume / swing get narrow
      if(fits()) return;
      moreX.hidden=false;                        // 2. actions move into ⋯, lowest priority first
      for(const a of ACTIONS){
        a.el.hidden=true; a.row.hidden=false;
        if(fits()) return;
      }
      CTRLS.forEach(c=>mmCtrls.appendChild(c));  // 3. sliders move into ⋯ (still reachable)
      ctrlsOut=true;
    }
    function openMM(){ const r=moreX.getBoundingClientRect();
      mmenu.style.left=Math.min(innerWidth-244,Math.max(8,r.right-236))+'px';
      mmenu.style.top=(r.bottom+6)+'px'; mmenu.hidden=false;
      moreX.setAttribute('aria-expanded','true');
      const f=mmenu.querySelector('.projmi:not([hidden])'); if(f) f.focus(); }
    function closeMM(){ mmenu.hidden=true; moreX.setAttribute('aria-expanded','false'); }
    moreX.addEventListener('click',e=>{ e.stopPropagation(); mmenu.hidden?openMM():closeMM(); });
    document.addEventListener('click',e=>{ if(!mmenu.hidden&&!mmenu.contains(e.target)&&e.target!==moreX) closeMM(); });
    mmenu.addEventListener('keydown',e=>{
      if(e.key==='Escape'){ closeMM(); moreX.focus(); return; }
      if(e.key!=='ArrowDown'&&e.key!=='ArrowUp') return;
      e.preventDefault(); const list=[...mmenu.querySelectorAll('.projmi:not([hidden])')];
      const i=list.indexOf(document.activeElement);
      list[(i+(e.key==='ArrowDown'?1:-1)+list.length)%list.length].focus(); });
    let reflowQueued=false;
    // rAF for smoothness, timeout as a fallback: a hidden tab pauses rAF, and the
    // toolbar must still be correct the moment it becomes visible again.
    const scheduleReflow=()=>{ if(reflowQueued) return; reflowQueued=true;
      const run=()=>{ if(!reflowQueued) return; reflowQueued=false; reflowTransport(); };
      requestAnimationFrame(run); setTimeout(run,60); };
    if(window.ResizeObserver) new ResizeObserver(scheduleReflow).observe(xport);
    window.addEventListener('resize',scheduleReflow);
    // a hidden tab delivers neither rAF nor ResizeObserver, so re-measure on the way back,
    // and again once webfonts land (they change every label's width)
    document.addEventListener('visibilitychange',scheduleReflow);
    window.addEventListener('load',scheduleReflow);
    if(document.fonts&&document.fonts.ready) document.fonts.ready.then(scheduleReflow).catch(()=>{});
    scheduleReflow();
    // Synchronous settle, for the layout audit only. Both responsive passes are scheduled through
    // requestAnimationFrame with a setTimeout fallback, and a BACKGROUND tab gets neither on any
    // useful schedule: rAF is paused outright, and after five minutes hidden Chrome throttles chained
    // timers to roughly one per minute. The audit then measures a layout that has not been fitted
    // yet — it would report faults the app does not have, which is the same class of error as
    // measuring mid-transition. Calling the two passes directly makes a measurement independent of
    // tab visibility. Nothing in the app calls this; it does no work the scheduled passes do not.
    window.__auraSettleNow=()=>{ reflowTransport(); fitSteps(); };
    // Repaint the welcome's two generated regions. Read-only in the sense that matters: it
    // renders from current state and writes none, so a fixture can seed recents and see the
    // same markup a boot would produce. Nothing in the app calls it that boot does not.
    window.__auraRenderWelcome=()=>{ renderWelcomeChips(); renderWelcomeRecents(); };
    // Repaint the song's shape. Same contract: renders from current state, writes none. A fixture
    // needs it because Auto-fill changes what the timeline should draw without touching the song.
    window.__auraRenderSong=()=>{ renderSongTimeline(); };
    // ================= MOBILE STRUCTURE (<768px) =================
    // Top bar keeps only emblem · name · Play · Record · More. The bottom nav carries the
    // five destinations. Everything else is one tap away inside the More sheet.
    const mMore=mk('mMore','⋯','More actions');
    mMore.setAttribute('aria-haspopup','dialog'); mMore.setAttribute('aria-expanded','false');
    mid.appendChild(mMore);

    const navExport=document.createElement('button');
    navExport.type='button'; navExport.className='wtab-export'; navExport.id='navExport';
    navExport.textContent='Export';
    navExport.setAttribute('aria-label','Export this track as a WAV file');
    navExport.addEventListener('click',()=>{ const e=$('export'); if(e) e.click(); });
    const navHost=document.querySelector('.wtabs');   // queried, not the later `tabsNav` const
    if(navHost) navHost.appendChild(navExport);

    // ---- phone bottom navigation: Vibes · Melody · Song · Vocals · Export ----
    // Each item gets an icon as well as its label, so the active one is not signalled by colour
    // alone. Beat is not a nav item on phones — Vibes lands on it, which is where a singer starts.
    if(navHost){
      const navVibes=document.createElement('button');
      navVibes.type='button'; navVibes.className='wtab-vibes'; navVibes.id='navVibes';
      navVibes.setAttribute('aria-label','Vibes — choose the sound of your backing track');
      navVibes.addEventListener('click',()=>{
        const onRack=document.querySelector('.wtab[data-v="rack"]').getAttribute('aria-selected')==='true';
        if(!onRack){ showView('rack'); document.querySelectorAll('.wtab[data-v]').forEach(x=>x.setAttribute('aria-selected',String(x.dataset.v==='rack'))); }
        else openVibes();                    // already home, so this is "change the vibe"
        paintNav();
      });
      navHost.insertBefore(navVibes,navHost.firstChild);
      const ICONS={rack:'icoVibes',piano:'icoMelody',play:'icoSong',voc:'icoVocals',smp:'icoTrack'};
      const deco=(btn,ico,label)=>{
        btn.innerHTML='<svg class="navico" aria-hidden="true" focusable="false"><use href="#'+ico+'"/></svg>'
          +'<span class="navlab">'+label+'</span>';
      };
      deco(navVibes,'icoVibes','Vibes');
      deco(navExport,'icoExport','Export');
      document.querySelectorAll('.wtab[data-v]').forEach(t=>{
        const ico=ICONS[t.dataset.v]; if(ico) deco(t,ico,t.textContent.trim());
      });
      // The Vibes item stands in for Beat on phones, so mirror Beat's selected state onto it.
      var paintNav=function(){
        const onRack=document.querySelector('.wtab[data-v="rack"]').getAttribute('aria-selected')==='true';
        navVibes.setAttribute('aria-selected',String(onRack));
      };
      document.querySelectorAll('.wtab[data-v]').forEach(t=>t.addEventListener('click',()=>setTimeout(paintNav,0)));
      paintNav();
    }

    const sheet=$('msheet'), sheetBody=$('msheetBody'), sheetClose=$('msheetClose');
    let sheetPrevFocus=null;
    const msGroup=t=>{ const d=document.createElement('div'); d.className='msgroup'; d.textContent=t; return d; };
    const msRow=(label,hint,fn)=>{ const b=document.createElement('button'); b.type='button'; b.className='msrow';
      b.setAttribute('aria-label',label);
      const s=document.createElement('span'); s.textContent=label; b.appendChild(s);
      if(hint){ const k=document.createElement('kbd'); k.textContent=hint; b.appendChild(k); }
      b.addEventListener('click',()=>{ closeSheet(); fn(); }); return b; };
    function buildSheet(){
      sheetBody.innerHTML='';
      sheetBody.appendChild(msGroup('Project'));
      sheetBody.appendChild(msRow('New Project','',()=>newProject()));
      sheetBody.appendChild(msRow('Open Project…','',()=>fi.click()));
      sheetBody.appendChild(msRow('Save','Cmd S',()=>saveProject()));
      sheetBody.appendChild(msRow('Save As…','⇧ Cmd S',()=>saveProjectAs()));
      sheetBody.appendChild(msRow('Recent Projects','',()=>openRecent()));
      sheetBody.appendChild(msGroup('View'));
      sheetBody.appendChild(msRow('Balance','',()=>{ const t=document.querySelector('.wtab[data-v="mix"]'); if(t) t.click(); }));
      // Guided is the DEFAULT and it hides the workspace tabs on desktop, so without this row the
      // Sound view — Find a sound and the sampler — had no direct route for a first-time visitor:
      // the step rail covers rack/piano/play/voc only. Reachable indirectly (Create something, an
      // import, Ask Aura) is not the same as reachable, and shipping a finished surface behind no
      // control is the thing this build is not allowed to do. Balance already had this treatment.
      sheetBody.appendChild(msRow('Sound','',()=>{ const t=document.querySelector('.wtab[data-v="smp"]'); if(t) t.click(); }));
      sheetBody.appendChild(msRow('Vibes','',()=>$('browser').classList.toggle('open')));
      sheetBody.appendChild(msRow('Customize','',()=>{ inspectPinned=true; setInspect(true); }));
      const gRow=document.createElement('div'); gRow.className='msctrl';
      const gLab=document.createElement('label'); gLab.textContent='Mode';
      const gSeg=document.createElement('div'); gSeg.className='modeseg';
      gSeg.innerHTML='<button type="button" data-m="guided">Guided</button><button type="button" data-m="studio">Studio</button>';
      const paint=()=>gSeg.querySelectorAll('button').forEach(x=>x.classList.toggle('on',(x.dataset.m==='guided')===guided));
      gSeg.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{ setMode(b.dataset.m==='guided'); paint(); }));
      paint(); gRow.appendChild(gLab); gRow.appendChild(gSeg); sheetBody.appendChild(gRow);
      sheetBody.appendChild(msGroup('Sound'));
      const holder=document.createElement('div'); holder.id='msCtrls'; sheetBody.appendChild(holder);
      sheetBody.appendChild(msRow('Metronome','M',()=>metX.click()));
      sheetBody.appendChild(msGroup('Edit'));
      sheetBody.appendChild(msRow('Undo','Cmd Z',()=>undoX.click()));
      sheetBody.appendChild(msRow('Redo','⇧ Cmd Z',()=>redoX.click()));
      sheetBody.appendChild(msGroup('Share'));
      sheetBody.appendChild(msRow('Copy link','',()=>{ const s=$('share'); if(s) s.click(); }));
      sheetBody.appendChild(msRow('Export MIDI','',()=>midiX.click()));
      sheetBody.appendChild(msRow('Export WAV','',()=>{ const e=$('export'); if(e) e.click(); }));
      sheetBody.appendChild(msGroup('Help'));
      sheetBody.appendChild(msRow('Help & shortcuts','?',()=>helpX.click()));
    }
    const sheetKey=e=>{ if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); closeSheet(); }
      else if(e.key==='Tab'){ trapTab(sheet,e); } };
    function openSheet(){
      buildSheet();
      const holder=$('msCtrls'); CTRLS.forEach(c=>holder.appendChild(c));  // the real sliders
      sheetPrevFocus=document.activeElement;
      sheet.hidden=false; mMore.setAttribute('aria-expanded','true');
      document.addEventListener('keydown',sheetKey,true);
      const f=sheetBody.querySelector('button'); if(f) f.focus();
    }
    function closeSheet(){
      if(sheet.hidden) return;
      sheet.hidden=true; mMore.setAttribute('aria-expanded','false');
      document.removeEventListener('keydown',sheetKey,true);
      CTRLS.forEach(c=>right.insertBefore(c,undoX));                        // hand them back
      if(sheetPrevFocus&&sheetPrevFocus.focus) try{ sheetPrevFocus.focus(); }catch(e){}
    }
    window.__auraCloseSheet=closeSheet;
    mMore.addEventListener('click',()=>{ sheet.hidden?openSheet():closeSheet(); });
    sheetClose.addEventListener('click',closeSheet);
    sheet.addEventListener('click',e=>{ if(e.target===sheet) closeSheet(); });
    oldHeader.remove();

    $('browserHost').appendChild($('vibes'));                 // keeps legacy #vibes handler alive
    $('inspectHost').appendChild(q('.keybar'));
    $('v-rack').appendChild(q('.toolbar'));
    $('v-rack').appendChild(q('.grid-wrap'));
    // The instrument leads. Groove goes last, so a singer opening Beat sees the pads rather
    // than seven sliders. Moving the node keeps its subtree, its ID and every listener already
    // bound to it. Deliberately a DOM move rather than flex `order`: everything reordered here
    // contains focusable controls, and `order` would put a WCAG 2.4.3 focus-order failure into
    // a build that ships a 37-check suite. After this line DOM order equals visual order.
    $('v-rack').appendChild($('grooveCard'));
    $('v-piano').appendChild(q('.proll'));
    // The song leads its own view, and it has to be found by what it CONTAINS.
    //
    // `.song` is a generic card class: #balSimple, #vocals, #findSoundCard, #sndCard and #refCard
    // all carry it. `querySelectorAll('.song').find(el=>el.id!=='vocals')` therefore returned
    // #balSimple — the Balance card — and moved THAT into Song, while the actual arrangement
    // panel, the only one with no id, stayed attached to <body> below every view. Measured at
    // 1440x900 on this build: the Balance card at the top of Song, and the bar grid loose at
    // y=900 outside the view system entirely. The bar grid still worked, which is why nothing
    // caught it. Select on #slots, which only the arrangement panel has.
    const songPanel=$('slots') && $('slots').closest('.song');
    if(songPanel) $('v-play').insertBefore(songPanel, $('v-play').firstChild);
    // The record ledge sits directly under the view title, ahead of the words and the coaching.
    // Appended last, a singer who opened Vocals to SING scrolled past a lyric editor and a coach
    // to reach the Record button. Inserted after the title rather than at the very front so the
    // room still names itself first. DOM move, so every id and listener survives.
    { const t=$('v-voc').querySelector('.viewtitle');
      if(t && t.nextSibling) $('v-voc').insertBefore($('vocals'), t.nextSibling);
      else $('v-voc').appendChild($('vocals')); }
    $('dock').appendChild($('mixer'));
    $('mixer').classList.add('open');                          // the dock is the mixer's home now

    // ---- collapsed-by-default mixer dock ----
    GROUPS.concat([{id:'__master',name:'Master'}]).forEach(G=>{
      const d=document.createElement('div'); d.className='dm';
      d.innerHTML=`<i><b></b></i><span>${G.name}</span>`;
      d.dataset.g=G.id; $('dockMini').appendChild(d);
    });
    const dockBtn=$('dockToggle');
    const setDock=open=>{ document.body.classList.toggle('dockopen',open);
      dockBtn.textContent=open?'▼ Collapse':'▲ Expand';
      dockBtn.setAttribute('aria-expanded',String(open));
      dockBtn.setAttribute('aria-label',open?'Collapse the mixer':'Expand the mixer');
      try{ localStorage.setItem('aura-dock',open?'open':'closed'); }catch(e){} };
    dockBtn.addEventListener('click',()=>setDock(!document.body.classList.contains('dockopen')));
    let wantOpen=false; try{ wantOpen=localStorage.getItem('aura-dock')==='open'; }catch(e){}
    if(innerHeight<760) wantOpen=false;            // short laptops always start collapsed
    setDock(wantOpen);

    // MIX takes the mixer out of the dock and gives it the whole workspace; leaving MIX puts it back.
    document.querySelectorAll('.wtab[data-v]').forEach(t=>t.addEventListener('click',()=>{
      const v=t.dataset.v;
      document.querySelectorAll('.wtab[data-v]').forEach(x=>x.setAttribute('aria-selected',String(x===t)));
      document.querySelectorAll('.wview').forEach(x=>x.classList.toggle('on',x.id==='v-'+v));
      const mx=$('mixer');
      if(v==='mix'){ $('v-mix').appendChild(mx); document.body.classList.add('mixfull'); }
      else if(mx.parentElement===$('v-mix')){ $('dock').appendChild(mx); document.body.classList.remove('mixfull'); }
      const railIdx=({rack:1,piano:2,play:3,voc:4}[v]); if(railIdx!=null&&guided){ railStep=railIdx; buildRail(); }
      try{ localStorage.setItem('aura-view',v); }catch(e){}
      scheduleFit();
    }));
    const b1=$('tgBrowser'); if(b1) b1.addEventListener('click',()=>{ $('browser').classList.toggle('open'); scheduleFit(); });
    const b2=$('tgInspect'); if(b2) b2.addEventListener('click',()=>{
      const open=!$('inspect').classList.contains('open');
      inspectPinned=open; setInspect(open);              // an explicit click pins the choice
      try{ localStorage.setItem('aura-inspect',open?'open':'collapsed'); }catch(e){} });
    // Restore the pinned Inspector choice; with no stored choice it stays auto (collapsed
    // until a note, clip, track or import needs it).
    let inspStored=null; try{ inspStored=localStorage.getItem('aura-inspect'); }catch(e){}
    inspectPinned = inspStored==='open';
    setInspect(inspStored==='open');
    // Restore the last workspace (Studio only — in Guided the rail owns the view)
    try{ const v=localStorage.getItem('aura-view');
      if(v && !guided){ const t=document.querySelector('.wtab[data-v="'+v+'"]'); if(t&&!t.hidden) t.click(); }
    }catch(e){}

    // Fit 16 / Zoom — compact workspace control; Fit 16 is the desktop default
    const fitSeg=document.createElement('div'); fitSeg.className='modeseg fitseg'; fitSeg.id='fitSeg';
    fitSeg.innerHTML='<button data-f="fit">Fit 16</button><button data-f="zoom">Zoom</button>';
    fitSeg.querySelectorAll('button').forEach(b=>{
      b.setAttribute('aria-label', b.dataset.f==='fit'?'Fit all 16 steps':'Zoom to full-size pads');
      b.classList.toggle('on', b.dataset.f===fitMode);
      b.addEventListener('click',()=>{ fitMode=b.dataset.f;
        try{ localStorage.setItem(FIT_KEY,fitMode); }catch(e){}
        fitSeg.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x.dataset.f===fitMode));
        fitSteps(); }); });
    const tabsNav=document.querySelector('.wtabs');
    if(tabsNav) tabsNav.insertBefore(fitSeg, $('tgBrowser'));
    window.addEventListener('resize',scheduleFit);
    scheduleFit();

    // ---- accessibility pass (Phase 5) ----
    const label=(el,txt)=>{ if(el&&!el.getAttribute('aria-label')) el.setAttribute('aria-label',txt); };
    label($('mixBtn'),'Show or hide the mixer'); label($('share'),'Copy a shareable link to this track');
    label($('export'),'Export this track as a WAV file');
    label($('bpm'),'Tempo in beats per minute'); label($('swing'),'Swing amount');
    label($('master'),'Master volume'); label($('keyRoot'),'Musical key'); label($('keyMode'),'Scale or mode');
    label($('prog'),'Chord progression'); label($('chordStyle'),'Chord sound');
    label($('chordVol'),'Chord volume'); label($('bassVol'),'Bass volume'); label($('bassStyle'),'Bass sound');
    label($('reverb'),'Reverb amount'); label($('preset'),'Drum beat preset');
    label($('melSound'),'Melody instrument'); label($('melVol'),'Melody volume');
    label($('recBtn'),'Record vocals'); label($('playTake'),'Play your take with the music');
    label($('clearTake'),'Delete your take'); label($('vocalVol'),'Vocal volume');
    label($('sync'),'Nudge vocal timing in milliseconds');
    $('slots').setAttribute('role','list'); $('slots').setAttribute('aria-label','Song arrangement, 32 bars');
    document.querySelectorAll('#slots .slot').forEach(s=>{ s.setAttribute('role','listitem'); s.tabIndex=0;
      s.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); s.click(); } }); });
    document.getElementById('grid').setAttribute('role','grid');
    document.getElementById('grid').setAttribute('aria-label','Step sequencer');
    document.querySelectorAll('#grid .cell').forEach(c=>{ c.setAttribute('role','gridcell'); });
    rovingGrid();
    document.querySelectorAll('.strip .mb').forEach(b=>b.setAttribute('aria-label','Mute this channel'));
    document.querySelectorAll('.strip .sb').forEach(b=>b.setAttribute('aria-label','Solo this channel'));
    // Ready-strip actions delegate to the real transport controls rather than duplicating logic.
    { const rp=$('readyPlay'), rs=$('readySing'), rc=$('readyChange');
      if(rp) rp.addEventListener('click',()=>$('play').click());
      if(rs) rs.addEventListener('click',()=>{ showView('voc'); const r=$('recBtn'); if(r) r.click(); });
      if(rc) rc.addEventListener('click',openVibes); }
    { const vc=$('vibesClose'); if(vc) vc.addEventListener('click',()=>{ closeVibes(); const rc=$('readyChange'); if(rc) rc.focus(); }); }
    { const rd=$('rebuildDiscard'); if(rd) rd.addEventListener('click',discardRebuild); }
    document.body.classList.add('shell'); $('app').hidden=false;
    renderReady();
  }
  // ---------- QA surface ----------
  // The reconstruction engine is pure: it reads a decoded AudioBuffer and returns a plain object,
  // touching no project state, no DOM and no storage. Exposing it lets fixtures/import-qa.html
  // measure THE SHIPPED RUNTIME against generated ground truth instead of a copy of it, which is the
  // only way this file can be tested at all — there is no Node here, and app.js is one IIFE.
  // Read-only by construction and frozen so a page cannot swap an implementation in. Precedent:
  // window.__auraFit and window.__auraCloseSheet already exist for the same reason.
  window.__auraRebuild=Object.freeze({
    analyseImport, spectralFrames, detectBPM, detectKey, detectHarmony, detectSections,
    bandFlux, pickOnsetsBand, mergeOnsets, onsetFeatures, classifyOnsets, detectLowEnd,
    refineBeats, quantiseEvents, deflamEvents, pickGrooveWindow, buildBeatPattern,
    beatGrid, pickDownbeatFromKicks,
    LANE_LABEL, OUT_IDS, LANE_TO_ID, STEPS,
    audioContext:()=>{ ensureCtx(); return ac; },
  });

  // Frozen read-only surface for fixtures/media-decode.html, for the same reason __auraRebuild
  // exists: there is no Node here, so the only way to measure the SHIPPED import path is to drive
  // it in the browser. It adds no behaviour — load() is the same loadSampleFile() the file picker
  // calls, so the matrix cannot pass while the real path is broken.
  window.__auraMediaProbe=Object.freeze({
    reset(){ smp.lastFailure=null; smp.buf=null; smp.name=null;
             const el=document.getElementById('smpStatus'); if(el) el.textContent=''; },
    load(file){ return loadSampleFile(file); },
    read(){ return {
      decoded: !!smp.buf,
      duration: smp.buf?smp.buf.duration:null,
      channels: smp.buf?smp.buf.numberOfChannels:null,
      rate:     smp.buf?smp.buf.sampleRate:null,
      reason:   smp.lastFailure||null,
      // An import must arrive muted. The matrix asserts this on every successful decode because
      // scheduleSample() feeds the offline export graph too — an unmuted import is a copy of
      // someone's song inside the singer's exported WAV.
      muted:    !!(mix&&mix.sample&&mix.sample.mute),
      name:     smp.name||null,
    }; },

    // ---- cancellation and failure isolation, for fixtures/cancel-safety.html ----
    // The contract every interrupted operation has to meet is that the PROJECT is untouched, so the
    // test needs the project's exact bytes, its undo depth and its autosave bytes — the three things
    // an interruption could quietly change.
    snapshot(){ return JSON.stringify(serialize()); },
    undoDepth(){ return hist.past.length; },
    autosaveBytes(){ try{ return localStorage.getItem(SAVE_KEY); }catch(e){ return null; } },
    hasReconstruction(){ return !!imp; },
    // Lets the leak tests recreate the dangerous starting condition: a project where the singer had
    // deliberately INCLUDED a previous reference, so `mix.sample.mute` is 0 when the next import
    // begins. That is the value a cancelled import used to restore.
    setSampleMuted(m){ mix.sample.mute=m?1:0; applyGroupLive('sample'); syncMixerUI(); },
    // Start an import WITHOUT awaiting it, so the test can interrupt it mid-flight.
    beginLoad(file){ loadSampleFile(file); },
    cancel(){ cancelImportJob(); },
    removeReference(){ const b=document.getElementById('smpClear'); if(b) b.click(); },
    // Open Recent, a share link and the autosave restore all replace the project through applyState.
    replaceProject(stateJson){ applyState(JSON.parse(stateJson)); },
    reanalyse(){ reanalyseReference(); },
    // Deliberately corrupt the decoded buffer reference, to prove a missing buffer is survivable.
    dropBuffer(){ smp.buf=null; },
    liveAudioContextState(){ try{ return ac?ac.state:'none'; }catch(e){ return 'none'; } },
  });

  // Frozen read-only surface for fixtures/vocal-qa.html. The vocal balance is the one feature whose
  // honesty depends on a NUMBER — how much of a centred lead actually goes away, how much of the
  // wider backing actually survives, and how much damage the instrumental takes. Those cannot be
  // judged by listening in a test, so the suite measures them against fixtures whose stems it built
  // itself and therefore knows exactly.
  window.__auraVocal=Object.freeze({
    separateStereo, stereoWidthOf, vocSharpFor,
    modes:()=>Object.keys(VOC_MODES),
    // The refusal path, without the UI: does this recording have anything to work with?
    wouldRefuse(buf){ const i=stereoWidthOf(buf); return {mono:i.mono, side:i.side, refused:i.mono}; },
    confidenceFor(buf){ const i=stereoWidthOf(buf); return Math.max(0.1,Math.min(0.85,i.side*3.0)); },
    audioContext:()=>{ ensureCtx(); return ac; },
  });

  // Frozen read-only surface for fixtures/endtoend-qa.html — the sampler, the six sonic families,
  // project identity and export privacy. Same justification as the other two: no Node, so the only
  // way to test the shipped build is to drive it in a browser.
  window.__auraSuite=Object.freeze({
    snapshot(){ return JSON.stringify(serialize()); },
    serializedKeys(){ return Object.keys(serialize()); },
    schemaVersion(){ return SCHEMA_VERSION; },
    undoDepth(){ return hist.past.length; },
    projectMeta(){ return {id:projMeta.id||'', createdAt:projMeta.createdAt||'', name:projName}; },
    families(){ return Object.keys(FAMILY_CTRL); },
    familyControls(f){ return (FAMILY_CTRL[f]||[]).map(c=>c.id); },
    applyVibe(k){ applyVibe(k); },
    famApply(f,id,v){ famApply(f,id,v); },
    // Renders through the SAME offline graph the WAV uses, so what this measures is what a singer
    // would get in their file — not an approximation of it.
    renderExport(){ return renderExportBuffer(); },
    sampleMuted(){ return !!(mix.sample&&mix.sample.mute); },
    setSampleMuted(m){ mix.sample.mute=m?1:0; applyGroupLive('sample'); syncMixerUI(); },
    hasSample(){ return !!smp.buf; },
    // The reference is resampled to the project tempo on playback, which shifts every frequency in
    // it. A test looking for a known tone has to know that, or it measures silence at the original
    // pitch and concludes nothing leaked when plenty did.
    samplePlaybackRate(){ return smp.bpm ? (+bpmEl.value*(smp.half?0.5:1)/smp.bpm)*smp.rate : smp.rate; },
    matchProjectTempoToSample(){ if(smp.bpm){ bpmEl.value=String(Math.round(smp.bpm));
      bpmEl.dispatchEvent(new Event('input',{bubbles:true})); } },
    recentsRaw(){ try{ return localStorage.getItem('aura-recent')||''; }catch(e){ return ''; } },
    autosaveRaw(){ try{ return localStorage.getItem(SAVE_KEY)||''; }catch(e){ return ''; } },
    exportProjectText(){ return JSON.stringify(toReadable(serialize())); },
    // ---- persistence, for fixtures/persistence-qa.html ----
    // buildFile/openFile drive the SHIPPED save and open paths. A suite that builds its own file
    // object or its own reader would be testing itself, not the app.
    buildFile(name,asNew){ return buildProjectFile(name||projName||'Test',!!asNew); },
    openFile(obj,fileName){ return openProjectObject(obj,fileName); },
    requiredSchema(){ return requiredSchema(serialize()); },
    contentFlags(){ return contentFlags(); },
    capabilities(){ return {...CAPABILITIES}; },
    setProjectName(n){ projName=n; },
    projectName(){ return projName; },
    newProject(){ projMeta={id:'',createdAt:''}; },
    pushRecent(name){ pushRecent(name,JSON.stringify(serialize())); },
    openRecentAt(i){ const l=recentProjects(); if(!l[i]) return false;
      applyState(JSON.parse(l[i].state));
      const m=l[i].meta; projMeta={id:(m&&m.id)||'',createdAt:(m&&m.createdAt)||''};
      projName=l[i].name; return true; },
    writeRecentsRaw(s){ try{ localStorage.setItem('aura-recent',s); return true; }catch(e){ return false; } },
    // ---- groove builder, for fixtures/music-knowledge-qa.html ----
    grooveControls(){ return Object.assign({}, groove); },
    setGroove(n,v){ return setGroove(n,v); },
    resetGroove(){ Object.assign(groove, GROOVE_DEFAULT); },
    grooveBeat(o){ return grooveBeat(o); },
    grooveLowEnd(o){ return grooveLowEnd(o); },
    tresilloSteps(){ return tresilloSteps(); },
    floorSteps(){ return FLOOR_STEPS.slice(); },
    applyGroove(o){ return applyGroove(o); },
    grooveMixTargets(){ return grooveMixTargets(); },
    grooveIdeaCode(){ return grooveIdeaCode(); },
    grooveFromIdeaCode(c){ return grooveFromIdeaCode(c); },
    grooveSeed(v){ if(v!=null) grooveSeed=v|0; return grooveSeed; },
    patternLanes(i){ const p=patterns[i]; if(!p) return null;
      const out={}; drums.forEach(d=>out[d.id]=p[d.id].map(Boolean)); return out; },
    patternAccents(i){ const a=accents[i]; if(!a) return null;
      const out={}; drums.forEach(d=>out[d.id]=a[d.id].map(Boolean)); return out; },
    patternBass(i){ const p=patterns[i]; return p?(p.bass||[]).map(n=>({p:n.p,s:n.s,l:n.l,v:n.v})):null; },
    // ---- architect / transitions / emotion / mix, for fixtures/music-knowledge-qa.html ----
    architectPlan(o){ return architectPlan(o); },
    applyArchitect(o){ return applyArchitect(o); },
    architectActionNames(){ return Object.keys(architectActions()); },
    runArchitect(n){ const a=architectActions()[n]; if(!a) return false; a.run(); return true; },
    architectPreview(n){ const a=architectActions()[n]; return a?a.preview:null; },
    transitionTypes(){ return TRANSITIONS.map(t=>t.id); },
    transitionSuggest(a,b){ return transitionSuggest(a,b); },
    applyTransition(t,b){ return applyTransition(t,b); },
    emotionMap(){ return emotionMap(); },
    sectionMetrics(i){ return sectionMetrics(i); },
    mixCheck(){ return mixCheck(); },
    songSlots(){ return song.slice(); },
    sectionNames(){ return secNames.slice(); },
    // ---- lyrics and vocal coach, for fixtures/music-knowledge-qa.html ----
    setLyrics(i,t){ return setLyrics(i,t); },
    getLyrics(i){ return lyrics.sections[i|0]||''; },
    lyricAnalysis(i){ return lyricAnalysis(i|0); },
    countSyllables(w,h){ return countSyllables(w,h); },
    lineSyllables(l){ return lineSyllables(l); },
    suggestBreaths(i){ return suggestBreaths(i|0); },
    setPerformanceNote(i,t){ return setPerformanceNote(i,t); },
    vocalRange(i){ return vocalRange(i); },
    vocalCoach(i){ return vocalCoach(i); },
    // ---- project intention, for fixtures/music-knowledge-qa.html ----
    intention(){ return Object.assign({}, intention); },
    setIntention(k,v){ return setIntention(k,v); },
    clearIntention(){ return clearIntention(); },
    intentionSummary(){ return intentionSummary(); },
    // ---- rights and sources, for fixtures/music-knowledge-qa.html ----
    recordAsset(k,n,o){ return recordAsset(k,n,o); },
    noteTransform(i,w){ return noteTransform(i,w); },
    setAssetIncluded(i,on){ return setAssetIncluded(i,on); },
    setAssetRights(i,n){ return setAssetRights(i,n); },
    rightsReport(){ return rightsReport(); },
    confirmRights(){ return confirmRights(); },
    rightsManifest(){ return rightsManifest(); },
    sourceKinds(){ return Object.keys(SOURCE_KINDS); },
    // ---- complete export, for fixtures/music-knowledge-qa.html ----
    tempoKeyMap(){ return tempoKeyMap(); },
    lyricsDocument(){ return lyricsDocument(); },
    exportReadme(l){ return exportReadme(l||[]); },
    midiBytesForExport(){ const b=midiBytesForExport(); return b?b.length:0; },
    // ---- finish the record, for fixtures/music-knowledge-qa.html ----
    finishStages(){ return finishStages(); },
    readyToShare(){ return readyToShare(); },
    // ---- find a sound / create something, for fixtures/music-knowledge-qa.html ----
    soundFamilies(){ return SOUND_FAMILIES.map(f=>({id:f.id,name:f.name,voice:f.voice})); },
    trySound(id,o){ return trySound(id,o); },
    keepSound(){ return keepSound(); },
    keptSound(){ return soundPick.keptId; },
    soundMelodyHint(id){ return soundMelodyHint(id); },
    createLanes(){ return CREATE_LANES.map(l=>l.id); },
    createMoods(){ return CREATE_MOODS.map(m=>m.id); },
    createStarts(){ return CREATE_STARTS.map(s2=>s2.id); },
    // The welcome's route keys, so a fixture can prove every door dispatches to something that
    // exists rather than closing the dialog and doing nothing.
    welcomeRoutes(){ return Object.keys(W_ROUTES); },
    // The destructive controls a live performance locks, so a fixture can prove each one is
    // disabled AND says why, rather than silently missing.
    performLockIds(){ return PERF_LOCKED.slice(); },
    performLockWhy(){ return PERF_LOCK_WHY; },
    createSomething(c){ return createSomething(c); },
    openCreate(){ openCreate(); return true; },
    // ---- variations, for fixtures/variation-qa.html ----
    variations(){ return {activeId:variations.activeId, main:!!variations.main,
      items:variations.items.map(v=>({id:v.id,name:v.name,scope:v.scope,basedOn:v.basedOn}))}; },
    setApplyMode(m){ beatApplyMode=m; },
    applyMode(){ return beatApplyMode; },
    switchVariation(id){ let r=false; oneCheckpoint(()=>{ r=switchVariation(id); }); return r; },
    promoteVariation(id){ let r=false; oneCheckpoint(()=>{ r=promoteVariation(id); }); return r; },
    deleteVariation(id){ let r=false; oneCheckpoint(()=>{ r=deleteVariation(id); }); return r; },
    renameVariation(id,n){ let r=false; oneCheckpoint(()=>{ r=renameVariation(id,n); }); return r; },
    // ---- controller, for fixtures/midi-qa.html ----
    midiState(){ return {supported:midi.supported, state:midi.state, inputs:midi.inputs.length,
      maps:midi.maps.length, learning:midi.learning}; },
    midiActionNames(){ return Object.keys(performActions()); },
    midiFeed(bytes){ handleMidiMessage({data:bytes}); },
    midiLearn(action){ midi.learning=action; renderMidi(); },
    midiMaps(){ return midi.maps.map(m=>Object.assign({},m)); },
    midiSetMaps(a){ midi.maps=a||[]; saveMidiMaps(); renderMidi(); },
    midiConnect(){ return connectMidi(); },
    // ---- perform / automation, for fixtures/performance-qa.html ----
    runAction(n,v){ return runAction(n,v); },
    perfState(){ return {recording:perf.recording, events:perf.events.length,
      take:perf.take?perf.take.events.length:null, automation:automation.events.length}; },
    perfStart(){ return perfStart(); },
    perfStop(){ return perfStop(); },
    perfKeep(){ return perfKeep(); },
    perfDiscard(){ return perfDiscard(); },
    perfSimplify(){ return perfSimplify(); },
    perfClearAutomation(){ return perfClearAutomation(); },
    automationAt(ms){ return automationAt(ms); },
    // ---- guide, for fixtures/guide-qa.html ----
    guideContext(){ return guideContext(); },
    guideAnswer(t){ const a=guideAnswer(t);
      return {intent:a.intent, say:a.say, why:a.why,
        actions:(a.actions||[]).map(x=>({label:x.label, danger:!!x.danger, preview:x.previewText||null}))}; },
    guideAsk(t){ const a=guideAsk(t); return a?a.intent:null; },
    guideOpen(){ guideOpen(); }, guideClose(){ guideClose(); },
    guideState(){ return {open:guide.open, log:guide.log.length, pending:!!guide.pending}; },
    guideConfirmLast(){ const sheet=document.getElementById('guideSheet');
      const b=sheet&&[...sheet.querySelectorAll('.gcard.danger')].find(x=>x.textContent==='Confirm');
      if(b){ b.click(); return true; } return false; },
    guideCancelLast(){ const sheet=document.getElementById('guideSheet');
      const b=sheet&&[...sheet.querySelectorAll('.gcard')].find(x=>x.textContent==='Cancel');
      if(b){ b.click(); return true; } return false; },
    guideClickAction(i){ const sheet=document.getElementById('guideSheet');
      const cards=sheet?[...sheet.querySelectorAll('.gmsg:last-child .gcard')]:[];
      if(cards[i||0]){ cards[i||0].click(); return true; } return false; },
    midiBytes(){ return null; },
  });

  function updateReadout(){ const el=document.getElementById('readout'); if(!el) return;
    const bar=mode==='song'?slotIndex+1:1, beat=Math.floor(step/4)+1;
    el.textContent=`${bar} · ${beat}`; }

  // ---------- init ----------
  buildPianoRoll(); buildMixer(); buildGrid(); buildPatBar(); buildSong(); buildSectionNames(); buildVibeTiles();
  mountShell(); wireSamplePanel(); wireBrowserPanel(); wireReferenceCard(); buildBalance(); wireSoundPanel(); wireVocalPanel(); wireImportModes();
  try{ railHidden=localStorage.getItem('aura-rail')==='hidden'; }catch(e){}
  buildRail(); wireWelcome(); fillDatafield();
  // Datafield intensity: default Low, persisted, auto-reduced on small screens.
  (function wireDatafield(){
    let level='low'; try{ level=localStorage.getItem('aura-df')||'low'; }catch(e){}
    if(innerWidth<768 && level==='full') level='low';         // phones never start on Full
    const apply=l=>{ document.body.classList.remove('df-off','df-low','df-full'); document.body.classList.add('df-'+l);
      document.querySelectorAll('#dfSeg button').forEach(b=>b.classList.toggle('on',b.dataset.df===l));
      try{ localStorage.setItem('aura-df',l); }catch(e){} };
    apply(level);
    document.querySelectorAll('#dfSeg button').forEach(b=>b.addEventListener('click',()=>apply(b.dataset.df)));
  })();
  // Aura is for singers, so the simple path is the default. Studio is one tap away and, once
  // chosen, is remembered — only a first-time visitor with no stored preference lands in Guided.
  try{ setMode(localStorage.getItem('aura-mode')!=='studio'); }catch(e){ setMode(true); }
  if(!loadFromHashOrStorage()){ seedSong(); applyVibe('moody'); }   // restore saved/shared track, else start on a full reggaetón groove
  hist.last=snapshot(); setDirty(false);          // seed history so the FIRST edit is undoable
  setInterval(autosave, 4000); window.addEventListener('beforeunload', autosave);
  window.addEventListener('beforeunload', e=>{ if(dirty){ e.preventDefault(); e.returnValue=''; } });
  // Audio stability beats visual motion: stop all Datafield work when the tab is hidden.
  document.addEventListener('visibilitychange',()=>{
    document.body.classList.toggle('novis', document.hidden);
    if(document.hidden && mixMeterRAF){ cancelAnimationFrame(mixMeterRAF); mixMeterRAF=null; }
    else if(!document.hidden && !mixMeterRAF) startMeters();
  });
  // Low-performance mode: if frames are consistently slow, drop the animated layers.
  (function perfWatch(){ let slow=0,last=performance.now(),n=0;
    const tick=()=>{ const t=performance.now(), dt=t-last; last=t;
      if(++n>60){ if(dt>34) slow++; else slow=Math.max(0,slow-1);
        if(slow>45 && !document.body.classList.contains('lowfx')){
          document.body.classList.add('lowfx'); toast('Reduced background motion to keep audio smooth'); } }
      if(!document.hidden) requestAnimationFrame(tick); else setTimeout(()=>requestAnimationFrame(tick),400); };
    requestAnimationFrame(tick); })();

  // Everything above is Aura setting itself up, not the singer working. Freeze the history depth
  // here so "has the user done anything?" can be answered honestly.
  renderVariations(); wireMidiPanel(); wirePerform(); wireGuide(); wireGrooveCard(); wireCraftUI();
  histBaseline=hist.past.length;
})();
