import { useState, useEffect } from "react";
import {
  FileText, ClipboardList, ChevronRight,
  RefreshCw, AlertCircle, CheckCircle2,
} from "lucide-react";
import api from "../api.js";
import EvaluationPage from "./EvaluationPage";

function parseWorkbooks(data, summary) {
  const pendingList   = [];
  const evaluatedList = [];
  const questionSet   = new Set();

  for (const [paper_id, questions] of Object.entries(data)) {
    for (const [question_no, group] of Object.entries(questions)) {
      questionSet.add(Number(question_no));
      for (const workbook_id of group.pending || []) {
        pendingList.push({ paper_id, question_no: Number(question_no), workbook_id });
      }
      for (const item of group.evaluated || []) {
        evaluatedList.push({ paper_id, question_no: Number(question_no), workbook_id: item.workbook_id, marks: item.marks });
      }
    }
  }

  return {
    workbookList: pendingList,
    evaluatedList,
    questionsAssigned: [...questionSet].sort((a, b) => a - b),
    sheetsLeft:      summary?.pending   ?? pendingList.length,
    sheetsEvaluated: summary?.evaluated ?? evaluatedList.length,
    totalSheets:     summary?.total     ?? pendingList.length + evaluatedList.length,
  };
}

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

function Skeleton({ className }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

// ── Filter select ─────────────────────────────────────────────────────────────
function FilterSelect({ value, onChange, children, placeholder }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-300"
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}

export default function EvaluatorDashboard({ userData }) {
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState("");
  const [metrics,        setMetrics]        = useState(null);
  const [activeWorkbook, setActiveWorkbook] = useState(null);
  const [activeTab,      setActiveTab]      = useState("pending");

  // Filters — shared across both tabs
  const [paperFilter,    setPaperFilter]    = useState("");
  const [questionFilter, setQuestionFilter] = useState("");
  const [workbookFilter, setWorkbookFilter] = useState("");

  const fetchWorkbooks = async () => {
    setLoading(true); setError("");
    try {
      const response = await api.getExaminerWorkbooks();
      const parsed   = parseWorkbooks(response.data, response.summary);
      setMetrics(parsed);
      return parsed;
    } catch (err) {
      if (err.message?.includes("No questions assigned")) {
        const empty = { workbookList: [], evaluatedList: [], questionsAssigned: [], sheetsLeft: 0, sheetsEvaluated: 0, totalSheets: 0 };
        setMetrics(empty);
        return empty;
      }
      setError(err.message || "Failed to load workbooks.");
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWorkbooks(); }, []);

  // Reset downstream filters when a parent filter changes
  const handlePaperFilter = (v) => { setPaperFilter(v); setQuestionFilter(""); setWorkbookFilter(""); };
  const handleQuestionFilter = (v) => { setQuestionFilter(v); setWorkbookFilter(""); };
  const handleWorkbookFilter = (v) => { setWorkbookFilter(v); };

  // ── Apply filters to whichever list is active ──────────────────────────────
  const applyFilters = (list) =>
    (list || []).filter(item =>
      (!paperFilter    || item.paper_id    === paperFilter) &&
      (!questionFilter || item.question_no === Number(questionFilter)) &&
      (!workbookFilter || item.workbook_id === workbookFilter)
    );

  const filteredPending   = applyFilters(metrics?.workbookList);
  const filteredEvaluated = applyFilters(metrics?.evaluatedList);

  // ── Cascading option lists ─────────────────────────────────────────────────
  // Paper options — unique paper IDs across the active tab's full list
  const allItems   = activeTab === "pending" ? (metrics?.workbookList || []) : (metrics?.evaluatedList || []);
  const paperOpts  = [...new Set(allItems.map(w => w.paper_id))].sort();

  // Question options — filtered by selected paper
  const questionOpts = [...new Set(
    allItems.filter(w => !paperFilter || w.paper_id === paperFilter).map(w => w.question_no)
  )].sort((a, b) => a - b);

  // Workbook options — filtered by paper + question
  const workbookOpts = [...new Set(
    allItems
      .filter(w =>
        (!paperFilter    || w.paper_id    === paperFilter) &&
        (!questionFilter || w.question_no === Number(questionFilter))
      )
      .map(w => w.workbook_id)
  )].sort();

  // ── Auto-next after submit ─────────────────────────────────────────────────
  const handleEvaluationDone = async (finishedWorkbook) => {
    setActiveWorkbook(null);
    const fresh = await fetchWorkbooks();
    if (!fresh) return;
    const next = fresh.workbookList.find(
      w => w.question_no === finishedWorkbook.question_no &&
           w.paper_id    === finishedWorkbook.paper_id    &&
           w.workbook_id !== finishedWorkbook.workbook_id
    );
    if (next) setActiveWorkbook(next);
  };

  if (activeWorkbook) {
    return (
      <EvaluationPage
        workbookId={activeWorkbook.workbook_id}
        questionNo={activeWorkbook.question_no}
        paperId={activeWorkbook.paper_id}
        userData={userData}
        onBack={() => { setActiveWorkbook(null); fetchWorkbooks(); }}
        onSubmitDone={() => handleEvaluationDone(activeWorkbook)}
      />
    );
  }

  return (
    <div className="p-6 h-full overflow-y-auto">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Evaluator Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Your pending marking queue</p>
        </div>
        <button
          onClick={fetchWorkbooks} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Could not load workbooks</p>
            <p className="text-sm text-red-600 mt-0.5">{error}</p>
            <button onClick={fetchWorkbooks} className="mt-2 text-sm font-medium text-red-700 underline hover:text-red-900">Try again</button>
          </div>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {loading ? (
          <><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></>
        ) : metrics ? (
          <>
            <StatCard icon={FileText}      label="Sheets Left"        value={metrics.sheetsLeft}      color="bg-blue-500" />
            <StatCard icon={CheckCircle2}  label="Evaluated"          value={metrics.sheetsEvaluated} color="bg-green-500" />
            <StatCard icon={ClipboardList} label="Questions Assigned" value={metrics.questionsAssigned.length > 0 ? metrics.questionsAssigned.join(", ") : "—"} color="bg-teal-500" />
          </>
        ) : null}
      </div>

      {/* ── Main table card ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">

        {/* Card header: tabs + filters */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left: title + tabs */}
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  {activeTab === "pending" ? "Pending Workbooks" : "Evaluated Workbooks"}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {activeTab === "pending" ? "Click a row to start evaluating" : "Marks already submitted — view only"}
                </p>
              </div>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab("pending")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${activeTab === "pending" ? "bg-white shadow-sm text-blue-700" : "text-gray-500 hover:text-gray-700"}`}
                >
                  Pending ({metrics?.sheetsLeft ?? 0})
                </button>
                <button
                  onClick={() => setActiveTab("evaluated")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${activeTab === "evaluated" ? "bg-white shadow-sm text-green-700" : "text-gray-500 hover:text-gray-700"}`}
                >
                  Evaluated ({metrics?.sheetsEvaluated ?? 0})
                </button>
              </div>
            </div>

            {/* Right: cascading filters */}
            <div className="flex flex-wrap items-center gap-2">
              <FilterSelect value={paperFilter} onChange={handlePaperFilter} placeholder="All Papers">
                {paperOpts.map(id => <option key={id} value={id}>{id}</option>)}
              </FilterSelect>

              <FilterSelect value={questionFilter} onChange={handleQuestionFilter} placeholder="All Questions">
                {questionOpts.map(q => <option key={q} value={q}>Q{q}</option>)}
              </FilterSelect>

              <FilterSelect value={workbookFilter} onChange={handleWorkbookFilter} placeholder="All Workbooks">
                {workbookOpts.map(id => <option key={id} value={id}>{id}</option>)}
              </FilterSelect>

              {/* Clear filters button — only shown when any filter is active */}
              {(paperFilter || questionFilter || workbookFilter) && (
                <button
                  onClick={() => { setPaperFilter(""); setQuestionFilter(""); setWorkbookFilter(""); }}
                  className="text-xs font-medium text-gray-500 hover:text-gray-700 underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Table body ── */}
        {loading ? (
          <div className="divide-y divide-gray-100">
            {[1, 2, 3].map(i => (
              <div key={i} className="px-6 py-4 flex items-center gap-4">
                <Skeleton className="w-24 h-4" /><Skeleton className="w-16 h-4" /><Skeleton className="w-32 h-4" />
              </div>
            ))}
          </div>

        ) : activeTab === "pending" ? (
          filteredPending.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">
                {paperFilter || questionFilter || workbookFilter
                  ? "No workbooks match the selected filters"
                  : "No pending workbooks"}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {paperFilter || questionFilter || workbookFilter
                  ? "Try clearing the filters above."
                  : error ? "Check the error above." : "All done, or none assigned yet."}
              </p>
            </div>
          ) : (
            <>
              <div className="px-6 py-2 bg-gray-50 grid grid-cols-4 gap-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <span>Paper ID</span><span>Question No.</span><span>Workbook ID</span><span />
              </div>
              <div className="divide-y divide-gray-100">
                {filteredPending.map(({ paper_id, question_no, workbook_id }) => (
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
          filteredEvaluated.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <CheckCircle2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">
                {paperFilter || questionFilter || workbookFilter
                  ? "No evaluated workbooks match the selected filters"
                  : "Nothing evaluated yet"}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {paperFilter || questionFilter || workbookFilter
                  ? "Try clearing the filters above."
                  : "Workbooks you've marked will show up here."}
              </p>
            </div>
          ) : (
            <>
              <div className="px-6 py-2 bg-gray-50 grid grid-cols-4 gap-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <span>Paper ID</span><span>Question No.</span><span>Workbook ID</span><span className="text-right">Marks</span>
              </div>
              <div className="divide-y divide-gray-100">
                {filteredEvaluated.map(({ paper_id, question_no, workbook_id, marks }) => (
                  <div key={`${workbook_id}-${question_no}`}
                    className="w-full px-6 py-4 grid grid-cols-4 gap-4 items-center text-left">
                    <span className="text-sm font-medium text-gray-800">{paper_id}</span>
                    <span className="text-sm text-gray-600">Q{question_no}</span>
                    <span className="font-mono text-sm text-gray-700">{workbook_id}</span>
                    <span className="text-sm font-semibold text-green-700 text-right">{marks ?? "—"}</span>
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