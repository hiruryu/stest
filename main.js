function parseRatio(ratioStr) {
    const [num, denom] = ratioStr.split('/').map(Number);
    return denom ? num / denom : num;
  }
  
  function parseDuration(durStr) {
    const [num, denom] = durStr.split('/').map(Number);
    return denom ? num / denom : num;
  }
  
  function expandRhythmInput(raw) {
    const tokens = raw.match(/\[.*?\]x\d+|\(.*?\)|[^\s,]+/g);
    const result = [];
    let lastValue = null;
  
    tokens.forEach(token => {
      if (/^\[.*\]x\d+$/.test(token)) {
        // 繰り返しパターン
        const [_, group, count] = token.match(/^\[(.*)\]x(\d+)$/);
        const expandedGroup = expandRhythmInput(group);
        for (let i = 0; i < parseInt(count); i++) {
          result.push(...expandedGroup);
        }
      } else if (/^\(.*\)$/.test(token)) {
        // 休符（無音）
        const inner = token.slice(1, -1);
        const silentDurations = expandRhythmInput(inner);
        result.push(...silentDurations.map(() => null)); // null で休符表現
      } else if (token === '=') {
        if (lastValue != null) result.push(lastValue);
      } else {
        const duration = parseDuration(token);
        lastValue = duration;
        result.push(duration);
      }
    });
  
    return result;
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
      gain.gain.value = 0.3;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const startTime = t0 + i * 0.3;
      osc.start(startTime);
      osc.stop(startTime + 0.3);
    });
  }
  
  function playRhythmBeats(durations) {
    if (!durations.length) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const beatMs = parseFloat(document.getElementById('beatDurationInput').value) || 500;
    const beatSec = beatMs / 1000;
    let t0 = ctx.currentTime;
  
    durations.forEach(dur => {
      if (dur !== null) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = 1000;
        gain.gain.value = 0.3;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.03);
      }
      t0 += (dur || 1) * beatSec; // null のときは無音1拍扱いにする
    });
}
  
  document.getElementById('playResearch').addEventListener('click', () => {
    const raw = document.getElementById('ratioInput').value;
    const ratios = getRatioArray(raw);
    const status = document.getElementById('status');
    if (!ratios.length) {
      status.textContent = '有効な比率が見つかりません。形式を確認してください。';
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
      status.textContent = '有効な拍数が見つかりません。形式を確認してください。';
      return;
    }
    const show = durations.map(d => typeof d === 'object' ? `(${d.value})` : d);
    status.textContent = `再生中ビート: ${show.join(' , ')} 拍`;
    playRhythmBeats(durations);
  });
  
  document.querySelectorAll('.usage-toggle').forEach(button => {
    button.addEventListener('click', () => {
      const target = document.getElementById(button.dataset.target);
      if (target.style.display === 'none') {
        target.style.display = 'block';
        button.textContent = '使い方を隠す';
      } else {
        target.style.display = 'none';
        button.textContent = '使い方を表示';
      }
    });
  });  