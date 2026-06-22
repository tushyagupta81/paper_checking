import { useState, useEffect } from 'react'
import { FileText, ClipboardList, ChevronRight, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../api.js'
import EvaluationPage from './EvaluationPage';

// API returns - { paper_id, question_no, workbook_id,..}

// From this we find out - 
// 1. totalSheets - total unique workbook ids
// 2. sheetsLeft - unchecked workbooks
// 3. questionAssigned - flat list of question nos.
// 4. workbookList - list containing [paper_id, question_no. , workbook_id]


// New API response shape:
// {
//   data: { paper_id: { question_no: { pending: [wb_id,...], evaluated: [{workbook_id, marks}, ...] } } },
//   summary: { pending, evaluated, total }
// }
function parseWorkbooks(data, summary) {
  const pendingList = [];
  const evaluatedList = [];
  const questionSet = new Set();

  for (const [paper_id, questions] of Object.entries(data)) {
    for (const [question_no, group] of Object.entries(questions)) {
      questionSet.add(Number(question_no));

      for (const workbook_id of group.pending || []) {
        pendingList.push({ paper_id, question_no: Number(question_no), workbook_id });
      }
      for (const item of group.evaluated || []) {
        evaluatedList.push({
          paper_id,
          question_no: Number(question_no),
          workbook_id: item.workbook_id,
          marks: item.marks,
        });
      }
    }
  }

  return {
    workbookList: pendingList,
    evaluatedList,
    questionsAssigned: [...questionSet].sort((a, b) => a - b),
    sheetsLeft: summary?.pending ?? pendingList.length,
    sheetsEvaluated: summary?.evaluated ?? evaluatedList.length,
    totalSheets: summary?.total ?? (pendingList.length + evaluatedList.length),
  };
}

// Star Card
function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <p className="text-3xl font-extrabold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

// Skeleton loader
function Skeleton({ className }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

export default function EvaluatorDashboard({ userData }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [metrics, setMetrics] = useState(null);
  const [activeWorkbook, setActiveWorkbook] = useState(null);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'evaluated'
  // { workbook_id, question_no, paper_id }

  const fetchWorkbooks = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getExaminerWorkbooks();
      // response.data is the nested mapping, response.summary has counts
      const parsed = parseWorkbooks(response.data, response.summary);
      setMetrics(parsed);
    } catch (err) {
      // 404 means no questions assigned yet — treat as empty, not a crash
      if (err.message?.includes('No questions assigned')) {
        setMetrics({
          workbookList: [],
          evaluatedList: [],
          questionsAssigned: [],
          sheetsLeft: 0,
          sheetsEvaluated: 0,
          totalSheets: 0,
        });
      } else {
        setError(err.message || 'Failed to load workbooks.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkbooks();
  }, []);

  // If the examiner clicked a workbook, show EvaluationPage

  if (activeWorkbook) {
    return (
      <EvaluationPage
        workbookId={activeWorkbook.workbook_id}
        questionNo={activeWorkbook.question_no}
        paperId={activeWorkbook.paper_id}
        userData={userData}
        onBack={() => {
          setActiveWorkbook(null);
          fetchWorkbooks();
        }}
      />
    )
  }

  return (
    <div className="p-6 h-full overflow-y-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Evaluator Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Your pending marking queue</p>
        </div>
        <button
          onClick={fetchWorkbooks}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Could not load workbooks</p>
            <p className="text-sm text-red-600 mt-0.5">{error}</p>
            <button
              onClick={fetchWorkbooks}
              className="mt-2 text-sm font-medium text-red-700 underline hover:text-red-900"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {loading ? (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </>
        ) : metrics ? (
          <>
            <StatCard
              icon={FileText}
              label="Sheets Left"
              value={metrics.sheetsLeft}
              color="bg-blue-500"
            />
            <StatCard
              icon={CheckCircle2}
              label="Evaluated"
              value={metrics.sheetsEvaluated}
              color="bg-green-500"
            />
            <StatCard
              icon={ClipboardList}
              label="Questions Assigned"
              value={metrics.questionsAssigned.length > 0
                ? metrics.questionsAssigned.join(', ')
                : '—'}
              color="bg-teal-500"
            />
          </>
        ) : null}
      </div>

      {/* Workbook list */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              {activeTab === 'pending' ? 'Pending Workbooks' : 'Evaluated Workbooks'}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {activeTab === 'pending' ? 'Click a row to start evaluating' : 'Marks already submitted — view only'}
            </p>
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition
                ${activeTab === 'pending' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Pending ({metrics?.sheetsLeft ?? 0})
            </button>
            <button
              onClick={() => setActiveTab('evaluated')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition
                ${activeTab === 'evaluated' ? 'bg-white shadow-sm text-green-700' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Evaluated ({metrics?.sheetsEvaluated ?? 0})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="divide-y divide-gray-100">
            {[1, 2, 3].map(i => (
              <div key={i} className="px-6 py-4 flex items-center gap-4">
                <Skeleton className="w-24 h-4" />
                <Skeleton className="w-16 h-4" />
                <Skeleton className="w-32 h-4" />
              </div>
            ))}
          </div>
        ) : activeTab === 'pending' ? (
          !metrics || metrics.workbookList.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No pending workbooks</p>
              <p className="text-sm text-gray-400 mt-1">
                {error ? 'Check the error above.' : 'All done, or none have been assigned yet.'}
              </p>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="px-6 py-2 bg-gray-50 grid grid-cols-4 gap-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <span>Paper ID</span>
                <span>Question No.</span>
                <span>Workbook ID</span>
                <span />
              </div>

              <div className="divide-y divide-gray-100">
                {metrics.workbookList.map(({ paper_id, question_no, workbook_id }) => (
                  <button
                    key={`${workbook_id}-${question_no}`}
                    onClick={() => setActiveWorkbook({ workbook_id, question_no, paper_id })}
                    className="w-full px-6 py-4 grid grid-cols-4 gap-4 items-center text-left hover:bg-blue-50 transition-colors group"
                  >
                    <span className="text-sm font-medium text-gray-800">{paper_id}</span>
                    <span className="text-sm text-gray-600">Q{question_no}</span>
                    <span className="font-mono text-sm text-gray-700">{workbook_id}</span>
                    <span className="flex justify-end">
                      <span className="flex items-center gap-1 text-xs font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        Evaluate <ChevronRight className="w-3 h-3" />
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )
        ) : (
          // Evaluated tab
          !metrics || metrics.evaluatedList.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <CheckCircle2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Nothing evaluated yet</p>
              <p className="text-sm text-gray-400 mt-1">Workbooks you've marked will show up here.</p>
            </div>
          ) : (
            <>
              <div className="px-6 py-2 bg-gray-50 grid grid-cols-4 gap-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <span>Paper ID</span>
                <span>Question No.</span>
                <span>Workbook ID</span>
                <span className="text-right">Marks</span>
              </div>

              <div className="divide-y divide-gray-100">
                {metrics.evaluatedList.map(({ paper_id, question_no, workbook_id, marks }) => (
                  <div
                    key={`${workbook_id}-${question_no}`}
                    className="w-full px-6 py-4 grid grid-cols-4 gap-4 items-center text-left"
                  >
                    <span className="text-sm font-medium text-gray-800">{paper_id}</span>
                    <span className="text-sm text-gray-600">Q{question_no}</span>
                    <span className="font-mono text-sm text-gray-700">{workbook_id}</span>
                    <span className="text-sm font-semibold text-green-700 text-right">
                      {marks ?? '—'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )
        )}
      </div>

    </div>
  );
}