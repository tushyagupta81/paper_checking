import { useState } from 'react';
import api from '../api.js';

export default function UploadImagesPage() {
  const [workbookId, setWorkbookId] = useState('');
  const [questionNo, setQuestionNo] = useState('');
  const [pageCount, setPageCount] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // When page count changes, reset file slots to match
  const handlePageCountChange = (e) => {
    const count = parseInt(e.target.value) || 0;
    setPageCount(e.target.value);
    setFiles(new Array(count).fill(null));
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
      setSuccess(`Successfully uploaded ${files.length} page(s) for Workbook "${workbookId}", Question ${questionNo}.`);
      setWorkbookId(''); setQuestionNo(''); setPageCount(''); setFiles([]);
    } catch (err) {
      setError(err.message || 'Upload failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-1">Upload Scanned Answer Sheets</h1>
      <p className="text-gray-500 mb-8">Upload scanned images of a student's answer for one question. The number of images must match the page count set when creating the question.</p>

      <div className="max-w-xl bg-white rounded-xl shadow-lg border border-gray-200 p-8">
        {error && <div className="mb-5 p-4 bg-red-50 border border-red-300 text-red-700 rounded-lg text-sm">{error}</div>}
        {success && <div className="mb-5 p-4 bg-green-50 border border-green-300 text-green-700 rounded-lg text-sm">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Workbook ID</label>
            <input type="text" value={workbookId} onChange={e => setWorkbookId(e.target.value)}
              placeholder="e.g. WB-2024-001" required disabled={loading}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Question Number</label>
            <input type="number" value={questionNo} onChange={e => setQuestionNo(e.target.value)}
              placeholder="e.g. 1" min="1" required disabled={loading}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Number of Pages</label>
            <input type="number" value={pageCount} onChange={handlePageCountChange}
              placeholder="e.g. 2" min="1" required disabled={loading}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50" />
            <p className="text-xs text-gray-400 mt-1">Must match the page count you set when creating this question. The form will show exactly that many upload slots.</p>
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