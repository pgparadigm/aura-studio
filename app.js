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
    dorian:  {steps:[0,2,3,5,7,9,10], quals:['min','min','maj','maj','min','dim','maj'], romans:['i','ii','III','IV','v','vi°','VII']},   // soulful (Kanye / hip-hop)
    phrygian:{steps:[0,1,3,5,7,8,10], quals:['min','maj','maj','min','dim','maj','min'], romans:['i','♭II','♭III','iv','v°','♭VI','♭vii']}, // exotic (Persian hip-hop lane)
    // gospel: raised leading tone makes V a true dominant (with 'soul' 7ths -> V7, the Ultralight Beam pull); III voiced major per gospel practice
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
              on:false, rate:1, half:false, hp:20, offset:0 };
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
  const PR_LO=48, PR_HI=83, PR_CW=40, PR_RH=19;   // Phase 3: wider columns, taller rows
  let melodySound='lead';
  const DRUM_SEND=id=>(id==='snare'||id==='clap'||id==='shaker');  // which drums get a touch of reverb

  // ---------- pattern state ----------
  function emptyPattern(){ const p={}; drums.forEach(t=>p[t.id]=new Array(STEPS).fill(false)); CHORD_DEGREES.forEach(c=>p[c.id]=new Array(STEPS).fill(false)); p.melody=[]; return p; }   // melody: [{p:midi, s:step, l:steps, v:velocity}]
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
  function getNoise(ctx){ if(ctx.__noise) return ctx.__noise; const len=Math.floor(ctx.sampleRate*0.4), b=ctx.createBuffer(1,len,ctx.sampleRate), d=b.getChannelData(0); for(let i=0;i<len;i++) d[i]=Math.random()*2-1; ctx.__noise=b; return b; }
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
  // bass: 'sub' = warm saw+sub (reggaetón); '808' = sine with a pitch-drop thump + long sustain (Kanye/hip-hop)
  function playBass(ctx,bus,freq,t,dur,style){ style=style||'sub';
    const g=ctx.createGain(),f=ctx.createBiquadFilter(); f.type='lowpass'; f.Q.value= style==='808'?1.1:0.7; f.frequency.setValueAtTime(style==='808'?260:430,t); susEnv(g,t,dur, style==='808'?0.72:0.6); f.connect(g).connect(bus);
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
  function playClick(ctx,accent,t){ const o=ctx.createOscillator(),g=ctx.createGain(); o.type='square'; o.frequency.value=accent?1500:1000; g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(accent?.5:.3,t+.002); g.gain.exponentialRampToValueAtTime(0.0001,t+.06); o.connect(g).connect(ctx.destination); o.start(t); o.stop(t+.08); }

  // synthesized reverb impulse (no file needed): de-correlated L/R noise with exponential (RT60) decay
  function makeIR(ctx,seconds=2.2,rt60=1.8){ const rate=ctx.sampleRate, len=Math.floor(rate*seconds), buf=ctx.createBuffer(2,len,rate), k=rate*rt60/6.908; for(let c=0;c<2;c++){ const d=buf.getChannelData(c); for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.exp(-i/k); } return buf; }

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
    // high-pass on the imported channel so Aura's own 808 can own the low end (the Kanye move)
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
      if(BUS_VOL.bass>0 && !mutes.bass) playBass(ctx,bus.bass,midiToFreq(chordRootMidi(degs[0].deg)-24),t, bassStyle==='808'?dur:Math.min(dur,sps*3), bassStyle); }
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
  function currentPlaybackPattern(){ if(mode==='pattern') return currentPattern; const p=song[slotIndex]; return p==null?-1:p; }
  function scheduleTick(t){ const pat=currentPlaybackPattern(); if(pat>=0) scheduleStepAudio(ac,liveBus,pat,step,t,secondsPerStep(), mode==='song'&&fillForBar(song,slotIndex,true));
    if(metOn && step%4===0) playClick(ac, step===0, t); const s=step, sl=slotIndex; setTimeout(()=>paintPlayhead(s,sl), Math.max(0,(t-now())*1000)); }
  function advance(){ step++; if(step>=STEPS){ step=0; if(mode==='song') slotIndex=(slotIndex+1)%(songUsedLen()||SONG_SLOTS); } }
  function loop(){ while(nextTime<now()+LOOKAHEAD){ let t=nextTime; if(step%2===1) t+=secondsPerStep()*(+swingEl.value/100)*0.9; scheduleTick(t); nextTime+=secondsPerStep(); advance(); } timer=setTimeout(loop,INTERVAL); }
  function start(withCue){
    ensureCtx(); clearTimeout(timer); stopTake(); playing=true; step=0; slotIndex=0;  // idempotent: never leave a second scheduler loop running
    let t0=now()+.12;
    if(countInEl.checked){ const beat=secondsPerStep()*4; for(let k=0;k<4;k++){ playClick(ac,k===0,t0+k*beat); if(withCue){ const n=4-k; setTimeout(()=>showCue(n), Math.max(0,(t0+k*beat-now())*1000)); } } if(withCue) setTimeout(hideCue, Math.max(0,(t0+4*beat-now())*1000)); t0+=4*beat; }
    musicZeroTime=t0; nextTime=t0; loop(); playBtn.classList.add('on'); playBtn.textContent='■ Stop';
    stopSample(); sampleSrc=scheduleSample(ac,liveBus,t0,null);
    const xp=document.getElementById('xport'); if(xp) xp.classList.add('playing');
    document.body.classList.add('playing-now');           // wakes the Datafield up a notch
  }
  // Schedule the imported instrumental. Same function for live and offline, so the export matches what you hear.
  function scheduleSample(ctx,bus,startAt,dur){
    if(!smp.buf||!smp.on||!bus.sampleHP) return null;
    const src=ctx.createBufferSource(); src.buffer=smp.buf;
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
  function stop(){ playing=false; clearTimeout(timer); clearPlayhead(); hideCue(); stopTake(); stopSample(); playBtn.classList.remove('on'); playBtn.textContent='▶ Play';
    const xp=document.getElementById('xport'); if(xp) xp.classList.remove('playing');
    document.body.classList.remove('playing-now');
    if(prPH) prPH.style.left='-10px';
    document.querySelectorAll('.mtr i').forEach(e=>e.style.height='0%'); }   // meters must not freeze mid-level

  // vocal channel: rumble highpass -> gentle 3:1 comp so the take sits level on top of the mix (voice stays forward of the presence scoop)
  function vocalChain(ctx,dest){ const hp=ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=80; hp.Q.value=0.7;
    const comp=ctx.createDynamicsCompressor(); comp.threshold.value=-18; comp.knee.value=12; comp.ratio.value=3; comp.attack.value=.006; comp.release.value=.12;
    hp.connect(comp); comp.connect(dest); return hp; }

  // ---------- export (backing + optional vocal, aligned) ----------
  async function exportWav(){
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
    for(let i=0;i<active.length;i++){ const pat=active[i]; if(pat==null) continue; const fl=isSong&&fillForBar(active,i,false); for(let s=0;s<STEPS;s++){ let t=(i*STEPS+s)*sps; if(s%2===1) t+=sps*(+swingEl.value/100)*0.9; scheduleStepAudio(off,bus,pat,s,t,sps,fl); } }
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
    const wav=encodeWav(rendered);
    const url=URL.createObjectURL(new Blob([wav],{type:'audio/wav'}));
    const a=document.createElement('a'); a.href=url; a.download= vocalBuffer?'aura-studio-song-with-vocals.wav':'aura-studio-backing.wav'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),4000);
  }
  // ---------- MIDI export ----------
  // One type-1 file: track 1 = melody, track 2 = chords. Ticks are 480/quarter = 120 per 16th step.
  function exportMidi(){
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
      const msg = n==='NotAllowedError'  ? '🎤 Microphone blocked. Allow mic access for this site in your browser, then press Record again.'
                : n==='NotFoundError'    ? '🎤 No microphone found. Plug one in or check your system input, then try again.'
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
    updateExportLabel();
  }
  function playTake(){
    if(!vocalBuffer) return; ensureCtx();
    start(false);
    const vs=ac.createBufferSource(); vs.buffer=vocalBuffer; const vg=ac.createGain(); vg.gain.value=+vocalVolEl.value/100; vs.connect(vg).connect(vocalChain(ac,liveBus.vocalIn)); takeGain=vg;
    const head=vocalHeadSec+LAT()+(+syncEl.value/1000);
    if(head>=0) vs.start(musicZeroTime, head); else vs.start(musicZeroTime-head, 0);
    takeSource=vs;
  }
  function clearTake(){ vocalBuffer=null; stopTake(); playTakeBtn.disabled=true; clearTakeBtn.disabled=true; recStatus.textContent='No take yet'; updateExportLabel(); }
  function startMeter(){ if(!micAnalyser) return; const data=new Float32Array(micAnalyser.fftSize); const tick=()=>{ micAnalyser.getFloatTimeDomainData(data); let sum=0; for(let i=0;i<data.length;i++) sum+=data[i]*data[i]; const rms=Math.sqrt(sum/data.length); const pct=Math.min(100,rms*220); meterEl.style.width=pct+'%'; meterEl.style.background= pct>88?'#ff5c8a':pct>8?'var(--green)':'#3a4270'; meterRAF=requestAnimationFrame(tick); }; tick(); }
  function stopMeter(){ if(meterRAF) cancelAnimationFrame(meterRAF); meterRAF=null; meterEl.style.width='0%'; }
  function updateExportLabel(){ exportBtn.textContent = vocalBuffer? '⬇ Export WAV + vocals' : '⬇ Export WAV'; }

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
    const head=document.createElement('tr'); head.className='col-head'; head.appendChild(document.createElement('td')); head.appendChild(document.createElement('td'));
    for(let s=0;s<STEPS;s++){ if(s>0&&s%4===0){ const g=document.createElement('td'); g.className='beatgap'; head.appendChild(g);} const td=document.createElement('td'); td.className='num'; td.textContent=s+1; head.appendChild(td);} gridEl.appendChild(head);
    rowMeta().forEach(meta=>{
      if(meta===null){ const dv=document.createElement('tr'); dv.className='divider'; const l=document.createElement('td'); l.className='rowlabel'; l.textContent='Chords (sing over these)'; dv.appendChild(l); const sp=document.createElement('td'); sp.colSpan=STEPS+5; dv.appendChild(sp); gridEl.appendChild(dv); return; }
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
        c.addEventListener('click',()=>{ const on=!P()[meta.id][s]; P()[meta.id][s]=on; c.classList.toggle('on',on);
          if(!on && meta.type==='drum'){ A()[meta.id][s]=false; c.classList.remove('acc'); }
          if(on){ ensureCtx(); if(meta.type==='drum') playDrum(ac,liveBus[meta.id],meta.id,now()+.001,DRUM_SEND(meta.id)?liveBus.drumSend:null, A()[meta.id][s]?1.12:0.95); else { playChord(ac,liveBus.chords,liveBus.chordSend,chordMidiNotes(meta.deg, chordStyle==='soul').map(midiToFreq),now()+.001,.7,chordStyle); playBass(ac,liveBus.bass,midiToFreq(chordRootMidi(meta.deg)-24),now()+.001,.7,bassStyle); } }
          refreshPatBtns(); autosave(); });
        if(meta.type==='drum') c.addEventListener('contextmenu',e=>{ e.preventDefault(); if(!P()[meta.id][s]){ P()[meta.id][s]=true; c.classList.add('on'); } const acc=!A()[meta.id][s]; A()[meta.id][s]=acc; c.classList.toggle('acc',acc); ensureCtx(); playDrum(ac,liveBus[meta.id],meta.id,now()+.001,DRUM_SEND(meta.id)?liveBus.drumSend:null, acc?1.15:0.9); refreshPatBtns(); autosave(); });
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
  function buildSong(){ for(let i=0;i<SONG_SLOTS;i++){ const el=document.createElement('div'); el.className='slot'; el.innerHTML=`<span class="bn">bar ${i+1}</span><span class="v">·</span>`; el.addEventListener('click',()=>{ const cur=song[i]; song[i]=cur==null?0:(cur+1>=N_PATTERNS?null:cur+1); renderSlot(i); autosave(); }); slotsEl.appendChild(el); slotEls.push(el); renderSlot(i);} }
  // section names — beginner-facing labels for the playlist clips
  const SEC_DEFAULT=['Intro','Verse','Pre-Chorus','Chorus','Bridge','Outro'];
  const secNames=SEC_DEFAULT.slice();
  function renderSlot(i){ const el=slotEls[i], v=song[i];
    el.className='slot'+(v!=null?` set p${v+1}`:'')+(v!=null&&fillForBar(song,i,false)?' fillbar':'');
    el.querySelector('.v').textContent=v!=null?(v+1):'·';
    let lb=el.querySelector('.lbl'); if(!lb){ lb=document.createElement('span'); lb.className='lbl'; el.appendChild(lb); }
    lb.textContent=v!=null?(secNames[v]||('Sec '+(v+1))):'';
    el.title=v!=null?`Bar ${i+1} — ${secNames[v]||('Section '+(v+1))}`:`Bar ${i+1} — empty`; }
  function renderAllSlots(){ for(let i=0;i<SONG_SLOTS;i++) renderSlot(i); }
  function buildSectionNames(){
    const host=document.getElementById('secnames'); if(!host) return;
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
      el.title=NOTE_NAMES[n.p%12]+(Math.floor(n.p/12)-1); prGrid.appendChild(el); }); }
  function previewNote(p){ ensureCtx(); playMelody(ac,liveBus.melody,liveBus.melodySend,p,now()+.001,.35,.9,melodySound); }
  prGrid.addEventListener('mousedown',e=>{ if(e.button!==0||e.ctrlKey) return; e.preventDefault();   // ctrl+click is a right-click on macOS — let contextmenu handle it
    const r=prGrid.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top;
    const noteEl=e.target.closest('.pnote');
    if(noteEl){ const n=P().melody[+noteEl.dataset.i]; if(!n) return;
      const edge=(e.clientX-noteEl.getBoundingClientRect().left) > noteEl.offsetWidth-8;
      prDrag={mode:edge?'resize':'move', n, x0:x, y0:y, o:{p:n.p,s:n.s,l:n.l}, moved:false};
    } else {
      const s=clampN(Math.floor(x/PR_CW),0,STEPS-1), p=snapScale(clampN(PR_HI-Math.floor(y/PR_RH),PR_LO,PR_HI));
      // scale-snap can land on a row the user didn't click; grab that note instead of stacking an invisible duplicate
      const hit=P().melody.find(n=>n.p===p && s>=n.s && s<n.s+n.l);
      if(hit){ prDrag={mode:'move', n:hit, x0:x, y0:y, o:{p:hit.p,s:hit.s,l:hit.l}, moved:false}; return; }
      const n={p,s,l:Math.min(prLastLen,STEPS-s),v:0.85}; P().melody.push(n); previewNote(p);
      prDrag={mode:'resize', n, x0:x, y0:y, o:{p,s,l:n.l}, moved:true, added:true};
      renderRoll(); refreshPatBtns();
    }});
  window.addEventListener('mousemove',e=>{ if(!prDrag) return;
    const r=prGrid.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top, n=prDrag.n;
    if(Math.abs(x-prDrag.x0)>4||Math.abs(y-prDrag.y0)>4) prDrag.moved=true;
    if(prDrag.mode==='resize'){ n.l=clampN(Math.ceil((x-n.s*PR_CW)/PR_CW),1,STEPS-n.s); }
    else { n.s=clampN(prDrag.o.s+Math.round((x-prDrag.x0)/PR_CW),0,STEPS-n.l);
      const np=clampN(prDrag.o.p-Math.round((y-prDrag.y0)/PR_RH),PR_LO,PR_HI); const sp=snapScale(np); if(sp!==n.p){ n.p=sp; if(prDrag.moved) previewNote(sp); } }
    renderRoll(); });
  window.addEventListener('mouseup',()=>{ if(!prDrag) return; const n=prDrag.n;
    if(prDrag.mode==='move'&&!prDrag.moved&&!prDrag.added){ const i=P().melody.indexOf(n); if(i>-1) P().melody.splice(i,1); }
    else prLastLen=n.l;
    prDrag=null; renderRoll(); refreshPatBtns(); autosave(); });
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

  // ---------- mixer UI ----------
  const stripsEl=document.getElementById('strips'), mixerEl=document.getElementById('mixer');
  const stripUI={};
  function applyGroupLive(id){ if(!liveBus||!liveBus.grp) return; const n=liveBus.grp[id], m=mix[id]; if(!n) return;
    const t=ac?ac.currentTime:0;
    n.g.gain.setTargetAtTime(groupGain(id),t,.008);      // ramp, so fader/mute moves don't click
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
    fxRevSize.value=fx.revSize; fxDlyTime.value=fx.dlyTime; fxDlyFb.value=fx.dlyFb; fxComp.value=fx.comp; syncFxLabels(); refreshStripDim(); }
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
    boombap:     { kick:[0,6,10], snare:[4,12], hat:[0,2,4,6,8,10,12,14] },              // dusty hip-hop (Kanye / Persian rap lane)
    sparse808:   { kick:[0,8], clap:[4,12], openhat:[7,15] },                            // 808s & Heartbreak — minimal + moody
    fill:        { kick:[0], snare:[6,8,10,11,12,13,14,15], shaker:[0,2,4,6,8,10,12,14], clap:[15] },
    heartbeat:   { kick:[0,4,8,12], shaker:[2,6,10,14] },                                // Love Lockdown pulse — the deleted backbeat IS the beat
    gospelpulse: { kick:[0], clap:[8] },                                                 // drums almost entirely silence (Ultralight Beam)
    halftime:    { kick:[0,6,10], snare:[8], hat:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15] },  // snare on 8 alone = the half-time anthem trick
    drill:       { kick:[0,3,10], snare:[8], hat:[0,2,4,6,8,10,12,14], openhat:[7] },        // sliding UK drill pocket
    silk:        { kick:[0,10], snare:[4,12], hat:[2,6,10,14], shaker:[0,4,8,12] },          // soft modern R&B
  };
  function applyBeat(name){ if(name==='keep') return; drums.forEach(t=>{ P()[t.id]=new Array(STEPS).fill(false); A()[t.id]=new Array(STEPS).fill(false); }); const p=BEATS[name]||{}; Object.keys(p).forEach(id=>p[id].forEach(s=>P()[id][s]=true)); renderGrid(); refreshPatBtns(); document.getElementById('preset').value='keep'; autosave(); }
  const PROGS={ pop:[0,4,5,3], ballad:[0,5,3,4], emotional:[5,3,0,4], simple:[0,3,4,3], doowop:[0,5,1,4], soulful:[0,6,3,4], phrygian:[0,5,1,0],
    lockdown:[0,3,0,3], ultralight:[0,2,5,4], soulflip:[0,6,5,6], throne:[0,6,5,4] };   // i-iv vamp · i-III-VI-V7 gospel · i-bVII-bVI-bVII soul flip
  function clearChords(){ CHORD_DEGREES.forEach(c=>P()[c.id]=new Array(STEPS).fill(false)); }
  function applyProg(name){ if(name==='keep') return; clearChords(); if(name!=='clearchords'){ (PROGS[name]||[]).forEach((deg,i)=>{ const step=i*4; if(step<STEPS) P()['deg'+deg][step]=true; }); } renderGrid(); refreshPatBtns(); progEl.value='keep'; autosave(); }

  // One-click vibes: lane -> BPM -> mood -> key -> chords -> beat, all at once (the fluid on-ramp)
  const VIBES={
    moody:    { label:'Reggaetón · Moody',   key:9, mode:'minor',    prog:'emotional', beat:'reggaeton',    bpm:90, swing:16, reverb:34, cs:'pad',   bs:'sub', ms:'lead' },
    classic:  { label:'Reggaetón · Classic', key:0, mode:'minor',    prog:'simple',    beat:'dembow',       bpm:94, swing:14, reverb:24, cs:'pad',   bs:'sub', ms:'lead' },
    latinpop: { label:'Latin Pop · Upbeat',  key:0, mode:'major',    prog:'pop',       beat:'reggaetonpop', bpm:96, swing:12, reverb:28, cs:'pluck', bs:'sub', ms:'pluck' },
    rnbchill: { label:'R&B · Chill',         key:2, mode:'minor',    prog:'ballad',    beat:'lofi',         bpm:84, swing:22, reverb:40, cs:'piano', bs:'sub', ms:'keys' },
    kanyesoul:{ label:'Kanye · Soul',        key:0, mode:'dorian',   prog:'soulful',   beat:'boombap',      bpm:86, swing:20, reverb:26, cs:'soul',  bs:'808', ms:'keys' },
    kanye808: { label:'Kanye · 808s',        key:9, mode:'minor',    prog:'emotional', beat:'sparse808',    bpm:78, swing:8,  reverb:38, cs:'pad',   bs:'808', ms:'pad' },
    tehran:   { label:'Tehrán · Noir',       key:4, mode:'phrygian', prog:'phrygian',  beat:'boombap',      bpm:92, swing:14, reverb:32, cs:'pluck', bs:'808', ms:'pluck' },  // Persian hip-hop lane: phrygian dark, midnight boom-bap
    urbano:   { label:'Urbano · Polished',   key:5, mode:'minor',    prog:'simple',    beat:'reggaetonpop', bpm:95, swing:10, reverb:20, cs:'pluck', bs:'sub', ms:'pluck' },  // J Balvin lane: clean, tight, radio-bright
    atmos:    { label:'Atmosphérico',        key:8, mode:'minor',    prog:'emotional', beat:'reggaeton',    bpm:88, swing:18, reverb:48, cs:'pad',   bs:'sub', ms:'pad' },  // Feid lane: washed pads, dark and spacious
    // Kanye Codex SHIP-NOW pack (see KANYE-CODEX.md):
    chipmunk:  { label:'Soul · Chipmunk',    key:3, mode:'minor',    prog:'soulflip',  beat:'boombap',      bpm:88, swing:16, reverb:20, cs:'soul',  bs:'sub', ms:'keys' },  // College Dropout lane: Eb minor era home key, MPC-58% swing
    heartbreak:{ label:'808 · Heartbreak',   key:1, mode:'minor',    prog:'lockdown',  beat:'heartbeat',    bpm:120,swing:0,  reverb:12, cs:'piano', bs:'808', ms:'pad' },  // Love Lockdown lane: tuned 808 carries the chords, no snare
    gospel:    { label:'Gospel · Sunday',    key:0, mode:'harmonicMinor', prog:'ultralight', beat:'gospelpulse', bpm:74, swing:33, reverb:55, cs:'soul', bs:'sub', ms:'keys' },  // Ultralight lane: V7 pull, drums withheld, choir-wet
    // closing the gap with the reference library: UK drill, Houston melodic trap, modern R&B
    drillnoir: { label:'Drill · Noir',       key:8, mode:'minor',    prog:'throne',    beat:'drill',    bpm:140, swing:6,  reverb:18, cs:'pluck', bs:'808', ms:'bell' },
    houston:   { label:'Houston · Melodic',  key:7, mode:'minor',    prog:'emotional', beat:'halftime', bpm:75,  swing:10, reverb:46, cs:'pad',   bs:'808', ms:'pad'  },
    silk:      { label:'R&B · Silk',         key:2, mode:'dorian',   prog:'soulful',   beat:'silk',     bpm:88,  swing:20, reverb:36, cs:'soul',  bs:'sub', ms:'keys' },
  };
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
    autosave();
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
      pat:patterns.map(p=>ALL_IDS.map(id=>maskOf(p[id]))),
      acc:accents.map(a=>drums.map(d=>maskOf(a[d.id]))),
      song:song.slice(), mute:{...mutes}, dv:drums.map(d=>Math.round(BUS_VOL[d.id]*100)), cp:currentPattern };
  }
  function applyState(o){
    if(!o) return;
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
    if(Array.isArray(o.mx)) o.mx.forEach((a,i)=>{ const G=GROUPS[i]; if(!G||!Array.isArray(a)) return; const m=mix[G.id];
      m.vol=clampN(a[0]|0,0,140); m.pan=clampN(a[1]|0,-100,100); m.mute=a[2]?1:0; m.solo=a[3]?1:0;
      m.lo=clampN(a[4]|0,-12,12); m.mid=clampN(a[5]|0,-12,12); m.hi=clampN(a[6]|0,-12,12);
      m.rev=clampN(a[7]|0,0,100); m.dly=clampN(a[8]|0,0,100); });
    if(Array.isArray(o.fx)){ fx.dlyTime=clampN(o.fx[0]|0,60,700); fx.dlyFb=clampN(o.fx[1]|0,0,70); fx.revSize=clampN(o.fx[2]|0,0,100); fx.comp=clampN(o.fx[3]|0,0,100); }
    if(o.pat) o.pat.forEach((pm,pi)=>{ if(pi<N_PATTERNS) ALL_IDS.forEach((id,ii)=>{ patterns[pi][id]=unmask(pm[ii]||0); }); });
    if(o.acc) o.acc.forEach((am,pi)=>{ if(pi<N_PATTERNS) drums.forEach((d,di)=>{ accents[pi][d.id]=unmask(am[di]||0); }); });
    if(o.song) for(let i=0;i<SONG_SLOTS;i++){ song[i]= i<o.song.length ? o.song[i] : null; renderSlot(i); }
    if(o.mute){ Object.keys(mutes).forEach(k=>delete mutes[k]); Object.assign(mutes,o.mute); }
    melMuteBtn.classList.toggle('on',!!mutes.melody);
    if(o.cp!=null && o.cp<N_PATTERNS) currentPattern=o.cp;
    relabelChords(); renderGrid(); refreshPatBtns(); syncMixerUI(); applyAllGroupsLive();
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
    const prior=b=>Math.pow(Math.exp(-Math.pow(Math.log2(b/110)/0.95,2)/2), 0.6);
    const scoreAt=bpm=>{ const lag=Math.round(fps*60/bpm); if(lag<2||lag>=frames) return 0;
      let s=0,n=0; for(let f=0;f<frames-lag;f++){ s+=flux[f]*flux[f+lag]; n++; }
      return n? (s/n) : 0; };
    let best=0,bestBpm=0;
    for(let bpm=60;bpm<=190;bpm+=0.25){
      const sc=scoreAt(bpm)*prior(bpm);
      if(sc>best){ best=sc; bestBpm=bpm; }
    }
    // Compare the metrical relatives — a peak at 1.5x or 2x is usually the same groove counted differently.
    if(bestBpm){
      const cands=[bestBpm, bestBpm/2, bestBpm*2, bestBpm*2/3, bestBpm*3/2, bestBpm*3/4, bestBpm*4/3]
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
    const all=[]; for(let r=0;r<12;r++){ all.push(corr(KK_MAJ,r),corr(KK_MIN,r)); }
    const mean=all.reduce((a,b)=>a+b,0)/all.length;
    return {key:best.key, mode:best.mode, conf:Math.max(0,Math.min(1,(best.score-mean)/(best.score||1)))};
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

  function newProject(){ if(!confirm('Start a new project? Your current track will be cleared.')) return;
    stop(); patterns.forEach((p,i)=>{ ALL_IDS.forEach(id=>p[id]=new Array(STEPS).fill(false)); p.melody=[];
      drums.forEach(d=>accents[i][d.id]=new Array(STEPS).fill(false)); });
    song.fill(null); for(let i=0;i<SONG_SLOTS;i++) renderSlot(i);
    Object.keys(mutes).forEach(k=>delete mutes[k]);
    GROUPS.forEach(G=>Object.assign(mix[G.id],mixDefault()));
    currentPattern=0; projName='Untitled'; clearTake();
    seedSong(); applyVibe('moody'); renderGrid(); refreshPatBtns(); syncMixerUI(); applyAllGroupsLive();
    hist.past.length=0; hist.future.length=0; hist.last=snapshot(); setDirty(false); toast('New project'); }

  // recent projects: names + the state itself, so "recent" actually reopens
  function pushRecent(name,state){
    try{ const list=JSON.parse(localStorage.getItem('aura-recent')||'[]').filter(r=>r.name!==name);
      list.unshift({name,at:Date.now(),state}); localStorage.setItem('aura-recent',JSON.stringify(list.slice(0,5)));
    }catch(e){}
  }
  function recentProjects(){ try{ return JSON.parse(localStorage.getItem('aura-recent')||'[]'); }catch(e){ return []; } }
  function openRecent(){ const list=recentProjects();
    if(!list.length){ toast('No recent projects yet'); return; }
    const pick=prompt('Open which recent project?\n\n'+list.map((r,i)=>`${i+1}. ${r.name}`).join('\n'),'1');
    const i=parseInt(pick,10)-1; if(isNaN(i)||!list[i]) return;
    restore(JSON.stringify(list[i].state)); projName=list[i].name;
    hist.past.length=0; hist.future.length=0; hist.last=snapshot(); setDirty(false); toast('Opened '+projName); }

  function saveProject(){ const name=(prompt('Name this project',projName)||projName).trim()||'Untitled';
    projName=name; pushRecent(name, serialize());
    const blob=new Blob([JSON.stringify({
      format:'aura-project', schemaVersion:1, aura:1,          // `aura` kept for v12-era files
      name, saved:new Date().toISOString(), app:'Aura Studio v13',
      contains:{ beat:true, melody:true, arrangement:true, mixer:true,
                 vocalTakes:false, importedAudio:false },       // explicit: audio is NOT embedded
      state:serialize()},null,1)],{type:'application/json'});
    const url=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url; a.download=name.replace(/[^\w\- ]/g,'')+'.aura'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),4000); setDirty(false); toast('Saved '+a.download); }

  // Validate-then-commit. Nothing from a project file is ever executed — it is parsed as
  // data, field-checked, clamped by applyState, and rejected with a readable message if bad.
  function validateProject(o,fileName){
    if(o===null||typeof o!=='object'||Array.isArray(o)) return {ok:false,msg:'That file does not contain a project.'};
    const st = (o.state && typeof o.state==='object') ? o.state : o;   // bare-state files still load
    if(o.format && o.format!=='aura-project') return {ok:false,msg:`“${o.format}” is not an Aura project file.`};
    if(o.schemaVersion && o.schemaVersion>1)
      return {ok:false,msg:`This project was saved by a newer version of Aura (schema ${o.schemaVersion}). Update Aura to open it.`};
    if(!st.pat && !st.mel && st.bpm===undefined)
      return {ok:false,msg:'That file is missing its song data, so there is nothing to open.'};
    if(st.pat!==undefined && !Array.isArray(st.pat)) return {ok:false,msg:'This project file looks damaged (bad pattern data).'};
    if(st.mel!==undefined && !Array.isArray(st.mel)) return {ok:false,msg:'This project file looks damaged (bad melody data).'};
    // unknown/future keys are simply ignored; applyState reads only what it knows and clamps it
    return {ok:true, state:st, name:(typeof o.name==='string'&&o.name.trim())||fileName.replace(/\.aura$/i,'')};
  }
  function openProjectFile(file){
    const fr=new FileReader();
    fr.onerror=()=>toast('Could not read that file.');
    fr.onload=()=>{
      let parsed;
      try{ parsed=JSON.parse(fr.result); }
      catch(e){ toast('That file is not valid JSON, so it cannot be opened.'); return; }
      const v=validateProject(parsed,file.name);
      if(!v.ok){ toast(v.msg); return; }
      const rollback=snapshot();
      try{
        restore(JSON.stringify(v.state)); projName=v.name;
        hist.past.length=0; hist.future.length=0; hist.last=snapshot(); setDirty(false);
        const noAudio=(parsed.contains&&parsed.contains.vocalTakes===false);
        toast('Opened '+projName+(noAudio?' — vocals and imported audio are not stored in project files':''));
      }catch(e){ restore(rollback); toast('That project could not be loaded, so nothing was changed.'); }
    };
    fr.readAsText(file); }

  let metOn=false;
  let storageWarned=false;
  function autosave(){
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
    if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(url).then(()=>toast('🔗 Link copied — paste it anywhere'),()=>toast('Link is in your address bar')); }
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
  exportBtn.addEventListener('click',async e=>{ const b=e.currentTarget, old=b.textContent; b.textContent='Rendering…'; b.classList.add('disabled'); try{ await exportWav(); b.textContent='✓ Saved'; }catch(err){ b.textContent='Export failed'; console.error(err);} setTimeout(()=>{ b.classList.remove('disabled'); updateExportLabel(); },1500); });
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
    const t=e.target, typing=t.tagName==='INPUT'||t.tagName==='SELECT'||t.tagName==='TEXTAREA'||t.isContentEditable;
    const meta=e.metaKey||e.ctrlKey;
    if(meta&&e.key.toLowerCase()==='z'){ e.preventDefault(); e.shiftKey?redo():undo(); return; }
    if(meta&&e.key.toLowerCase()==='s'){ e.preventDefault(); saveProject(); return; }
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

  async function loadSampleFile(file){
    if(!file) return;
    smpStatus('Reading '+file.name+'…');
    try{
      ensureCtx();
      const arr=await file.arrayBuffer();
      const buf=await ac.decodeAudioData(arr.slice(0));
      smp.buf=buf; smp.name=file.name; smp.offset=0; smp.rate=1; smp.on=true;
      smpStatus('Analysing tempo and key…');
      await new Promise(r=>setTimeout(r,10));
      smp.bpm=detectBPM(buf);
      const k=detectKey(buf); smp.key=k.key; smp.mode=k.mode; smp.conf=k.conf;
      const off=document.getElementById('smpOff'); off.max=Math.max(1,Math.floor(buf.duration*10)); off.value=0;
      document.getElementById('smpCtrls').style.display='';
      document.getElementById('smpBpm').value=smp.bpm;
      document.getElementById('smpKey').value=String(smp.key);
      document.getElementById('smpMode').value=smp.mode;
      document.getElementById('smpToggle').disabled=false; document.getElementById('smpClear').disabled=false;
      document.getElementById('smpToggle').textContent='■ Exclude from track';
      document.getElementById('smpDrop').textContent='Loaded — drop another to replace';
      smp.detBpm=smp.bpm; smp.detKey=smp.key; smp.detMode=smp.mode;   // remember for "reset to detected"
      const conf = smp.conf>0.55?'good':smp.conf>0.35?'fair':'low';
      smpStatus(`${file.name} · ${buf.duration.toFixed(1)}s · estimated ${smp.bpm} BPM · estimated ${NOTE_NAMES[smp.key]}${smp.mode==='minor'?'m':''} · confidence ${conf} — check this result`);
      drawWave(); refreshSmpRate(); buildRemixPlan(); refreshImportList(); showAudioTab(true);
      toast('Audio imported — see the remix plan');
    }catch(e){ console.warn(e);
      const big = file.size>80*1024*1024;
      const msg = big ? `“${file.name}” is ${(file.size/1048576).toFixed(0)} MB — too large to decode in the browser. Try a shorter clip.`
        : !/audio|wav|mp3|m4a|aac|ogg|flac/i.test(file.type+file.name)
          ? `“${file.name}” is not an audio file Aura can read. Use WAV, MP3 or M4A.`
          : `Could not decode “${file.name}”. The file may be corrupted or use an unsupported codec — try exporting it again as WAV or MP3.`;
      smpStatus(msg); toast(msg); }
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
    refreshSmpRate(); autosave();
    toast(done.length?('Applied: '+done.join(' · ')):'Nothing selected');
  }

  // Importing is an entry route in the Browser, not a songwriting stage. Selecting an import
  // reveals the contextual Audio Editor tab; removing it hides the tab again.
  function showAudioTab(on){
    const t=document.querySelector('.wtab[data-v="smp"]'); if(!t) return;
    t.hidden=!on;
    if(on){ t.click(); }
    else if(t.getAttribute('aria-selected')==='true'){ document.querySelector('.wtab[data-v="rack"]').click(); }
  }
  function refreshImportList(){
    const host=document.getElementById('importList'); if(!host) return;
    host.innerHTML='';
    if(!smp.buf) return;
    const d=document.createElement('div'); d.className='impitem on';
    d.innerHTML=`<div style="min-width:0;flex:1"><b>${smp.name}</b>
      <span>${smp.buf.duration.toFixed(1)}s · ${smp.bpm} BPM · ${NOTE_NAMES[smp.key]}${smp.mode==='minor'?'m':''}</span></div>`;
    d.addEventListener('click',()=>showAudioTab(true));
    host.appendChild(d);
  }
  function wireBrowserTabs(){
    document.querySelectorAll('.btab').forEach(b=>b.addEventListener('click',()=>{
      document.querySelectorAll('.btab').forEach(x=>x.classList.toggle('on',x===b));
      const imports=b.dataset.b==='imports';
      document.getElementById('vgrid').hidden=imports;
      document.getElementById('importPane').hidden=!imports;
    }));
    document.getElementById('importPick').addEventListener('click',()=>document.getElementById('smpPick').click());
  }
  function wireSamplePanel(){
    const pick=document.getElementById('smpPick'), drop=document.getElementById('smpDrop');
    const fi=document.createElement('input'); fi.type='file'; fi.accept='audio/*'; fi.hidden=true; document.body.appendChild(fi);
    fi.addEventListener('change',()=>{ if(fi.files&&fi.files[0]) loadSampleFile(fi.files[0]); fi.value=''; });
    pick.addEventListener('click',()=>fi.click());
    const panel=document.getElementById('smpPanel');
    ['dragenter','dragover'].forEach(ev=>panel.addEventListener(ev,e=>{ e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave','drop'].forEach(ev=>panel.addEventListener(ev,e=>{ e.preventDefault(); if(ev==='dragleave') drop.classList.remove('over'); }));
    panel.addEventListener('drop',e=>{ drop.classList.remove('over');
      const f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0]; if(f) loadSampleFile(f); });
    document.getElementById('smpToggle').addEventListener('click',e=>{ smp.on=!smp.on;
      e.currentTarget.textContent=smp.on?'■ Exclude from track':'▶ Include in track';
      if(!smp.on) stopSample(); else if(playing){ stopSample(); sampleSrc=scheduleSample(ac,liveBus,now()+.05,null); } });
    document.getElementById('smpClear').addEventListener('click',()=>{ stopSample(); smp.buf=null; smp.on=false; smp.bpm=0;
      document.getElementById('smpWave').classList.remove('on'); document.getElementById('smpCtrls').style.display='none';
      document.getElementById('smpPlan').style.display='none'; document.getElementById('smpToggle').disabled=true;
      document.getElementById('smpClear').disabled=true; document.getElementById('smpDrop').textContent='Drop audio here';
      smpStatus('No sample loaded'); refreshImportList(); showAudioTab(false); });
    document.getElementById('smpHalf').addEventListener('change',e=>{ smp.half=e.target.checked; refreshSmpRate();
      if(playing){ stopSample(); sampleSrc=scheduleSample(ac,liveBus,now()+.05,null); } });
    document.getElementById('smpHP').addEventListener('input',e=>{ smp.hp=+e.target.value;
      document.getElementById('smpHPV').textContent=smp.hp+' Hz';
      if(liveBus&&liveBus.sampleHP) liveBus.sampleHP.frequency.value=smp.hp; });
    document.getElementById('smpOff').addEventListener('input',e=>{ smp.offset=(+e.target.value)/10;
      document.getElementById('smpOffV').textContent=smp.offset.toFixed(1)+' s'; drawWave(); });
    document.getElementById('smpBpm').addEventListener('change',e=>{ const v=+e.target.value;
      if(v>=40&&v<=220){ smp.bpm=v; refreshSmpRate(); buildRemixPlan();
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
      refreshSmpRate(); buildRemixPlan(); refreshImportList(); toast('Back to Aura’s detected values'); });
    bpmEl.addEventListener('input',refreshSmpRate);
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
    {id:'song',   label:'Arrange your song', view:'play'},
    {id:'voice',  label:'Record your voice', view:'voc'},
    {id:'export', label:'Export',            view:'rack'},
  ];
  let guided=false, railStep=0, railHidden=false;
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
      if(STEPS_RAIL[railStep].id==='export') toast('Press Export WAV in the top bar when you are ready'); }));
    document.getElementById('railHide').addEventListener('click',()=>{ railHidden=true; r.classList.add('hide');
      try{ localStorage.setItem('aura-rail','hidden'); }catch(e){} });
    r.classList.toggle('hide',railHidden);
  }
  function wireWelcome(){
    const w=document.getElementById('welcome');
    const close=()=>{ w.classList.remove('on'); try{ localStorage.setItem('aura-seen','1'); }catch(e){} };
    w.querySelectorAll('.wopt').forEach(b=>b.addEventListener('click',()=>{
      const k=b.dataset.w; close();
      if(k==='vibe'){ setMode(true); railStep=0; buildRail(); showView('rack'); document.getElementById('browser').classList.add('open');
        toast('Tap a vibe tile on the left to start'); }
      else if(k==='beat'){ setMode(true); railStep=1; buildRail(); showView('rack'); toast('Click the grid to place drums'); }
      else if(k==='melody'){ setMode(true); railStep=2; buildRail(); showView('piano'); toast('Click the grid to draw notes — Stay in key keeps them right'); }
      else if(k==='record'){ setMode(true); railStep=4; buildRail(); showView('voc'); toast('Headphones on, then press Record'); }
      else if(k==='sample'){ setMode(false); showView('smp'); toast('Drop an instrumental into the Sample panel'); }
      else if(k==='open'){ setMode(false); const f=document.getElementById('auraFile'); if(f) f.click(); }
    }));
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
  function buildVibeTiles(){
    const host=document.getElementById('vgrid'); if(!host) return;
    Object.keys(VIBES).forEach(k=>{
      const v=VIBES[k], parts=v.label.split('·').map(s=>s.trim());
      const beat=BEATS[v.beat]||{}, hits=new Set([...(beat.kick||[]),...(beat.snare||[]),...(beat.clap||[])]);
      const bars=Array.from({length:8},(_,i)=>`<s style="height:${hits.has(i*2)?12:hits.has(i*2+1)?7:3}px"></s>`).join('');
      const isMin=v.mode!=='major';
      const b=document.createElement('button');
      b.className='vtile'; b.dataset.k=k; b.type='button';
      b.setAttribute('aria-label',`${v.label}, ${v.bpm} BPM, ${NOTE_NAMES[v.key]}${isMin?' minor':' major'}`);
      b.innerHTML=`<span class="art"><i></i><b>${bars}</b></span>
        <span class="meta"><span class="nm">${parts[0]||v.label}</span>
        <span class="sub2">${parts[1]?parts[1]+' · ':''}${v.bpm} BPM · ${NOTE_NAMES[v.key]}${isMin?'m':''}</span></span>`;
      b.addEventListener('click',()=>applyVibe(k));
      host.appendChild(b);
    });
  }
  function markVibeTile(k){ document.querySelectorAll('#vgrid .vtile').forEach(t=>t.classList.toggle('on',t.dataset.k===k)); }

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
      b.id=id; b.textContent=txt; b.className='ghost iconbtn '+(cls||''); b.title=label; b.setAttribute('aria-label',label); return b; };
    const recX=mk('recX','●','Record vocals','rec2'); recX.style.color='var(--rec)';
    const metX=mk('metX','🎵','Metronome');
    mid.insertBefore(recX, $('modeSeg'));
    mid.insertBefore(metX, $('modeSeg'));
    const undoX=mk('undoX','↶','Undo (Cmd/Ctrl+Z)'), redoX=mk('redoX','↷','Redo (Shift+Cmd/Ctrl+Z)');
    const newX=mk('newX','✦','New project'), openX=mk('openX','↥','Open .aura project'), saveX=mk('saveX','↧','Save .aura project (Cmd/Ctrl+S)');
    const recentX=mk('recentX','◷','Recent projects'), helpX=mk('helpX','?','Help and shortcuts');
    [undoX,redoX,newX,openX,recentX,saveX,helpX].forEach(b=>right.appendChild(b));
    recentX.addEventListener('click',openRecent);
    helpX.addEventListener('click',()=>$('help').classList.add('on'));
    const midiX=mk('midiX','♪','Export MIDI (melody + chords)');
    midiX.addEventListener('click',exportMidi); right.appendChild(midiX);
    ['mixBtn','share','export'].forEach(id=>{ const el=$(id); if(el) right.appendChild(el); });
    const fi=document.createElement('input'); fi.type='file'; fi.accept='.aura,application/json'; fi.id='auraFile'; fi.hidden=true;
    document.body.appendChild(fi);
    fi.addEventListener('change',()=>{ if(fi.files&&fi.files[0]) openProjectFile(fi.files[0]); fi.value=''; });
    recX.addEventListener('click',()=>{ recording?stopRecording():startRecording(); });
    metX.addEventListener('click',()=>{ metOn=!metOn; metX.classList.toggle('on',metOn);
      metX.setAttribute('aria-pressed',String(metOn)); toast(metOn?'Metronome on':'Metronome off'); });
    undoX.addEventListener('click',undo); redoX.addEventListener('click',redo);
    newX.addEventListener('click',newProject); saveX.addEventListener('click',saveProject);
    openX.addEventListener('click',()=>fi.click());
    oldHeader.remove();

    $('browserHost').appendChild($('vibes'));                 // keeps legacy #vibes handler alive
    $('inspectHost').appendChild(q('.keybar'));
    $('v-rack').appendChild(q('.toolbar'));
    $('v-rack').appendChild(q('.grid-wrap'));
    $('v-piano').appendChild(q('.proll'));
    const songPanel=[...document.querySelectorAll('.song')].find(el=>el.id!=='vocals');
    if(songPanel) $('v-play').appendChild(songPanel);
    $('v-voc').appendChild($('vocals'));
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
    }));
    const tg=(btn,panel)=>{ const b=$(btn); if(b) b.addEventListener('click',()=>$(panel).classList.toggle('open')); };
    tg('tgBrowser','browser'); tg('tgInspect','inspect');
    // tempo/swing/master live in the transport on wide screens and fold into the Inspector on narrow ones
    const ctrls=[...right.querySelectorAll('.ctrl')];
    const mqW=window.matchMedia('(min-width:1181px)');
    const placeCtrls=()=>{ const wide=mqW.matches;
      ctrls.forEach(c=>{ c.classList.toggle('hideSm',wide);
        (wide?right:$('inspectHost')).insertBefore(c, wide?right.firstChild:$('inspectHost').firstChild); }); };
    placeCtrls(); (mqW.addEventListener?mqW.addEventListener('change',placeCtrls):mqW.addListener(placeCtrls));
    window.addEventListener('resize',placeCtrls);

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
    document.querySelectorAll('#grid .cell').forEach(c=>{ c.setAttribute('role','gridcell'); c.tabIndex=-1; });
    document.querySelectorAll('.strip .mb').forEach(b=>b.setAttribute('aria-label','Mute this channel'));
    document.querySelectorAll('.strip .sb').forEach(b=>b.setAttribute('aria-label','Solo this channel'));
    document.body.classList.add('shell'); $('app').hidden=false;
  }
  function updateReadout(){ const el=document.getElementById('readout'); if(!el) return;
    const bar=mode==='song'?slotIndex+1:1, beat=Math.floor(step/4)+1;
    el.textContent=`${bar} · ${beat}`; }

  // ---------- init ----------
  buildPianoRoll(); buildMixer(); buildGrid(); buildPatBar(); buildSong(); buildSectionNames(); buildVibeTiles();
  mountShell(); wireSamplePanel(); wireBrowserTabs();
  try{ railHidden=localStorage.getItem('aura-rail')==='hidden'; }catch(e){}
  buildRail(); wireWelcome(); fillDatafield();
  try{ if(localStorage.getItem('aura-mode')==='guided') setMode(true); }catch(e){}
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
})();
