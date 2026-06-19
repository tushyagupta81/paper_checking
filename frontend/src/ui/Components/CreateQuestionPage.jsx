import { useState } from 'react';
import api from '../api.js';

export default function CreateQuestionPage() {
  const [paperId, setPaperId] = useState('');
  const [questionNo, setQuestionNo] = useState('');
  const [maxMarks, setMaxMarks] = useState('');
  const [pages, setPages] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const resetForm = () => {
    setPaperId(''); setQuestionNo(''); setMaxMarks(''); setPages(''); setFile(null);
    document.getElementById('q-file-input').value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!file) return setError('Please select a question image file.');
    setLoading(true);
    try {
      await api.createQuestion(paperId, parseInt(questionNo), parseInt(maxMarks), parseInt(pages), file);
      setSuccess(`Question ${questionNo} for paper "${paperId}" created! You can add another question below.`);
      resetForm();
    } catch (err) {
      setError(err.message || 'Failed to create question.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-1">Create Question Paper</h1>
      <p className="text-gray-500 mb-8">Add questions one at a time. Each question belongs to a Paper ID — use the same Paper ID for all questions in one exam.</p>

      <div className="max-w-xl bg-white rounded-xl shadow-lg border border-gray-200 p-8">
        {error && <div className="mb-5 p-4 bg-red-50 border border-red-300 text-red-700 rounded-lg text-sm">{error}</div>}
        {success && <div className="mb-5 p-4 bg-green-50 border border-green-300 text-green-700 rounded-lg text-sm">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Paper ID</label>
            <input type="text" value={paperId} onChange={e => setPaperId(e.target.value)}
              placeholder="e.g. MATH101-2024" required disabled={loading}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50" />
            <p className="text-xs text-gray-400 mt-1">All questions in the same exam share the same Paper ID.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Question Number</label>
            <input type="number" value={questionNo} onChange={e => setQuestionNo(e.target.value)}
              placeholder="e.g. 1" min="1" required disabled={loading}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Marks</label>
            <input type="number" value={maxMarks} onChange={e => setMaxMarks(e.target.value)}
              placeholder="e.g. 20" min="1" required disabled={loading}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Answer Pages</label>
            <input type="number" value={pages} onChange={e => setPages(e.target.value)}
              placeholder="e.g. 2" min="1" required disabled={loading}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50" />
            <p className="text-xs text-gray-400 mt-1">How many scanned pages a student's answer for this question will take. When uploading answer sheets later, exactly this many images must be uploaded per student per question.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Question Image</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition cursor-pointer">
              <input id="q-file-input" type="file" accept="image/*"
                onChange={e => setFile(e.target.files[0])} disabled={loading} className="hidden" />
              <label htmlFor="q-file-input" className="cursor-pointer flex flex-col items-center gap-2">
                <span className="text-4xl">🖼️</span>
                {file
                  ? <span className="text-sm text-green-600 font-medium">{file.name}</span>
                  : <span className="text-sm text-gray-500">Click to upload question image</span>}
              </label>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className={`w-full py-3 bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700 transition ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {loading ? 'Creating...' : 'Create Question'}
          </button>
        </form>
      </div>
    </div>
  );
}