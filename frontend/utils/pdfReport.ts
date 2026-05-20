/**
 * PDF Report Generator — VocaFlow Progress Snapshot
 * ─────────────────────────────────────────────────────────────────────────────
 * Builds a printable HTML report from the data persisted in AsyncStorage and
 * opens it in a new window with print stylesheet applied. The user clicks the
 * browser's "Save as PDF" option from the print dialog.
 *
 * Zero external dependencies — uses only the browser's built-in print engine.
 * On native (iOS/Android) this can later be wired to expo-print without any
 * change to the report-building logic below.
 *
 * Sections included:
 *   • Title + date + user
 *   • Baseline → Now (overall score + CEFR delta)
 *   • IELTS Speaking band breakdown (4 criteria)
 *   • Cambridge CEFR equivalent
 *   • PTE Core Speaking estimate (via IELTS→CEFR→CLB→PTE chain)
 *   • CAF profile (Complexity / Accuracy / Fluency)
 *   • Grammar accuracy trend
 *   • Performance by domain (COCA — 9 top-level genres)
 *   • Indicator definitions + academic sources
 * ─────────────────────────────────────────────────────────────────────────────
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

type CAFEntry = { ts: number; C: number; A: number; F: number; cefr: string; wps: number };
type ExamSession = {
  ts: number; ielts_overall: number; cambridge_level: string; cambridge_exam: string;
  ielts: { fluency_coherence: number; lexical_resource: number;
           grammatical_accuracy: number; pronunciation: number;
           overall: number; band_label: string };
  pte_core?: {
    speaking_score: number; score_range: string;
    clb_level: number | null; cefr_equivalent: string;
  } | null;
};
type GrammarSession = {
  ts: number; severity_score: number; error_count: number;
  categories: Record<string, number>;
};
type GenreSession = {
  ts: number; dominant_genre: string | null; dominant_subcategory: string | null;
  distribution: Record<string, number>; cefr_level: string; cefr_score: number;
  input_mode: 'speaking' | 'writing';
};
type Baseline = {
  predicted_cefr: string; overall_score: number;
  indicators: Array<{ name: string; normalized: number; cefr_level: string; severity: string }>;
  exam_specific_scores: Record<string, number>;
};

const GENRE_LABEL: Record<string, string> = {
  SPOK: 'Spoken', FIC: 'Fiction', MAG: 'Magazine', NEWS: 'News', ACAD: 'Academic',
  Web: 'Web', Blog: 'Blog', Mov: 'Movies', TV: 'TV',
};

const CEFR_COLOR: Record<string, string> = {
  A1: '#22c55e', A2: '#4ade80', B1: '#60a5fa', B2: '#f59e0b', C1: '#f87171', C2: '#e879f9',
};

const esc = (s: any) => String(s ?? '').replace(/[<>&"']/g, c =>
  ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c] || c));

async function loadJSON<T>(key: string, def: T): Promise<T> {
  try {
    const v = await AsyncStorage.getItem(key);
    return v ? JSON.parse(v) : def;
  } catch { return def; }
}

export async function generateReportHTML(): Promise<string> {
  const [
    baseline, originalBaseline, cafSessions, examSessions, grammarSessions, genreSessions,
    userEmail, targetExam,
  ] = await Promise.all([
    loadJSON<Baseline | null>('baselineDiagnosis', null),
    loadJSON<Baseline | null>('baselineDiagnosisOriginal', null),
    loadJSON<CAFEntry[]>('vf_caf_sessions', []),
    loadJSON<ExamSession[]>('vf_exam_sessions', []),
    loadJSON<GrammarSession[]>('vf_grammar_sessions', []),
    loadJSON<GenreSession[]>('vf_genre_sessions', []),
    AsyncStorage.getItem('userEmail').catch(() => null),
    AsyncStorage.getItem('userTargetExam').catch(() => null),
  ]);

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  const startBaseline = originalBaseline ?? baseline;
  const isRerun = !!originalBaseline;

  // Current overall score from latest exam sessions (preferred) or CAF
  const currentScore = examSessions.length > 0
    ? Math.round(examSessions.slice(-5).reduce((s, e) => s + e.ielts_overall, 0)
                 / Math.min(examSessions.length, 5) / 9 * 100)
    : cafSessions.length > 0
    ? Math.round(cafSessions.slice(-5).reduce((s, e) => s + (e.C + e.A + e.F) / 3, 0)
                 / Math.min(cafSessions.length, 5))
    : null;
  const currentCefr = examSessions.length > 0
    ? examSessions[examSessions.length - 1].cambridge_level
    : cafSessions.length > 0 ? cafSessions[cafSessions.length - 1].cefr : null;

  const delta = currentScore !== null && startBaseline
    ? currentScore - Math.round(startBaseline.overall_score) : null;

  // ── Aggregations ──
  const examLatest = examSessions[examSessions.length - 1] || null;
  const examAvg = examSessions.length > 0
    ? Math.round(examSessions.slice(-5).reduce((s, e) => s + e.ielts_overall, 0)
                 / Math.min(examSessions.length, 5) * 2) / 2
    : null;

  const cafAvg = (k: 'C' | 'A' | 'F') => cafSessions.length > 0
    ? Math.round(cafSessions.slice(-5).reduce((s, e) => s + e[k], 0) / Math.min(cafSessions.length, 5))
    : 0;

  const grammarAvg = grammarSessions.length > 0
    ? Math.round(grammarSessions.slice(-5).reduce((s, e) => s + e.severity_score, 0)
                 / Math.min(grammarSessions.length, 5))
    : null;
  const grammarLatest = grammarSessions[grammarSessions.length - 1];

  // Performance by genre (avg cefr_score per dominant_genre)
  const byGenre: Record<string, { count: number; total: number }> = {};
  for (const g of genreSessions) {
    if (!g.dominant_genre) continue;
    if (!byGenre[g.dominant_genre]) byGenre[g.dominant_genre] = { count: 0, total: 0 };
    byGenre[g.dominant_genre].count += 1;
    byGenre[g.dominant_genre].total += g.cefr_score;
  }
  const genreBars = Object.entries(byGenre)
    .map(([g, v]) => ({ g, avg: Math.round(v.total / v.count), count: v.count }))
    .sort((a, b) => b.avg - a.avg);

  // ── Build HTML ──
  const bar = (pct: number, color: string, w = '100%') =>
    `<div class="bar"><div class="fill" style="width:${Math.min(pct, 100)}%;background:${color};"></div></div>`;

  const pill = (txt: string, bg: string, fg: string) =>
    `<span class="pill" style="background:${bg};color:${fg};">${esc(txt)}</span>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>VocaFlow Progress Report — ${esc(dateStr)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: -apple-system, 'Segoe UI', sans-serif; color: #0F172A; background: #F8FAFC; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { max-width: 880px; margin: 0 auto; padding: 28px 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 2px solid #0FBA9A; margin-bottom: 22px; }
  .brand { font-size: 22px; font-weight: 800; letter-spacing: -0.4px; }
  .brand .accent { color: #0FBA9A; }
  .meta { text-align: right; font-size: 11px; color: #64748B; line-height: 1.55; }
  h1 { font-size: 24px; margin: 4px 0 4px; letter-spacing: -0.6px; }
  h2 { font-size: 15px; text-transform: uppercase; letter-spacing: 0.6px; color: #64748B; margin: 22px 0 10px; padding-bottom: 6px; border-bottom: 1px solid #E5E7EB; }
  .card { background: #fff; border: 1px solid #E5E7EB; border-radius: 12px; padding: 16px; margin-bottom: 14px; }
  .row { display: flex; gap: 16px; align-items: center; }
  .row > * { flex: 1; }
  .stat { text-align: center; padding: 10px 6px; }
  .stat .num { font-size: 32px; font-weight: 800; color: #0FBA9A; line-height: 1.1; }
  .stat .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; color: #64748B; margin-top: 4px; font-weight: 700; }
  .pill { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }
  .bar { height: 8px; background: #E5E7EB; border-radius: 4px; overflow: hidden; flex: 1; }
  .bar .fill { height: 100%; border-radius: 4px; }
  .bar-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; font-size: 12px; }
  .bar-row .label { width: 130px; font-weight: 600; }
  .bar-row .value { width: 50px; text-align: right; font-weight: 800; }
  .delta-pos { color: #10B981; }
  .delta-neg { color: #EF4444; }
  .footer { margin-top: 28px; padding-top: 14px; border-top: 1px solid #E5E7EB; font-size: 10px; color: #94A3B8; line-height: 1.6; }
  .source-list { font-size: 10px; color: #64748B; line-height: 1.7; padding-left: 18px; margin: 6px 0; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .empty { font-size: 12px; color: #94A3B8; font-style: italic; padding: 8px 0; }
  .arrow { color: #94A3B8; font-weight: 800; padding: 0 8px; }
  .compare-row { display: flex; align-items: center; gap: 18px; justify-content: center; padding: 14px 0; }
  .compare-box { text-align: center; min-width: 100px; }
  .compare-box .big { font-size: 36px; font-weight: 900; }
  .compare-box .lbl { font-size: 10px; text-transform: uppercase; color: #64748B; font-weight: 700; letter-spacing: 0.6px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #F1F5F9; }
  th { color: #64748B; font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 800; }
  .print-btn { position: fixed; top: 16px; right: 16px; padding: 10px 16px; background: #0FBA9A; color: #fff; border: 0; border-radius: 10px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 12px rgba(15,186,154,0.3); }
  @media print {
    .print-btn { display: none; }
    body { background: #fff; }
    .page { padding: 14px 20px; }
    .card { box-shadow: none; }
  }
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">🖨 Save as PDF</button>
<div class="page">
  <div class="header">
    <div>
      <div class="brand">Voca<span class="accent">Flow</span></div>
      <h1>Progress Report</h1>
    </div>
    <div class="meta">
      ${esc(dateStr)}<br/>
      ${userEmail ? esc(userEmail) + '<br/>' : ''}
      ${targetExam ? 'Target: ' + esc(targetExam.replace(/_/g, ' ').toUpperCase()) : ''}
    </div>
  </div>

  ${startBaseline ? `
  <h2>Baseline → Now</h2>
  <div class="card">
    <div class="compare-row">
      <div class="compare-box">
        <div class="big" style="color:#64748B;">${Math.round(startBaseline.overall_score)}<span style="font-size:14px;color:#94A3B8;">/100</span></div>
        <div class="lbl">Start</div>
        <div style="margin-top:6px;">${pill(startBaseline.predicted_cefr, (CEFR_COLOR[startBaseline.predicted_cefr] || '#64748B') + '22', CEFR_COLOR[startBaseline.predicted_cefr] || '#64748B')}</div>
      </div>
      <div class="arrow">→</div>
      ${currentScore !== null ? `
      <div class="compare-box">
        <div class="big" style="color:#0FBA9A;">${currentScore}<span style="font-size:14px;color:#94A3B8;">/100</span></div>
        <div class="lbl">Now</div>
        ${currentCefr ? `<div style="margin-top:6px;">${pill(currentCefr, (CEFR_COLOR[currentCefr] || '#0FBA9A') + '22', CEFR_COLOR[currentCefr] || '#0FBA9A')}</div>` : ''}
      </div>
      ` : '<div class="compare-box"><div class="big" style="color:#E5E7EB;">?</div><div class="lbl">No sessions yet</div></div>'}
    </div>
    ${delta !== null ? `<div style="text-align:center;margin-top:8px;font-size:14px;font-weight:800;" class="${delta >= 0 ? 'delta-pos' : 'delta-neg'}">${delta >= 0 ? '+' : ''}${delta} pts since baseline</div>` : ''}
    ${isRerun ? `<div style="text-align:center;margin-top:6px;font-size:11px;color:#64748B;font-style:italic;">Re-diagnosed since initial assessment</div>` : ''}
    <div style="font-size:10px;color:#94A3B8;font-style:italic;text-align:center;margin-top:10px;">Alderson (2005) diagnostic assessment · Knoch (2009) formative evaluation</div>
  </div>
  ` : '<h2>Baseline → Now</h2><div class="card empty">No baseline diagnostic yet — complete the initial diagnostic to start tracking.</div>'}

  ${examLatest ? `
  <h2>IELTS Speaking — Band ${examAvg}/9 (${esc(examLatest.ielts.band_label)})</h2>
  <div class="card">
    <div class="row" style="margin-bottom:12px;">
      <div class="stat"><div class="num">${examAvg}</div><div class="label">Avg overall</div></div>
      <div class="stat"><div class="num" style="color:${CEFR_COLOR[examLatest.cambridge_level] || '#0FBA9A'};">${esc(examLatest.cambridge_level)}</div><div class="label">Cambridge</div></div>
      <div class="stat"><div class="num">${examSessions.length}</div><div class="label">Sessions</div></div>
    </div>
    ${[
      { key: 'fluency_coherence', label: 'Fluency & Coherence', color: '#FF7A59' },
      { key: 'lexical_resource', label: 'Lexical Resource', color: '#7C6FFF' },
      { key: 'grammatical_accuracy', label: 'Grammatical Range', color: '#1EE8B5' },
      { key: 'pronunciation', label: 'Pronunciation', color: '#f59e0b' },
    ].map(c => {
      const v = (examLatest.ielts as any)[c.key] || 0;
      return `<div class="bar-row"><span class="label">${c.label}</span>${bar(v / 9 * 100, c.color)}<span class="value" style="color:${c.color};">${v}/9</span></div>`;
    }).join('')}
    <div style="font-size:10px;color:#94A3B8;font-style:italic;margin-top:8px;">${esc(examLatest.cambridge_exam)} — British Council / Cambridge ESOL (2024)</div>
  </div>
  ` : ''}

  ${examLatest?.pte_core ? (() => {
    const p = examLatest.pte_core!;
    const pct = Math.round((p.speaking_score / 90) * 100);
    const clbLabel = p.clb_level ? `CLB ${p.clb_level}` : 'Below CLB 3';
    return `
  <h2>PTE Core — Speaking Estimate</h2>
  <div class="card">
    <div class="row" style="margin-bottom:12px;">
      <div class="stat"><div class="num" style="color:#3B82F6;">${p.speaking_score}</div><div class="label">Score /90</div></div>
      <div class="stat"><div class="num" style="font-size:18px;color:#3B82F6;">${esc(p.score_range)}</div><div class="label">Score range</div></div>
      <div class="stat"><div class="num" style="font-size:20px;color:#64748B;">${esc(clbLabel)}</div><div class="label">Canadian CLB</div></div>
      <div class="stat"><div class="num" style="color:${CEFR_COLOR[p.cefr_equivalent] || '#64748B'};">${esc(p.cefr_equivalent)}</div><div class="label">CEFR equiv.</div></div>
    </div>
    <div class="bar-row"><span class="label">PTE Core Speaking</span>${bar(pct, '#3B82F6')}<span class="value" style="color:#3B82F6;">${p.speaking_score}/90</span></div>
    <div style="font-size:10px;color:#94A3B8;font-style:italic;margin-top:8px;">
      Estimated via IELTS→CEFR→CLB→PTE chain. Not a substitute for an actual PTE Core test score.<br/>
      Source: Pearson PTE (2024) — CLB comparison table, Speaking column;
      Kolahi Ahari et al. (2025) — IELTS↔CEFR bridge; Council of Europe Global Scale (globalscale.txt)
    </div>
  </div>`;
  })() : ''}

  ${cafSessions.length > 0 ? `
  <h2>CAF Profile — Pallotti (2014) · Skehan (1998)</h2>
  <div class="card">
    <div class="bar-row"><span class="label">Complexity</span>${bar(cafAvg('C'), '#7C6FFF')}<span class="value" style="color:#7C6FFF;">${cafAvg('C')}%</span></div>
    <div class="bar-row"><span class="label">Accuracy</span>${bar(cafAvg('A'), '#1EE8B5')}<span class="value" style="color:#1EE8B5;">${cafAvg('A')}%</span></div>
    <div class="bar-row"><span class="label">Fluency</span>${bar(cafAvg('F'), '#FF7A59')}<span class="value" style="color:#FF7A59;">${cafAvg('F')}%</span></div>
    <div style="font-size:10px;color:#94A3B8;font-style:italic;margin-top:8px;">Avg of last ${Math.min(cafSessions.length, 5)} session(s) · ${cafSessions.length} total</div>
  </div>
  ` : ''}

  ${grammarLatest ? `
  <h2>Grammar Accuracy — Pungă &amp; Pârlog (2015) · Popescu (2013)</h2>
  <div class="card">
    <div class="row">
      <div class="stat"><div class="num" style="color:${grammarAvg && grammarAvg >= 80 ? '#10B981' : grammarAvg && grammarAvg >= 55 ? '#F59E0B' : '#EF4444'};">${grammarAvg ?? '—'}</div><div class="label">Accuracy /100</div></div>
      <div class="stat"><div class="num">${grammarLatest.error_count}</div><div class="label">Error types (latest)</div></div>
      <div class="stat"><div class="num">${grammarSessions.length}</div><div class="label">Sessions</div></div>
    </div>
    ${Object.entries(grammarLatest.categories).filter(([, n]) => n > 0).length > 0 ? `
    <table style="margin-top:10px;">
      <thead><tr><th>Category</th><th style="text-align:right;">Latest</th></tr></thead>
      <tbody>
        ${Object.entries(grammarLatest.categories)
          .filter(([, n]) => n > 0)
          .sort(([, a], [, b]) => b - a)
          .map(([cat, n]) => `<tr><td>${esc(cat.replace(/_/g, ' '))}</td><td style="text-align:right;font-weight:700;">${n}</td></tr>`)
          .join('')}
      </tbody>
    </table>
    ` : '<div style="font-size:11px;color:#10B981;text-align:center;padding:8px;">✓ No interference errors detected.</div>'}
  </div>
  ` : ''}

  ${genreBars.length > 0 ? `
  <h2>Performance by Domain — COCA (Davies)</h2>
  <div class="card">
    ${genreBars.map(({ g, avg, count }) => {
      const colors: Record<string, string> = {
        SPOK: '#10B981', FIC: '#7C6FFF', MAG: '#f59e0b',
        NEWS: '#FF7A59', ACAD: '#1EE8B5',
        Web: '#60a5fa', Blog: '#e879f9', Mov: '#fb7185', TV: '#a78bfa',
      };
      return `<div class="bar-row"><span class="label">${esc(GENRE_LABEL[g] || g)} (${count})</span>${bar(avg, colors[g] || '#0FBA9A')}<span class="value" style="color:${colors[g] || '#0FBA9A'};">${avg}</span></div>`;
    }).join('')}
    <div style="font-size:10px;color:#94A3B8;font-style:italic;margin-top:8px;">CEFR-derived score from sessions where each domain was the dominant register · 96 COCA sub-genres aggregated</div>
  </div>
  ` : ''}

  <h2>Academic Sources</h2>
  <ul class="source-list">
    <li><b>Alderson (2005)</b> — Diagnostic assessment: identify SPECIFIC weaknesses, not global abilities</li>
    <li><b>Pallotti (2014)</b> — CAF model in SLA · Skehan (1998) — Complexity, Accuracy, Fluency framework</li>
    <li><b>Kolahi Ahari et al. (2025)</b> — IELTS-CEFR mapping, β = .40 lexical diversity strongest predictor</li>
    <li><b>McCarthy &amp; Jarvis (2010)</b> — MTLD algorithm, TTR threshold = 0.720</li>
    <li><b>Hunt (1965); Norris &amp; Ortega (2009); Bae &amp; Min (2020)</b> — Subordination Index / MLS</li>
    <li><b>Crossley, Kyle &amp; McNamara (2016)</b> — TAACO connective density (writing cohesion)</li>
    <li><b>Pungă &amp; Pârlog (2015); Popescu (2013)</b> — Romanian L1 interference errors (44% collocational)</li>
    <li><b>Davies, M.</b> — Corpus of Contemporary American English (COCA), 60k lemmas across 96 sub-genres</li>
    <li><b>Knoch (2009)</b> — Diagnostic assessment of writing — Language Testing 26(2)</li>
    <li><b>British Council / Cambridge ESOL (2024)</b> — IELTS Speaking band descriptors</li>
    <li><b>Pearson PTE (2024)</b> — PTE Core Speaking → CLB comparison table (PTE Core scoring _ Pearson PTE.txt); CEFR↔CLB alignment via Council of Europe Global Scale</li>
  </ul>

  <div class="footer">
    Generated by VocaFlow on ${esc(now.toLocaleString('en-GB'))} · This report is a snapshot of the user's current
    progress based on their last ${cafSessions.length} CAF sessions, ${examSessions.length} exam sessions, and
    ${grammarSessions.length} grammar checks. All indicators are computed using rule-based analysis of the user's
    own speech / writing, with thresholds grounded in the academic literature listed above.
  </div>
</div>
</body>
</html>`;
}

/**
 * Open the report in a new tab. The user clicks "Save as PDF" from the print dialog.
 * Web-only; on native this would call expo-print.
 */
export async function openReport(): Promise<void> {
  const html = await generateReportHTML();
  const win = window.open('', '_blank');
  if (!win) {
    alert('Please allow pop-ups for this site to view the report.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

/**
 * Download the report directly as a PDF file — opens the user's file-save
 * dialog through the browser's native download flow. Uses html2pdf.js
 * (jsPDF + html2canvas) to render the HTML to a real PDF binary.
 */
export async function downloadReportPDF(): Promise<void> {
  // Dynamic import keeps html2pdf.js out of the main bundle until needed
  const html2pdf = (await import('html2pdf.js')).default;

  const html = await generateReportHTML();

  // Render the HTML in a hidden off-screen container so html2canvas can
  // capture it at full quality without disturbing the user's current view.
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '880px';
  container.innerHTML = html;
  document.body.appendChild(container);

  // Hide the in-report "Save as PDF" button (only relevant when previewing in a tab)
  const printBtn = container.querySelector('.print-btn') as HTMLElement | null;
  if (printBtn) printBtn.style.display = 'none';

  const target = container.querySelector('.page') as HTMLElement | null;

  const date = new Date().toISOString().slice(0, 10);
  const filename = `VocaFlow-Progress-Report_${date}.pdf`;

  try {
    await html2pdf()
      .set({
        margin:       [10, 8, 10, 8],            // top, left, bottom, right (mm)
        filename,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false, backgroundColor: '#F8FAFC' },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] },
      })
      .from(target || container)
      .save();
  } finally {
    document.body.removeChild(container);
  }
}
