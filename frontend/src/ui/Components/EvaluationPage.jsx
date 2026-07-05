// frontend/src/ui/Components/EvaluationPage.jsx
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Scan, Pen, Palette, Check, X, AlertCircle, ArrowLeft, CheckCircle, Eraser, RotateCcw, RotateCw } from 'lucide-react';
import api from '../api.js';

const formatMark = (mark) => {
  if (mark === null || isNaN(mark)) return '0';
  return Number.isInteger(mark) ? String(mark) : mark.toFixed(1);
};

// ─── SVG cursor builder ───────────────────────────────────────────────────────
function makeCursor(mode, eraserSize) {
  const enc = (s) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;

  if (mode === 'pen') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <g transform="rotate(35 20 20)">
        <rect x="15" y="6" width="8" height="22" rx="3" fill="#1f2937"/>
        <rect x="15" y="20" width="8" height="5" fill="#3b82f6"/>
        <polygon points="15,28 23,28 19,36" fill="#d1d5db"/>
        <circle cx="19" cy="36" r="1.5" fill="#111827"/>
      </g>
    </svg>`;
    return `${enc(svg)} 19 36, crosshair`;
  }
  if (mode === 'highlight') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36">
      <circle cx="18" cy="18" r="14" fill="rgba(250,204,21,0.5)" stroke="rgba(202,138,4,0.8)" stroke-width="1.5"/>
    </svg>`;
    return `${enc(svg)} 18 18, crosshair`;
  }
  if (mode === 'check') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36">
      <text x="2" y="30" font-size="28" fill="white" font-family="sans-serif" stroke="#333" stroke-width="1" paint-order="stroke">✓</text>
    </svg>`;
    return `${enc(svg)} 2 30, crosshair`;
  }
  if (mode === 'cross') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36">
      <text x="2" y="30" font-size="28" fill="white" font-family="sans-serif" stroke="#333" stroke-width="1" paint-order="stroke">✖</text>
    </svg>`;
    return `${enc(svg)} 2 30, crosshair`;
  }
  if (mode === 'eraser') {
    const disp = Math.min(Math.max(Math.round(eraserSize / 3), 10), 52);
    const half = Math.round(disp / 2);
    const tot  = disp + 8;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tot}" height="${tot}">
      <rect x="4" y="4" width="${disp}" height="${disp}" rx="2"
            fill="rgba(255,255,255,0.2)" stroke="white" stroke-width="1.5" stroke-dasharray="3,2"/>
    </svg>`;
    return `${enc(svg)} ${half + 4} ${half + 4}, crosshair`;
  }
  return 'default';
}

// ─── jsPDF lazy loader ────────────────────────────────────────────────────────
let _JsPDF = null;
async function getJsPDF() {
  if (_JsPDF) return _JsPDF;
  await new Promise((res, rej) => {
    if (document.getElementById('jspdf-cdn')) { res(); return; }
    const s = document.createElement('script');
    s.id = 'jspdf-cdn';
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
  _JsPDF = window.jspdf.jsPDF;
  return _JsPDF;
}

// ─── Annotation button ────────────────────────────────────────────────────────
const AnnotationButton = ({ icon: Icon, colorClass, label, active, onClick }) => (
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
export default function EvaluationPage({ workbookId, questionNo, paperId, userData, onBack, onSubmitDone }) {

  // ── Core state ───────────────────────────────────────────────────────────────
  const [currentMark,    setCurrentMark]    = useState(0);
  const [annotationText, setAnnotationText] = useState('');
  const [drawingMode,    setDrawingMode]    = useState(null);
  const [eraserSize,     setEraserSize]     = useState(24);
  const [currentPage,    setCurrentPage]    = useState(1);
  const [showPagePreview, setShowPagePreview] = useState(false);

  // Rotation per page: { pageNum: 0 | 90 | 180 | 270 }
  const [pageRotations, setPageRotations] = useState({});

  // ── Data state ───────────────────────────────────────────────────────────────
  const [images,          setImages]          = useState([]);
  const [maxMarks,        setMaxMarks]        = useState(10);
  const [imagesLoading,   setImagesLoading]   = useState(true);
  const [imageLoadStatus, setImageLoadStatus] = useState({});

  // Buffered blob URLs — fetched once, never expire
  const [bufferedUrls, setBufferedUrls] = useState({});
  const blobUrlsRef = useRef({});

  const [questionImageUrl,     setQuestionImageUrl]     = useState(null);
  const [questionImageLoading, setQuestionImageLoading] = useState(true);
  const [questionImageError,   setQuestionImageError]   = useState('');

  // ── Submit state ─────────────────────────────────────────────────────────────
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted,   setSubmitted]   = useState(false);

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const canvasRef       = useRef(null);
  const imgRef          = useRef(null);
  const isDrawing       = useRef(false);
  const lastPos         = useRef({ x: 0, y: 0 });
  const pageAnnotations = useRef({});   // { pageNum: dataURL } — annotation layer only
  const eraserSizeRef   = useRef(eraserSize);
  useEffect(() => { eraserSizeRef.current = eraserSize; }, [eraserSize]);

  // Free blob URLs on unmount
  useEffect(() => () => {
    Object.values(blobUrlsRef.current).forEach(u => URL.revokeObjectURL(u));
  }, []);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const totalPages      = images.length || 1;
  const currentImageUrl = bufferedUrls[currentPage - 1] ?? images[currentPage - 1] ?? null;
  const currentRotation = pageRotations[currentPage] ?? 0;   // degrees: 0 | 90 | 180 | 270

  const marksOptions = useMemo(() =>
    Array.from({ length: maxMarks + 1 }, (_, i) => i),
  [maxMarks]);

  // ── Fetch images ─────────────────────────────────────────────────────────────
  useEffect(() => { if (workbookId && questionNo) fetchImages(); }, [workbookId, questionNo]);
  useEffect(() => {
    if (!paperId || !questionNo) { setQuestionImageLoading(false); return; }
    fetchQuestionImage();
  }, [paperId, questionNo]);

  const fetchQuestionImage = async () => {
    setQuestionImageLoading(true); setQuestionImageError('');
    try {
      const data = await api.getQuestionImage(paperId, questionNo);
      setQuestionImageUrl(data?.url || null);
    } catch (err) {
      setQuestionImageError(`Could not load question image: ${err.message}`);
      setQuestionImageUrl(null);
    } finally { setQuestionImageLoading(false); }
  };

  const fetchImages = async () => {
    setImagesLoading(true); setSubmitError(''); setImageLoadStatus({});
    try {
      const data = await api.getImages(workbookId, questionNo);
      if (data?.urls) {
        const sorted = Object.entries(data.urls)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([, url]) => url);
        setImages(sorted);
        if (data.max_marks) setMaxMarks(data.max_marks);
        bufferAllPages(sorted);
        return sorted;
      }
      setImages([]); return [];
    } catch (err) {
      setSubmitError(`Could not load images: ${err.message}`);
      setImages([]); return [];
    } finally { setImagesLoading(false); }
  };

  // Fetch all pages → Blob → object URL in parallel (no expiry after this)
  const bufferAllPages = async (urls) => {
    await Promise.all(urls.map(async (url, idx) => {
      try {
        const res  = await fetch(url);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        blobUrlsRef.current[idx] = blobUrl;
        setBufferedUrls(prev => ({ ...prev, [idx]: blobUrl }));
        setImageLoadStatus(prev => ({ ...prev, [idx]: 'loaded' }));
      } catch {
        setImageLoadStatus(prev => ({ ...prev, [idx]: 'error' }));
      }
    }));
  };

  // ── Rotation helpers ─────────────────────────────────────────────────────────
  const rotatePage = (delta) => {
    // Save annotations before rotating so they don't misalign
    saveCurrentPageAnnotation(currentPage);
    setPageRotations(prev => {
      const current = prev[currentPage] ?? 0;
      return { ...prev, [currentPage]: (current + delta + 360) % 360 };
    });
  };

  // ── Canvas helpers ────────────────────────────────────────────────────────────
  const clearCanvas = () => {
    const c = canvasRef.current;
    if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height);
    delete pageAnnotations.current[currentPage];
  };

  const saveCurrentPageAnnotation = (pageNum) => {
    const c = canvasRef.current;
    if (!c) return;
    try {
      pageAnnotations.current[pageNum] = {
        dataUrl: c.toDataURL('image/png'),
        rotation: pageRotations[pageNum] ?? 0, // rotation this snapshot was drawn under
      };
    }
    catch (e) { console.error('Could not save page annotation:', e); }
  };

  const restorePageAnnotation = (pageNum) => {
    const c     = canvasRef.current;
    const saved = pageAnnotations.current[pageNum];
    if (!c || !saved) return;
    const ctx        = c.getContext('2d');
    const targetRot  = pageRotations[pageNum] ?? 0;
    const delta      = ((targetRot - saved.rotation) % 360 + 360) % 360;
    const layer = new Image();
    layer.onload = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      if (delta === 0) {
        // Same rotation as when saved — draw as-is.
        ctx.drawImage(layer, 0, 0, c.width, c.height);
      } else {
        // Page has been rotated further since this snapshot was taken —
        // spin the old strokes by the delta instead of stretching them,
        // so they land back on the same physical spot on the page.
        ctx.save();
        ctx.translate(c.width / 2, c.height / 2);
        ctx.rotate((delta * Math.PI) / 180);
        ctx.drawImage(layer, -layer.naturalWidth / 2, -layer.naturalHeight / 2);
        ctx.restore();
      }
    };
    layer.src = saved.dataUrl;
  };

  const resizeCanvas = useCallback(() => {
    const c   = canvasRef.current;
    const img = imgRef.current;
    if (!c || !img) return;

    const nw = img.naturalWidth  || 800;
    const nh = img.naturalHeight || 600;
    const rotated90 = currentRotation === 90 || currentRotation === 270;

    // The canvas's pixel buffer is sized in DISPLAY (post-rotation) space —
    // i.e. what the examiner actually sees — so a stroke lands exactly where
    // the pointer is, and so the saved annotation lines up 1:1 with the
    // rotated page when flattened into the final PDF (see
    // flattenAndUploadAsPDF, which already assumes this convention).
    c.width  = rotated90 ? nh : nw;
    c.height = rotated90 ? nw : nh;

    // img already has `rotate(currentRotation)` applied via CSS, so its
    // bounding rect is the final, post-rotation box. Overlay the canvas on
    // that exact box — with NO rotation transform of its own — so the two
    // stay perfectly aligned without double-rotating.
    const ir = img.getBoundingClientRect();
    const pr = (img.closest('.image-canvas-container') ?? c.parentElement).getBoundingClientRect();
    c.style.width  = `${ir.width}px`;
    c.style.height = `${ir.height}px`;
    c.style.top    = `${ir.top  - pr.top}px`;
    c.style.left   = `${ir.left - pr.left}px`;
  }, [currentRotation]);

  useEffect(() => {
    resizeCanvas();
    restorePageAnnotation(currentPage);
    const img = imgRef.current;
    const onLoad = () => { resizeCanvas(); restorePageAnnotation(currentPage); };
    img?.addEventListener('load', onLoad);
    return () => img?.removeEventListener('load', onLoad);
  }, [resizeCanvas, currentPage, currentImageUrl]);

  // Also resize when rotation changes (swaps width/height visually)
  useEffect(() => {
    setTimeout(() => { resizeCanvas(); restorePageAnnotation(currentPage); }, 50);
  }, [currentRotation]);

  // ── Drawing events ────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const coords = (cx, cy) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: ((cx - r.left) / r.width)  * canvas.width,
        y: ((cy - r.top)  / r.height) * canvas.height,
      };
    };

    const onUp = () => {
      isDrawing.current = false;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    };

    const onDown = (e) => {
      e.preventDefault();
      const cx = e.touches?.[0].clientX ?? e.clientX;
      const cy = e.touches?.[0].clientY ?? e.clientY;
      const { x, y } = coords(cx, cy);
      lastPos.current = { x, y };

      if (drawingMode === 'check' || drawingMode === 'cross') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = drawingMode === 'check' ? '#10b981' : '#ef4444';
        ctx.font      = '70px sans-serif';
        ctx.fillText(drawingMode === 'check' ? '✓' : '✖', x - 25, y + 25);
        return;
      }
      if (['pen', 'highlight', 'eraser'].includes(drawingMode)) {
        isDrawing.current = true;
        ctx.beginPath(); ctx.moveTo(x, y);
      }
    };

    const onMove = (e) => {
      if (!isDrawing.current) return;
      e.preventDefault();
      const cx = e.touches?.[0].clientX ?? e.clientX;
      const cy = e.touches?.[0].clientY ?? e.clientY;
      const { x, y } = coords(cx, cy);

      if (drawingMode === 'pen') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1; ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 4; ctx.lineCap = ctx.lineJoin = 'round';
        ctx.lineTo(x, y); ctx.stroke();
      } else if (drawingMode === 'highlight') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.15; ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 30; ctx.lineCap = ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(lastPos.current.x, lastPos.current.y);
        ctx.lineTo(x, y); ctx.stroke();
      } else if (drawingMode === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = 1; ctx.lineWidth = eraserSizeRef.current;
        ctx.lineCap = ctx.lineJoin = 'round';
        ctx.lineTo(x, y); ctx.stroke();
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

  // ── Page navigation ───────────────────────────────────────────────────────────
  const goToPage = (n) => {
    if (n === currentPage) return;
    saveCurrentPageAnnotation(currentPage);
    setCurrentPage(n);
    setShowPagePreview(false);
  };

  // ── Flatten all pages → single multi-page PDF → upload ───────────────────────
  // For every page (whether annotated or not):
  //   1. Draw base image on offscreen canvas with rotation applied
  //   2. Composite annotation layer on top (if any)
  //   3. Add as a PDF page
  // This ensures ALL answer sheet pages end up in one PDF file.
  const flattenAndUploadAsPDF = async () => {
    saveCurrentPageAnnotation(currentPage);

    if (images.length === 0) return;

    const JsPDF   = await getJsPDF();
    const loadImg = (src) => new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

    let pdf = null;

    for (let i = 0; i < images.length; i++) {
      const pageNum  = i + 1;
      const blobUrl  = blobUrlsRef.current[i];
      if (!blobUrl) continue;                         // page didn't buffer — skip

      const rotation   = pageRotations[pageNum] ?? 0;
      const annotation = pageAnnotations.current[pageNum] ?? null;

      const baseImg = await loadImg(blobUrl);
      const sw = baseImg.naturalWidth;
      const sh = baseImg.naturalHeight;

      // After rotation, canvas dimensions may swap (90° / 270°)
      const rotated90  = rotation === 90 || rotation === 270;
      const outW = rotated90 ? sh : sw;
      const outH = rotated90 ? sw : sh;

      const off = document.createElement('canvas');
      off.width  = outW;
      off.height = outH;
      const ctx  = off.getContext('2d');

      // Apply rotation transform around centre, then draw base image
      ctx.save();
      ctx.translate(outW / 2, outH / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(baseImg, -sw / 2, -sh / 2, sw, sh);
      ctx.restore();

      // Composite annotation layer on top. It's stored in the display space
      // of whatever rotation was active when it was last saved
      // (annotation.rotation) — normally this already equals the page's
      // final `rotation`, but if it doesn't for any reason, rotate it into
      // alignment rather than stretching it.
      if (annotation) {
        const annotImg = await loadImg(annotation.dataUrl);
        const annotDelta = ((rotation - (annotation.rotation ?? 0)) % 360 + 360) % 360;
        if (annotDelta === 0) {
          // Already matches the page's final rotation — same size as outW×outH.
          ctx.drawImage(annotImg, 0, 0, outW, outH);
        } else {
          ctx.save();
          ctx.translate(outW / 2, outH / 2);
          ctx.rotate((annotDelta * Math.PI) / 180);
          ctx.drawImage(annotImg, -annotImg.naturalWidth / 2, -annotImg.naturalHeight / 2);
          ctx.restore();
        }
      }

      const dataUrl = off.toDataURL('image/jpeg', 0.92);
      const wPt = outW * 0.75;   // px → pt (72dpi)
      const hPt = outH * 0.75;

      if (!pdf) {
        pdf = new JsPDF({ orientation: wPt > hPt ? 'l' : 'p', unit: 'pt', format: [wPt, hPt] });
      } else {
        pdf.addPage([wPt, hPt], wPt > hPt ? 'l' : 'p');
      }
      pdf.addImage(dataUrl, 'JPEG', 0, 0, wPt, hPt);
    }

    if (!pdf) return;

    const pdfBlob = pdf.output('blob');
    // Upload as a single file — page index 1 so the backend stores it
    await api.uploadCheckedImages(workbookId, questionNo, [pdfBlob], [1]);
  };

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (currentMark < 0 || currentMark > maxMarks) {
      setSubmitError(`Marks must be between 0 and ${maxMarks}.`); return;
    }
    setSubmitting(true); setSubmitError('');
    try {
      try { await flattenAndUploadAsPDF(); }
      catch (e) { throw new Error(`Could not save annotated PDF: ${e.message}`); }

      const response = await api.evaluateQuestion(workbookId, questionNo, currentMark, annotationText);
      console.log('Evaluation saved:', response);
      setSubmitted(true);
      setTimeout(() => { (onSubmitDone ?? onBack)?.(); }, 2000);
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit evaluation. Please try again.');
    } finally { setSubmitting(false); }
  };

  const canvasCursor = makeCursor(drawingMode, eraserSize);

  // ── Success ───────────────────────────────────────────────────────────────────
  if (submitted) return (
    <div className="flex items-center justify-center h-full bg-gray-100">
      <div className="text-center bg-white rounded-2xl shadow-xl p-12">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Evaluation Submitted!</h2>
        <p className="text-gray-500">
          Workbook <span className="font-mono font-semibold">{workbookId}</span> —
          Q{questionNo} — <span className="font-bold text-blue-600">{currentMark}/{maxMarks} marks</span>
        </p>
        <p className="text-sm text-gray-400 mt-3">Opening next workbook…</p>
      </div>
    </div>
  );

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (imagesLoading) return (
    <div className="flex items-center justify-center h-full bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="text-gray-600">Loading answer sheet...</p>
        <p className="text-sm text-gray-400 mt-1">Workbook: {workbookId} · Q{questionNo}</p>
      </div>
    </div>
  );

  // ── Main UI ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-1 h-full bg-gray-100 overflow-hidden p-2 md:p-4 font-sans">

      {/* Error toast */}
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

      {/* ── Left: image area ── */}
      <div className="flex-1 bg-white rounded-xl shadow-2xl flex flex-col relative overflow-hidden mr-4">

        {/* Header bar */}
        <div className="flex-shrink-0 p-4 bg-blue-50 border-b border-blue-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {onBack && (
              <button onClick={onBack} className="p-2 rounded-lg hover:bg-blue-100 text-blue-700 transition flex-shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="min-w-0">
              <p className="text-xs text-blue-500 font-medium uppercase tracking-wide">Paper: {paperId} · Q{questionNo}</p>
              <h4 className="text-sm font-bold text-blue-800 truncate">Workbook: {workbookId}</h4>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* ── Rotation controls ── */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1">
              <button
                onClick={() => rotatePage(-90)}
                title="Rotate 90° counter-clockwise"
                className="p-1.5 rounded hover:bg-white hover:shadow transition text-gray-600"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono text-gray-500 w-8 text-center">{currentRotation}°</span>
              <button
                onClick={() => rotatePage(90)}
                title="Rotate 90° clockwise"
                className="p-1.5 rounded hover:bg-white hover:shadow transition text-gray-600"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => setShowPagePreview(s => !s)}
              className={`py-2 px-3 flex items-center gap-1 font-semibold rounded-lg shadow transition text-sm
                ${showPagePreview ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
            >
              <Scan className="w-4 h-4" /> Pages
            </button>
          </div>
        </div>

        {/* Page preview strip */}
        {showPagePreview && images.length > 0 && (
          <div className="flex-shrink-0 p-3 bg-gray-100 border-b border-gray-300 overflow-x-auto">
            <div className="inline-flex gap-3">
              {images.map((_, idx) => {
                const rot = pageRotations[idx + 1] ?? 0;
                return (
                  <button key={idx} onClick={() => goToPage(idx + 1)}
                    className={`inline-flex flex-col items-center p-1 rounded-lg transition
                      ${currentPage === idx + 1 ? 'ring-4 ring-blue-500 bg-white shadow-lg' : 'hover:bg-gray-200'}`}
                  >
                    {bufferedUrls[idx]
                      ? <img src={bufferedUrls[idx]} alt={`Page ${idx + 1}`}
                          style={{ transform: `rotate(${rot}deg)`, transition: 'transform .2s' }}
                          className="w-14 h-20 object-cover rounded border border-gray-300" />
                      : <div className="w-14 h-20 rounded border border-gray-300 bg-gray-200 flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                        </div>
                    }
                    <span className="text-xs font-semibold mt-1 text-gray-600">P{idx + 1}</span>
                    {rot !== 0 && <span className="text-xs text-blue-500">{rot}°</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Scroll region */}
        <div className="flex-1 overflow-auto bg-gray-50">

          {/* Question image */}
          {(questionImageUrl || questionImageLoading || questionImageError) && (
            <div className="px-4 pt-4">
              <div className="bg-white rounded-lg border border-gray-300 shadow-sm p-3">
                <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Question</h4>
                {questionImageLoading
                  ? <div className="flex items-center justify-center h-24 text-gray-400 text-sm">Loading question…</div>
                  : questionImageError
                  ? <div className="flex items-center justify-between text-sm text-red-500">
                      <span>{questionImageError}</span>
                      <button onClick={fetchQuestionImage} className="ml-3 px-3 py-1 bg-red-50 border border-red-300 rounded text-red-600 hover:bg-red-100">Retry</button>
                    </div>
                  : questionImageUrl
                  ? <img src={questionImageUrl} alt={`Question ${questionNo}`} className="max-h-64 mx-auto object-contain rounded border border-gray-200" />
                  : null}
              </div>
            </div>
          )}

          {/* Answer image + canvas.
              justify-[safe_center] / items-[safe_center]: when the rotated
              image is bigger than the viewport, plain `justify-center` /
              `items-center` still centers it — which overflows equally on
              both sides, and since a scroll container can't scroll to a
              negative position, the left/top overflow becomes permanently
              unreachable (this is what was cutting off the left side of
              rotated pages). "safe center" falls back to start-alignment
              whenever the content doesn't fit, so the whole image stays
              reachable by scrolling; it still centers normally when it fits. */}
          <div className="p-4 relative flex items-[safe_center] justify-[safe_center] min-h-[60vh]">
            {images.length === 0 ? (
              <div className="text-center text-gray-500">
                <AlertCircle className="w-14 h-14 mx-auto mb-3 opacity-40" />
                <p className="text-lg font-semibold">No images found</p>
                <p className="text-sm mt-1 text-gray-400">Workbook: {workbookId} · Q{questionNo}</p>
                <button onClick={fetchImages} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Retry</button>
              </div>
            ) : currentImageUrl ? (
              <div className="relative max-w-full max-h-full image-canvas-container">
                {/* CSS rotation — visual only; canvas coordinates adjust via resizeCanvas */}
                <img
                  ref={imgRef}
                  src={currentImageUrl}
                  alt={`Answer sheet page ${currentPage}`}
                  style={{
                    transform: `rotate(${currentRotation}deg)`,
                    transition: 'transform 0.25s ease',
                  }}
                  className="max-h-full max-w-full object-contain rounded-lg border border-gray-300 shadow-md"
                  onLoad={()  => setImageLoadStatus(p => ({ ...p, [currentPage - 1]: 'loaded' }))}
                  onError={() => setImageLoadStatus(p => ({ ...p, [currentPage - 1]: 'error' }))}
                />
                {imageLoadStatus[currentPage - 1] === undefined && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-200/75 rounded-lg">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                  </div>
                )}
                {imageLoadStatus[currentPage - 1] === 'error' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-red-100/90 rounded-lg">
                    <div className="text-center p-4">
                      <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
                      <p className="font-semibold text-red-800">Image failed to load</p>
                      <button onClick={fetchImages} className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Reload Images</button>
                    </div>
                  </div>
                )}
                {/* Drawing canvas — buffer is sized in rotated/display space
                    (see resizeCanvas), so it is positioned to exactly overlay
                    the already-rotated image with NO transform of its own. */}
                <canvas
                  ref={canvasRef}
                  className="absolute"
                  style={{
                    backgroundColor: 'transparent',
                    cursor: canvasCursor,
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>

        {/* Nav bar */}
        <div className="flex-shrink-0 bg-blue-600 text-white text-sm font-semibold p-2 px-4 flex justify-between items-center rounded-b-xl">
          <div className="flex items-center gap-3">
            <button onClick={() => goToPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}
              className="px-3 py-1 rounded text-xs bg-blue-700 hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition">
              ← Previous
            </button>
            <span>Page {currentPage} / {totalPages}</span>
            <button onClick={() => goToPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}
              className="px-3 py-1 rounded text-xs bg-blue-700 hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition">
              Next →
            </button>
          </div>
          <span>Marks: <span className="text-xl font-extrabold">{formatMark(currentMark)}</span><span className="text-blue-200"> / {formatMark(maxMarks)}</span></span>
        </div>
      </div>

      {/* ── Right sidebar ── */}
      <div className="w-64 flex-shrink-0 bg-white rounded-xl shadow-2xl p-3 space-y-5 overflow-y-auto">

        {/* Annotations */}
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase border-b pb-2 mb-3">Annotations</h3>
          <div className="grid grid-cols-2 gap-2">
            <AnnotationButton icon={Check}   colorClass="text-green-600 border-green-300"   label="Correct"   active={drawingMode === 'check'}     onClick={() => setDrawingMode('check')} />
            <AnnotationButton icon={X}       colorClass="text-red-600 border-red-300"       label="Wrong"     active={drawingMode === 'cross'}     onClick={() => setDrawingMode('cross')} />
            <AnnotationButton icon={Pen}     colorClass="text-red-600 border-red-300"       label="Pen"       active={drawingMode === 'pen'}       onClick={() => setDrawingMode('pen')} />
            <AnnotationButton icon={Palette} colorClass="text-yellow-600 border-yellow-300" label="Highlight" active={drawingMode === 'highlight'} onClick={() => setDrawingMode('highlight')} />
            <AnnotationButton icon={Eraser}  colorClass="text-gray-600 border-gray-300"     label="Eraser"    active={drawingMode === 'eraser'}    onClick={() => setDrawingMode('eraser')} />
          </div>

          {drawingMode === 'eraser' && (
            <div className="mt-3 px-1">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Eraser size</span>
                <span className="font-semibold text-gray-700">{eraserSize}px</span>
              </div>
              <input type="range" min={8} max={120} step={4} value={eraserSize}
                onChange={e => setEraserSize(Number(e.target.value))} className="w-full accent-gray-500" />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>Small</span><span>Large</span></div>
            </div>
          )}

          <button onClick={() => setDrawingMode(null)}
            className="w-full py-2 mt-2 flex items-center justify-center rounded-lg border-2 border-gray-300 bg-gray-100 hover:bg-gray-200 transition">
            <X className="w-4 h-4 mr-1 text-gray-600" /><span className="text-xs font-semibold text-gray-600">Clear Tool</span>
          </button>
          <button onClick={clearCanvas}
            className="w-full py-2 mt-2 flex items-center justify-center rounded-lg border-2 border-red-400 bg-red-50 text-red-700 hover:bg-red-100 transition">
            <Eraser className="w-4 h-4 mr-1" /><span className="text-xs font-semibold">Clear Canvas</span>
          </button>
        </div>

        <div className="border-t" />

        {/* Rotation shortcut in sidebar too */}
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase border-b pb-2 mb-3">Rotate Page</h3>
          <div className="flex items-center justify-between gap-2">
            <button onClick={() => rotatePage(-90)}
              className="flex-1 py-2 flex items-center justify-center gap-1 rounded-lg border-2 border-gray-300 bg-gray-50 hover:bg-gray-100 transition text-gray-700">
              <RotateCcw className="w-4 h-4" /><span className="text-xs font-semibold">CCW</span>
            </button>
            <span className="text-xs font-mono text-gray-400">{currentRotation}°</span>
            <button onClick={() => rotatePage(90)}
              className="flex-1 py-2 flex items-center justify-center gap-1 rounded-lg border-2 border-gray-300 bg-gray-50 hover:bg-gray-100 transition text-gray-700">
              <RotateCw className="w-4 h-4" /><span className="text-xs font-semibold">CW</span>
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1 text-center">Rotation is baked into the saved PDF</p>
        </div>

        <div className="border-t" />

        {/* Marks */}
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase border-b pb-2 mb-3">Assign Marks</h3>
          <div className="grid grid-cols-4 gap-1.5">
            {marksOptions.map(m => (
              <button key={m} onClick={() => setCurrentMark(m)}
                className={`h-9 text-sm font-bold rounded-lg border-2 transition
                  ${currentMark === m ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-400' : 'bg-white text-gray-800 border-gray-300 hover:bg-blue-50'}`}>
                {m}
              </button>
            ))}
          </div>
          <input type="number" step="0.5" min="0" max={maxMarks} value={currentMark}
            onChange={e => setCurrentMark(Math.min(maxMarks, Math.max(0, parseFloat(e.target.value) || 0)))}
            className="w-full text-center p-2 mt-3 border border-gray-300 rounded-lg text-lg font-bold focus:border-blue-500 focus:ring-2 focus:ring-blue-200" />
          <p className="text-xs text-gray-400 text-center mt-1">Max: {formatMark(maxMarks)}</p>
        </div>

        <div className="border-t" />

        {/* Comment */}
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase border-b pb-2 mb-3">Comment</h3>
          <textarea className="w-full h-20 p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 resize-none"
            placeholder="Optional notes..." value={annotationText} onChange={e => setAnnotationText(e.target.value)} />
        </div>

        <div className="border-t" />

        {/* Submit */}
        <div className="space-y-2">
          <button onClick={handleSubmit} disabled={submitting || images.length === 0}
            className={`w-full py-3 bg-blue-600 text-white font-extrabold rounded-lg shadow-lg hover:bg-blue-700 transition
              ${(submitting || images.length === 0) ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {submitting ? 'Saving PDF & submitting…' : `Submit — ${formatMark(currentMark)} / ${formatMark(maxMarks)}`}
          </button>
          {images.length === 0 && <p className="text-xs text-center text-gray-400">Load images before submitting</p>}
        </div>

      </div>
    </div>
  );
}