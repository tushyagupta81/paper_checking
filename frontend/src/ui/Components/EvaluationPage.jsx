import { useState, useRef, useEffect } from 'react';
import { Check, X, Pen, Circle, List } from 'lucide-react';

const EvaluationPage = () => {
  const [marks, setMarks] = useState([
    { id: 1, value: 1 },
    { id: 2, value: 2 },
    { id: 3, value: 3 },
    { id: 4, value: 4 },
    { id: 5, value: 4.5 },
    { id: 6, value: 5 },
    { id: 7, value: 6 },
    { id: 8, value: 7 },
    { id: 9, value: 8 },
    { id: 10, value: 9 },
  ]);
  const [selectedMark, setSelectedMark] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isCommentOpen, setIsCommentOpen] = useState(false);
  const [drawingMode, setDrawingMode] = useState(null);
  const [showMarksPanel, setShowMarksPanel] = useState(false);

  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const toggleMark = (id) => setSelectedMark(id);
  const clearMark = () => setSelectedMark(null);
  const confirmMarks = () => {
    const markValue = marks.find(m => m.id === selectedMark)?.value;
    console.log('Confirmed mark:', markValue);
  };

  // Canvas Drawing Logic
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const handleMouseDown = (e) => {
      if (!drawingMode) return;
      isDrawing.current = true;
      const rect = canvas.getBoundingClientRect();
      lastPos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const handleMouseMove = (e) => {
      if (!isDrawing.current) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      ctx.strokeStyle = 'red';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (drawingMode === 'pen') {
        ctx.moveTo(lastPos.current.x, lastPos.current.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else if (drawingMode === 'circle') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const radius = Math.sqrt(
          (x - lastPos.current.x) ** 2 + (y - lastPos.current.y) ** 2
        );
        ctx.arc(lastPos.current.x, lastPos.current.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
      }
      lastPos.current = { x, y };
    };

    const handleMouseUp = () => { isDrawing.current = false; };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
    };
  }, [drawingMode]);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Floating Marks Button */}
      <button
        onClick={() => setShowMarksPanel(!showMarksPanel)}
        className="fixed bottom-6 left-6 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-xl z-50 flex items-center justify-center transition-transform duration-200"
      >
        <List className="w-6 h-6" />
      </button>

      {/* Left Panel (conditionally rendered) */}
      {showMarksPanel && (
        <div className="fixed left-0 top-0 w-64 h-full bg-white shadow-xl overflow-y-auto z-40 p-5 flex flex-col">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Assign Marks</h2>

          <div className="grid grid-cols-2 gap-3 mb-6">
            {marks.map(mark => (
              <button
                key={mark.id}
                onClick={() => toggleMark(mark.id)}
                className={`h-12 rounded-lg font-semibold text-lg transition-all duration-200 ${
                  selectedMark === mark.id
                    ? 'bg-blue-600 text-white shadow-md scale-105'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
              >
                {mark.value}
              </button>
            ))}
          </div>

          <div className="flex gap-3 mb-4">
            <button
              onClick={confirmMarks}
              className="flex-1 h-12 bg-green-500 hover:bg-green-600 rounded-lg flex items-center justify-center text-white font-semibold shadow-md transition-colors"
            >
              <Check className="w-6 h-6 mr-2" /> Confirm
            </button>
            <button
              onClick={clearMark}
              className="flex-1 h-12 bg-red-500 hover:bg-red-600 rounded-lg flex items-center justify-center text-white font-semibold shadow-md transition-colors"
            >
              <X className="w-6 h-6 mr-2" /> Clear
            </button>
          </div>

          <button
            onClick={() => setIsCommentOpen(!isCommentOpen)}
            className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg shadow-md transition-colors mb-4"
          >
            Add Comment
          </button>

          {isCommentOpen && (
            <textarea
              className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none mb-4"
              placeholder="Enter your comment here..."
            />
          )}

          <div className="flex gap-2 mt-auto">
            <button
              onClick={() => setDrawingMode('pen')}
              className={`flex-1 py-2 rounded-lg text-white font-medium ${
                drawingMode === 'pen' ? 'bg-blue-600' : 'bg-blue-400 hover:bg-blue-500'
              } flex items-center justify-center gap-2`}
            >
              <Pen className="w-5 h-5" /> Freehand
            </button>
            <button
              onClick={() => setDrawingMode('circle')}
              className={`flex-1 py-2 rounded-lg text-white font-medium ${
                drawingMode === 'circle' ? 'bg-blue-600' : 'bg-blue-400 hover:bg-blue-500'
              } flex items-center justify-center gap-2`}
            >
              <Circle className="w-5 h-5" /> Circle
            </button>
          </div>
        </div>
      )}

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Page Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
          <h1 className="text-2xl font-bold text-gray-800">Page {currentPage}</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Next
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 p-6 overflow-auto relative">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 h-full min-h-[600px] relative flex flex-col items-center justify-center">
            <canvas
              ref={canvasRef}
              width={1200}
              height={800}
              className="absolute inset-0 w-full h-full bg-gray-50 rounded-xl"
            />
            <div className="text-center z-10 pointer-events-none">
              <p className="text-gray-600 text-xl font-medium mb-2">Document Canvas</p>
              <p className="text-gray-400 text-sm">Scanned answer sheet will appear here</p>
            </div>
          </div>

          {/* Question Display */}
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-md border border-gray-200 p-4 max-w-xl w-full text-center">
            <p className="text-gray-800 font-semibold text-lg">
              Q{currentPage}: Introduce yourself (Education, strengths, weaknesses, etc.)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EvaluationPage;
