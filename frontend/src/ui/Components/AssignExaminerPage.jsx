import { useState, useEffect } from 'react';
import api from '../api.js';

export default function AssignExaminerPage() {
  const [examiners, setExaminers] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [selectedExaminer, setSelectedExaminer] = useState('');
  const [paperId, setPaperId] = useState('');
  const [questionNo, setQuestionNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setFetchingData(true);
    try {
      const [examinersRes, assignedRes] = await Promise.all([
        api.getUnassignedExaminers(),
        api.getAssignedQuestions(),
      ]);
      setExaminers(examinersRes.examiners || []);
      setAssignments(assignedRes.data || {});
    } catch (err) {
      setError('Failed to load data: ' + err.message);
    } finally {
      setFetchingData(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    setLoading(true);
    try {
      await api.assignExaminer(parseInt(selectedExaminer), paperId, parseInt(questionNo));
      setSuccess(`Examiner #${selectedExaminer} assigned to Question ${questionNo} of "${paperId}".`);
      setSelectedExaminer(''); setPaperId(''); setQuestionNo('');
      loadData(); // Refresh the lists
    } catch (err) {
      setError(err.message || 'Failed to assign examiner.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-1">Assign Examiner to Question</h1>
      <p className="text-gray-500 mb-8">Assign an examiner to mark a specific question across all student workbooks.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Assignment Form */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-5">New Assignment</h2>

          {error && <div className="mb-5 p-4 bg-red-50 border border-red-300 text-red-700 rounded-lg text-sm">{error}</div>}
          {success && <div className="mb-5 p-4 bg-green-50 border border-green-300 text-green-700 rounded-lg text-sm">{success}</div>}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Examiner</label>
              {fetchingData ? (
                <div className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-400 text-sm">Loading examiners...</div>
              ) : examiners.length === 0 ? (
                <div className="w-full p-3 border border-orange-300 rounded-lg bg-orange-50 text-orange-700 text-sm">
                  No unassigned examiners available. All examiners have been assigned.
                </div>
              ) : (
                <select value={selectedExaminer} onChange={e => setSelectedExaminer(e.target.value)}
                  required disabled={loading}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:bg-gray-50">
                  <option value="">Select an examiner...</option>
                  {examiners.map(id => (
                    <option key={id} value={id}>Examiner #{id}</option>
                  ))}
                </select>
              )}
              <p className="text-xs text-gray-400 mt-1">Only shows examiners not yet assigned to any question.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Paper ID</label>
              <input type="text" value={paperId} onChange={e => setPaperId(e.target.value)}
                placeholder="e.g. MATH101-2024" required disabled={loading}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Question Number</label>
              <input type="number" value={questionNo} onChange={e => setQuestionNo(e.target.value)}
                placeholder="e.g. 1" min="1" required disabled={loading}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50" />
            </div>

            <button type="submit" disabled={loading || examiners.length === 0}
              className={`w-full py-3 font-semibold rounded-lg shadow transition text-white ${
                loading || examiners.length === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              }`}>
              {loading ? 'Assigning...' : 'Assign Examiner'}
            </button>
          </form>
        </div>

        {/* Current Assignments Table */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-5">Current Assignments</h2>
          {fetchingData ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : Object.keys(assignments).length === 0 ? (
            <p className="text-gray-400 text-sm">No questions created yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left p-3 text-gray-600 font-medium">Paper ID</th>
                    <th className="text-left p-3 text-gray-600 font-medium">Q#</th>
                    <th className="text-left p-3 text-gray-600 font-medium">Examiner</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(assignments).flatMap(([paper, questions]) =>
                    Object.entries(questions).map(([qNo, examiner]) => (
                      <tr key={`${paper}-${qNo}`} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-3 text-gray-800 font-mono text-xs">{paper}</td>
                        <td className="p-3 text-gray-800">{qNo}</td>
                        <td className="p-3">
                          {examiner === 'Unassigned'
                            ? <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">Unassigned</span>
                            : <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">#{examiner}</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}