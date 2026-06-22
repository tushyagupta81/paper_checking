// frontend/src/ui/Components/ReportsPage.jsx
import { useState, useEffect } from 'react';
import { FileText, ChevronDown, ChevronRight, Download, RefreshCw, AlertCircle, Users as UsersIcon } from 'lucide-react';
import api from '../api.js';

function Skeleton({ className }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

// ── CSV export — builds one row per student per workbook ──────────────────────
function downloadCsv(students) {
  const rows = [['Student ID', 'Paper ID', 'Workbook ID', 'Question No', 'Marks', 'Max Marks', 'Checked']];

  students.forEach(s => {
    s.workbooks.forEach(wb => {
      wb.questions.forEach(q => {
        rows.push([
          s.student_id,
          wb.paper_id,
          wb.workbook_id,
          q.question_no,
          q.marks ?? '',
          q.max_marks ?? '',
          q.checked ? 'Yes' : 'No',
        ]);
      });
    });
  });

  const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `paper_checking_report_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── One workbook row inside a student's expanded panel ────────────────────────
function WorkbookRow({ wb }) {
  const percent = wb.total_max > 0 ? Math.round((wb.total_obtained / wb.total_max) * 100) : null;

  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">{wb.paper_id}</p>
          <p className="text-sm font-mono text-gray-700">{wb.workbook_id}</p>
        </div>
        <div className="text-right">
          {wb.fully_checked ? (
            <>
              <p className="text-lg font-bold text-gray-900">
                {wb.total_obtained}<span className="text-sm text-gray-400 font-normal">/{wb.total_max}</span>
              </p>
              {percent !== null && <p className="text-xs text-green-600">{percent}%</p>}
            </>
          ) : (
            <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
              In progress
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {wb.questions.map(q => (
          <span
            key={q.question_no}
            className={`text-xs px-2 py-1 rounded font-medium ${
              q.checked ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
            }`}
          >
            Q{q.question_no}: {q.checked ? `${q.marks}/${q.max_marks}` : 'pending'}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── One student card — collapsible ─────────────────────────────────────────────
function StudentCard({ student }) {
  const [expanded, setExpanded] = useState(false);

  const totalObtained = student.workbooks.reduce((sum, wb) => sum + wb.total_obtained, 0);
  const totalMax = student.workbooks.reduce((sum, wb) => sum + wb.total_max, 0);
  const allChecked = student.workbooks.every(wb => wb.fully_checked);
  const percent = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition text-left"
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
            {String(student.student_id).slice(-2)}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Student #{student.student_id}</p>
            <p className="text-xs text-gray-400">{student.workbooks.length} paper{student.workbooks.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="text-right">
          {allChecked ? (
            <>
              <p className="text-lg font-bold text-gray-900">
                {totalObtained}<span className="text-sm text-gray-400 font-normal">/{totalMax}</span>
              </p>
              {percent !== null && <p className="text-xs text-green-600">{percent}% overall</p>}
            </>
          ) : (
            <span className="text-xs font-medium text-amber-700 bg-amber-100 px-3 py-1.5 rounded-full">
              Checking in progress
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-3 border-t border-gray-100 pt-4">
          {student.workbooks.map(wb => (
            <WorkbookRow key={wb.workbook_id} wb={wb} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReportsPage({ userRole }) {
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [students, setStudents] = useState([]);

  const fetchResults = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getAllStudentResults();
      setStudents(response.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load student results.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userRole === 'admin') fetchResults();
  }, [userRole]);

  if (userRole !== 'admin') {
    return (
      <div className="p-8 text-center text-xl text-red-500">
        You are not authorized to access the Reports page.
      </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Result Reports</h1>
          <p className="text-sm text-gray-500 mt-1">Marks across all students and papers</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchResults}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => downloadCsv(students)}
            disabled={loading || students.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Could not load reports</p>
            <p className="text-sm text-red-600 mt-0.5">{error}</p>
            <button onClick={fetchResults} className="mt-2 text-sm font-medium text-red-700 underline hover:text-red-900">
              Try again
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : students.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-16 text-center">
          <UsersIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No students with assigned workbooks yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Reports will appear here once workbooks are assigned and evaluated.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {students.map(s => (
            <StudentCard key={s.student_id} student={s} />
          ))}
        </div>
      )}
    </div>
  );
}