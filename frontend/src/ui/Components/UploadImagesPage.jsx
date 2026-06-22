import { useState, useEffect } from 'react';
import api from '../api.js';

export default function UploadImagesPage() {
  const [workbookId, setWorkbookId] = useState('');

  // Paper / question selection — drives the auto-filled page count
  const [paperId, setPaperId] = useState('');
  const [papers, setPapers] = useState([]);
  const [papersLoading, setPapersLoading] = useState(true);
  const [papersError, setPapersError] = useState('');

  const [questionNo, setQuestionNo] = useState('');
  const [questions, setQuestions] = useState([]); // [{question_no, max_marks, pages}]
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState('');

  const [pageCount, setPageCount] = useState(''); // auto-filled, read-only
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchPapers();
  }, []);

  // Whenever the paper changes, fetch its questions and reset anything
  // downstream that depended on the previous paper's question list.
  useEffect(() => {
    setQuestionNo('');
    setPageCount('');
    setFiles([]);
    if (paperId) {
      fetchQuestions(paperId);
    } else {
      setQuestions([]);
    }
  }, [paperId]);

  // Whenever the question changes, auto-fill the page count from the
  // question's stored record — no manual re-entry needed.
  useEffect(() => {
    if (!questionNo) {
      setPageCount('');
      setFiles([]);
      return;
    }
    const selected = questions.find(q => String(q.question_no) === String(questionNo));
    if (selected) {
      setPageCount(String(selected.pages));
      setFiles(new Array(selected.pages).fill(null));
    }
  }, [questionNo, questions]);

  const fetchPapers = async () => {
    setPapersLoading(true);
    setPapersError('');
    try {
      const response = await api.getPapers();
      setPapers(response.paper_ids || []);
    } catch (err) {
      setPapersError(err.message || 'Failed to load papers.');
    } finally {
      setPapersLoading(false);
    }
  };

  const fetchQuestions = async (pid) => {
    setQuestionsLoading(true);
    setQuestionsError('');
    try {
      const response = await api.getQuestionsForPaper(pid);
      setQuestions(response.questions || []);
    } catch (err) {
      setQuestionsError(err.message || 'Failed to load questions for this paper.');
      setQuestions([]);
    } finally {
      setQuestionsLoading(false);
    }
  };

  const handleFileChange = (index, file) => {
    setFiles(prev => {
      const updated = [...prev];
      updated[index] = file;
      return updated;
    });
  };

  const allFilesSelected = files.length > 0 && files.every(f => f !== null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');

    if (!allFilesSelected) {
      return setError(`Please select all ${pageCount} page images before uploading.`);
    }

    setLoading(true);
    try {
      await api.uploadQuestionImages(workbookId, parseInt(questionNo), files);
      setSuccess(`Successfully uploaded ${files.length} page(s) for Workbook "${workbookId}", Question ${questionNo} (Paper "${paperId}").`);
      // Paper and question stay selected — admin is very likely uploading
      // the next student's answer sheet for the exact same question next.
      // Only the workbook-specific fields reset.
      setWorkbookId('');
      setFiles(new Array(parseInt(pageCount) || 0).fill(null));
    } catch (err) {
      setError(err.message || 'Upload failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-1">Upload Scanned Answer Sheets</h1>
      <p className="text-gray-500 mb-8">Pick the paper and question first — the number of pages is filled in automatically from when the question was created.</p>

      <div className="max-w-xl bg-white rounded-xl shadow-lg border border-gray-200 p-8">
        {error && <div className="mb-5 p-4 bg-red-50 border border-red-300 text-red-700 rounded-lg text-sm">{error}</div>}
        {success && <div className="mb-5 p-4 bg-green-50 border border-green-300 text-green-700 rounded-lg text-sm">{success}</div>}
        {papersError && (
          <div className="mb-5 p-4 bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-lg text-sm flex items-center justify-between">
            <span>{papersError}</span>
            <button type="button" onClick={fetchPapers} className="font-medium underline">Retry</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Paper ID — dropdown */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Paper ID</label>
              {paperId && (
                <button type="button" onClick={() => setPaperId('')} className="text-xs font-medium text-blue-600 hover:text-blue-800">
                  Change paper
                </button>
              )}
            </div>
            {papersLoading ? (
              <div className="w-full p-3 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-400">Loading papers…</div>
            ) : papers.length === 0 ? (
              <div className="w-full p-3 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-400">No papers found. Create a question paper first.</div>
            ) : (
              <select
                value={paperId}
                onChange={e => setPaperId(e.target.value)}
                required
                disabled={loading}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 bg-white"
              >
                <option value="" disabled>Select a paper…</option>
                {papers.map(pid => <option key={pid} value={pid}>{pid}</option>)}
              </select>
            )}
          </div>

          {/* Question Number — dropdown, populated from the selected paper */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Question Number</label>
            {!paperId ? (
              <div className="w-full p-3 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-400">Select a paper first</div>
            ) : questionsLoading ? (
              <div className="w-full p-3 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-400">Loading questions…</div>
            ) : questionsError ? (
              <div className="w-full p-3 border border-red-200 rounded-lg bg-red-50 text-sm text-red-600 flex items-center justify-between">
                <span>{questionsError}</span>
                <button type="button" onClick={() => fetchQuestions(paperId)} className="font-medium underline">Retry</button>
              </div>
            ) : questions.length === 0 ? (
              <div className="w-full p-3 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-400">No questions found for this paper.</div>
            ) : (
              <select
                value={questionNo}
                onChange={e => setQuestionNo(e.target.value)}
                required
                disabled={loading}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 bg-white"
              >
                <option value="" disabled>Select a question…</option>
                {questions.map(q => (
                  <option key={q.question_no} value={q.question_no}>
                    Q{q.question_no} — {q.max_marks} marks, {q.pages} page{q.pages !== 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Workbook ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Workbook ID</label>
            <input type="text" value={workbookId} onChange={e => setWorkbookId(e.target.value)}
              placeholder="e.g. WB-2024-001" required disabled={loading}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50" />
          </div>

          {/* Number of Pages — auto-filled, read only */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Number of Pages</label>
            <input
              type="text"
              value={pageCount ? `${pageCount} page${pageCount !== '1' ? 's' : ''} (set when this question was created)` : ''}
              readOnly
              disabled
              placeholder="Select a question above"
              className="w-full p-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 mt-1">
              Filled in automatically — no need to remember or re-type it.
            </p>
          </div>

          {/* Dynamic file upload slots */}
          {files.length > 0 && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Page Images</label>
              {files.map((file, index) => (
                <div key={index} className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 transition">
                  <input
                    id={`page-file-${index}`}
                    type="file"
                    accept="image/*"
                    onChange={e => handleFileChange(index, e.target.files[0])}
                    disabled={loading}
                    className="hidden"
                  />
                  <label htmlFor={`page-file-${index}`} className="cursor-pointer flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center flex-shrink-0">
                      {index + 1}
                    </span>
                    {file
                      ? <span className="text-sm text-green-600 font-medium">✓ {file.name}</span>
                      : <span className="text-sm text-gray-500">Click to select Page {index + 1}</span>}
                  </label>
                </div>
              ))}
            </div>
          )}

          <button type="submit" disabled={loading || !allFilesSelected || files.length === 0}
            className={`w-full py-3 font-semibold rounded-lg shadow transition text-white ${
              loading || !allFilesSelected || files.length === 0
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}>
            {loading ? 'Uploading...' : `Upload ${files.length > 0 ? files.length + ' Page(s)' : ''}`}
          </button>
        </form>
      </div>
    </div>
  );
}