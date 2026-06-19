import { useState } from 'react';
import api from '../api.js';

export default function AssignWorkbookPage() {
  const [studentId, setStudentId] = useState('');
  const [workbookId, setWorkbookId] = useState('');
  const [paperId, setPaperId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    setLoading(true);
    try {
      await api.assignWorkbook(parseInt(studentId), workbookId, paperId);
      setSuccess(`Workbook "${workbookId}" assigned to Student #${studentId} for paper "${paperId}".`);
      setStudentId(''); setWorkbookId(''); setPaperId('');
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Paper ID</label>
            <input type="text" value={paperId} onChange={e => setPaperId(e.target.value)}
              placeholder="e.g. MATH101-2024" required disabled={loading}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50" />
            <p className="text-xs text-gray-400 mt-1">Must exactly match a Paper ID you already created in "Create Question".</p>
          </div>

          <button type="submit" disabled={loading}
            className={`w-full py-3 bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700 transition ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {loading ? 'Assigning...' : 'Assign Workbook'}
          </button>
        </form>
      </div>
    </div>
  );
}