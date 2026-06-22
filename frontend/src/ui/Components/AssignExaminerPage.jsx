import { useState, useEffect } from 'react';
import api from '../api.js';

export default function AssignExaminerPage() {
  const [examiners, setExaminers] = useState([]);
  const [examinerLoad, setExaminerLoad] = useState({});
  const [selectedExaminer, setSelectedExaminer] = useState('');

  const [paperId, setPaperId] = useState('');
  const [papers, setPapers] = useState([]);
  const [papersLoading, setPapersLoading] = useState(true);
  const [papersError, setPapersError] = useState('');

  const [questionNo, setQuestionNo] = useState('');
  const [questions, setQuestions] = useState([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState('');

  const [assignments, setAssignments] = useState([]);

  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    setQuestionNo('');
    if (paperId) fetchQuestions(paperId);
    else setQuestions([]);
  }, [paperId]);

  const loadData = async () => {
    setFetchingData(true);
    setPapersLoading(true);
    try {
      const [examinersRes, assignedRes, papersRes] = await Promise.all([
        api.getUnassignedExaminers(),
        api.getAssignedQuestions(),
        api.getPapers(),
      ]);
      setExaminers(examinersRes.examiners || []);
      setExaminerLoad(examinersRes.examiner_load || {});
      setAssignments(assignedRes.assignments || []);
      setPapers(papersRes.paper_ids || []);
    } catch (err) {
      setError('Failed to load data: ' + err.message);
    } finally {
      setFetchingData(false);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    setLoading(true);
    try {
      await api.assignExaminer(parseInt(selectedExaminer), paperId, parseInt(questionNo));
      setSuccess(`Examiner #${selectedExaminer} assigned to Question ${questionNo} of "${paperId}".`);
      setSelectedExaminer('');
      setQuestionNo('');
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to assign examiner.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-1">Assign Examiner to Question</h1>
      <p className="text-gray-500 mb-8">Assign an examiner to mark a specific question. One examiner can be assigned to multiple questions.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-5">New Assignment</h2>

          {error && <div className="mb-5 p-4 bg-red-50 border border-red-300 text-red-700 rounded-lg text-sm">{error}</div>}
          {success && <div className="mb-5 p-4 bg-green-50 border border-green-300 text-green-700 rounded-lg text-sm">{success}</div>}
          {papersError && (
            <div className="mb-5 p-4 bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-lg text-sm flex items-center justify-between">
              <span>{papersError}</span>
              <button type="button" onClick={loadData} className="font-medium underline">Retry</button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Examiner</label>
              {fetchingData ? (
                <div className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-400 text-sm">Loading examiners...</div>
              ) : examiners.length === 0 ? (
                <div className="w-full p-3 border border-orange-300 rounded-lg bg-orange-50 text-orange-700 text-sm">
                  No examiner accounts exist yet. Create one via signup first.
                </div>
              ) : (
                <select value={selectedExaminer} onChange={e => setSelectedExaminer(e.target.value)}
                  required disabled={loading}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:bg-gray-50">
                  <option value="">Select an examiner...</option>
                  {examiners.map(id => (
                    <option key={id} value={id}>
                      Examiner #{id}{examinerLoad[id] ? ` — ${examinerLoad[id]} question${examinerLoad[id] !== 1 ? 's' : ''} assigned` : ' — no questions yet'}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-xs text-gray-400 mt-1">An examiner stays in this list no matter how many questions they already have.</p>
            </div>

            <button type="submit" disabled={loading || examiners.length === 0 || !paperId || !questionNo}
              className={`w-full py-3 font-semibold rounded-lg shadow transition text-white ${
                loading || examiners.length === 0 || !paperId || !questionNo
                  ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              }`}>
              {loading ? 'Assigning...' : 'Assign Examiner'}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-gray-700">Current Assignments</h2>
            <span className="text-xs text-gray-400">Newest first</span>
          </div>
          {fetchingData ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : assignments.length === 0 ? (
            <p className="text-gray-400 text-sm">No questions created yet.</p>
          ) : (
            <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left p-3 text-gray-600 font-medium">Paper ID</th>
                    <th className="text-left p-3 text-gray-600 font-medium">Q#</th>
                    <th className="text-left p-3 text-gray-600 font-medium">Examiner</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map(({ paper_id, question_no, examiner_id }) => (
                    <tr key={`${paper_id}-${question_no}`} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-3 text-gray-800 font-mono text-xs">{paper_id}</td>
                      <td className="p-3 text-gray-800">{question_no}</td>
                      <td className="p-3">
                        {examiner_id === 'Unassigned'
                          ? <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">Unassigned</span>
                          : <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">#{examiner_id}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}