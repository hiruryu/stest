function parseRatio(ratioStr) {
  const [num, denom] = ratioStr.split('/').map(Number);
  return denom ? num / denom : num;
}

function parseDuration(durStr) {
  const [num, denom] = durStr.split('/').map(Number);
  return denom ? num / denom : num;
}

function getRatioArray(raw) {
  return raw.split(',')
    .map(s => s.trim())
    .filter(s => /^\d+(?:\/\d+)?$/.test(s))
    .map(parseRatio);
}

function playScaleRatios(ratios) {
  if (!ratios.length) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const base = parseFloat(document.getElementById('baseFreqInput').value) || 440;
  let t0 = ctx.currentTime;

  ratios.forEach((r, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = base * r;
    gain.gain.value = 0.4;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const start = t0 + i * 0.3;
    osc.start(start);
    osc.stop(start + 0.3);
  });
}

function tokenize(str) {
  const tokens = [];
  let buf = '';
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if ((c === '[' || c === '(') && depth === 0) {
      if (buf.trim()) { tokens.push(buf.trim()); buf = ''; }
      buf += c; depth = 1;
    } else if (depth > 0) {
      buf += c;
      if (c === '[' || c === '(') depth++;
      if (c === ']' || c === ')') depth--;
      if (depth === 0) {
        let j = i + 1, rep = '';
        while (j < str.length && (/^[x0-9]$/.test(str[j]))) { rep += str[j++]; }
        if (/^x\d+$/.test(rep)) { buf += rep; i = j - 1; }
        tokens.push(buf.trim()); buf = '';
      }
    } else if (c === ',') {
      if (buf.trim()) { tokens.push(buf.trim()); buf = ''; }
    } else {
      buf += c;
    }
  }
  if (buf.trim()) tokens.push(buf.trim());
  return tokens;
}

function expandRhythmInput(raw) {
  const tokens = tokenize(raw);
  const seq = [];
  let last = null;

  tokens.forEach(tok => {
    let m;
    if (m = tok.match(/^\[(.*)\]x(\d+)$/)) {
      const group = m[1];
      const count = parseInt(m[2], 10);
      const sub = expandRhythmInput(group);
      for (let k = 0; k < count; k++) seq.push(...sub);
      return;
    }
    if (m = tok.match(/^\((.*)\)$/)) {
      const inner = m[1].trim();
      const sub = expandRhythmInput(inner);
      const total = sub.reduce((sum, o) => sum + o.value, 0);
      seq.push({ value: total, isRest: true });
      last = total;
      return;
    }
    if (tok === '=') {
      if (last != null) seq.push({ value: last, isRest: false });
      return;
    }
    if (/^\d+(?:\/\d+)?$/.test(tok)) {
      const val = parseDuration(tok);
      seq.push({ value: val, isRest: false });
      last = val;
      return;
    }
    // その他無視
  });

  return seq;
}

function playRhythmBeats(sequence) {
  if (!sequence.length) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const beatMs = parseFloat(document.getElementById('beatDurationInput').value) || 500;
  const beatSec = beatMs / 1000;
  let t0 = ctx.currentTime;

  sequence.forEach(item => {
    const { value, isRest } = item;
    if (!isRest) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 1000;
      gain.gain.value = 0.4;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.03);
    }
    t0 += value * beatSec;
  });
}

// --- ポリリズム ---
function expandPolyrhythm(raw) {
  return raw.split(';').map(s => expandRhythmInput(s.trim()));
}

function playPolyrhythm(raw) {
  const tracks = expandPolyrhythm(raw);
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const beatMs = parseFloat(document.getElementById('beatDurationInput').value) || 500;
  const beatSec = beatMs / 1000;

  // 小節長を揃える
  const lengths = tracks.map(seq => seq.reduce((sum, o) => sum + o.value, 0));
  const maxLen = Math.max(...lengths);

  tracks.forEach((seq, ti) => {
    let t0 = ctx.currentTime;
    let total = seq.reduce((sum, o) => sum + o.value, 0);
    if (total < maxLen) seq.push({ value: maxLen - total, isRest: true });

    seq.forEach(({ value, isRest }) => {
      if (!isRest) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = ['square','sine','triangle','sawtooth'][ti % 4];
        osc.frequency.value = 800 + ti * 400;
        gain.gain.value = 0.4;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.03);
      }
      t0 += value * beatSec;
    });
  });
}

// --- イベントバインド ---
document.getElementById('playResearch').addEventListener('click', () => {
  const raw = document.getElementById('ratioInput').value;
  const arr = getRatioArray(raw);
  const st = document.getElementById('status');
  if (!arr.length) { st.textContent = '有効な比率がありません'; return; }
  st.textContent = `再生中: ${arr.map(r => r.toFixed(3)).join(' , ')}`;
  playScaleRatios(arr);
});

document.getElementById('playRhythm').addEventListener('click', () => {
  const raw = document.getElementById('rhythmInput').value;
  const seq = expandRhythmInput(raw);
  const st = document.getElementById('rhythmStatus');
  if (!seq.length) { st.textContent = '有効な拍数がありません'; return; }
  st.textContent = `再生中ビート: ${seq.map(o => o.isRest ? `(rest ${o.value})` : o.value).join(' , ')} 拍`;
  playRhythmBeats(seq);
});

document.getElementById('playPolyrhythm').addEventListener('click', () => {
  const raw = document.getElementById('polyrhythmInput').value;
  const st = document.getElementById('polyrhythmStatus');
  const tracks = expandPolyrhythm(raw);
  if (!tracks.length) { st.textContent = 'ポリリズム入力が無効です'; return; }
  st.textContent = 'ポリリズム再生中…';
  playPolyrhythm(raw);
});

document.querySelectorAll('.usage-toggle').forEach(b => {
  b.addEventListener('click', () => {
    const id = b.dataset.target;
    const el = document.getElementById(id);
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
  });
  function parseChordProgression(raw) {
  const tokens = raw.trim().split(/\s+/);
  const base = parseFloat(document.getElementById('baseFreqInput').value) || 440;
  let currentRoot = base;
  const progression = [];

  tokens.forEach(tok => {
    let m;
    if (tok === '!') {
      currentRoot = base;
      return;
    }
    if (m = tok.match(/^(↑|↓)(\d+(?:\/\d+)?)\[(.+)\]$/)) {
      const dir = m[1] === '↑' ? 1 : -1;
      const ratio = parseRatio(m[2]);
      currentRoot = dir === 1 ? currentRoot * ratio : currentRoot / ratio;
      const intervals = getRatioArray(m[3]);
      progression.push({ root: currentRoot, intervals });
      return;
    }
    if (m = tok.match(/^\[(.+)\]$/)) {
      const intervals = getRatioArray(m[1]);
      progression.push({ root: currentRoot, intervals });
      return;
    }
  });

  return progression;
}

function playChordProgression(chords) {
  if (!chords.length) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const duration = parseFloat(document.getElementById('chordDurationInput').value) || 1;
  let t0 = ctx.currentTime;

  chords.forEach(({ root, intervals }) => {
    intervals.forEach(r => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = root * r;
      gain.gain.value = 0.3;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + duration);
    });
    t0 += duration;
  });
}

document.getElementById('playChords').addEventListener('click', () => {
  const raw = document.getElementById('chordInput').value;
  const st = document.getElementById('chordStatus');
  const chords = parseChordProgression(raw);
  if (!chords.length) {
    st.textContent = '有効なコード進行がありません';
    return;
  }
  st.textContent = `コード進行再生中 (${chords.length} 和音)`;
  playChordProgression(chords);
});
});
