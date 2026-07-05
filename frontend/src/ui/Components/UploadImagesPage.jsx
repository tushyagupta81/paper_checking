import { useState, useEffect, useRef } from 'react';
import api from '../api.js';

// ─── Parse folder into workbook map ──────────────────────────────────────────
//
// Expected folder structure — admin drops the paper folder as-is:
//
//   MATH101-2024/          ← paper folder (name doesn't need to match paper ID)
//     WB-001/              ← workbook ID (sub-folder name)
//       1.jpg              ← global page 1 of the whole paper
//       2.jpg
//       3.jpg
//     WB-002/
//       1.jpg
//       2.jpg
//       3.jpg
//
// The filename must contain at least one digit — that digit sequence is the
// global page number across the entire paper (not per-question).
// Files like "1.jpg", "page-1.png", "answersheet_01.jpg" all work.
//
// Returns { workbookMap, parseErrors }
//   workbookMap: { wbId: [ { globalPageNo, file } ] }  — sorted ascending
//   parseErrors: string[]

function parseFolder(files) {
  const map = {};
  const errors = [];

  for (const file of files) {
    // file.webkitRelativePath = "PaperFolder/WB-001/1.jpg"
    const parts = file.webkitRelativePath.split('/');
    if (parts.length !== 3) continue; // skip root dir entry or deep sub-folders

    const wbId    = parts[1];
    const fname   = parts[2];
    const numMatch = fname.replace(/\.[^.]+$/, '').match(/\d+/);
    if (!numMatch) {
      errors.push(`Skipped "${file.webkitRelativePath}" — no page number in filename`);
      continue;
    }
    const globalPageNo = parseInt(numMatch[0], 10);
    if (!map[wbId]) map[wbId] = [];
    map[wbId].push({ globalPageNo, file });
  }

  for (const id of Object.keys(map)) {
    map[id].sort((a, b) => a.globalPageNo - b.globalPageNo);
  }
  return { workbookMap: map, parseErrors: errors };
}

// ─── Compute global page slice for question N ─────────────────────────────────
// Q1 pages=2 → global pages 1,2
// Q2 pages=3 → global pages 3,4,5   (offset = sum of all previous pages)
function sliceForQuestion(questions, qNo) {
  const sorted = [...questions].sort((a, b) => a.question_no - b.question_no);
  let offset = 0;
  for (const q of sorted) {
    if (q.question_no === Number(qNo)) {
      return { start: offset + 1, end: offset + q.pages, count: q.pages };
    }
    offset += q.pages;
  }
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function UploadImagesPage() {
  const [papers,        setPapers]        = useState([]);
  const [papersLoading, setPapersLoading] = useState(true);
  const [papersError,   setPapersError]   = useState('');

  const [paperId,       setPaperId]       = useState('');
  const [questions,     setQuestions]     = useState([]);
  const [qLoading,      setQLoading]      = useState(false);
  const [qError,        setQError]        = useState('');

  // Folder state
  const [folderName,    setFolderName]    = useState('');
  const [workbookMap,   setWorkbookMap]   = useState({});
  const [parseErrors,   setParseErrors]   = useState([]);
  const folderRef = useRef(null);

  // Per-question upload progress
  // { qNo: { wbId: 'pending'|'success'|'error' } }
  const [progress,  setProgress]  = useState({});
  const [uploading, setUploading] = useState(false);
  const [done,      setDone]      = useState(false);
  const [globalErr, setGlobalErr] = useState('');

  useEffect(() => { fetchPapers(); }, []);

  useEffect(() => {
    resetFolderState();
    if (paperId) fetchQuestions(paperId);
    else setQuestions([]);
  }, [paperId]);

  const resetFolderState = () => {
    setFolderName(''); setWorkbookMap({}); setParseErrors([]);
    setProgress({}); setDone(false); setGlobalErr('');
  };

  // ── API ────────────────────────────────────────────────────────────────────
  const fetchPapers = async () => {
    setPapersLoading(true); setPapersError('');
    try { const r = await api.getPapers(); setPapers(r.paper_ids || []); }
    catch (e) { setPapersError(e.message || 'Could not load papers.'); }
    finally   { setPapersLoading(false); }
  };

  const fetchQuestions = async (pid) => {
    setQLoading(true); setQError('');
    try { const r = await api.getQuestionsForPaper(pid); setQuestions(r.questions || []); }
    catch (e) { setQError(e.message || 'Could not load questions.'); setQuestions([]); }
    finally   { setQLoading(false); }
  };

  // ── Folder change ──────────────────────────────────────────────────────────
  const handleFolder = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setFolderName(files[0].webkitRelativePath.split('/')[0]);
    const { workbookMap: map, parseErrors: errs } = parseFolder(files);
    setWorkbookMap(map);
    setParseErrors(errs);
    setProgress({}); setDone(false); setGlobalErr('');
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const workbookIds = Object.keys(workbookMap).sort();

  // For each question, get the slice and check which workbooks are ready
  const questionSlices = questions.map(q => ({
    q,
    slice: sliceForQuestion(questions, q.question_no),
  }));

  // For a given workbook and question, extract the right pages and rename them
  const getPagesForWbQ = (wbId, slice) => {
    if (!slice) return [];
    return workbookMap[wbId]
      .filter(p => p.globalPageNo >= slice.start && p.globalPageNo <= slice.end)
      .map((p, idx) => new File([p.file], String(idx + 1), { type: p.file.type }));
  };

  // Validation: every workbook must have exactly the right pages for every question
  const wbValidation = workbookIds.map(wbId => {
    const issues = [];
    for (const { q, slice } of questionSlices) {
      if (!slice) { issues.push(`Q${q.question_no}: no slice computed`); continue; }
      const found = workbookMap[wbId].filter(p => p.globalPageNo >= slice.start && p.globalPageNo <= slice.end).length;
      if (found !== q.pages) issues.push(`Q${q.question_no}: found ${found}/${q.pages} pages`);
    }
    return { wbId, ok: issues.length === 0, issues };
  });

  const totalPages = questions.reduce((s, q) => s + q.pages, 0);
  const allReady   = workbookIds.length > 0 && questions.length > 0 && wbValidation.every(w => w.ok);

  // ── Upload — all questions for all workbooks ───────────────────────────────
  const handleUpload = async () => {
    if (!allReady) return;
    setUploading(true); setDone(false); setGlobalErr('');

    // Initialise progress: { qNo: { wbId: 'pending' } }
    const init = {};
    for (const { q } of questionSlices) {
      init[q.question_no] = {};
      for (const wbId of workbookIds) init[q.question_no][wbId] = 'pending';
    }
    setProgress(init);

    for (const { q, slice } of questionSlices) {
      for (const wbId of workbookIds) {
        const files = getPagesForWbQ(wbId, slice);
        try {
          await api.uploadQuestionImages(wbId, q.question_no, files);
          setProgress(p => ({ ...p, [q.question_no]: { ...p[q.question_no], [wbId]: 'success' } }));
        } catch (err) {
          setProgress(p => ({ ...p, [q.question_no]: { ...p[q.question_no], [wbId]: 'error' } }));
        }
      }
    }

    setUploading(false); setDone(true);
  };

  // ── Summary stats ──────────────────────────────────────────────────────────
  const allCells   = Object.values(progress).flatMap(wb => Object.values(wb));
  const successCount = allCells.filter(v => v === 'success').length;
  const errorCount   = allCells.filter(v => v === 'error').length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 h-full overflow-y-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-1">Upload Answer Sheets</h1>
      <p className="text-gray-500 mb-8">
        Select the paper, then drop the paper folder. All workbooks and all questions are processed automatically.
      </p>

      <div className="max-w-3xl bg-white rounded-xl shadow-lg border border-gray-200 p-8 space-y-6">

        {papersError && (
          <div className="p-4 bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-lg text-sm flex items-center justify-between">
            <span>{papersError}</span>
            <button onClick={fetchPapers} className="font-medium underline ml-3">Retry</button>
          </div>
        )}

        {/* Paper ID */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">Paper ID</label>
            {paperId && <button type="button" onClick={() => setPaperId('')} className="text-xs font-medium text-blue-600 hover:text-blue-800">Change</button>}
          </div>
          {papersLoading ? (
            <div className="w-full p-3 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-400">Loading papers…</div>
          ) : papers.length === 0 ? (
            <div className="w-full p-3 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-400">No papers found. Create a question paper first.</div>
          ) : (
            <select value={paperId} onChange={e => setPaperId(e.target.value)} disabled={uploading}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 bg-white">
              <option value="" disabled>Select a paper…</option>
              {papers.map(pid => <option key={pid} value={pid}>{pid}</option>)}
            </select>
          )}
        </div>

        {/* Questions summary (auto-loaded) */}
        {paperId && (
          <div>
            {qLoading ? (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-400">Loading questions…</div>
            ) : qError ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center justify-between">
                <span>{qError}</span>
                <button onClick={() => fetchQuestions(paperId)} className="font-medium underline">Retry</button>
              </div>
            ) : questions.length === 0 ? (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">No questions defined for this paper yet.</div>
            ) : (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                <p className="font-semibold mb-1">{questions.length} question{questions.length !== 1 ? 's' : ''} — {totalPages} total pages per workbook</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {questionSlices.map(({ q, slice }) => slice && (
                    <span key={q.question_no} className="bg-blue-100 text-blue-700 rounded px-2 py-0.5 text-xs font-mono">
                      Q{q.question_no}: pages {slice.start}–{slice.end}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Folder picker — shown once paper + questions are loaded */}
        {paperId && questions.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Paper Folder
              <span className="ml-1 text-gray-400 font-normal text-xs">— one sub-folder per workbook, pages named 1.jpg, 2.jpg …</span>
            </label>
            <div
              onClick={() => folderRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition cursor-pointer"
            >
              <input ref={folderRef} type="file" className="hidden"
                webkitdirectory="" directory="" multiple onChange={handleFolder} />
              <span className="text-4xl block mb-2">📁</span>
              {folderName
                ? <span className="text-sm text-green-700 font-medium">📂 {folderName} — {workbookIds.length} workbook{workbookIds.length !== 1 ? 's' : ''} detected</span>
                : <span className="text-sm text-gray-500">Click to select the paper folder</span>}
            </div>
          </div>
        )}

        {/* Parse warnings */}
        {parseErrors.length > 0 && (
          <div className="p-3 bg-yellow-50 border border-yellow-300 rounded-lg text-xs text-yellow-800 space-y-0.5">
            <p className="font-semibold mb-1">⚠ Some files were skipped:</p>
            {parseErrors.map((e, i) => <p key={i}>{e}</p>)}
          </div>
        )}

        {/* Workbook validation table */}
        {workbookIds.length > 0 && questions.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-gray-700 mb-2">
              {workbookIds.length} workbook{workbookIds.length !== 1 ? 's' : ''} — validation
            </h2>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Header row */}
              <div className="grid px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200"
                style={{ gridTemplateColumns: `160px repeat(${questions.length}, 1fr)` }}>
                <span>Workbook ID</span>
                {questions.map(q => <span key={q.question_no}>Q{q.question_no} ({q.pages}p)</span>)}
              </div>
              {/* Workbook rows */}
              <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                {wbValidation.map(({ wbId, ok, issues }) => (
                  <div key={wbId} className="grid px-4 py-3 items-center text-sm"
                    style={{ gridTemplateColumns: `160px repeat(${questions.length}, 1fr)` }}>
                    <span className="font-mono text-gray-800">{wbId}</span>
                    {questionSlices.map(({ q, slice }) => {
                      const found = slice
                        ? workbookMap[wbId].filter(p => p.globalPageNo >= slice.start && p.globalPageNo <= slice.end).length
                        : 0;
                      const cellOk = found === q.pages;
                      const qStatus = progress[q.question_no]?.[wbId];
                      return (
                        <span key={q.question_no} className={cellOk ? 'text-green-700' : 'text-red-600'}>
                          {qStatus === 'success' && '✓ '}
                          {qStatus === 'error'   && '✕ '}
                          {qStatus === 'pending' && '… '}
                          {found}/{q.pages}
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            {!allReady && (
              <p className="text-xs text-red-500 mt-2">
                Fix page count mismatches before uploading. Check your folder structure and filename numbering.
              </p>
            )}
          </div>
        )}

        {/* Done banner */}
        {done && (
          <div className={`p-4 rounded-lg text-sm border ${errorCount === 0 ? 'bg-green-50 border-green-300 text-green-800' : 'bg-yellow-50 border-yellow-300 text-yellow-800'}`}>
            Upload complete — {successCount} succeeded{errorCount > 0 ? `, ${errorCount} failed (see table above)` : ''}.
          </div>
        )}

        {/* Upload button */}
        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading || !allReady}
          className={`w-full py-3 font-semibold rounded-lg shadow transition text-white ${
            uploading || !allReady ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {uploading
            ? `Uploading… ${successCount + errorCount} / ${workbookIds.length * questions.length} done`
            : workbookIds.length > 0 && questions.length > 0
              ? `Upload all ${questions.length} question${questions.length !== 1 ? 's' : ''} for ${workbookIds.length} workbook${workbookIds.length !== 1 ? 's' : ''}`
              : 'Select a paper and folder to continue'}
        </button>

      </div>
    </div>
  );
}