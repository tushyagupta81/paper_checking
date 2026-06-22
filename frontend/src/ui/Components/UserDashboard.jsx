// frontend/src/ui/Components/UserDashboard.jsx
import { useState, useEffect } from 'react';
import { FileText, CheckCircle2, Clock, RefreshCw, AlertCircle, Award } from 'lucide-react';
import api from '../api.js';

function Skeleton({ className }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

// Single question row — pure display, nothing clickable, nothing editable
function QuestionRow({ q }) {
  return (
    <div className="flex items-center justify-between py-3 px-4 border-b border-gray-100 last:border-b-0">
      <div className="flex items-center gap-3">
        {q.checked ? (
          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
        ) : (
          <Clock className="w-5 h-5 text-amber-400 flex-shrink-0" />
        )}
        <span className="text-sm font-medium text-gray-700">Question {q.question_no}</span>
      </div>

      {q.checked ? (
        <span className="text-sm font-bold text-gray-900">
          {q.marks} <span className="text-gray-400 font-normal">/ {q.max_marks}</span>
        </span>
      ) : (
        <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
          Pending
        </span>
      )}
    </div>
  );
}

// One workbook (one exam paper) — shows total + per-question breakdown
function WorkbookCard({ wb }) {
  const allChecked = wb.fully_checked;
  const percent = wb.total_max > 0 ? Math.round((wb.total_obtained / wb.total_max) * 100) : null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">{wb.paper_id}</p>
          <p className="text-sm font-mono text-gray-700 mt-0.5">{wb.workbook_id}</p>
        </div>
        {allChecked ? (
          <div className="text-right">
            <p className="text-2xl font-extrabold text-gray-900">
              {wb.total_obtained}<span className="text-base text-gray-400 font-normal">/{wb.total_max}</span>
            </p>
            {percent !== null && <p className="text-xs text-green-600 font-medium">{percent}%</p>}
          </div>
        ) : (
          <span className="text-xs font-medium text-amber-700 bg-amber-100 px-3 py-1.5 rounded-full">
            Checking in progress
          </span>
        )}
      </div>

      <div>
        {wb.questions.map(q => (
          <QuestionRow key={q.question_no} q={q} />
        ))}
      </div>
    </div>
  );
}

export default function UserDashboard({ userData }) {
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [results, setResults]   = useState([]);

  const fetchResults = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getStudentResults();
      setResults(response.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load your results.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchResults(); }, []);

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">My Results</h1>
          <p className="text-sm text-gray-500 mt-1">View your checked answer sheets and marks</p>
        </div>
        <button
          onClick={fetchResults}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Could not load results</p>
            <p className="text-sm text-red-600 mt-0.5">{error}</p>
            <button onClick={fetchResults} className="mt-2 text-sm font-medium text-red-700 underline hover:text-red-900">
              Try again
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : results.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-16 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No workbooks assigned yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Once your exam papers are uploaded and assigned, they'll appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {results.length > 1 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
              <Award className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <p className="text-sm text-blue-800">
                You have <span className="font-semibold">{results.length}</span> exam paper{results.length !== 1 ? 's' : ''} on record.
              </p>
            </div>
          )}
          {results.map(wb => (
            <WorkbookCard key={wb.workbook_id} wb={wb} />
          ))}
        </div>
      )}
    </div>
  );
}