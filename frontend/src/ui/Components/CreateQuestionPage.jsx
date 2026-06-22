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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!file) {
      setError('Please select a question image file.');
      return;
    }

    setLoading(true);
    try {
      await api.createQuestion(
        paperId,
        parseInt(questionNo),
        parseInt(maxMarks),
        parseInt(pages),
        file
      );
      setSuccess(`Question ${questionNo} for paper "${paperId}" created successfully!`);
      // Paper ID is deliberately kept — one paper has many questions, and
      // admins add them one at a time. Only the per-question fields reset.
      // Question number is bumped by 1 as a convenience guess for the next
      // question in the same paper — still fully editable if wrong.
      setQuestionNo(prev => (parseInt(prev) ? String(parseInt(prev) + 1) : ''));
      setMaxMarks('');
      setPages('');
      setFile(null);
      // Reset file input visually
      document.getElementById('question-file-input').value = '';
    } catch (err) {
      setError(err.message || 'Failed to create question. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-2">Create Question Paper</h1>
      <p className="text-gray-500 mb-8">
        Add a question to an exam paper. Upload an image of the question along with its details.
      </p>

      <div className="max-w-xl bg-white rounded-xl shadow-lg border border-gray-200 p-8">

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-300 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-300 text-green-700 rounded-lg text-sm">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Paper ID */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Paper ID
              </label>
              {paperId && (
                <button
                  type="button"
                  onClick={() => { setPaperId(''); setQuestionNo(''); }}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800"
                >
                  Start a different paper
                </button>
              )}
            </div>
            <input
              type="text"
              value={paperId}
              onChange={e => setPaperId(e.target.value)}
              placeholder="e.g. MATH101-2024"
              required
              disabled={loading}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition disabled:bg-gray-50"
            />
            <p className="text-xs text-gray-400 mt-1">
              A unique identifier for this exam. All questions in the same exam share the same Paper ID
              — it stays filled in after each question so you can add the next one straight away.
            </p>
          </div>

          {/* Question Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Question Number
            </label>
            <input
              type="number"
              value={questionNo}
              onChange={e => setQuestionNo(e.target.value)}
              placeholder="e.g. 1"
              min="1"
              required
              disabled={loading}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition disabled:bg-gray-50"
            />
          </div>

          {/* Max Marks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Maximum Marks
            </label>
            <input
              type="number"
              value={maxMarks}
              onChange={e => setMaxMarks(e.target.value)}
              placeholder="e.g. 20"
              min="1"
              required
              disabled={loading}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition disabled:bg-gray-50"
            />
            <p className="text-xs text-gray-400 mt-1">
              The maximum marks an examiner can award for this question.
            </p>
          </div>

          {/* Pages */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Answer Pages
            </label>
            <input
              type="number"
              value={pages}
              onChange={e => setPages(e.target.value)}
              placeholder="e.g. 2"
              min="1"
              required
              disabled={loading}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition disabled:bg-gray-50"
            />
            <p className="text-xs text-gray-400 mt-1">
              How many scanned pages make up a student's answer to this question. When uploading answer sheets later, exactly this many pages must be uploaded per student.
            </p>
          </div>

          {/* Question Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Question Image
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition">
              <input
                id="question-file-input"
                type="file"
                accept="image/*"
                onChange={e => setFile(e.target.files[0])}
                disabled={loading}
                className="hidden"
              />
              <label
                htmlFor="question-file-input"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <span className="text-4xl">🖼️</span>
                {file ? (
                  <span className="text-sm text-green-600 font-medium">{file.name}</span>
                ) : (
                  <span className="text-sm text-gray-500">
                    Click to upload question image
                  </span>
                )}
              </label>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Upload a scan or photo of the question as it appears on the exam paper.
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700 transition ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {loading ? 'Creating Question...' : 'Create Question'}
          </button>

        </form>
      </div>
    </div>
  );
}