export default function UserDashboard() {
  return (
    <div className="p-6 h-full flex flex-col items-center justify-center">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Welcome to Your Dashboard</h1>
      <p className="text-xl text-gray-700 mb-4">You can review your sheet here:</p>
      <button className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
        Review Your Sheet
      </button>
    </div>
  );
}
