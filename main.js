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
    .filter(s => /^\d+(\/\d+)?$/.test(s))
    .map(parseRatio);
}

function playScaleRatios(ratios) {
  if (!ratios.length) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  const baseFreq = parseFloat(document.getElementById('baseFreqInput').value) || 440;
  let t0 = ctx.currentTime;

  ratios.forEach((r, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = baseFreq * r;
    gain.gain.value = 0.4;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const startTime = t0 + i * 0.3;
    osc.start(startTime);
    osc.stop(startTime + 0.3);
  });
}

function expandRhythmInput(raw) {
  const result = [];

  function helper(str) {
    const tokens = [];
    let buffer = '';
    let depth = 0;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (char === '[') {
        if (depth > 0) buffer += char;
        depth++;
      } else if (char === ']') {
        depth--;
        if (depth === 0) {
          tokens.push('[' + buffer + ']');
          buffer = '';
        } else {
          buffer += char;
        }
      } else if ((char === ',' || char === 'x') && depth === 0) {
        if (buffer.trim()) tokens.push(buffer.trim());
        buffer = '';
        if (char === 'x') {
          let j = i + 1;
          while (j < str.length && /\d/.test(str[j])) buffer += str[j++];
          tokens.push('x' + buffer);
          buffer = '';
          i = j - 1;
        }
      } else {
        buffer += char;
      }
    }
    if (buffer.trim()) tokens.push(buffer.trim());

    let i = 0;
    while (i < tokens.length) {
      const token = tokens[i];
      if (/^\[.*\]$/.test(token)) {
        const inner = token.slice(1, -1);
        let repeat = 1;
        if (tokens[i + 1] && /^x\d+$/.test(tokens[i + 1])) {
          repeat = parseInt(tokens[i + 1].slice(1), 10);
          i++;
        }
        const sub = helper(inner);
        for (let j = 0; j < repeat; j++) result.push(...sub);
      } else if (/^\(.*\)$/.test(token)) {
        const inner = token.slice(1, -1).trim();
        const vals = helper(inner);
        vals.forEach(_ => result.push(null));
      } else if (token === '=') {
        if (result.length > 0) {
          result.push(result[result.length - 1]);
        }
      } else if (/^\d+(\/\d+)?$/.test(token)) {
        const dur = parseDuration(token);
        result.push(dur);
      }
      i++;
    }

    return result;
  }

  return helper(raw);
}

function playRhythmBeats(durations) {
  if (!durations.length) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  const beatMs = parseFloat(document.getElementById('beatDurationInput').value) || 500;
  const beatSec = beatMs / 1000;
  let t0 = ctx.currentTime;

  durations.forEach(d => {
    const dur = d === null ? 0 : d;
    if (d !== null) {
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
    t0 += dur * beatSec;
  });
}

function expandPolyrhythm(raw) {
  return raw.split(';').map(track => expandRhythmInput(track.trim()));
}

function playPolyrhythm(raw) {
  const tracks = expandPolyrhythm(raw);
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  const beatMs = parseFloat(document.getElementById('beatDurationInput').value) || 500;
  const beatSec = beatMs / 1000;

  const lengths = tracks.map(arr => arr.reduce((sum, v) => sum + (v||0), 0));
  const maxLen = Math.max(...lengths);

  tracks.forEach((durs, ti) => {
    let t0 = ctx.currentTime;
    let total = durs.reduce((s, v) => s + (v||0), 0);
    if (total < maxLen) {
      durs = durs.concat(Array(Math.ceil((maxLen - total) / (durs[durs.length-1]||1))).fill(null));
    }
    durs.forEach(d => {
      if (d != null) {
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
      t0 += (d || 0) * beatSec;
    });
  });
}

document.getElementById('playResearch').addEventListener('click', () => {
  const raw = document.getElementById('ratioInput').value;
  const ratios = getRatioArray(raw);
  const status = document.getElementById('status');
  if (!ratios.length) {
    status.textContent = '有効な比率が見つかりません。';
    return;
  }
  status.textContent = `再生中: ${ratios.map(r => r.toFixed(3)).join(' , ')}`;
  playScaleRatios(ratios);
});

document.getElementById('playRhythm').addEventListener('click', () => {
  const raw = document.getElementById('rhythmInput').value;
  const durations = expandRhythmInput(raw);
  const status = document.getElementById('rhythmStatus');
  if (!durations.length) {
    status.textContent = '有効な拍数が見つかりません。';
    return;
  }
  const disp = durations.map(d => d === null ? `(rest)` : d).join(' , ');
  status.textContent = `再生中ビート: ${disp} 拍`;
  playRhythmBeats(durations);
});

document.querySelectorAll('.usage-toggle').forEach(button => {
  button.addEventListener('click', () => {
    const targetId = button.getAttribute('data-target');
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
      targetElement.classList.toggle('visible');
      targetElement.style.display = targetElement.classList.contains('visible') ? 'block' : 'none';
    }
  });
});

document.getElementById('playPolyrhythm')?.addEventListener('click', () => {
  const raw = document.getElementById('polyrhythmInput').value;
  const status = document.getElementById('polyrhythmStatus');
  const patterns = expandPolyrhythm(raw);
  if (!patterns.length) {
    status.textContent = 'ポリリズムの入力が無効です。';
    return;
  }
  status.textContent = '再生中ポリリズム...';
  playPolyrhythm(raw);
});

