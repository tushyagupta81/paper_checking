export default function ReportsPage({ userRole }) {
  if (userRole !== 'admin') {
    return (
      <div className="p-8 text-center text-xl text-red-500">
        You are not authorized to access the Report Page.
      </div>
    );
  }

  const students = [
    { name: "ABC" },
    { name: "DEF" },
    { name: "XYZ" },
  ];

  const handleGenerateReport = (student) => {
  alert(`Generating report for ${student}`); 
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Generate Result Reports</h1>
      <div className="space-y-4">
        {students.map((s, i) => (
          <div key={i} className="flex justify-between items-center bg-white p-4 rounded-lg shadow border border-gray-200">
            <span className="text-lg font-medium">{s.name}</span>
            <button 
              onClick={() => handleGenerateReport(s.name)} 
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Generate Report
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
