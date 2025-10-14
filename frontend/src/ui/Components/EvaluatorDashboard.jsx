import EvaluationPage from './EvaluationPage';

export default function EvaluatorDashboard() {
  const sheetsLeft = 5;
  const questionsAssigned = [1,5];
  const totalSheets = 10;

  return (
    <div className="p-6 h-full overflow-y-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Evaluator Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-shadow duration-300">
          <h3 className="text-lg font-medium text-gray-500 mb-2">Sheets Left</h3>
          <p className="text-4xl font-extrabold text-gray-900">{sheetsLeft}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-shadow duration-300">
          <h3 className="text-lg font-medium text-gray-500 mb-2">Questions Assigned</h3>
          <p className="text-4xl font-extrabold text-gray-900">{questionsAssigned.join(', ')}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-shadow duration-300">
          <h3 className="text-lg font-medium text-gray-500 mb-2">Total Sheets</h3>
          <p className="text-4xl font-extrabold text-gray-900">{totalSheets}</p>
        </div>
      </div>
    </div>
  );
}
