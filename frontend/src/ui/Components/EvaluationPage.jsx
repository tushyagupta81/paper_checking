import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
    Scan, Pen, Palette, BookOpen, Check, X
} from 'lucide-react';

// --- Mock Data for Evaluation Tool ---
const MOCK_QUESTION_DATA = {
    workbookId: "W-1234",
    questionText: "Q1. Explain and differentiate between Prim's algorithm and Kruskal's algorithm. (Max Marks: 10)",
    maxMarks: 10,
    modelAnswer: "Prim's algorithm is a greedy algorithm that builds the MST incrementally. It starts with a single vertex and grows the MST one edge at a time, always choosing the smallest edge. Kruskal's algorithm is also a greedy algorithm but takes a different approach. It begins with all the vertices and no edges, and it adds edges one by one in increasing order of weight, ensuring no cycles are formed until the MST is complete.",
    // Placeholder image for the model answer in image form (split view)
    modelAnswerImage: "C:/Users/HP/Pictures/Screenshots/modelans.png", 
    // This references the user-uploaded image for the student's answer sheet
    imagePlaceholder: "C:/Users/HP/Pictures/Screenshots/sampleAns.png", 
    // Mock data for page previews (4 pages)
    pages: [
        { id: 1, thumbnail: "C:/Users/HP/Pictures/Screenshots/sampleAns.png" },
        { id: 2, thumbnail: "C:/Users/HP/Pictures/Screenshots/sampleAns.png" },
        { id: 3, thumbnail: "C:/Users/HP/Pictures/Screenshots/sampleAns.png" },
        { id: 4, thumbnail: "C:/Users/HP/Pictures/Screenshots/sampleAns.png" }
    ],
};

// Helper function for marks display precision
const formatMark = (mark) => {
    if (mark === null || isNaN(mark)) return '0.0';
    // Ensures display shows up to two decimal places if needed, otherwise one
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
    // State for showing/hiding the page thumbnail preview strip
    const [showPagePreview, setShowPagePreview] = useState(false); 
    // 'pen', 'highlight', 'check', 'cross'
    const [drawingMode, setDrawingMode] = useState(null);
    const [annotationText, setAnnotationText] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = MOCK_QUESTION_DATA.pages.length;

    // REFS for Canvas and Image
    const canvasRef = useRef(null);
    const imgRef = useRef(null);
    const isDrawing = useRef(false);
    const lastPos = useRef({ x: 0, y: 0 });

    // Marks options (whole numbers only)
    const marksOptions = useMemo(() => {
        const options = [];
        for (let i = 0; i <= MOCK_QUESTION_DATA.maxMarks; i++) {
            options.push(i);
        }
        return options;
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
    const resizeCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const img = imgRef.current;
        if (canvas && img && canvas.parentElement) {
            
            // Set canvas internal resolution to the image's natural size
            canvas.width = img.naturalWidth || 800;
            canvas.height = img.naturalHeight || 600;

            // Get image's current displayed size and position
            const imgRect = img.getBoundingClientRect();
            
            // Use a custom class 'image-canvas-container' to reliably find the parent for offset calculation
            const parentContainer = img.closest('.image-canvas-container'); 
            const parentRect = parentContainer ? parentContainer.getBoundingClientRect() : canvas.parentElement.getBoundingClientRect(); 

            // Set canvas CSS size to match the displayed image size
            canvas.style.width = `${imgRect.width}px`;
            canvas.style.height = `${imgRect.height}px`;

            // Position the canvas exactly over the image
            const topOffset = imgRect.top - parentRect.top;
            const leftOffset = imgRect.left - parentRect.left;

            canvas.style.top = `${topOffset}px`;
            canvas.style.left = `${leftOffset}px`;
        }
    }, []);

    useEffect(() => {
        // Initial setup and event listeners
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        const img = imgRef.current;
        if (img) {
            // Recalculate size and position once the image has loaded
            img.addEventListener('load', resizeCanvas);
        }

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            if (img) {
                img.removeEventListener('load', resizeCanvas);
            }
        };
    }, [resizeCanvas, showModelAnswer, currentPage]); // Added currentPage to trigger resize if image changes based on page

    // Drawing effect
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Helper to map screen coordinates to canvas drawing coordinates
        const getCanvasCoords = (clientX, clientY) => {
            const rect = canvas.getBoundingClientRect();
            const x = ((clientX - rect.left) / rect.width) * canvas.width;
            const y = ((clientY - rect.top) / rect.height) * canvas.height;
            return { x, y };
        };


        const drawStamp = (type, x, y) => {
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

            ctx.lineTo(x, y);

            if (drawingMode === 'pen') {
                ctx.globalCompositeOperation = 'source-over'; 
                ctx.strokeStyle = '#ef4444'; // Red for Pen
                ctx.lineWidth = 4;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.globalAlpha = 1.0; 
            } else if (drawingMode === 'highlight') {
                // Using 'multiply' composite operation for non-stacking highlighter effect
                ctx.globalCompositeOperation = 'multiply'; 
                ctx.strokeStyle = 'rgba(255, 196, 0, 0.05)'; // High opacity yellow
                ctx.lineWidth = 30;
                ctx.lineCap = 'round'; 
                ctx.lineJoin = 'miter';
                ctx.globalAlpha = 1.0; 
            }

            ctx.stroke();
            lastPos.current = { x, y };
        };

        const handleMouseUp = () => {
            isDrawing.current = false;
            // Always reset global state variables to default after drawing ends
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1.0; 
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
    const nextPage = () => {
        const next = Math.min(totalPages, currentPage + 1);
        setCurrentPage(next);
        clearCanvas(); // Clear drawings on page change
    };
    const prevPage = () => {
        const prev = Math.max(1, currentPage - 1);
        setCurrentPage(prev);
        clearCanvas(); // Clear drawings on page change
    };
    const goToPage = (pageNumber) => {
        setCurrentPage(pageNumber);
        clearCanvas(); // Clear drawings on page change
        setShowPagePreview(false); // Hide preview after selection
    };

    // Marks Button Sub-Component
    const MarksButton = ({ value }) => (
        <button
            onClick={() => setCurrentMark(value)}
            // Check if the current mark is exactly this whole number
            className={`w-full h-10 text-sm font-bold rounded-lg border-2 border-gray-300 transition duration-150 shadow-sm
                ${currentMark === value ? 'bg-blue-600 text-white ring-2 ring-blue-500' : 'bg-white text-gray-800 hover:bg-blue-50'}`
            }
            aria-label={`Assign ${value} marks`}
        >
            {/* Displaying whole number as integer */}
            {value}
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

    return (
        <div className="flex flex-1 h-full bg-gray-100 overflow-hidden p-2 md:p-4 font-sans">

            {/* 1. Canvas and Image Area (Main Content) - Fluid Width */}
            <div className="flex-1 bg-white rounded-xl shadow-2xl flex flex-col relative overflow-hidden mr-4">

                {/* --- HEADER SECTION (Question Text & Toggle Buttons) --- */}
                <div className="flex-shrink-0 p-4 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
                    {/* Question Info (left side of header) */}
                    <div className="flex-1 mr-4">
                        <h4 className="text-lg font-bold text-blue-800">Question:</h4>
                        <p className="text-sm text-gray-900 font-medium break-words">
                            {MOCK_QUESTION_DATA.questionText}
                        </p>
                    </div>

                    {/* Toggle Buttons Container (right side of header) - Changed to flex-col for vertical stacking */}
                    <div className="flex flex-col space-y-3">
                        
                        {/* Model Answer Toggle Button (TOP) */}
                        <button
                            onClick={() => {
                                setShowModelAnswer(!showModelAnswer);
                                clearCanvas(); // Clear drawings when switching view modes
                            }}
                            className={`py-2 px-4 flex-shrink-0 flex items-center justify-center font-semibold rounded-lg shadow-md transition duration-150 text-sm 
                                ${showModelAnswer ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
                            title="Toggle Model Answer Split View"
                        >
                            <BookOpen className="w-4 h-4 mr-2" />
                            {showModelAnswer ? 'Hide Model Answer' : 'Show Model Answer'}
                        </button>

                        {/* Page Preview Toggle Button (BOTTOM / UNDER) */}
                        <button
                            onClick={() => setShowPagePreview(!showPagePreview)}
                            className={`py-2 px-4 flex-shrink-0 flex items-center justify-center font-semibold rounded-lg shadow-md transition duration-150 text-sm 
                                ${showPagePreview ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
                            title="Toggle Page Previews"
                        >
                            <Scan className="w-4 h-4 mr-2" />
                            {showPagePreview ? 'Hide Preview' : 'Show Pages'}
                        </button>
                        
                    </div>
                </div>
                {/* --- END HEADER SECTION --- */}

                {/* --- NEW PAGE PREVIEW STRIP (Conditional Rendering) --- */}
                {showPagePreview && (
                    <div className="flex-shrink-0 p-3 bg-gray-100 border-b border-gray-300 overflow-x-auto whitespace-nowrap scroll-smooth shadow-inner">
                        <div className="inline-flex space-x-4">
                            {MOCK_QUESTION_DATA.pages.map(page => (
                                <div 
                                    key={page.id}
                                    className={`inline-block p-1 rounded-lg transition duration-150 cursor-pointer 
                                        ${currentPage === page.id ? 'ring-4 ring-blue-500 bg-white shadow-lg' : 'hover:bg-gray-200'}`}
                                    onClick={() => goToPage(page.id)}
                                >
                                    <img 
                                        src={page.thumbnail} 
                                        alt={`Page ${page.id} thumbnail`} 
                                        className="w-16 h-24 object-cover rounded-md border border-gray-400"
                                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/64x96/f3f4f6/374151?text=P' + page.id; }}
                                    />
                                    <p className="text-center text-xs font-semibold mt-1 text-gray-700">Page {page.id}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {/* --- END NEW PAGE PREVIEW STRIP --- */}


                {/* Canvas & Placeholder (Conditional Layout) */}
                <div className="flex-1 p-4 overflow-auto relative flex items-center justify-center">
                    
                    {showModelAnswer ? (
                        // Split view: Model Answer on Left, Student Answer on Right
                        <div className="flex w-full h-full space-x-4">
                            {/* Model Answer Image (Left Half) */}
                            <div className="flex-1 flex flex-col items-center justify-center bg-green-50 p-2 rounded-lg border-2 border-green-400 shadow-lg overflow-hidden">
                                <h4 className="text-sm font-bold text-green-700 mb-1">Model Answer Image</h4>
                                <img
                                    src={MOCK_QUESTION_DATA.modelAnswerImage}
                                    alt="Model Answer"
                                    className="max-h-full max-w-full object-contain rounded"
                                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/400x600/bbf7d0/065f46?text=Model+Answer+Image+Load+Error'; }}
                                />
                            </div>
                            
                            {/* Student Answer Image + Canvas (Right Half) */}
                            <div className="flex-1 relative flex items-center justify-center image-canvas-container">
                                {/* Important: Ref is set here for the image we need to overlay the canvas on */}
                                <img
                                    ref={imgRef}
                                    src={MOCK_QUESTION_DATA.imagePlaceholder} 
                                    alt="Scanned Answer Sheet"
                                    className="max-h-full max-w-full object-contain rounded-lg border border-gray-300 shadow-md"
                                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/800x600/6b7280/ffffff?text=Image+Load+Error'; }}
                                />
                                <canvas
                                    ref={canvasRef}
                                    width={800}
                                    height={600}
                                    className="absolute cursor-crosshair"
                                    style={{ backgroundColor: 'transparent' }}
                                />
                            </div>
                        </div>
                    ) : (
                        // Single view: Student Answer only (Original content)
                        <div className="relative max-w-full max-h-full image-canvas-container">
                            {/* Image (Mock placeholder or actual image) */}
                            {/* NOTE: In a real app, the image src would change based on currentPage */}
                            <img
                                ref={imgRef}
                                src={MOCK_QUESTION_DATA.imagePlaceholder} 
                                alt={`Scanned Answer Sheet - Page ${currentPage}`}
                                className="max-h-full max-w-full object-contain rounded-lg border border-gray-300 shadow-md"
                                onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/800x600/6b7280/ffffff?text=Page+${currentPage}+Load+Error`; }}
                            />
                            {/* Canvas Overlay for Annotations */}
                            <canvas
                                ref={canvasRef}
                                width={800}
                                height={600}
                                className="absolute cursor-crosshair"
                                style={{ backgroundColor: 'transparent' }}
                            />
                        </div>
                    )}
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
                        <span className="text-sm font-bold">Page: {currentPage} / {totalPages}</span>
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

            {/* 2. Right Column (Annotations, Marks, Comments, Submit) */}
            <div className="w-64 flex-shrink-0 bg-white rounded-xl shadow-2xl p-3 space-y-5 overflow-y-auto">
                
                {/* 2a. Annotation Tools (First) */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-gray-600 uppercase border-b pb-2">Annotations</h3>
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
                        title="Clear selected annotation tool"
                    >
                        <X className="w-5 h-5 mr-1 text-gray-600" />
                        <span className='text-xs font-semibold text-gray-600'>Clear Tool Selection</span>
                    </button>
                    {/* Clear All Drawings button */}
                    <button
                        onClick={clearCanvas}
                        className="w-full py-2 flex items-center justify-center rounded-lg border-2 border-red-500 bg-red-100 text-red-700 font-semibold hover:bg-red-200 transition duration-150 mt-3"
                        title="Permanently clear all canvas annotations"
                    >
                        <Scan className="w-5 h-5 mr-1" />
                        <span className='text-xs font-semibold'>Clear All Drawings</span>
                    </button>
                </div>
                
                <div className="border-t pt-4"></div>

                {/* 2b. Marks Assignment (Second) */}
                <div className="space-y-2 text-center">
                    <h3 className="text-xs font-bold text-gray-600 mb-2 uppercase border-b pb-2">Assign Marks</h3>
                    {/* Marks buttons showing only whole numbers */}
                    <div className="grid grid-cols-4 gap-2 justify-center">
                        {marksOptions.map(m => <MarksButton key={m} value={m} />)}
                    </div>

                    {/* Manual Marks Input (Step 0.1 allows for fractional marks like X.5) */}
                    <input
                        type="number"
                        step="0.1" 
                        min="0"
                        max={MOCK_QUESTION_DATA.maxMarks}
                        value={currentMark}
                        onChange={(e) => setCurrentMark(Math.min(MOCK_QUESTION_DATA.maxMarks, Math.max(0, parseFloat(e.target.value) || 0)))}
                        className="w-full text-center p-2 mt-3 border border-gray-300 rounded-lg text-lg font-bold shadow-inner focus:border-blue-500"
                        aria-label="Enter Marks Manually (e.g., 4.5)"
                    />
                    <p className="text-xs text-gray-500 font-semibold">Max: {formatMark(MOCK_QUESTION_DATA.maxMarks)}</p>
                </div>
                
                <div className="border-t pt-4"></div>

                {/* 2c. Evaluator Comment Area (Third) */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-gray-600 mb-2 uppercase border-b pb-2">Evaluator Comment</h3>
                    <textarea
                        className="w-full h-24 p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none shadow-inner"
                        placeholder="Add overall notes here..."
                        value={annotationText}
                        onChange={(e) => setAnnotationText(e.target.value)}
                    />
                </div>

                {/* 2d. Finish Evaluation Button (Last) */}
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
