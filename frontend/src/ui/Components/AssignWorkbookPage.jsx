import { useState, useEffect } from 'react';
import api from '../api.js';

export default function AssignWorkbookPage() {
  const [studentId, setStudentId] = useState('');
  const [workbookId, setWorkbookId] = useState('');
  const [paperId, setPaperId] = useState('');
  const [papers, setPapers] = useState([]);
  const [papersLoading, setPapersLoading] = useState(true);
  const [papersError, setPapersError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchPapers();
  }, []);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    setLoading(true);
    try {
      await api.assignWorkbook(parseInt(studentId), workbookId, paperId);
      setSuccess(`Workbook "${workbookId}" assigned to Student #${studentId} for paper "${paperId}".`);
      // Paper ID is kept — one paper has many students, assigned one at a
      // time. Only the per-student fields reset so the admin can move
      // straight to the next student without re-picking the paper.
      setStudentId('');
      setWorkbookId('');
    } catch (err) {
      setError(err.message || 'Failed to assign workbook.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-1">Assign Workbook to Student</h1>
      <p className="text-gray-500 mb-8">Link a student's user account to their physical answer booklet and the exam paper they sat.</p>

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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Student ID</label>
            <input type="number" value={studentId} onChange={e => setStudentId(e.target.value)}
              placeholder="e.g. 3" min="1" required disabled={loading}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50" />
            <p className="text-xs text-gray-400 mt-1">The numeric user ID assigned to the student at signup.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Workbook ID</label>
            <input type="text" value={workbookId} onChange={e => setWorkbookId(e.target.value)}
              placeholder="e.g. WB-2024-001" required disabled={loading}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50" />
            <p className="text-xs text-gray-400 mt-1">The barcode or unique ID written on the student's physical answer booklet.</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Paper ID</label>
              {paperId && (
                <button
                  type="button"
                  onClick={() => setPaperId('')}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800"
                >
                  Change paper
                </button>
              )}
            </div>

            {papersLoading ? (
              <div className="w-full p-3 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-400">
                Loading papers…
              </div>
            ) : papers.length === 0 ? (
              <div className="w-full p-3 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-400">
                No papers found. Create a question paper first.
              </div>
            ) : (
              <select
                value={paperId}
                onChange={e => setPaperId(e.target.value)}
                required
                disabled={loading}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 bg-white"
              >
                <option value="" disabled>Select a paper…</option>
                {papers.map(pid => (
                  <option key={pid} value={pid}>{pid}</option>
                ))}
              </select>
            )}
            <p className="text-xs text-gray-400 mt-1">
              Stays selected after each assignment, since one paper is sat by many students.
            </p>
          </div>

          <button type="submit" disabled={loading || papersLoading || papers.length === 0}
            className={`w-full py-3 font-semibold rounded-lg shadow transition text-white ${
              loading || papersLoading || papers.length === 0
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}>
            {loading ? 'Assigning...' : 'Assign Workbook'}
          </button>
        </form>
      </div>
    </div>
  );
}