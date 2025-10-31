import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Scan, Pen, Palette, BookOpen, Check, X, Bug, AlertCircle } from 'lucide-react';
import api from '../api.js';

const formatMark = (mark) => {
    if (mark === null || isNaN(mark)) return '0.0';
    if (Math.abs(mark * 100 - Math.round(mark * 100)) > 0.001) {
        return mark.toFixed(2);
    }
    return mark.toFixed(1);
};

const Evaluator = () => {
    // ========== STATE ==========
    const [currentMark, setCurrentMark] = useState(0);
    const [showModelAnswer, setShowModelAnswer] = useState(false);
    const [showPagePreview, setShowPagePreview] = useState(false);
    const [drawingMode, setDrawingMode] = useState(null);
    const [annotationText, setAnnotationText] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    
    // DEBUG MODE STATE
    const [debugMode, setDebugMode] = useState(true); // Set to true for testing
    const [imageLoadStatus, setImageLoadStatus] = useState({});
    const [debugLogs, setDebugLogs] = useState([]);

    // Data states
    const [questionData, setQuestionData] = useState(null);
    const [images, setImages] = useState([]);
    const [workbookId, setWorkbookId] = useState('W-1234');
    const [questionNo, setQuestionNo] = useState(1);

    const canvasRef = useRef(null);
    const imgRef = useRef(null);
    const isDrawing = useRef(false);
    const lastPos = useRef({ x: 0, y: 0 });

    // Debug logger
    const addDebugLog = (message, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        const log = { timestamp, message, type };
        setDebugLogs(prev => [log, ...prev].slice(0, 50)); // Keep last 50 logs
        
        // Also log to console
        const emoji = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
        console.log(`${emoji} [${timestamp}] ${message}`);
    };

    // ========== FETCH DATA ==========
    useEffect(() => {
        addDebugLog('Component mounted, fetching data...', 'info');
        fetchQuestionData();
        fetchImages();
    }, [workbookId, questionNo]);

    const fetchQuestionData = async () => {
        try {
            setLoading(true);
            addDebugLog(`Fetching question data for paper: ASX123`, 'info');
            const data = await api.getQuestions('ASX123');
            if (data && data.length > 0) {
                setQuestionData(data[0]);
                addDebugLog(`Question data loaded: ${data[0].question_text}`, 'success');
            } else {
                addDebugLog('No question data found', 'error');
            }
        } catch (err) {
            const errorMsg = `Failed to fetch question data: ${err.message}`;
            setError(errorMsg);
            addDebugLog(errorMsg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchImages = async () => {
        try {
            addDebugLog(`Fetching images for workbook: ${workbookId}, question: ${questionNo}`, 'info');
            const data = await api.getImages(workbookId, questionNo);
            
            if (data && data.images) {
                setImages(data.images);
                addDebugLog(`Loaded ${data.images.length} images`, 'success');
                
                // Log each image URL
                data.images.forEach((img, idx) => {
                    const url = api.getImageUrl(img);
                    addDebugLog(`Image ${idx + 1}: ${url}`, 'info');
                });
            } else {
                addDebugLog('No images found in response', 'error');
                setImages([]);
            }
        } catch (err) {
            const errorMsg = `Failed to fetch images: ${err.message}`;
            addDebugLog(errorMsg, 'error');
            console.error(err);
        }
    };

    // ========== IMAGE LOAD TRACKING ==========
    const handleImageLoad = (index) => {
        setImageLoadStatus(prev => ({ ...prev, [index]: 'loaded' }));
        addDebugLog(`Image ${index + 1} loaded successfully`, 'success');
    };

    const handleImageError = (index, imagePath) => {
        setImageLoadStatus(prev => ({ ...prev, [index]: 'error' }));
        const url = api.getImageUrl(imagePath);
        addDebugLog(`Image ${index + 1} failed to load. URL: ${url}`, 'error');
    };

    const totalPages = images.length || 1;
    const maxMarks = questionData?.max_marks || 10;
    const currentImagePath = images[currentPage - 1];
    const currentImageUrl = currentImagePath ? api.getImageUrl(currentImagePath) : null;

    // ========== CANVAS & DRAWING ==========
    const marksOptions = useMemo(() => {
        const options = [];
        for (let i = 0; i <= maxMarks; i++) {
            options.push(i);
        }
        return options;
    }, [maxMarks]);

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            addDebugLog('Canvas cleared', 'info');
        }
    };

    const resizeCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const img = imgRef.current;
        if (canvas && img && canvas.parentElement) {
            canvas.width = img.naturalWidth || 800;
            canvas.height = img.naturalHeight || 600;

            const imgRect = img.getBoundingClientRect();
            const parentContainer = img.closest('.image-canvas-container');
            const parentRect = parentContainer ? parentContainer.getBoundingClientRect() : canvas.parentElement.getBoundingClientRect();

            canvas.style.width = `${imgRect.width}px`;
            canvas.style.height = `${imgRect.height}px`;

            const topOffset = imgRect.top - parentRect.top;
            const leftOffset = imgRect.left - parentRect.left;

            canvas.style.top = `${topOffset}px`;
            canvas.style.left = `${leftOffset}px`;
        }
    }, []);

    useEffect(() => {
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        const img = imgRef.current;
        if (img) {
            img.addEventListener('load', resizeCanvas);
        }

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            if (img) {
                img.removeEventListener('load', resizeCanvas);
            }
        };
    }, [resizeCanvas, showModelAnswer, currentPage]);

    // Drawing code (simplified for brevity - use your original)
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        const getCanvasCoords = (clientX, clientY) => {
            const rect = canvas.getBoundingClientRect();
            const x = ((clientX - rect.left) / rect.width) * canvas.width;
            const y = ((clientY - rect.top) / rect.height) * canvas.height;
            return { x, y };
        };

        const drawStamp = (type, x, y) => {
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = type === 'check' ? '#10b981' : '#ef4444';
            ctx.font = '70px sans-serif';
            ctx.fillText(type === 'check' ? '✓' : '✖', x - 25, y + 25);
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
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 4;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.globalAlpha = 1.0;
            } else if (drawingMode === 'highlight') {
                ctx.globalCompositeOperation = 'multiply';
                ctx.strokeStyle = 'rgba(255, 196, 0, 0.05)';
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
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1.0;
        };

        const handleTouchStart = (e) => { handleMouseDown(e); };
        const handleTouchMove = (e) => { handleMouseMove(e); };
        const handleTouchEnd = handleMouseUp;

        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mouseleave', handleMouseUp);
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

    // ========== PAGE NAVIGATION ==========
    const nextPage = () => {
        const next = Math.min(totalPages, currentPage + 1);
        setCurrentPage(next);
        clearCanvas();
        addDebugLog(`Navigated to page ${next}`, 'info');
    };

    const prevPage = () => {
        const prev = Math.max(1, currentPage - 1);
        setCurrentPage(prev);
        clearCanvas();
        addDebugLog(`Navigated to page ${prev}`, 'info');
    };

    const goToPage = (pageNumber) => {
        setCurrentPage(pageNumber);
        clearCanvas();
        setShowPagePreview(false);
        addDebugLog(`Jumped to page ${pageNumber}`, 'info');
    };

    // ========== SUBMIT ==========
    const handleSubmit = async () => {
        try {
            setLoading(true);
            setError('');
            setSuccess('');
            addDebugLog(`Submitting evaluation: ${currentMark} marks`, 'info');

            await api.evaluateQuestion(
                workbookId,
                questionNo,
                currentMark,
                annotationText
            );

            setSuccess('Evaluation submitted successfully!');
            addDebugLog('Evaluation submitted successfully', 'success');
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            const errorMsg = err.message || 'Failed to submit evaluation';
            setError(errorMsg);
            addDebugLog(errorMsg, 'error');
        } finally {
            setLoading(false);
        }
    };

    // ========== UI COMPONENTS ==========
    const MarksButton = ({ value }) => (
        <button
            onClick={() => setCurrentMark(value)}
            className={`w-full h-10 text-sm font-bold rounded-lg border-2 border-gray-300 transition duration-150 shadow-sm
                ${currentMark === value ? 'bg-blue-600 text-white ring-2 ring-blue-500' : 'bg-white text-gray-800 hover:bg-blue-50'}`}
        >
            {value}
        </button>
    );

    const AnnotationButton = ({ type, icon: Icon, colorClass, label }) => (
        <button
            onClick={() => setDrawingMode(type)}
            className={`w-full py-2 flex items-center justify-center rounded-lg border-2 border-gray-300 transition duration-150 ${colorClass} ${drawingMode === type ? 'ring-4 ring-offset-2 ring-blue-500 shadow-md' : 'hover:bg-gray-100'}`}
        >
            <Icon className="w-5 h-5 mr-1" />
            <span className='text-xs font-semibold'>{label}</span>
        </button>
    );

    if (loading && !questionData) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading evaluation page...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-1 h-full bg-gray-100 overflow-hidden p-2 md:p-4 font-sans">
            {/* DEBUG PANEL */}
            {debugMode && (
                <div className="fixed top-20 right-4 w-96 max-h-[70vh] bg-white border-2 border-blue-500 rounded-lg shadow-2xl z-50 overflow-hidden flex flex-col">
                    <div className="bg-blue-600 text-white p-3 flex justify-between items-center">
                        <div className="flex items-center">
                            <Bug className="w-5 h-5 mr-2" />
                            <span className="font-bold">Debug Panel</span>
                        </div>
                        <button
                            onClick={() => setDebugMode(false)}
                            className="text-white hover:bg-blue-700 rounded px-2 py-1"
                        >
                            ✕
                        </button>
                    </div>
                    
                    <div className="p-3 border-b bg-gray-50">
                        <div className="text-xs space-y-1">
                            <p><strong>Workbook:</strong> {workbookId}</p>
                            <p><strong>Question:</strong> {questionNo}</p>
                            <p><strong>Images Loaded:</strong> {images.length}</p>
                            <p><strong>Current Page:</strong> {currentPage}/{totalPages}</p>
                            <p><strong>Current Image:</strong> {currentImagePath || 'None'}</p>
                            <p><strong>Image Status:</strong> {
                                imageLoadStatus[currentPage - 1] === 'loaded' ? '✅ Loaded' :
                                imageLoadStatus[currentPage - 1] === 'error' ? '❌ Failed' :
                                '⏳ Loading...'
                            }</p>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3">
                        <h4 className="text-xs font-bold mb-2 text-gray-700">Activity Log:</h4>
                        <div className="space-y-1">
                            {debugLogs.map((log, idx) => (
                                <div
                                    key={idx}
                                    className={`text-xs p-2 rounded ${
                                        log.type === 'error' ? 'bg-red-50 text-red-700' :
                                        log.type === 'success' ? 'bg-green-50 text-green-700' :
                                        'bg-blue-50 text-blue-700'
                                    }`}
                                >
                                    <span className="font-mono text-[10px] text-gray-500">[{log.timestamp}]</span>
                                    <br />
                                    {log.message}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="p-3 border-t bg-gray-50">
                        <button
                            onClick={() => {
                                setDebugLogs([]);
                                addDebugLog('Logs cleared', 'info');
                            }}
                            className="w-full py-2 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                        >
                            Clear Logs
                        </button>
                    </div>
                </div>
            )}

            {/* Toggle Debug Button (when hidden) */}
            {!debugMode && (
                <button
                    onClick={() => setDebugMode(true)}
                    className="fixed top-20 right-4 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 z-50"
                    title="Show Debug Panel"
                >
                    <Bug className="w-5 h-5" />
                </button>
            )}

            {/* Alerts */}
            {error && (
                <div className="fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50 max-w-md">
                    <div className="flex items-start">
                        <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                        <div>{error}</div>
                    </div>
                </div>
            )}
            {success && (
                <div className="fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded z-50">
                    {success}
                </div>
            )}

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 bg-white rounded-xl shadow-2xl flex flex-col relative overflow-hidden mr-4">
                {/* Header */}
                <div className="flex-shrink-0 p-4 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
                    <div className="flex-1 mr-4">
                        <h4 className="text-lg font-bold text-blue-800">Question:</h4>
                        <p className="text-sm text-gray-900 font-medium break-words">
                            {questionData?.question_text || 'Loading question...'}
                        </p>
                    </div>

                    <div className="flex flex-col space-y-3">
                        <button
                            onClick={() => {
                                setShowModelAnswer(!showModelAnswer);
                                clearCanvas();
                            }}
                            className={`py-2 px-4 flex-shrink-0 flex items-center justify-center font-semibold rounded-lg shadow-md transition duration-150 text-sm 
                                ${showModelAnswer ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
                        >
                            <BookOpen className="w-4 h-4 mr-2" />
                            {showModelAnswer ? 'Hide Model Answer' : 'Show Model Answer'}
                        </button>

                        <button
                            onClick={() => setShowPagePreview(!showPagePreview)}
                            className={`py-2 px-4 flex-shrink-0 flex items-center justify-center font-semibold rounded-lg shadow-md transition duration-150 text-sm 
                                ${showPagePreview ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
                        >
                            <Scan className="w-4 h-4 mr-2" />
                            {showPagePreview ? 'Hide Preview' : 'Show Pages'}
                        </button>
                    </div>
                </div>

                {/* Page Preview Strip */}
                {showPagePreview && (
                    <div className="flex-shrink-0 p-3 bg-gray-100 border-b border-gray-300 overflow-x-auto whitespace-nowrap scroll-smooth shadow-inner">
                        <div className="inline-flex space-x-4">
                            {images.map((img, idx) => (
                                <div
                                    key={idx}
                                    className={`inline-block p-1 rounded-lg transition duration-150 cursor-pointer 
                                        ${currentPage === idx + 1 ? 'ring-4 ring-blue-500 bg-white shadow-lg' : 'hover:bg-gray-200'}`}
                                    onClick={() => goToPage(idx + 1)}
                                >
                                    <div className="relative">
                                        <img
                                            src={api.getImageUrl(img)}
                                            alt={`Page ${idx + 1} thumbnail`}
                                            className="w-16 h-24 object-cover rounded-md border border-gray-400"
                                            onLoad={() => addDebugLog(`Thumbnail ${idx + 1} loaded`, 'success')}
                                            onError={() => addDebugLog(`Thumbnail ${idx + 1} failed`, 'error')}
                                        />
                                        {imageLoadStatus[idx] === 'error' && (
                                            <div className="absolute inset-0 bg-red-500 bg-opacity-50 rounded-md flex items-center justify-center">
                                                <X className="w-6 h-6 text-white" />
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-center text-xs font-semibold mt-1 text-gray-700">Page {idx + 1}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Image Display Area */}
                <div className="flex-1 p-4 overflow-auto relative flex items-center justify-center bg-gray-50">
                    {images.length === 0 ? (
                        <div className="text-center text-gray-500">
                            <AlertCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                            <p className="text-lg font-semibold">No Images Available</p>
                            <p className="text-sm mt-2">Workbook: {workbookId}, Question: {questionNo}</p>
                            <button
                                onClick={fetchImages}
                                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                                Retry Loading Images
                            </button>
                        </div>
                    ) : currentImageUrl ? (
                        <div className="relative max-w-full max-h-full image-canvas-container">
                            <img
                                ref={imgRef}
                                src={currentImageUrl}
                                alt={`Answer Sheet - Page ${currentPage}`}
                                className="max-h-full max-w-full object-contain rounded-lg border border-gray-300 shadow-md"
                                onLoad={() => handleImageLoad(currentPage - 1)}
                                onError={() => handleImageError(currentPage - 1, currentImagePath)}
                            />
                            
                            {/* Loading overlay */}
                            {imageLoadStatus[currentPage - 1] === undefined && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-200 bg-opacity-75 rounded-lg">
                                    <div className="text-center">
                                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-2"></div>
                                        <p className="text-sm text-gray-600">Loading image...</p>
                                    </div>
                                </div>
                            )}
                            
                            {/* Error overlay */}
                            {imageLoadStatus[currentPage - 1] === 'error' && (
                                <div className="absolute inset-0 flex items-center justify-center bg-red-100 bg-opacity-90 rounded-lg">
                                    <div className="text-center p-4">
                                        <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-3" />
                                        <p className="text-lg font-semibold text-red-800">Image Failed to Load</p>
                                        <p className="text-sm text-red-600 mt-2 break-all max-w-md">
                                            URL: {currentImageUrl}
                                        </p>
                                        <button
                                            onClick={() => {
                                                setImageLoadStatus(prev => {
                                                    const newStatus = { ...prev };
                                                    delete newStatus[currentPage - 1];
                                                    return newStatus;
                                                });
                                                window.location.reload();
                                            }}
                                            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                                        >
                                            Retry
                                        </button>
                                    </div>
                                </div>
                            )}

                            <canvas
                                ref={canvasRef}
                                width={800}
                                height={600}
                                className="absolute cursor-crosshair"
                                style={{ backgroundColor: 'transparent' }}
                            />
                        </div>
                    ) : (
                        <div className="text-gray-500">No image available for current page</div>
                    )}
                </div>

                {/* Navigation Bar */}
                <div className="flex-shrink-0 bg-blue-600 text-white text-sm font-semibold p-2 flex justify-between items-center px-4 rounded-b-xl">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={prevPage}
                            disabled={currentPage === 1}
                            className={`px-3 py-1 rounded text-xs transition ${currentPage === 1 ? 'bg-blue-500 text-gray-300 cursor-not-allowed' : 'bg-blue-700 hover:bg-blue-800'}`}
                        >
                            &larr; Previous
                        </button>
                        <span className="text-sm font-bold">Page: {currentPage} / {totalPages}</span>
                        <button
                            onClick={nextPage}
                            disabled={currentPage === totalPages}
                            className={`px-3 py-1 rounded text-xs transition ${currentPage === totalPages ? 'bg-blue-500 text-gray-300 cursor-not-allowed' : 'bg-blue-700 hover:bg-blue-800'}`}
                        >
                            Next &rarr;
                        </button>
                    </div>

                    <div className="flex items-center space-x-4">
                        <span className="font-mono">Workbook: {workbookId}</span>
                        <span>Marks: <span className="text-xl font-extrabold">{formatMark(currentMark)}</span> / {formatMark(maxMarks)}</span>
                    </div>
                </div>
            </div>

            {/* RIGHT SIDEBAR - Controls */}
            <div className="w-64 flex-shrink-0 bg-white rounded-xl shadow-2xl p-3 space-y-5 overflow-y-auto">
                {/* Annotations */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-gray-600 uppercase border-b pb-2">Annotations</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <AnnotationButton type="check" icon={Check} colorClass="text-green-600 border-green-300" label="Correct" />
                        <AnnotationButton type="cross" icon={X} colorClass="text-red-600 border-red-300" label="Cross" />
                        <AnnotationButton type="pen" icon={Pen} colorClass="text-red-600 border-red-300" label="Pen" />
                        <AnnotationButton type="highlight" icon={Palette} colorClass="text-yellow-600 border-yellow-300" label="Highlight" />
                    </div>
                    <button
                        onClick={() => setDrawingMode(null)}
                        className="w-full py-2 flex items-center justify-center rounded-lg border-2 border-gray-300 bg-gray-100 hover:bg-gray-200 mt-3 transition duration-150"
                    >
                        <X className="w-5 h-5 mr-1 text-gray-600" />
                        <span className='text-xs font-semibold text-gray-600'>Clear Tool</span>
                    </button>
                    <button
                        onClick={clearCanvas}
                        className="w-full py-2 flex items-center justify-center rounded-lg border-2 border-red-500 bg-red-100 text-red-700 font-semibold hover:bg-red-200 transition duration-150 mt-3"
                    >
                        <Scan className="w-5 h-5 mr-1" />
                        <span className='text-xs font-semibold'>Clear All</span>
                    </button>
                </div>

                <div className="border-t pt-4"></div>

                {/* Marks Assignment */}
                <div className="space-y-2 text-center">
                    <h3 className="text-xs font-bold text-gray-600 mb-2 uppercase border-b pb-2">Assign Marks</h3>
                    <div className="grid grid-cols-4 gap-2 justify-center">
                        {marksOptions.map(m => <MarksButton key={m} value={m} />)}
                    </div>
                    <input
                        type="number"
                        step="0.1"
                        min="0"
                        max={maxMarks}
                        value={currentMark}
                        onChange={(e) => setCurrentMark(Math.min(maxMarks, Math.max(0, parseFloat(e.target.value) || 0)))}
                        className="w-full text-center p-2 mt-3 border border-gray-300 rounded-lg text-lg font-bold shadow-inner focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 font-semibold">Max: {formatMark(maxMarks)}</p>
                </div>

                <div className="border-t pt-4"></div>

                {/* Comment */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-gray-600 mb-2 uppercase border-b pb-2">Comment</h3>
                    <textarea
                        className="w-full h-24 p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none shadow-inner"
                        placeholder="Add notes..."
                        value={annotationText}
                        onChange={(e) => setAnnotationText(e.target.value)}
                    />
                </div>

                {/* Submit */}
                <div className="pt-4 border-t">
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className={`w-full py-3 bg-red-600 text-white font-extrabold rounded-lg shadow-xl hover:bg-red-700 transition duration-150 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {loading ? 'SUBMITTING...' : 'SUBMIT'}
                    </button>
                </div>

                {/* Quick Test Buttons */}
                <div className="pt-4 border-t">
                    <h3 className="text-xs font-bold text-gray-600 mb-2">Quick Tests</h3>
                    <div className="space-y-2">
                        <button
                            onClick={() => {
                                if (currentImageUrl) {
                                    window.open(currentImageUrl, '_blank');
                                    addDebugLog('Opened image in new tab', 'info');
                                }
                            }}
                            className="w-full py-2 bg-purple-600 text-white text-xs rounded hover:bg-purple-700"
                        >
                            Open Image in New Tab
                        </button>
                        <button
                            onClick={() => {
                                console.log('=== IMAGE DEBUG INFO ===');
                                console.log('Current Page:', currentPage);
                                console.log('Total Pages:', totalPages);
                                console.log('Images Array:', images);
                                console.log('Current Image Path:', currentImagePath);
                                console.log('Current Image URL:', currentImageUrl);
                                console.log('Image Load Status:', imageLoadStatus);
                                console.log('API Base URL:', api.baseURL);
                                addDebugLog('Logged debug info to console', 'info');
                            }}
                            className="w-full py-2 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                        >
                            Log to Console
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Evaluator;