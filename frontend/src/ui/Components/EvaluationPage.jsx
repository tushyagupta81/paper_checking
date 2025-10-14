import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
    Scan, ClipboardList, Pen, Palette, BookOpen, Check, X
} from 'lucide-react';

// --- Mock Data for Evaluation Tool ---
const MOCK_QUESTION_DATA = {
    workbookId: "W-1234",
    questionText: "Q1. Explain and differentiate between Prim's algorithm and kruskal algorithm. (Max Marks: 10)",
    maxMarks: 10,
    modelAnswer: "Prim's algorithm is a greedy algorithm that builds the MST incrementally. It starts with a single vertex and grows the MST one edge at a time, always choosing the smallest edge. Kruskal's algorithm is also a greedy algorithm but takes a different approach. It begins with all the vertices and no edges, and it adds edges one by one in increasing order of weight, ensuring no cycles are formed until the MST is complete.",
    imagePlaceholder: "https://placehold.co/800x600/f0f9ff/0e7490?text=Scanned+Answer+Sheet+Content"
};

// Helper function for marks display precision
const formatMark = (mark) => {
    if (mark === null || isNaN(mark)) return '0.0';
    // Use toFixed(2) only if hundredths digit is present and non-zero, otherwise use toFixed(1)
    if (Math.abs(mark * 100 - Math.round(mark * 100)) > 0.001) {
        return mark.toFixed(2);
    }
    return mark.toFixed(1);
};


// --- Evaluation Tool Component ---
const Evaluator = () => {
    // STATE
    const [currentMark, setCurrentMark] = useState(4.0);
    const [showModelAnswer, setShowModelAnswer] = useState(false);
    // 'pen', 'highlight', 'check', 'cross'
    const [drawingMode, setDrawingMode] = useState(null);
    const [annotationText, setAnnotationText] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = 4; // Mock total pages

    // REFS for Canvas and Image
    const canvasRef = useRef(null);
    const imgRef = useRef(null);
    const isDrawing = useRef(false);
    const lastPos = useRef({ x: 0, y: 0 });

    // Marks options (0.0 to Max Marks in 0.5 increments)
    const marksOptions = useMemo(() => {
        const options = [];
        for (let i = 0; i <= MOCK_QUESTION_DATA.maxMarks * 2; i++) {
            options.push(i * 0.5);
        }
        return options.filter(m => m <= MOCK_QUESTION_DATA.maxMarks);
    }, []);

    // Function to clear the entire canvas
    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    // --- Dynamic Canvas Sizing & Positioning ---
    // This function ensures the canvas overlay matches the image size and position precisely.
    const resizeCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const img = imgRef.current;
        if (canvas && img && canvas.parentElement) {
            
            // 1. Set canvas dimensions to match the image's natural resolution (for drawing quality)
            canvas.width = img.naturalWidth || 800;
            canvas.height = img.naturalHeight || 600;

            // Get bounding box of the image and its immediate positioned parent
            const imgRect = img.getBoundingClientRect();
            const parentRect = canvas.parentElement.getBoundingClientRect(); // Positioned Parent

            // 2. Adjust canvas CSS size to visually match the displayed image size
            canvas.style.width = `${imgRect.width}px`;
            canvas.style.height = `${imgRect.height}px`;

            // 3. Position the canvas exactly over the image by calculating the image's
            // offset relative to the canvas's positioned parent.
            const topOffset = imgRect.top - parentRect.top;
            const leftOffset = imgRect.left - parentRect.left;

            canvas.style.top = `${topOffset}px`;
            canvas.style.left = `${leftOffset}px`;
        }
    }, []);

    useEffect(() => {
        // Initial setup and event listeners
        resizeCanvas();
        // Listen to window resize to reposition and resize canvas
        window.addEventListener('resize', resizeCanvas);

        const img = imgRef.current;
        if (img) {
            // Recalculate size/position when the image loads
            img.addEventListener('load', resizeCanvas);
        }

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            if (img) {
                img.removeEventListener('load', resizeCanvas);
            }
        };
    }, [resizeCanvas]);

    // Drawing effect
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Helper to get coordinates scaled to the canvas's natural resolution
        const getCanvasCoords = (clientX, clientY) => {
            const rect = canvas.getBoundingClientRect();
            // Calculate ratio of actual mouse position within the *displayed* canvas bounds (CSS pixels)
            // Then scale that ratio up to the canvas's internal drawing width/height (natural pixels)
            const x = ((clientX - rect.left) / rect.width) * canvas.width;
            const y = ((clientY - rect.top) / rect.height) * canvas.height;
            return { x, y };
        };


        // Function to draw simple stamps (Check, Cross)
        const drawStamp = (type, x, y) => {
            // Reset composite operation for normal stamping
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = type === 'check' ? '#10b981' : '#ef4444'; // Green or Red
            ctx.font = '70px sans-serif';
            ctx.fillText(type === 'check' ? '✔' : '✖', x - 25, y + 25);
            setDrawingMode(null);
        };

        const handleMouseDown = (e) => {
            e.preventDefault();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            const { x, y } = getCanvasCoords(clientX, clientY);
            lastPos.current = { x, y };

            if (drawingMode === 'check' || drawingMode === 'cross') {
                drawStamp(drawingMode, x, y);
                return;
            }

            if (drawingMode === 'pen' || drawingMode === 'highlight') {
                isDrawing.current = true;
                ctx.beginPath();
                ctx.moveTo(x, y);
            }
        };

        const handleMouseMove = (e) => {
            if (!isDrawing.current) return;
             e.preventDefault();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            const { x, y } = getCanvasCoords(clientX, clientY);

            // Connect previous position to current position
            ctx.lineTo(x, y);

            if (drawingMode === 'pen') {
                ctx.globalCompositeOperation = 'source-over'; // Default setting for solid lines
                ctx.strokeStyle = '#ef4444'; // Red for Pen
                ctx.lineWidth = 4;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
            } else if (drawingMode === 'highlight') {
                // Use 'multiply' for highlighter to prevent the color from stacking/getting darker
                // when drawing over the same spot slowly.
                ctx.globalCompositeOperation = 'multiply';
                ctx.strokeStyle = 'rgba(255, 255, 0, 0.4)'; // Transparent yellow
                ctx.lineWidth = 30; // Thicker line for marker
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
            }

            ctx.stroke();
            lastPos.current = { x, y };
        };

        const handleMouseUp = () => {
            isDrawing.current = false;
            // Reset composite operation to default once drawing is finished
            ctx.globalCompositeOperation = 'source-over';
        };

        // Touch support handlers
        const handleTouchStart = (e) => { handleMouseDown(e); };
        const handleTouchMove = (e) => { handleMouseMove(e); };
        const handleTouchEnd = handleMouseUp;


        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mouseleave', handleMouseUp); // End drawing if cursor leaves

        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
        canvas.addEventListener('touchend', handleTouchEnd);


        return () => {
            canvas.removeEventListener('mousedown', handleMouseDown);
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('mouseup', handleMouseUp);
            canvas.removeEventListener('mouseleave', handleMouseUp);

            canvas.removeEventListener('touchstart', handleTouchStart);
            canvas.removeEventListener('touchmove', handleTouchMove);
            canvas.removeEventListener('touchend', handleTouchEnd);
        };
    }, [drawingMode, resizeCanvas]);

    // Page navigation logic
    const nextPage = () => setCurrentPage(prev => Math.min(totalPages, prev + 1));
    const prevPage = () => setCurrentPage(prev => Math.max(1, prev - 1));

    // Marks Button Sub-Component
    const MarksButton = ({ value }) => (
        <button
            onClick={() => setCurrentMark(value)}
            className={`w-full h-10 text-sm font-bold rounded-lg border-2 border-gray-300 transition duration-150 shadow-sm
                ${currentMark === value ? 'bg-blue-600 text-white ring-2 ring-blue-500' : 'bg-white text-gray-800 hover:bg-blue-50'}`
            }
            aria-label={`Assign ${value} marks`}
        >
            {formatMark(value)}
        </button>
    );

    // Annotation Button Sub-Component
    const AnnotationButton = ({ type, icon: Icon, colorClass, label }) => (
        <button
            onClick={() => setDrawingMode(type)}
            className={`w-full py-2 flex items-center justify-center rounded-lg border-2 border-gray-300 transition duration-150 ${colorClass} ${drawingMode === type ? 'ring-4 ring-offset-2 ring-blue-500 shadow-md' : 'hover:bg-gray-100'}`}
            aria-label={label}
            title={label}
        >
            <Icon className="w-5 h-5 mr-1" />
            <span className='text-xs font-semibold'>{label}</span>
        </button>
    );

    // UI Structure: Left (Marks), Center (Canvas), Right (Question/Model)
    return (
        <div className="flex flex-1 h-full bg-gray-100 overflow-hidden p-2 md:p-4">

            {/* 1. Left Control Panel (Marks & Tools) */}
            <div className="w-64 flex-shrink-0 bg-white rounded-xl shadow-2xl p-3 space-y-5 overflow-y-auto mr-4">

                {/* Marks Assignment */}
                <div className="space-y-2 text-center">
                    <h3 className="text-xs font-bold text-gray-600 mb-2 uppercase border-b pb-2">Assign Marks</h3>
                    <div className="grid grid-cols-4 gap-2 justify-center">
                        {marksOptions.map(m => <MarksButton key={m} value={m} />)}
                    </div>

                    {/* Manual Marks Input (Step changed to 0.01 for precision) */}
                    <input
                        type="number"
                        step="0.1" 
                        min="0"
                        max={MOCK_QUESTION_DATA.maxMarks}
                        value={currentMark}
                        onChange={(e) => setCurrentMark(Math.min(MOCK_QUESTION_DATA.maxMarks, Math.max(0, parseFloat(e.target.value) || 0)))}
                        className="w-full text-center p-2 mt-3 border border-gray-300 rounded-lg text-lg font-bold shadow-inner focus:border-blue-500"
                        aria-label="Enter Marks Manually"
                    />
                    <p className="text-xs text-gray-500 font-semibold">Max: {formatMark(MOCK_QUESTION_DATA.maxMarks)}</p>
                </div>

                {/* Annotation Tools */}
                <div className="border-t pt-4 space-y-3">
                    <h3 className="text-xs font-bold text-gray-600 mb-2 uppercase border-b pb-2">Annotations</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <AnnotationButton
                            type="check"
                            icon={Check}
                            colorClass="text-green-600 border-green-300"
                            label="Correct (Stamp)"
                        />
                        <AnnotationButton
                            type="cross"
                            icon={X}
                            colorClass="text-red-600 border-red-300"
                            label="Cross (Stamp)"
                        />
                        <AnnotationButton
                            type="pen"
                            icon={Pen}
                            colorClass="text-red-600 border-red-300"
                            label="Freehand (Pen)"
                        />
                         <AnnotationButton
                            type="highlight"
                            icon={Palette}
                            colorClass="text-yellow-600 border-yellow-300"
                            label="Highlight (Marker)"
                        />
                    </div>
                    <button
                        onClick={() => setDrawingMode(null)}
                        className="w-full py-2 flex items-center justify-center rounded-lg border-2 border-gray-300 bg-gray-100 hover:bg-gray-200 mt-3 transition duration-150"
                    >
                        <X className="w-5 h-5 mr-1 text-gray-600" />
                        <span className='text-xs font-semibold text-gray-600'>Clear Tool Selection</span>
                    </button>
                    {/* Clear All Drawings button */}
                    <button
                        onClick={clearCanvas}
                        className="w-full py-2 flex items-center justify-center rounded-lg border-2 border-red-500 bg-red-100 text-red-700 font-semibold hover:bg-red-200 transition duration-150 mt-3"
                    >
                        <Scan className="w-5 h-5 mr-1" />
                        <span className='text-xs font-semibold'>Clear All Drawings</span>
                    </button>
                </div>
            </div>

            {/* 2. Center Canvas Area (Answer Sheet) - Fluid Width */}
            <div className="flex-1 bg-white rounded-xl shadow-2xl flex flex-col relative overflow-hidden">

                {/* Canvas & Placeholder */}
                <div className="flex-1 p-4 overflow-auto relative flex items-center justify-center">
                    {/* The container is necessary for relative positioning */}
                    <div className="relative max-w-full max-h-full">
                         {/* Image (Mock placeholder or actual image) */}
                        <img
                            ref={imgRef}
                            src={MOCK_QUESTION_DATA.imagePlaceholder}
                            alt="Scanned Answer Sheet"
                            className="max-h-full max-w-full object-contain rounded-lg border border-gray-300 shadow-md"
                            onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/800x600/6b7280/ffffff?text=Image+Load+Error'; }}
                        />
                        {/* Canvas Overlay for Annotations */}
                        <canvas
                            ref={canvasRef}
                            // Initial width/height are placeholders; actual dimensions are set by JS
                            width={800}
                            height={600}
                            className="absolute cursor-crosshair"
                            style={{ backgroundColor: 'transparent' }}
                        />
                    </div>
                </div>

                {/* Navigation and Score Bar (Display FIXED for precision) */}
                <div className="flex-shrink-0 bg-blue-600 text-white text-sm font-semibold p-2 flex justify-between items-center px-4 rounded-b-xl">

                    {/* Page Navigation */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={prevPage}
                            disabled={currentPage === 1}
                            className={`px-3 py-1 rounded text-xs transition ${currentPage === 1 ? 'bg-blue-500 text-gray-300 cursor-not-allowed' : 'bg-blue-700 hover:bg-blue-800'}`}
                        >
                            &larr; Previous Page
                        </button>
                        <span className="text-sm">Page: {currentPage} / {totalPages}</span>
                        <button
                            onClick={nextPage}
                            disabled={currentPage === totalPages}
                            className={`px-3 py-1 rounded text-xs transition ${currentPage === totalPages ? 'bg-blue-500 text-gray-300 cursor-not-allowed' : 'bg-blue-700 hover:bg-blue-800'}`}
                        >
                            Next Page &rarr;
                        </button>
                    </div>

                    {/* Workbook and Marks Info */}
                    <div className="flex items-center space-x-4">
                        <span className="font-mono">Workbook: {MOCK_QUESTION_DATA.workbookId}</span>
                        <span>Marks: <span className="text-xl font-extrabold">{formatMark(currentMark)}</span> / {formatMark(MOCK_QUESTION_DATA.maxMarks)}</span>
                    </div>
                </div>
            </div>

            {/* 3. Right Panel (Question Text, Model Answer, Comment, SUBMIT) */}
            <div className="w-64 md:w-80 flex-shrink-0 bg-white rounded-xl shadow-2xl p-4 space-y-4 ml-4 overflow-y-auto">

                {/* Question Info */}
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-300 shadow-inner">
                    <h4 className="text-md font-bold text-blue-800 mb-2">Question:</h4>
                    <p className="text-sm text-gray-900 font-medium break-words">
                        {MOCK_QUESTION_DATA.questionText}
                    </p>
                </div>

                {/* Model Answer Button */}
                <button
                    onClick={() => setShowModelAnswer(!showModelAnswer)}
                    className="w-full py-2 flex items-center justify-center bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 transition duration-150"
                >
                    <BookOpen className="w-5 h-5 mr-2" />
                    {showModelAnswer ? 'Hide Model Answer' : 'Read Model Answer'}
                </button>

                {/* Model Answer Display (Conditional) */}
                {showModelAnswer && (
                    <div className="p-4 bg-green-50 border-l-4 border-green-500 rounded-r-lg shadow text-sm transition-all duration-300">
                        <h5 className="font-bold text-green-700 mb-1">Model Answer</h5>
                        <p className="text-gray-700 italic">
                            {MOCK_QUESTION_DATA.modelAnswer}
                        </p>
                    </div>
                )}

                {/* Evaluator Comment Area */}
                <div className="border-t pt-4 space-y-3">
                    <h3 className="text-xs font-bold text-gray-600 mb-2 uppercase border-b pb-2">Evaluator Comment</h3>
                    <textarea
                        className="w-full h-24 p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none shadow-inner"
                        placeholder="Add overall notes here..."
                        value={annotationText}
                        onChange={(e) => setAnnotationText(e.target.value)}
                    />
                </div>

                {/* Finish Evaluation Button */}
                <div className="pt-4 border-t">
                    <button
                        className="w-full py-3 bg-red-600 text-white font-extrabold rounded-lg shadow-xl hover:bg-red-700 transition duration-150"
                    >
                        SUBMIT 
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Evaluator;
