/* Interference Match memory task.
 *
 * Design (all within-subject, fully crossed, one trial per cell = 24 trials):
 *   stimulus_type : words | shapes            (what is memorised)
 *   exposure_ms   : 1000 | 2000               (how long the 5 items are on screen)
 *   delay_ms      : 2000 | 6000               (retention interval before recall)
 *   interference  : none | verbal | visual    (what fills the delay)
 * Derived: interference_match = matched (words+verbal, shapes+visual),
 *          mismatched (words+visual, shapes+verbal) or none.
 *
 * Trial: fixation 500 ms -> 5 study items -> delay (with/without side task)
 *        -> recognition grid (5 old + 5 new); participant clicks the old ones.
 * Score = hits - false alarms (range -5..5). Accuracy = (hits + correct rejections) / 10.
 *
 * Add ?test=1 to the URL for a fast dry run (all timings x0.15, data still saved).
 */
(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  const TEST = params.get('test') === '1';
  const SPEED = TEST ? 0.15 : 1;

  const CONFIG = {
    fixationMs: 500,
    exposures: [1000, 2000],
    delays: [2000, 6000],
    interferences: ['none', 'verbal', 'visual'],
    stimulusTypes: ['words', 'shapes'],
    setSize: 5,
    lures: 5,
    distractorItemMs: 1500,   // max time per side-task item
    distractorGapMs: 150,
    itiMs: 600
  };

  const $ = id => document.getElementById(id);
  const stage = $('stage');
  const sleep = ms => new Promise(r => setTimeout(r, ms * SPEED));
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = a => a[Math.floor(Math.random() * a.length)];

  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
    document.body.classList.toggle('in-trial', id === 'screen-trial');
    window.scrollTo(0, 0);
  }

  // ---------- design ----------
  function buildTrials() {
    const cells = [];
    for (const s of CONFIG.stimulusTypes)
      for (const e of CONFIG.exposures)
        for (const d of CONFIG.delays)
          for (const i of CONFIG.interferences)
            cells.push({ stimulus_type: s, exposure_ms: e, delay_ms: d, interference: i });
    // shuffle, but avoid more than 3 trials of the same stimulus type in a row
    for (let tries = 0; tries < 200; tries++) {
      const order = shuffle(cells);
      let ok = true;
      for (let k = 3; k < order.length; k++)
        if ([1, 2, 3].every(b => order[k - b].stimulus_type === order[k].stimulus_type)) { ok = false; break; }
      if (ok) return order;
    }
    return shuffle(cells);
  }
  const PRACTICE = [
    { stimulus_type: 'words', exposure_ms: 2000, delay_ms: 6000, interference: 'verbal' },
    { stimulus_type: 'shapes', exposure_ms: 2000, delay_ms: 6000, interference: 'visual' }
  ];

  function matchOf(t) {
    if (t.interference === 'none') return 'none';
    const m = (t.stimulus_type === 'words' && t.interference === 'verbal') ||
              (t.stimulus_type === 'shapes' && t.interference === 'visual');
    return m ? 'matched' : 'mismatched';
  }

  // Word pool is used without replacement for the whole session (130 needed, ~280 available).
  let wordPool = shuffle(STIM.WORDS);
  function takeWords(n) {
    if (wordPool.length < n) wordPool = shuffle(STIM.WORDS);
    return wordPool.splice(0, n);
  }
  function makeItems(type, n) {
    return type === 'words' ? takeWords(n) : Array.from({ length: n }, () => 'S' + STIM.newShapeSeed());
  }
  function itemHTML(type, id) {
    return type === 'words' ? `<span>${id}</span>` : STIM.shapeSVG(Number(id.slice(1)), 0, false);
  }

  // ---------- keyboard ----------
  let keyHandler = null;
  document.addEventListener('keydown', e => { if (keyHandler) keyHandler(e.key.toLowerCase()); });

  // ---------- side tasks ----------
  function verbalItem() {
    const rhyme = Math.random() < 0.5;
    let a, b;
    if (rhyme) { const f = shuffle(pick(STIM.RHYME_FAMILIES)); a = f[0]; b = f[1]; }
    else { const fs = shuffle(STIM.RHYME_FAMILIES); a = pick(fs[0]); b = pick(fs[1]); }
    return {
      title: 'Do they rhyme?', yes: 'F = Rhyme', no: 'J = No rhyme', answerYes: rhyme,
      html: `<div class="word">${a.toUpperCase()}</div><div class="word">${b.toUpperCase()}</div>`
    };
  }
  function visualItem() {
    const same = Math.random() < 0.5;
    const seed = STIM.newShapeSeed();
    const rot = 60 + Math.floor(Math.random() * 240);
    return {
      title: 'Same shape (just turned)?', yes: 'F = Same', no: 'J = Different', answerYes: same,
      html: STIM.shapeSVG(seed, 0, false) + STIM.shapeSVG(seed, rot, !same)
    };
  }

  // Runs side-task items until the delay is over. Returns performance counts.
  function runDelay(kind, delayMs) {
    const total = delayMs * SPEED;
    const end = performance.now() + total;
    const res = { items: 0, correct: 0, rts: [] };
    if (kind === 'none') {
      stage.innerHTML = `<div class="distract-title">Wait…</div><div class="wait-dot"></div>`;
      return new Promise(r => setTimeout(() => r(res), total));
    }
    return new Promise(resolve => {
      let itemTimer = null, done = false;
      const finish = () => { if (done) return; done = true; keyHandler = null; clearTimeout(itemTimer); resolve(res); };
      setTimeout(finish, total);
      const next = () => {
        if (done) return;
        const left = end - performance.now();
        if (left < 400 * SPEED) { // too little time for another item; wait for the delay to end
          stage.innerHTML = `<div class="distract-title">Wait…</div><div class="wait-dot"></div>`; keyHandler = null; return;
        }
        const it = kind === 'verbal' ? verbalItem() : visualItem();
        const t0 = performance.now();
        stage.innerHTML = `<div class="distract-title">${it.title}</div>
          <div class="pair" id="pair">${it.html}</div>
          <div class="answer-row"><button data-a="yes">${it.yes}</button><button data-a="no">${it.no}</button></div>`;
        let answered = false;
        const answer = saidYes => {
          if (answered || done) return; answered = true; clearTimeout(itemTimer);
          res.items++;
          const ok = saidYes === it.answerYes;
          if (ok) res.correct++;
          if (saidYes !== null) res.rts.push(Math.round((performance.now() - t0) / SPEED));
          const pair = $('pair'); if (pair) pair.classList.add(ok ? 'flash-ok' : 'flash-bad');
          setTimeout(next, CONFIG.distractorGapMs * SPEED);
        };
        stage.querySelectorAll('.answer-row button').forEach(b =>
          b.addEventListener('click', () => answer(b.dataset.a === 'yes')));
        keyHandler = k => { if (k === 'f') answer(true); else if (k === 'j') answer(false); };
        itemTimer = setTimeout(() => {
          // only count a time-out if the item was fully available
          if (end - performance.now() > 0) answer(null);
        }, Math.min(CONFIG.distractorItemMs * SPEED, left));
      };
      next();
    });
  }

  // ---------- one trial ----------
  async function runTrial(cond, idx, practice) {
    const type = cond.stimulus_type;
    const targets = makeItems(type, CONFIG.setSize);
    const lures = makeItems(type, CONFIG.lures);

    stage.innerHTML = `<div class="fixation">+</div>`;
    await sleep(CONFIG.fixationMs);

    stage.innerHTML = `<div class="study-row">${targets.map(t => `<div class="item">${itemHTML(type, t)}</div>`).join('')}</div>`;
    await sleep(cond.exposure_ms);

    const d = await runDelay(cond.interference, cond.delay_ms);

    // recognition grid
    const grid = shuffle(targets.concat(lures));
    stage.innerHTML = `<div class="prompt">Click the items you saw, then press Done.</div>
      <div class="grid">${grid.map(g => `<div class="item" data-id="${g}">${itemHTML(type, g)}</div>`).join('')}</div>
      <button class="primary" id="btn-done" disabled>Done</button>`;
    const t0 = performance.now();
    const selected = new Set();
    stage.querySelectorAll('.grid .item').forEach(el => el.addEventListener('click', () => {
      const id = el.dataset.id;
      if (selected.has(id)) selected.delete(id); else selected.add(id);
      el.classList.toggle('on');
      $('btn-done').disabled = selected.size === 0;
    }));
    await new Promise(r => $('btn-done').addEventListener('click', r, { once: true }));
    const rt = Math.round((performance.now() - t0) / SPEED);

    const tset = new Set(targets);
    const hits = [...selected].filter(s => tset.has(s)).length;
    const fa = selected.size - hits;
    const row = Object.assign({}, cond, {
      trial: idx + 1, practice,
      interference_match: matchOf(cond),
      targets: targets.join(' '), lures: lures.join(' '), selected: [...selected].join(' '),
      hits, false_alarms: fa, misses: CONFIG.setSize - hits, correct_rejections: CONFIG.lures - fa,
      score: hits - fa,
      accuracy: Math.round(((hits + CONFIG.lures - fa) / (CONFIG.setSize + CONFIG.lures)) * 1000) / 1000,
      recall_rt_ms: rt,
      distractor_items: d.items, distractor_correct: d.correct,
      distractor_accuracy: d.items ? Math.round((d.correct / d.items) * 1000) / 1000 : '',
      distractor_mean_rt_ms: d.rts.length ? Math.round(d.rts.reduce((s, x) => s + x, 0) / d.rts.length) : '',
      test_mode: TEST,
      time: new Date().toISOString()
    });

    if (practice) {
      stage.querySelectorAll('.grid .item').forEach(el => {
        const isT = tset.has(el.dataset.id), sel = selected.has(el.dataset.id);
        el.classList.add(isT && sel ? 'fb-hit' : isT ? 'fb-miss' : sel ? 'fb-fa' : 'x');
      });
      $('btn-done').remove();
      const fb = document.createElement('div');
      fb.innerHTML = `<p>You found <b>${hits} of 5</b>${fa ? ` and picked ${fa} you had not seen` : ''}.
        <span class="small">Green = correct, dashed green = missed, red = not shown before.</span></p>
        <button class="primary" id="btn-fb">Next</button>`;
      stage.appendChild(fb);
      await new Promise(r => $('btn-fb').addEventListener('click', r, { once: true }));
    }
    stage.innerHTML = '';
    await sleep(CONFIG.itiMs);
    return row;
  }

  // ---------- flow ----------
  let P = null;

  $('consent-box').addEventListener('change', e => { $('btn-consent').disabled = !e.target.checked; });
  $('btn-consent').addEventListener('click', () => show('screen-demo'));

  $('demo-form').addEventListener('submit', e => {
    e.preventDefault();
    const age = Number($('age').value), gender = $('gender').value,
      course = $('course').value.trim(), email = $('email').value.trim();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!(age >= 10 && age <= 99) || !gender || !course || !emailOk) { $('demo-error').hidden = false; return; }
    $('demo-error').hidden = true;
    P = {
      participant_id: DB.newId(), age, gender, course, email,
      started_at: new Date().toISOString(), completed: false, test_mode: TEST,
      user_agent: navigator.userAgent, trials: []
    };
    DB.save(P);
    show('screen-instr');
  });

  function setProgress(done, total) { $('progress-bar').style.width = (100 * done / total) + '%'; }

  $('btn-start-practice').addEventListener('click', async () => {
    show('screen-trial');
    for (let i = 0; i < PRACTICE.length; i++) {
      setProgress(i, PRACTICE.length);
      P.trials.push(await runTrial(PRACTICE[i], i, true));
      DB.save(P);
    }
    show('screen-ready');
  });

  $('btn-start-main').addEventListener('click', async () => {
    show('screen-trial');
    const trials = buildTrials();
    for (let i = 0; i < trials.length; i++) {
      setProgress(i, trials.length);
      P.trials.push(await runTrial(trials[i], i, false));
      DB.save(P);
    }
    P.completed = true;
    P.finished_at = new Date().toISOString();
    DB.save(P);
    const main = P.trials.filter(t => !t.practice);
    const found = main.reduce((s, t) => s + t.hits, 0);
    $('end-score').textContent = `You recognised ${Math.round(100 * found / (main.length * CONFIG.setSize))}% of the items you were shown.`;
    show('screen-end');
  });

  $('btn-next').addEventListener('click', () => location.reload());
  $('btn-own-data').addEventListener('click', e => {
    e.preventDefault();
    DB.download(`${P.participant_id}_trials.csv`, DB.csv(DB.trialRows([P])));
  });

  if (TEST) document.title += ' (TEST MODE)';
  window.IMT = { CONFIG, buildTrials, TEST };
})();
