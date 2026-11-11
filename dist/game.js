(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const holes = [...document.querySelectorAll('.hole')];
  const ui = {
    shell: $('#gameShell'), score: $('#score'), best: $('#bestScore'), combo: $('#combo'),
    time: $('#time'), bar: $('#timerBar'), start: $('#startOverlay'), result: $('#resultOverlay'),
    startBtn: $('#startBtn'), againBtn: $('#againBtn'), pauseBtn: $('#pauseBtn'),
    soundBtn: $('#soundBtn'), helpBtn: $('#helpBtn'), help: $('#helpDialog'), closeHelp: $('#closeHelp'),
    finalScore: $('#finalScore'), accuracy: $('#accuracy'), maxCombo: $('#maxCombo'),
    resultTitle: $('#resultTitle'), resultCopy: $('#resultCopy'), toast: $('#toast'), arena: $('#arena')
  };
  ui.homeBtn = $('#homeBtn'); ui.legendHomeBtn = $('#legendHomeBtn'); ui.brandHome = $('#brandHome');
  ui.skinBtn = $('#skinBtn'); ui.currentSkinName = $('#currentSkinName'); ui.skinDialog = $('#skinDialog');
  ui.closeSkin = $('#closeSkin'); ui.skinOptions = [...document.querySelectorAll('.skin-option[data-skin]')];
  ui.closeSkinDone = $('#closeSkinDone'); ui.goldSkinOptions = [...document.querySelectorAll('.skin-option[data-gold-skin]')];
  ui.catSkinOptions = [...document.querySelectorAll('.skin-option[data-cat-skin]')];

  const WORDS = ['DEADLINE', 'BUG', '早八', '周报', '内耗', '已读', '开会', '改需求', 'KPI'];
  const MODES = {
    chill: { duration: 30, minGap: 360, maxGap: 660, upMin: 620, upMax: 980, cat: .11, gold: .13 },
    rage: { duration: 20, minGap: 210, maxGap: 400, upMin: 410, upMax: 690, cat: .14, gold: .16 }
  };
  const SKINS = { classic: '原生地鼠', boss: '加活领导', meeting: '无效会议', landlord: '催租房东', elite: '傲慢精英' };
  const SKIN_PREFIXES = { classic: '烦恼地鼠', boss: '烦恼领导', meeting: '无效会议', landlord: '催租房东', elite: '傲慢精英' };
  const GOLD_SKINS = { classic: '原生好运', windfall: '天降横财' };
  const CAT_SKINS = { classic: '原生猫猫', slacker: '摸鱼白猫' };
  let selectedMode = 'chill';
  let selectedSkins = (() => {
    try {
      const saved = JSON.parse(localStorage.getItem('stressSmashSkins') || '[]');
      const valid = Array.isArray(saved) ? [...new Set(saved.filter(skin => SKINS[skin]))] : [];
      if (valid.length) return valid;
    } catch (_) { /* Fall back to the legacy single-skin setting. */ }
    const legacy = localStorage.getItem('stressSmashSkin');
    return [SKINS[legacy] ? legacy : 'classic'];
  })();
  let selectedGoldSkin = GOLD_SKINS[localStorage.getItem('stressSmashGoldSkin')] ? localStorage.getItem('stressSmashGoldSkin') : 'windfall';
  let selectedCatSkin = CAT_SKINS[localStorage.getItem('stressSmashCatSkin')] ? localStorage.getItem('stressSmashCatSkin') : 'slacker';
  let running = false, paused = false, soundOn = true;
  let score = 0, combo = 0, topCombo = 0, attempts = 0, hits = 0;
  let startAt = 0, pausedAt = 0, pausedTotal = 0, remaining = 0;
  let spawnTimer = null, frame = null, audio = null, lastHole = -1;
  let best = Number(localStorage.getItem('stressSmashBest') || 0);
  ui.best.textContent = String(best).padStart(3, '0');

  function rand(min, max) { return Math.random() * (max - min) + min; }
  function mode() { return MODES[selectedMode]; }
  function normalSkinSummary() { return selectedSkins.length === 1 ? SKINS[selectedSkins[0]] : `混搭 ${selectedSkins.length} 款`; }
  function updateSkinSummary() { ui.currentSkinName.textContent = `${normalSkinSummary()} · ${GOLD_SKINS[selectedGoldSkin]} · ${CAT_SKINS[selectedCatSkin]}`; }
  function syncSkinSelection(persist = true) {
    ui.skinBtn.dataset.skin = selectedSkins.length === 1 ? selectedSkins[0] : 'mix';
    updateSkinSummary();
    ui.skinOptions.forEach(option => {
      const active = selectedSkins.includes(option.dataset.skin);
      option.classList.toggle('selected', active);
      option.setAttribute('aria-checked', String(active));
    });
    if (persist) {
      localStorage.setItem('stressSmashSkins', JSON.stringify(selectedSkins));
      localStorage.setItem('stressSmashSkin', selectedSkins[0]);
    }
  }
  function applySkin(skin, persist = true) {
    selectedSkins = [SKINS[skin] ? skin : 'classic'];
    syncSkinSelection(persist);
  }
  function applySkinMix(skins, persist = true) {
    const valid = Array.isArray(skins) ? [...new Set(skins.filter(skin => SKINS[skin]))] : [];
    selectedSkins = valid.length ? valid : ['classic'];
    syncSkinSelection(persist);
  }
  function toggleSkin(skin) {
    if (!SKINS[skin]) return false;
    if (selectedSkins.includes(skin)) {
      if (selectedSkins.length === 1) return false;
      selectedSkins = selectedSkins.filter(selected => selected !== skin);
    } else {
      selectedSkins = [...selectedSkins, skin];
    }
    syncSkinSelection(true);
    return true;
  }
  function applyGoldSkin(skin, persist = true) {
    selectedGoldSkin = GOLD_SKINS[skin] ? skin : 'windfall';
    ui.arena.dataset.goldSkin = selectedGoldSkin;
    updateSkinSummary();
    ui.goldSkinOptions.forEach(option => {
      const active = option.dataset.goldSkin === selectedGoldSkin;
      option.classList.toggle('selected', active);
      option.setAttribute('aria-checked', String(active));
    });
    if (persist) localStorage.setItem('stressSmashGoldSkin', selectedGoldSkin);
  }
  function applyCatSkin(skin, persist = true) {
    selectedCatSkin = CAT_SKINS[skin] ? skin : 'slacker';
    ui.arena.dataset.catSkin = selectedCatSkin;
    updateSkinSummary();
    ui.catSkinOptions.forEach(option => {
      const active = option.dataset.catSkin === selectedCatSkin;
      option.classList.toggle('selected', active);
      option.setAttribute('aria-checked', String(active));
    });
    if (persist) localStorage.setItem('stressSmashCatSkin', selectedCatSkin);
  }
  function toast(message) {
    ui.toast.textContent = message; ui.toast.classList.add('show');
    clearTimeout(toast.timer); toast.timer = setTimeout(() => ui.toast.classList.remove('show'), 1300);
  }
  function initAudio() {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  }
  function tone(freq, duration = .07, type = 'sine', volume = .055, slide = 1) {
    if (!soundOn) return;
    initAudio();
    const osc = audio.createOscillator(), gain = audio.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, audio.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), audio.currentTime + duration);
    gain.gain.setValueAtTime(volume, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
    osc.connect(gain).connect(audio.destination); osc.start(); osc.stop(audio.currentTime + duration);
  }
  function playHit(kind) {
    if (kind === 'cat') { tone(120, .18, 'sawtooth', .035, .55); return; }
    tone(kind === 'gold' ? 720 : 340, .08, 'square', .035, 1.8);
    setTimeout(() => tone(kind === 'gold' ? 980 : 510, .07, 'sine', .04, 1.2), 45);
  }
  function haptic(pattern) { if ('vibrate' in navigator) navigator.vibrate(pattern); }

  function updateHUD() {
    ui.score.textContent = String(Math.max(0, score)).padStart(3, '0');
    ui.combo.textContent = combo;
    ui.combo.parentElement.classList.remove('combo-pop');
    void ui.combo.parentElement.offsetWidth;
    if (combo) ui.combo.parentElement.classList.add('combo-pop');
  }
  function clearHole(hole) {
    clearTimeout(hole.hideTimer);
    hole.classList.remove('up', 'gold', 'cat', 'hit');
    hole.dataset.kind = '';
    delete hole.dataset.activeSkin;
    hole.querySelector('.mole').removeAttribute('data-word');
    hole.setAttribute('aria-label', `洞口 ${Number(hole.dataset.index) + 1}`);
  }
  function clearAll() { holes.forEach(clearHole); }
  function getOpenHole() {
    const candidates = holes.filter((h, i) => !h.classList.contains('up') && i !== lastHole);
    const pool = candidates.length ? candidates : holes.filter(h => !h.classList.contains('up'));
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    if (chosen) lastHole = Number(chosen.dataset.index);
    return chosen;
  }
  function spawn() {
    if (!running || paused) return;
    const hole = getOpenHole();
    if (!hole) { scheduleSpawn(100); return; }
    const roll = Math.random();
    const kind = roll < mode().cat ? 'cat' : roll < mode().cat + mode().gold ? 'gold' : 'normal';
    const mole = hole.querySelector('.mole');
    const activeSkin = kind === 'normal' ? selectedSkins[Math.floor(Math.random() * selectedSkins.length)] : '';
    hole.dataset.kind = kind;
    if (activeSkin) hole.dataset.activeSkin = activeSkin;
    hole.classList.add('up');
    if (kind !== 'normal') hole.classList.add(kind);
    mole.dataset.word = kind === 'normal' ? WORDS[Math.floor(Math.random() * WORDS.length)] : '';
    mole.style.setProperty('--tilt', `${rand(-4, 4)}deg`);
    const normalLabel = `${SKIN_PREFIXES[activeSkin]}：${mole.dataset.word}`;
    const goldLabel = selectedGoldSkin === 'windfall' ? '天降横财，点击得三分' : '金色好运地鼠，点击得三分';
    const catLabel = selectedCatSkin === 'slacker' ? '摸鱼白猫，请不要点击' : '摸鱼猫，请不要点击';
    hole.setAttribute('aria-label', kind === 'cat' ? catLabel : kind === 'gold' ? goldLabel : normalLabel);
    const life = rand(mode().upMin, mode().upMax) * Math.max(.64, remaining / mode().duration);
    hole.hideTimer = setTimeout(() => {
      if (hole.classList.contains('up') && hole.dataset.kind !== 'cat') combo = 0;
      clearHole(hole); updateHUD();
    }, life);
    scheduleSpawn(rand(mode().minGap, mode().maxGap));
  }
  function scheduleSpawn(delay) { clearTimeout(spawnTimer); spawnTimer = setTimeout(spawn, delay); }

  function particles(hole, text, bad = false) {
    const rect = hole.getBoundingClientRect(), arenaRect = ui.arena.getBoundingClientRect();
    const label = document.createElement('span');
    label.className = 'float-score'; label.textContent = text;
    label.style.left = `${rect.left - arenaRect.left + rect.width * .5 - 18}px`;
    label.style.top = `${rect.top - arenaRect.top + rect.height * .35}px`;
    label.style.color = bad ? '#ff8fba' : '#fff'; ui.arena.append(label); setTimeout(() => label.remove(), 700);
    for (let i = 0; i < 8; i++) {
      const spark = document.createElement('i'); spark.className = 'spark';
      spark.style.left = `${rect.left - arenaRect.left + rect.width / 2}px`;
      spark.style.top = `${rect.top - arenaRect.top + rect.height / 2}px`;
      spark.style.setProperty('--x', `${rand(-72,72)}px`); spark.style.setProperty('--y', `${rand(-65,52)}px`);
      spark.style.background = bad ? '#ff6cab' : i % 2 ? '#d8ff3e' : '#fff';
      ui.arena.append(spark); setTimeout(() => spark.remove(), 750);
    }
  }
  function hit(hole) {
    if (!running || paused) return;
    attempts++;
    if (!hole.classList.contains('up') || hole.classList.contains('hit')) {
      combo = 0; tone(95, .045, 'sine', .02, .75); updateHUD(); return;
    }
    const kind = hole.dataset.kind;
    hole.classList.add('hit'); clearTimeout(hole.hideTimer);
    if (kind === 'cat') {
      score = Math.max(0, score - 2); combo = 0; particles(hole, '猫猫无辜 -2', true);
      ui.shell.classList.remove('shake'); void ui.shell.offsetWidth; ui.shell.classList.add('shake');
      haptic([20,35,20]);
    } else {
      hits++; combo++; topCombo = Math.max(topCombo, combo);
      const base = kind === 'gold' ? 3 : 1;
      const bonus = combo > 0 && combo % 5 === 0 ? 2 : 0;
      score += base + bonus; particles(hole, `+${base + bonus}${bonus ? ' COMBO' : ''}`);
      haptic(kind === 'gold' ? [15,25,15] : 12);
    }
    playHit(kind); updateHUD();
    setTimeout(() => clearHole(hole), 210);
  }

  function tick(now) {
    if (!running) return;
    if (!paused) {
      const elapsed = (now - startAt - pausedTotal) / 1000;
      remaining = Math.max(0, mode().duration - elapsed);
      ui.time.textContent = `${remaining.toFixed(1)}s`;
      ui.bar.style.transform = `scaleX(${remaining / mode().duration})`;
      if (remaining <= 0) { finish(); return; }
    }
    frame = requestAnimationFrame(tick);
  }
  function startGame() {
    initAudio(); clearTimeout(spawnTimer); cancelAnimationFrame(frame); clearAll();
    score = combo = topCombo = attempts = hits = pausedTotal = 0; remaining = mode().duration;
    running = true; paused = false; startAt = performance.now();
    ui.start.hidden = true; ui.result.hidden = true; ui.pauseBtn.disabled = false;
    ui.shell.classList.remove('paused'); ui.pauseBtn.innerHTML = '<i>Ⅱ</i> 暂停一下';
    updateHUD(); tone(260, .1, 'sine', .04, 2); scheduleSpawn(380); frame = requestAnimationFrame(tick);
  }
  function finish() {
    running = false; paused = false; clearTimeout(spawnTimer); cancelAnimationFrame(frame); clearAll();
    ui.pauseBtn.disabled = true; ui.time.textContent = '0.0s'; ui.bar.style.transform = 'scaleX(0)';
    const acc = attempts ? Math.round(hits / attempts * 100) : 0;
    if (score > best) { best = score; localStorage.setItem('stressSmashBest', best); ui.best.textContent = String(best).padStart(3,'0'); }
    ui.finalScore.textContent = score; ui.accuracy.textContent = `${acc}%`; ui.maxCombo.textContent = `${topCombo}×`;
    if (score >= 40) { ui.resultTitle.textContent = '压力粉碎机！'; ui.resultCopy.textContent = '今天的烦恼见了你都得绕路。'; }
    else if (score >= 24) { ui.resultTitle.textContent = '爽到了！'; ui.resultCopy.textContent = '你把今天的烦恼锤了个稀碎。'; }
    else { ui.resultTitle.textContent = '已松一口气'; ui.resultCopy.textContent = '状态已回弹，再来一局会更爽。'; }
    ui.result.hidden = false; tone(430,.12,'sine',.04,1.5); setTimeout(()=>tone(650,.16,'sine',.04,1.35),100);
  }
  function goHome(showMessage = true) {
    running = false; paused = false; clearTimeout(spawnTimer); cancelAnimationFrame(frame); clearAll();
    score = combo = topCombo = attempts = hits = pausedTotal = 0; remaining = mode().duration;
    ui.result.hidden = true; ui.start.hidden = false; ui.pauseBtn.disabled = true;
    ui.shell.classList.remove('paused', 'shake'); ui.pauseBtn.innerHTML = '<i>Ⅱ</i> 暂停一下';
    ui.time.textContent = `${mode().duration.toFixed(1)}s`; ui.bar.style.transform = 'scaleX(1)'; updateHUD();
    if (showMessage) toast('已返回首页');
  }
  function togglePause() {
    if (!running) return;
    paused = !paused; ui.shell.classList.toggle('paused', paused);
    if (paused) { pausedAt = performance.now(); clearTimeout(spawnTimer); clearAll(); ui.pauseBtn.innerHTML = '<i>▶</i> 继续开锤'; toast('暂停一下也没关系'); }
    else { pausedTotal += performance.now() - pausedAt; scheduleSpawn(350); ui.pauseBtn.innerHTML = '<i>Ⅱ</i> 暂停一下'; toast('继续清空压力'); }
  }

  holes.forEach(hole => hole.addEventListener('pointerdown', () => hit(hole)));
  document.querySelectorAll('.mode').forEach(button => button.addEventListener('click', () => {
    selectedMode = button.dataset.mode;
    document.querySelectorAll('.mode').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-checked', b === button ? 'true' : 'false'); });
  }));
  ui.skinBtn.addEventListener('click', () => ui.skinDialog.showModal());
  ui.closeSkin.addEventListener('click', () => ui.skinDialog.close());
  ui.closeSkinDone.addEventListener('click', () => ui.skinDialog.close());
  ui.skinDialog.addEventListener('click', e => { if (e.target === ui.skinDialog) ui.skinDialog.close(); });
  ui.skinOptions.forEach(option => option.addEventListener('click', () => {
    if (!toggleSkin(option.dataset.skin)) { toast('普通形象至少保留一个'); return; }
    toast(selectedSkins.length === 1 ? `当前使用「${SKINS[selectedSkins[0]]}」` : `已混搭 ${selectedSkins.length} 个普通形象`);
  }));
  ui.goldSkinOptions.forEach(option => option.addEventListener('click', () => {
    applyGoldSkin(option.dataset.goldSkin);
    toast(`金色好运已换成「${GOLD_SKINS[selectedGoldSkin]}」`);
  }));
  ui.catSkinOptions.forEach(option => option.addEventListener('click', () => {
    applyCatSkin(option.dataset.catSkin);
    toast(`白色目标已换成「${CAT_SKINS[selectedCatSkin]}」`);
  }));
  ui.startBtn.addEventListener('click', startGame); ui.againBtn.addEventListener('click', startGame);
  ui.homeBtn.addEventListener('click', () => goHome()); ui.legendHomeBtn.addEventListener('click', () => goHome());
  ui.brandHome.addEventListener('click', e => { e.preventDefault(); goHome(); });
  ui.pauseBtn.addEventListener('click', togglePause);
  ui.soundBtn.addEventListener('click', () => { soundOn = !soundOn; ui.soundBtn.textContent = soundOn ? '♫' : '×'; ui.soundBtn.setAttribute('aria-pressed', String(soundOn)); ui.soundBtn.setAttribute('aria-label', soundOn ? '关闭音效' : '打开音效'); if (soundOn) tone(520); });
  ui.helpBtn.addEventListener('click', () => ui.help.showModal()); ui.closeHelp.addEventListener('click', () => ui.help.close());
  ui.help.addEventListener('click', e => { if (e.target === ui.help) ui.help.close(); });
  window.addEventListener('keydown', e => {
    if (e.code === 'Space' && !ui.help.open && !ui.skinDialog.open) { e.preventDefault(); togglePause(); return; }
    const n = Number(e.key); if (n >= 1 && n <= 9) hit(holes[n - 1]);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && running && !paused) togglePause(); });
  ['./assets/skins/boss/boss-normal.png','./assets/skins/boss/boss-hit.png','./assets/skins/meeting/meeting-executive-normal.png','./assets/skins/meeting/meeting-executive-hit.png','./assets/skins/landlord/landlord-normal.png','./assets/skins/landlord/landlord-hit.png','./assets/skins/elite/elite-normal.png','./assets/skins/elite/elite-hit.png','./assets/skins/gold/windfall.png','./assets/skins/cat/slacker-cat.png'].forEach(src => { const image = new Image(); image.src = src; });
  syncSkinSelection(false);
  applyGoldSkin(selectedGoldSkin, false);
  applyCatSkin(selectedCatSkin, false);
  window.StressSmash = { goHome, selectSkin: applySkin, selectSkins: applySkinMix, selectGoldSkin: applyGoldSkin, selectCatSkin: applyCatSkin, isRunning: () => running, isAtHome: () => !running && !ui.start.hidden };
})();
