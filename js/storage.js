/* Saves every participant on this device (browser localStorage) and builds the
 * export tables. Data is saved after every trial, so a participant who stops
 * early still has their finished trials kept (marked completed = no).
 */
(function () {
  'use strict';
  const KEY = 'imt_participants_v1';

  function all() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
  }
  function writeAll(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; }
    catch (e) { alert('Could not save data on this device: ' + e.message); return false; }
  }
  function save(p) {
    const list = all();
    const i = list.findIndex(x => x.participant_id === p.participant_id);
    if (i >= 0) list[i] = p; else list.push(p);
    writeAll(list);
  }
  function newId() {
    const n = all().length + 1;
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return 'P' + String(n).padStart(2, '0') + '-' + rand;
  }
  function merge(imported) {
    const list = all();
    let added = 0;
    for (const p of imported) {
      if (!p || !p.participant_id) continue;
      if (!list.some(x => x.participant_id === p.participant_id)) { list.push(p); added++; }
    }
    writeAll(list);
    return added;
  }
  function clear() { localStorage.removeItem(KEY); }

  const DEMO_COLS = ['participant_id', 'age', 'gender', 'course', 'email', 'session_date', 'completed'];
  const TRIAL_COLS = ['trial', 'stimulus_type', 'exposure_ms', 'delay_ms', 'interference', 'interference_match',
    'targets', 'lures', 'selected', 'hits', 'false_alarms', 'misses', 'correct_rejections',
    'score', 'accuracy', 'recall_rt_ms', 'distractor_items', 'distractor_correct', 'distractor_accuracy',
    'distractor_mean_rt_ms'];

  function demoOf(p) {
    return {
      participant_id: p.participant_id, age: p.age, gender: p.gender, course: p.course,
      email: p.email, session_date: (p.started_at || '').slice(0, 10), completed: p.completed ? 'yes' : 'no',
      test_mode: p.test_mode ? 'yes' : 'no'
    };
  }

  // One row per main (non-practice) trial, with the person's details repeated.
  function trialRows(list) {
    const rows = [];
    for (const p of (list || all())) {
      for (const t of p.trials || []) {
        if (t.practice) continue;
        const row = demoOf(p);
        for (const c of TRIAL_COLS) row[c] = t[c];
        rows.push(row);
      }
    }
    return rows;
  }

  function mean(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : ''; }
  function round(x, d) { return x === '' ? '' : Math.round(x * 10 ** d) / 10 ** d; }

  // One row per person: overall and per-condition mean scores (for SPSS/Excel t-tests).
  function participantRows(list) {
    return (list || all()).map(p => {
      const ts = (p.trials || []).filter(t => !t.practice);
      const m = f => round(mean(ts.filter(f).map(t => t.score)), 3);
      const dts = ts.filter(t => t.distractor_items > 0);
      const dItems = dts.reduce((s, t) => s + t.distractor_items, 0);
      const dCorrect = dts.reduce((s, t) => s + t.distractor_correct, 0);
      return Object.assign(demoOf(p), {
        n_trials: ts.length,
        mean_score: m(() => true),
        mean_accuracy: round(mean(ts.map(t => t.accuracy)), 3),
        mean_recall_rt_ms: round(mean(ts.map(t => t.recall_rt_ms)), 0),
        score_words: m(t => t.stimulus_type === 'words'),
        score_shapes: m(t => t.stimulus_type === 'shapes'),
        score_exposure_short: m(t => t.exposure_ms === CONFIG_EXPOSURES()[0]),
        score_exposure_long: m(t => t.exposure_ms === CONFIG_EXPOSURES()[1]),
        score_delay_short: m(t => t.delay_ms === CONFIG_DELAYS()[0]),
        score_delay_long: m(t => t.delay_ms === CONFIG_DELAYS()[1]),
        score_no_interference: m(t => t.interference === 'none'),
        score_verbal_interference: m(t => t.interference === 'verbal'),
        score_visual_interference: m(t => t.interference === 'visual'),
        score_matched: m(t => t.interference_match === 'matched'),
        score_mismatched: m(t => t.interference_match === 'mismatched'),
        distractor_accuracy: dItems ? round(dCorrect / dItems, 3) : ''
      });
    });
  }
  // Fixed design levels (kept here so exports work even outside the task page).
  function CONFIG_EXPOSURES() { return [1000, 2000]; }
  function CONFIG_DELAYS() { return [2000, 6000]; }

  function csv(rows) {
    if (!rows.length) return '';
    const cols = Object.keys(rows[0]);
    const esc = v => {
      const s = v === undefined || v === null ? '' : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return [cols.join(',')].concat(rows.map(r => cols.map(c => esc(r[c])).join(','))).join('\n');
  }

  function download(name, content, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: type || 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  window.DB = { all, save, newId, merge, clear, trialRows, participantRows, csv, download, TRIAL_COLS, DEMO_COLS };
})();
