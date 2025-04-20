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
    .filter(s => /^\d+(?:\/\d+)?$/.test(s))
    .map(parseRatio);
}

function playScaleRatios(ratios) {
  if (!ratios.length) return;
  const ctx = new (window.AudioContext||window.webkitAudioContext)();
  const base = parseFloat(document.getElementById('baseFreqInput').value)||440;
  let t = ctx.currentTime;

  ratios.forEach((r,i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = base * r;
    gain.gain.value = 0.4;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const start = t + i*0.3;
    osc.start(start);
    osc.stop(start + 0.3);
  });
}

function tokenize(str) {
  const tokens = [];
  let buffer = '';
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '[' || c === '(') {
      if (depth === 0 && buffer) {
        tokens.push(buffer.trim());
        buffer = '';
      }
      buffer += c;
      depth++;
    } else if ((c === ']' || c === ')') && depth > 0) {
      buffer += c;
      depth--;
      if (depth === 0) {
        
        let j = i+1;
        let rep = '';
        while (j < str.length && str[j] === 'x' || /\d/.test(str[j])) rep += str[j++];
        if (/^x\d+$/.test(rep)) {
          buffer += rep;
          i = j - 1;
        }
        tokens.push(buffer.trim());
        buffer = '';
      }
    } else if (c === ',' && depth === 0) {
      if (buffer) {
        tokens.push(buffer.trim());
        buffer = '';
      }
    } else {
      buffer += c;
    }
  }
  if (buffer.trim()) tokens.push(buffer.trim());
  return tokens;
}

function expandRhythmInput(raw) {
  const tokens = tokenize(raw);
  const result = [];
  let lastDur = null;

  tokens.forEach(tok => {
    let m;
    if (m = tok.match(/^\[(.*)\]x(\d+)$/)) {
      const group = m[1];
      const count = parseInt(m[2],10);
      const sub = expandRhythmInput(group);
      for (let i=0;i<count;i++) result.push(...sub);
      return;
    }
    
    if (m = tok.match(/^\((.*)\)$/)) {
      const inner = m[1].trim();
      const sub = expandRhythmInput(inner);
      sub.forEach(() => result.push(null));
      return;
    }
    if (tok === '=') {
      if (lastDur != null) result.push(lastDur);
      return;
    }
    if (/^\d+(?:\/\d+)?$/.test(tok)) {
      const dur = parseDuration(tok);
      result.push(dur);
      lastDur = dur;
      return;
    }
  });

  return result;
}

function playRhythmBeats(durations) {
  if (!durations.length) return;
  const ctx = new (window.AudioContext||window.webkitAudioContext)();
  const beatMs = parseFloat(document.getElementById('beatDurationInput').value)||500;
  const beatSec = beatMs/1000;
  let t = ctx.currentTime;

  durations.forEach(d => {
    const dur = d===null?0:d;
    if (d !== null) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 1000;
      gain.gain.value = 0.4;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.03);
    }
    t += dur * beatSec;
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

  const lengths = tracks.map(seq => seq.reduce((s,v)=>s + (v||0),0));
  const maxLen = Math.max(...lengths);

  tracks.forEach((seq,idx) => {
    let t = ctx.currentTime;
    let total = seq.reduce((s,v)=>s + (v||0),0);
    if (total < maxLen) seq.push(...Array(Math.ceil((maxLen-total)/(seq[seq.length-1]||1))).fill(null));
    seq.forEach(d => {
      if (d !== null) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = ['square','sine','triangle','sawtooth'][idx%4];
        osc.frequency.value = 800 + idx*400;
        gain.gain.value = 0.4;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.03);
      }
      t += (d||0)*beatSec;
    });
  });
}

document.getElementById('playResearch').addEventListener('click',()=>{
  const raw = document.getElementById('ratioInput').value;
  const arr = getRatioArray(raw);
  const st = document.getElementById('status');
  if(!arr.length){st.textContent='有効な比率がありません'; return;}
  st.textContent=`再生中: ${arr.map(r=>r.toFixed(3)).join(' , ')}`;
  playScaleRatios(arr);
});

document.getElementById('playRhythm').addEventListener('click',()=>{
  const raw = document.getElementById('rhythmInput').value;
  const seq = expandRhythmInput(raw);
  const st = document.getElementById('rhythmStatus');
  if(!seq.length){st.textContent='有効な拍数がありません'; return;}
  st.textContent=`再生中ビート: ${seq.map(d=>d===null?`(rest)`:d).join(' , ')} 拍`;
  playRhythmBeats(seq);
});

document.getElementById('playPolyrhythm').addEventListener('click',()=>{
  const raw=document.getElementById('polyrhythmInput').value;
  const st=document.getElementById('polyrhythmStatus');
  const tracks=expandPolyrhythm(raw);
  if(!tracks.length){st.textContent='ポリリズム入力が無効です';return;}
  st.textContent='ポリリズム再生中…';
  playPolyrhythm(raw);
});

document.querySelectorAll('.usage-toggle').forEach(b=>{
  b.addEventListener('click',()=>{
    const id=b.dataset.target;
    const el=document.getElementById(id);
    el.style.display=el.style.display==='none'?'block':'none';
  });
});
