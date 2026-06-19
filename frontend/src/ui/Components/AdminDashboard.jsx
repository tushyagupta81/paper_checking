import { useState, useEffect } from 'react';
import api from '../api.js';

export default function AdminDashboard({ userData }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    setError('');
    try {
      const [allWorkbooksRes, assignedRes] = await Promise.all([
        api.getAllExaminerWorkbooks(),
        api.getAssignedQuestions(),
      ]);

      const allWorkbooksData = allWorkbooksRes.data || {};
      const assignedData = assignedRes.data || {};

      // Count total and checked workbook-question pairs
      let totalWorkbookQuestions = 0;
      let checkedWorkbookQuestions = 0;
      let activeExaminers = new Set();

      Object.entries(allWorkbooksData).forEach(([examinerId, papers]) => {
        activeExaminers.add(examinerId);
        Object.values(papers).forEach(questions => {
          Object.values(questions).forEach(workbooks => {
            workbooks.forEach(([, isChecked]) => {
              totalWorkbookQuestions++;
              if (isChecked) checkedWorkbookQuestions++;
            });
          });
        });
      });

      // Count assigned vs unassigned questions
      let totalQuestions = 0;
      let assignedQuestions = 0;
      Object.values(assignedData).forEach(questions => {
        Object.values(questions).forEach(examinerId => {
          totalQuestions++;
          if (examinerId !== 'Unassigned') assignedQuestions++;
        });
      });

      setStats({
        totalWorkbookQuestions,
        checkedWorkbookQuestions,
        activeExaminers: activeExaminers.size,
        totalQuestions,
        assignedQuestions,
        assignedData,
        allWorkbooksData,
      });
    } catch (err) {
      setError('Failed to load dashboard data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 h-full overflow-y-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Dashboard Overview</h1>
        <div className="p-4 bg-red-50 border border-red-300 text-red-700 rounded-lg">{error}</div>
      </div>
    );
  }

  const unchecked = (stats.totalWorkbookQuestions - stats.checkedWorkbookQuestions);
  const progressPercent = stats.totalWorkbookQuestions > 0
    ? Math.round((stats.checkedWorkbookQuestions / stats.totalWorkbookQuestions) * 100)
    : 0;

  const metricCards = [
    {
      title: 'Total to Check',
      value: stats.totalWorkbookQuestions,
      sub: 'workbook-question pairs',
      color: 'blue',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
    },
    {
      title: 'Checked',
      value: stats.checkedWorkbookQuestions,
      sub: `${progressPercent}% complete`,
      color: 'green',
      bg: 'bg-green-50',
      text: 'text-green-700',
      border: 'border-green-200',
    },
    {
      title: 'Remaining',
      value: unchecked,
      sub: 'still to be marked',
      color: 'orange',
      bg: 'bg-orange-50',
      text: 'text-orange-700',
      border: 'border-orange-200',
    },
    {
      title:'Unassigned Questions',
      value: stats.totalQuestions - stats.assignedQuestions,
      sub: `${stats.assignedQuestions}/${stats.totalQuestions} assigned`,
      color: 'red',
      bg: 'bg-red-50',
      text: 'text-red-700',
      border: 'border-red-200',
    },
    {
      title: 'Active Examiners',
      value: stats.activeExaminers,
      sub: `${stats.assignedQuestions}/${stats.totalQuestions} questions assigned`,
      color: 'purple',
      bg: 'bg-purple-50',
      text: 'text-purple-700',
      border: 'border-purple-200',
    },
  ];

  return (
    <div className="p-6 h-full overflow-y-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800">Dashboard Overview</h1>
        <button onClick={loadStats}
          className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition">
          ↻ Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {metricCards.map((m, i) => (
          <div key={i} className={`${m.bg} ${m.border} border rounded-xl p-5`}>
            <p className="text-sm font-medium text-gray-500 mb-1">{m.title}</p>
            <p className={`text-4xl font-extrabold ${m.text} mb-1`}>{m.value}</p>
            <p className="text-xs text-gray-400">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-sm font-semibold text-gray-700">Overall Marking Progress</h2>
          <span className="text-sm font-bold text-blue-600">{progressPercent}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div
            className="bg-blue-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {stats.checkedWorkbookQuestions} of {stats.totalWorkbookQuestions} workbook-question pairs marked
        </p>
      </div>

      {/* Question Assignment Table */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Question Assignments</h2>
        {Object.keys(stats.assignedData).length === 0 ? (
          <p className="text-gray-400 text-sm">No questions created yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left p-3 text-gray-500 font-medium">Paper ID</th>
                <th className="text-left p-3 text-gray-500 font-medium">Question</th>
                <th className="text-left p-3 text-gray-500 font-medium">Examiner</th>
                <th className="text-left p-3 text-gray-500 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(stats.assignedData).flatMap(([paper, questions]) =>
                Object.entries(questions).map(([qNo, examinerId]) => {
                  const isAssigned = examinerId !== 'Unassigned';
                  // Count workbooks for this question
                  let total = 0, checked = 0;
                  Object.values(stats.allWorkbooksData).forEach(papers => {
                    if (papers[paper]?.[qNo]) {
                      papers[paper][qNo].forEach(([, isChecked]) => {
                        total++;
                        if (isChecked) checked++;
                      });
                    }
                  });
                  return (
                    <tr key={`${paper}-${qNo}`} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-3 font-mono text-xs text-gray-700">{paper}</td>
                      <td className="p-3 text-gray-700">Q{qNo}</td>
                      <td className="p-3">
                        {isAssigned
                          ? <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">#{examinerId}</span>
                          : <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">Unassigned</span>}
                      </td>
                      <td className="p-3 text-xs text-gray-500">
                        {total > 0 ? `${checked}/${total} marked` : 'No workbooks uploaded'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}