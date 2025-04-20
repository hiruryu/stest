function parseRatio(ratioStr) {
  const [num, denom] = ratioStr.split('/').map(Number);
  return denom ? num/denom : num;
}

function parseDuration(durStr) {
  const [num, denom] = durStr.split('/').map(Number);
  return denom ? num/denom : num;
}

function getRatioArray(raw) {
  return raw.split(',')
    .map(s => s.trim())
    .filter(s => /^\d+(\/\d+)?$/.test(s))
    .map(parseRatio);
}

function playScaleRatios(ratios) {
  if (!ratios.length) return;
  const ctx = new (window.AudioContext||window.webkitAudioContext)();
  const base = parseFloat(document.getElementById('baseFreqInput').value)||440;
  let t = ctx.currentTime;

  ratios.forEach((r,i) => {
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = base * r;
    gain.gain.value = 0.4;
    osc.connect(gain); gain.connect(ctx.destination);
    const start = t + i*0.3;
    osc.start(start);
    osc.stop(start + 0.3);
  });
}


function tokenize(str) {
  const re = /\[.*?\]x\d+|\(.*?\)|=|\d+(?:\/\d+)?/g;
  return str.match(re) || [];
}

function expandRhythmInput(raw) {
  const tokens = tokenize(raw);
  const result = [];
  let lastDur = null;

  tokens.forEach(tok => {
    let m;
    if (m = tok.match(/^\[(.*)\]x(\d+)$/)) {
      const [_, grp, cnt] = m;
      const sub = expandRhythmInput(grp);
      for (let i=0;i<+cnt;i++) result.push(...sub);
      return;
    }
    if (m = tok.match(/^\((.*)\)$/)) {
      const inner = m[1].trim();
      const sub = expandRhythmInput(inner);
      sub.forEach(o => result.push({ value: o.value, isRest: true }));
      lastDur = sub[sub.length-1]?.value ?? lastDur;
      return;
    }
    if (tok === '=') {
      if (lastDur != null) result.push({ value: lastDur, isRest: false });
      return;
    }
    if (/^\d+(?:\/\d+)?$/.test(tok)) {
      const dur = parseDuration(tok);
      result.push({ value: dur, isRest: false });
      lastDur = dur;
      return;
    }
  });

  return result;
}

function playRhythmBeats(sequence) {
  if (!sequence.length) return;
  const ctx = new (window.AudioContext||window.webkitAudioContext)();
  const beatMs = parseFloat(document.getElementById('beatDurationInput').value)||500;
  const beatSec = beatMs/1000;
  let t = ctx.currentTime;

  sequence.forEach(({ value, isRest }) => {
    if (!isRest) {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 1000;
      gain.gain.value = 0.4;
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.03);
    }
    t += value * beatSec;
  });
}

function expandPolyrhythm(raw) {
  return raw.split(';').map(track => expandRhythmInput(track.trim()));
}

function playPolyrhythm(raw) {
  const tracks = expandPolyrhythm(raw);
  const ctx = new (window.AudioContext||window.webkitAudioContext)();
  const beatMs = parseFloat(document.getElementById('beatDurationInput').value)||500;
  const beatSec = beatMs/1000;

  const lengths = tracks.map(seq => seq.reduce((s,o)=>
    s + (o.value||0), 0));
  const maxLen = Math.max(...lengths);

  tracks.forEach((seq, ti) => {
    let t = ctx.currentTime;
    let total = seq.reduce((s,o)=>s + (o.value||0),0);

    if (total < maxLen) {
      seq.push({ value: maxLen - total, isRest: true });
    }
    seq.forEach(({ value, isRest }) => {
      if (!isRest) {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = ['square','sine','triangle','sawtooth'][ti%4];
        osc.frequency.value = 800 + 400*ti;
        gain.gain.value = 0.4;
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.03);
      }
      t += value * beatSec;
    });
  });
}

document.getElementById('playResearch').addEventListener('click', ()=>{
  const raw = document.getElementById('ratioInput').value;
  const arr = getRatioArray(raw);
  const st = document.getElementById('status');
  if (!arr.length) {
    st.textContent = '有効な比率がありません。'; return;
  }
  st.textContent = `再生中: ${arr.map(r=>r.toFixed(3)).join(' , ')}`;
  playScaleRatios(arr);
});

document.getElementById('playRhythm').addEventListener('click', ()=>{
  const raw = document.getElementById('rhythmInput').value;
  const seq = expandRhythmInput(raw);
  const st = document.getElementById('rhythmStatus');
  if (!seq.length) {
    st.textContent = '有効な拍数がありません。'; return;
  }
  st.textContent = `再生中ビート: ${seq.map(o=>
    o.isRest?`(rest ${o.value})`:o.value
  ).join(' , ')} 拍`;
  playRhythmBeats(seq);
});

document.getElementById('playPolyrhythm').addEventListener('click', ()=>{
  const raw = document.getElementById('polyrhythmInput').value;
  const st = document.getElementById('polyrhythmStatus');
  const tracks = expandPolyrhythm(raw);
  if (!tracks.length) {
    st.textContent = 'ポリリズム入力が無効です。'; return;
  }
  st.textContent = 'ポリリズム再生中…';
  playPolyrhythm(raw);
});

document.querySelectorAll('.usage-toggle').forEach(b=>{
  b.addEventListener('click', ()=>{
    const id = b.dataset.target;
    const el = document.getElementById(id);
    el.style.display = el.style.display==='none'?'block':'none';
  });
});
