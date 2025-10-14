export default function AdminDashboard() {
  const metrics = [
    { title: "Workbooks Scanned", value: "120/N", detail: "View all" },
    { title: "Workbooks Checked", value: "15/N", detail: "Review access only to super admin" },
    { title: "Active Evaluators", value: "8", detail: "Manage" },
    { title: "Questions Assigned", value: "2/N", detail: "Assign Now" },
  ];

  return (
    <div className="p-6 h-full overflow-y-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Dashboard Overview</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((m, i) => (
          <div key={i} className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-shadow duration-300">
            <h3 className="text-lg font-medium text-gray-500 mb-2">{m.title}</h3>
            <p className="text-4xl font-extrabold text-gray-900 mb-1">{m.value}</p>
            <p className="text-sm text-blue-600 font-medium cursor-pointer hover:underline">{m.detail} &rarr;</p>
          </div>
        ))}
      </div>
    </div>
  );
}
