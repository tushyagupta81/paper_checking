// frontend/src/ui/Components/EvaluationPage.jsx
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Scan, Pen, Palette, BookOpen, Check, X, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react';
import api from '../api.js';

const formatMark = (mark) => {
  if (mark === null || isNaN(mark)) return '0';
  return Number.isInteger(mark) ? String(mark) : mark.toFixed(1);
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const AnnotationButton = ({ type, icon: Icon, colorClass, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full py-2 flex items-center justify-center rounded-lg border-2 transition duration-150
      ${active ? 'ring-4 ring-offset-1 ring-blue-500 shadow-md' : 'hover:bg-gray-100'}
      ${colorClass}`}
  >
    <Icon className="w-5 h-5 mr-1" />
    <span className="text-xs font-semibold">{label}</span>
  </button>
);

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Props:
 *   workbookId  (string)  — e.g. "W-1234"         passed from EvaluatorDashboard
 *   questionNo  (number)  — e.g. 1                 passed from EvaluatorDashboard
 *   paperId     (string)  — e.g. "CS101-2024"      passed from EvaluatorDashboard
 *   userData    (object)  — current logged-in user
 *   onBack      (fn)      — called after submit or when back button pressed
 */
export default function EvaluationPage({ workbookId, questionNo, paperId, userData, onBack }) {
  // ── Core state ──────────────────────────────────────────────────────────────
  const [currentMark, setCurrentMark]         = useState(0);
  const [annotationText, setAnnotationText]   = useState('');
  const [drawingMode, setDrawingMode]         = useState(null);
  const [currentPage, setCurrentPage]         = useState(1);
  const [showModelAnswer, setShowModelAnswer] = useState(false);
  const [showPagePreview, setShowPagePreview] = useState(false);

  // ── Data state ──────────────────────────────────────────────────────────────
  const [images, setImages]         = useState([]);  // array of presigned URLs
  const [maxMarks, setMaxMarks]     = useState(10);  // from question_bank
  const [imagesLoading, setImagesLoading] = useState(true);
  const [imageLoadStatus, setImageLoadStatus] = useState({});

  // Question image (the scanned question itself) — kept separate from
  // answer images so a failure here never blocks the answer/marking flow.
  const [questionImageUrl, setQuestionImageUrl] = useState(null);
  const [questionImageLoading, setQuestionImageLoading] = useState(true);
  const [questionImageError, setQuestionImageError] = useState('');

  // ── Submit state ────────────────────────────────────────────────────────────
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted]     = useState(false);  // success state

  // ── Refs ────────────────────────────────────────────────────────────────────
  const canvasRef   = useRef(null);
  const imgRef      = useRef(null);
  const isDrawing   = useRef(false);
  const lastPos     = useRef({ x: 0, y: 0 });

  // Per-page annotation storage: { [pageNumber]: dataURL }
  // The single <canvas> is reused across pages, so its content must be
  // saved here before switching pages and restored when coming back —
  // otherwise navigating Next/Previous silently erases prior marks.
  const pageAnnotations = useRef({});

  // ── Derived ─────────────────────────────────────────────────────────────────
  const totalPages      = images.length || 1;
  const currentImageUrl = images[currentPage - 1] || null;

  const marksOptions = useMemo(() => {
    const opts = [];
    for (let i = 0; i <= maxMarks; i++) opts.push(i);
    return opts;
  }, [maxMarks]);

  // ────────────────────────────────────────────────────────────────────────────
  // Fetch images on mount
  // Backend: POST /images/get → { urls: { page_no: presigned_url } }
  // ────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!workbookId || !questionNo) return;
    fetchImages();
  }, [workbookId, questionNo]);

  // ────────────────────────────────────────────────────────────────────────────
  // Fetch the question's own image on mount
  // Backend: GET /question/image?paper_id=...&question_no=... → { url }
  // ────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!paperId || !questionNo) {
      setQuestionImageLoading(false);
      return;
    }
    fetchQuestionImage();
  }, [paperId, questionNo]);

  const fetchQuestionImage = async () => {
    setQuestionImageLoading(true);
    setQuestionImageError('');
    try {
      const data = await api.getQuestionImage(paperId, questionNo);
      setQuestionImageUrl(data?.url || null);
    } catch (err) {
      setQuestionImageError(`Could not load question image: ${err.message}`);
      setQuestionImageUrl(null);
    } finally {
      setQuestionImageLoading(false);
    }
  };

  const fetchImages = async () => {
    setImagesLoading(true);
    setSubmitError('');
    setImageLoadStatus({});
    try {
      // this zip's api.js method is getImages(), not getQuestionImages()
      const data = await api.getImages(workbookId, questionNo);

      // data.urls is { "1": url, "2": url, ... } — sort by page number
      if (data && data.urls) {
        const sorted = Object.entries(data.urls)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([, url]) => url);
        setImages(sorted);

        // If backend also gives us max_marks, use it
        if (data.max_marks) setMaxMarks(data.max_marks);
        return sorted;
      } else {
        setImages([]);
        return [];
      }
    } catch (err) {
      setSubmitError(`Could not load images: ${err.message}`);
      setImages([]);
      return [];
    } finally {
      setImagesLoading(false);
    }
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Canvas helpers — save/restore per-page annotation layers
  // ────────────────────────────────────────────────────────────────────────────
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    }
    // Also clear the saved annotation for the current page, since
    // "Clear Canvas" is meant to wipe that page's marks entirely.
    delete pageAnnotations.current[currentPage];
  };

  // Saves the current canvas's drawn content (not the underlying image,
  // just the annotation layer) as a PNG data URL keyed by page number.
  const saveCurrentPageAnnotation = (pageNum) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      pageAnnotations.current[pageNum] = canvas.toDataURL('image/png');
    } catch (e) {
      // toDataURL can throw if the canvas is tainted (e.g. CORS) — in that
      // case we simply can't persist this page's annotation in-memory.
      console.error('Could not save page annotation:', e);
    }
  };

  // Redraws a previously-saved annotation layer onto the (already resized,
  // freshly cleared) canvas for the page now being shown.
  const restorePageAnnotation = (pageNum) => {
    const canvas = canvasRef.current;
    const saved = pageAnnotations.current[pageNum];
    if (!canvas || !saved) return;
    const ctx = canvas.getContext('2d');
    const layer = new Image();
    layer.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(layer, 0, 0, canvas.width, canvas.height);
    };
    layer.src = saved;
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Canvas: resize to sit exactly over the image
  // ────────────────────────────────────────────────────────────────────────────
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    if (!canvas || !img) return;

    // NOTE: setting canvas.width/height always clears its content — this is
    // standard browser behavior, not a bug. Any previously-saved annotation
    // for this page must be redrawn afterward (done in the effect below).
    canvas.width  = img.naturalWidth  || 800;
    canvas.height = img.naturalHeight || 600;

    const imgRect    = img.getBoundingClientRect();
    const container  = img.closest('.image-canvas-container');
    const parentRect = container
      ? container.getBoundingClientRect()
      : canvas.parentElement.getBoundingClientRect();

    canvas.style.width  = `${imgRect.width}px`;
    canvas.style.height = `${imgRect.height}px`;
    canvas.style.top    = `${imgRect.top  - parentRect.top}px`;
    canvas.style.left   = `${imgRect.left - parentRect.left}px`;
  }, []);

  useEffect(() => {
    resizeCanvas();
    restorePageAnnotation(currentPage);
    window.addEventListener('resize', resizeCanvas);
    const img = imgRef.current;
    const handleImgLoad = () => {
      resizeCanvas();
      restorePageAnnotation(currentPage);
    };
    if (img) img.addEventListener('load', handleImgLoad);
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (img) img.removeEventListener('load', handleImgLoad);
    };
  }, [resizeCanvas, showModelAnswer, currentPage]);

  // ────────────────────────────────────────────────────────────────────────────
  // Canvas: drawing events
  // ────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const coords = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width)  * canvas.width,
        y: ((clientY - rect.top)  / rect.height) * canvas.height,
      };
    };

    const drawStamp = (type, x, y) => {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = type === 'check' ? '#10b981' : '#ef4444';
      ctx.font      = '70px sans-serif';
      ctx.fillText(type === 'check' ? '✓' : '✖', x - 25, y + 25);
      // Tool stays active after stamping, same as pen/highlight, so the
      // examiner can place multiple ✓ / ✖ marks without reselecting it.
    };
    const onUp = () => {
      isDrawing.current = false;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    };
    const onDown = (e) => {
      e.preventDefault();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      const { x, y } = coords(cx, cy);
      lastPos.current = { x, y };

      if (drawingMode === 'check' || drawingMode === 'cross') {
        drawStamp(drawingMode, x, y);
        return;
      }
      if (drawingMode === 'pen' || drawingMode === 'highlight' || drawingMode === 'eraser') {
        isDrawing.current = true;
        ctx.beginPath();
        ctx.moveTo(x, y);
      }
    };

    const onMove = (e) => {
      if (!isDrawing.current) return;
      e.preventDefault();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      const { x, y } = coords(cx, cy);
        
      if (drawingMode === 'pen') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth   = 4;
        ctx.lineCap = ctx.lineJoin = 'round';
        ctx.lineTo(x, y);
        ctx.stroke();
      
      } else if (drawingMode === 'highlight') {
        // Draw segment-by-segment from lastPos so each stroke is one
        // fresh path — this prevents globalAlpha from stacking up over
        // a long drag and turning the highlight fully opaque.
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth   = 30;
        ctx.lineCap = ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(lastPos.current.x, lastPos.current.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      
      } else if (drawingMode === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = 1;
        ctx.lineWidth   = 24;
        ctx.lineCap = ctx.lineJoin = 'round';
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    
      lastPos.current = { x, y };
    };

    canvas.addEventListener('mousedown',  onDown);
    canvas.addEventListener('mousemove',  onMove);
    canvas.addEventListener('mouseup',    onUp);
    canvas.addEventListener('mouseleave', onUp);
    canvas.addEventListener('touchstart', onDown, { passive: false });
    canvas.addEventListener('touchmove',  onMove, { passive: false });
    canvas.addEventListener('touchend',   onUp);

    return () => {
      canvas.removeEventListener('mousedown',  onDown);
      canvas.removeEventListener('mousemove',  onMove);
      canvas.removeEventListener('mouseup',    onUp);
      canvas.removeEventListener('mouseleave', onUp);
      canvas.removeEventListener('touchstart', onDown);
      canvas.removeEventListener('touchmove',  onMove);
      canvas.removeEventListener('touchend',   onUp);
    };
  }, [drawingMode]);

  // ────────────────────────────────────────────────────────────────────────────
  // Page navigation
  // ────────────────────────────────────────────────────────────────────────────
  const goToPage = (n) => {
    if (n === currentPage) return;
    saveCurrentPageAnnotation(currentPage);
    setCurrentPage(n);
    setShowPagePreview(false);
    // Restoration happens in the resize effect below, once the new page's
    // image has loaded and the canvas has been resized to match it.
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Flatten + upload checked images
  // For every page, draws the original answer image plus that page's saved
  // annotation layer onto an offscreen canvas, exports it as a PNG blob, and
  // uploads all pages together so the examiner's marks are actually saved
  // (not just visible in the browser during this session).
  // ────────────────────────────────────────────────────────────────────────────
  const flattenAndUploadCheckedImages = async () => {
    // Make sure the page currently on screen is saved before flattening.
    saveCurrentPageAnnotation(currentPage);

    const pageNumsWithContent = Object.keys(pageAnnotations.current).map(Number);
    if (pageNumsWithContent.length === 0) {
      // Nothing was annotated — nothing to upload. Not an error; the
      // examiner may have only entered marks without drawing anything.
      return;
    }

    // Presigned URLs expire after 60 seconds (backend URL_EXPIRY). By the
    // time the examiner finishes marking and clicks submit, the ones
    // already in `images` state are very likely stale — fetch fresh ones
    // right now rather than reusing them.
    const freshImages = await fetchImages();
    const validPageNums = pageNumsWithContent.filter((n) => freshImages[n - 1]);
    if (validPageNums.length === 0) return;

    const loadImage = (src) =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });

    const blobs = [];
    for (const pageNum of validPageNums) {
      const baseUrl = freshImages[pageNum - 1];
      const annotationDataUrl = pageAnnotations.current[pageNum];
      if (!baseUrl || !annotationDataUrl) continue;

      const baseImg = await loadImage(baseUrl);
      const annotationImg = await loadImage(annotationDataUrl);

      const offscreen = document.createElement('canvas');
      offscreen.width = baseImg.naturalWidth;
      offscreen.height = baseImg.naturalHeight;
      const ctx = offscreen.getContext('2d');
      ctx.drawImage(baseImg, 0, 0, offscreen.width, offscreen.height);
      ctx.drawImage(annotationImg, 0, 0, offscreen.width, offscreen.height);

      const blob = await new Promise((resolve) => offscreen.toBlob(resolve, 'image/png'));
      blobs.push({ pageNum, blob });
    }

    if (blobs.length === 0) return;

    await api.uploadCheckedImages(
      workbookId,
      questionNo,
      blobs.map((b) => b.blob),
      blobs.map((b) => b.pageNum),
    );
  };

  // ────────────────────────────────────────────────────────────────────────────
  // SUBMIT — uploads checked (annotated) images, then calls POST /question/evaluate
  // ────────────────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    // Guard: marks must be a valid number
    if (currentMark < 0 || currentMark > maxMarks) {
      setSubmitError(`Marks must be between 0 and ${maxMarks}.`);
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      // Save annotations first. If this fails, we deliberately stop before
      // evaluating — better to retry the whole submit than to record marks
      // with no corresponding saved annotations.
      try {
        await flattenAndUploadCheckedImages();
      } catch (uploadErr) {
        throw new Error(`Could not save annotated images: ${uploadErr.message}`);
      }

      const response = await api.evaluateQuestion(
        workbookId,      // string  — "W-1234"
        questionNo,      // number  — 1
        currentMark,      // number  — 0..maxMarks
        annotationText,   // examiner's typed comment
        // mac_addr defaults to '12:12:12:12:12:12' inside api.evaluateQuestion()
      );

      // ── Success ─────────────────────────────────────────────────────────────
      // Response: { message, workbook_id, question_no, marks, comment, submit_time }
      console.log('Evaluation saved:', response);
      setSubmitted(true);

      // Return to dashboard after 2 seconds so the examiner sees the tick
      setTimeout(() => {
        if (onBack) onBack();
      }, 2000);

    } catch (err) {
      // ── Error handling ───────────────────────────────────────────────────────
      // 403 — not assigned to this question
      // 409 — already evaluated
      // 422 — marks out of range (caught above, but backend double-checks)
      // 500 — database error
      setSubmitError(err.message || 'Failed to submit evaluation. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Success screen — shown for 2 seconds after submit before onBack() fires
  // ────────────────────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <div className="text-center bg-white rounded-2xl shadow-xl p-12">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Evaluation Submitted!</h2>
          <p className="text-gray-500">
            Workbook <span className="font-mono font-semibold">{workbookId}</span> —
            Q{questionNo} — <span className="font-bold text-blue-600">{currentMark}/{maxMarks} marks</span>
          </p>
          <p className="text-sm text-gray-400 mt-3">Returning to dashboard...</p>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Loading screen
  // ────────────────────────────────────────────────────────────────────────────
  if (imagesLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading answer sheet...</p>
          <p className="text-sm text-gray-400 mt-1">
            Workbook: {workbookId} · Q{questionNo}
          </p>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Main UI
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-1 h-full bg-gray-100 overflow-hidden p-2 md:p-4 font-sans">

      {/* Error / success toasts */}
      {submitError && (
        <div className="fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg z-50 max-w-md shadow-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Submission failed</p>
              <p className="text-sm mt-0.5">{submitError}</p>
            </div>
            <button onClick={() => setSubmitError('')} className="ml-2 text-red-500 hover:text-red-700">✕</button>
          </div>
        </div>
      )}

      {/* ── Main image area ── */}
      <div className="flex-1 bg-white rounded-xl shadow-2xl flex flex-col relative overflow-hidden mr-4">

        {/* Header */}
        <div className="flex-shrink-0 p-4 bg-blue-50 border-b border-blue-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-lg hover:bg-blue-100 text-blue-700 transition flex-shrink-0"
                title="Back to dashboard"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="min-w-0">
              <p className="text-xs text-blue-500 font-medium uppercase tracking-wide">
                Paper: {paperId} · Q{questionNo}
              </p>
              <h4 className="text-sm font-bold text-blue-800 truncate">
                Workbook: {workbookId}
              </h4>
            </div>
          </div>

          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => setShowModelAnswer(!showModelAnswer)}
              className={`py-2 px-3 flex items-center gap-1 font-semibold rounded-lg shadow transition text-sm
                ${showModelAnswer ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
            >
              <BookOpen className="w-4 h-4" />
              {showModelAnswer ? 'Hide Answer' : 'Model Answer'}
            </button>
            <button
              onClick={() => setShowPagePreview(!showPagePreview)}
              className={`py-2 px-3 flex items-center gap-1 font-semibold rounded-lg shadow transition text-sm
                ${showPagePreview ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
            >
              <Scan className="w-4 h-4" />
              Pages
            </button>
          </div>
        </div>

        {/* Page preview strip */}
        {showPagePreview && images.length > 0 && (
          <div className="flex-shrink-0 p-3 bg-gray-100 border-b border-gray-300 overflow-x-auto">
            <div className="inline-flex gap-3">
              {images.map((url, idx) => (
                <button
                  key={idx}
                  onClick={() => goToPage(idx + 1)}
                  className={`inline-flex flex-col items-center p-1 rounded-lg transition
                    ${currentPage === idx + 1 ? 'ring-4 ring-blue-500 bg-white shadow-lg' : 'hover:bg-gray-200'}`}
                >
                  <img
                    src={url}
                    alt={`Page ${idx + 1}`}
                    className="w-14 h-20 object-cover rounded border border-gray-300"
                  />
                  <span className="text-xs font-semibold mt-1 text-gray-600">P{idx + 1}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Question + Answer — one shared scroll region, single scrollbar */}
        <div className="flex-1 overflow-auto bg-gray-50">

          {/* Question image — shown above the answer, view-only, no annotation */}
          {(questionImageUrl || questionImageLoading || questionImageError) && (
            <div className="px-4 pt-4 flex-shrink-0">
              <div className="bg-white rounded-lg border border-gray-300 shadow-sm p-3">
                <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Question</h4>
                {questionImageLoading ? (
                  <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
                    Loading question…
                  </div>
                ) : questionImageError ? (
                  <div className="flex items-center justify-between text-sm text-red-500">
                    <span>{questionImageError}</span>
                    <button
                      onClick={fetchQuestionImage}
                      className="ml-3 px-3 py-1 bg-red-50 border border-red-300 rounded text-red-600 hover:bg-red-100"
                    >
                      Retry
                    </button>
                  </div>
                ) : questionImageUrl ? (
                  <img
                    src={questionImageUrl}
                    alt={`Question ${questionNo}`}
                    className="max-h-64 mx-auto object-contain rounded border border-gray-200"
                  />
                ) : null}
              </div>
            </div>
          )}

          {/* Answer image display */}
          <div className="p-4 relative flex items-center justify-center min-h-[60vh]">
          {images.length === 0 ? (
            <div className="text-center text-gray-500">
              <AlertCircle className="w-14 h-14 mx-auto mb-3 opacity-40" />
              <p className="text-lg font-semibold">No images found</p>
              <p className="text-sm mt-1 text-gray-400">
                Workbook: {workbookId} · Q{questionNo}
              </p>
              <button
                onClick={fetchImages}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                Retry
              </button>
            </div>
          ) : currentImageUrl ? (
            <div className="relative max-w-full max-h-full image-canvas-container">
              <img
                ref={imgRef}
                src={currentImageUrl}
                alt={`Answer sheet page ${currentPage}`}
                className="max-h-full max-w-full object-contain rounded-lg border border-gray-300 shadow-md"
                onLoad={() => setImageLoadStatus(prev => ({ ...prev, [currentPage - 1]: 'loaded' }))}
                onError={() => setImageLoadStatus(prev => ({ ...prev, [currentPage - 1]: 'error' }))}
              />

              {/* Loading overlay */}
              {imageLoadStatus[currentPage - 1] === undefined && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-200/75 rounded-lg">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                </div>
              )}

              {/* Error overlay */}
              {imageLoadStatus[currentPage - 1] === 'error' && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-100/90 rounded-lg">
                  <div className="text-center p-4">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
                    <p className="font-semibold text-red-800">Image failed to load</p>
                    <p className="text-xs text-red-500 mt-1">Presigned URL may have expired (60s limit)</p>
                    <button
                      onClick={fetchImages}
                      className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
                    >
                      Reload Images
                    </button>
                  </div>
                </div>
              )}

              {/* Drawing canvas */}
              <canvas
                ref={canvasRef}
                className="absolute cursor-crosshair"
                style={{ backgroundColor: 'transparent' }}
              />
            </div>
          ) : null}
          </div>
        </div>

        {/* Navigation bar */}
        <div className="flex-shrink-0 bg-blue-600 text-white text-sm font-semibold p-2 px-4 flex justify-between items-center rounded-b-xl">
          <div className="flex items-center gap-3">
            <button
              onClick={() => goToPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded text-xs bg-blue-700 hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              ← Previous
            </button>
            <span>Page {currentPage} / {totalPages}</span>
            <button
              onClick={() => goToPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded text-xs bg-blue-700 hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next →
            </button>
          </div>
          <span>
            Marks: <span className="text-xl font-extrabold">{formatMark(currentMark)}</span>
            <span className="text-blue-200"> / {formatMark(maxMarks)}</span>
          </span>
        </div>
      </div>

      {/* ── Right sidebar ── */}
      <div className="w-64 flex-shrink-0 bg-white rounded-xl shadow-2xl p-3 space-y-5 overflow-y-auto">

        {/* Annotations */}
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase border-b pb-2 mb-3">Annotations</h3>
          <div className="grid grid-cols-2 gap-2">
            <AnnotationButton type="check"     icon={Check}   colorClass="text-green-600 border-green-300"   label="Correct"   active={drawingMode === 'check'}     onClick={() => setDrawingMode('check')} />
            <AnnotationButton type="cross"     icon={X}       colorClass="text-red-600 border-red-300"       label="Wrong"     active={drawingMode === 'cross'}     onClick={() => setDrawingMode('cross')} />
            <AnnotationButton type="pen"       icon={Pen}     colorClass="text-red-600 border-red-300"       label="Pen"       active={drawingMode === 'pen'}       onClick={() => setDrawingMode('pen')} />
            <AnnotationButton type="highlight" icon={Palette} colorClass="text-yellow-600 border-yellow-300" label="Highlight" active={drawingMode === 'highlight'} onClick={() => setDrawingMode('highlight')} />
            <AnnotationButton type="eraser"    icon={Scan}    colorClass="text-gray-600 border-gray-300"     label="Eraser"    active={drawingMode === 'eraser'}    onClick={() => setDrawingMode('eraser')} />
          </div>
          <button
            onClick={() => setDrawingMode(null)}
            className="w-full py-2 mt-2 flex items-center justify-center rounded-lg border-2 border-gray-300 bg-gray-100 hover:bg-gray-200 transition"
          >
            <X className="w-4 h-4 mr-1 text-gray-600" />
            <span className="text-xs font-semibold text-gray-600">Clear Tool</span>
          </button>
          <button
            onClick={clearCanvas}
            className="w-full py-2 mt-2 flex items-center justify-center rounded-lg border-2 border-red-400 bg-red-50 text-red-700 hover:bg-red-100 transition"
          >
            <Scan className="w-4 h-4 mr-1" />
            <span className="text-xs font-semibold">Clear Canvas</span>
          </button>
        </div>

        <div className="border-t" />

        {/* Marks */}
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase border-b pb-2 mb-3">Assign Marks</h3>
          <div className="grid grid-cols-4 gap-1.5">
            {marksOptions.map(m => (
              <button
                key={m}
                onClick={() => setCurrentMark(m)}
                className={`h-9 text-sm font-bold rounded-lg border-2 transition
                  ${currentMark === m
                    ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-400'
                    : 'bg-white text-gray-800 border-gray-300 hover:bg-blue-50'}`}
              >
                {m}
              </button>
            ))}
          </div>
          {/* Manual input for decimal marks */}
          <input
            type="number"
            step="0.5"
            min="0"
            max={maxMarks}
            value={currentMark}
            onChange={e => setCurrentMark(Math.min(maxMarks, Math.max(0, parseFloat(e.target.value) || 0)))}
            className="w-full text-center p-2 mt-3 border border-gray-300 rounded-lg text-lg font-bold focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
          <p className="text-xs text-gray-400 text-center mt-1">Max: {formatMark(maxMarks)}</p>
        </div>

        <div className="border-t" />

        {/* Comment */}
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase border-b pb-2 mb-3">Comment</h3>
          <textarea
            className="w-full h-20 p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 resize-none"
            placeholder="Optional notes..."
            value={annotationText}
            onChange={e => setAnnotationText(e.target.value)}
          />
        </div>

        <div className="border-t" />

        {/* Submit */}
        <div className="space-y-2">
          <button
            onClick={handleSubmit}
            disabled={submitting || images.length === 0}
            className={`w-full py-3 bg-blue-600 text-white font-extrabold rounded-lg shadow-lg hover:bg-blue-700 transition
              ${(submitting || images.length === 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {submitting ? 'Submitting...' : `Submit — ${formatMark(currentMark)} / ${formatMark(maxMarks)}`}
          </button>
          {images.length === 0 && (
            <p className="text-xs text-center text-gray-400">Load images before submitting</p>
          )}
        </div>

      </div>
    </div>
  );
}