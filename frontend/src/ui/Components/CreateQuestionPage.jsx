import { useState, useRef, useCallback } from 'react';
import api from '../api.js';

// ─── Crop Hook ────────────────────────────────────────────────────────────────
function useCrop() {
  const cropState = useRef({ dragging: false, rect: null });

  const initCanvas = useCallback((origDataUrl, canvasEl) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        canvasEl.width = img.naturalWidth;
        canvasEl.height = img.naturalHeight;
        canvasEl.getContext('2d').drawImage(img, 0, 0);
        resolve();
      };
      img.src = origDataUrl;
    });
  }, []);

  const redraw = useCallback((origDataUrl, canvasEl, rect) => {
    const img = new Image();
    img.onload = () => {
      const ctx = canvasEl.getContext('2d');
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      ctx.drawImage(img, 0, 0, canvasEl.width, canvasEl.height);
      if (rect) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
        ctx.clearRect(rect.x, rect.y, rect.w, rect.h);
        ctx.strokeStyle = '#6ea8fe';
        ctx.lineWidth = Math.max(1, canvasEl.width / 400);
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      }
    };
    img.src = origDataUrl;
  }, []);

  const getScaled = useCallback((e, canvasEl) => {
    const r = canvasEl.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (canvasEl.width / r.width),
      y: (e.clientY - r.top) * (canvasEl.height / r.height),
    };
  }, []);

  const onMouseDown = useCallback((e, canvasEl, origDataUrl, onRectChange) => {
    const { x, y } = getScaled(e, canvasEl);
    cropState.current = { dragging: true, startX: x, startY: y, rect: null };
    redraw(origDataUrl, canvasEl, null);
    onRectChange(null);
  }, [getScaled, redraw]);

  const onMouseMove = useCallback((e, canvasEl, origDataUrl, onRectChange) => {
    if (!cropState.current.dragging) return;
    const { x, y } = getScaled(e, canvasEl);
    const { startX, startY } = cropState.current;
    const rect = {
      x: Math.min(startX, x), y: Math.min(startY, y),
      w: Math.abs(x - startX), h: Math.abs(y - startY),
    };
    cropState.current.rect = rect;
    redraw(origDataUrl, canvasEl, rect);
    onRectChange(rect);
  }, [getScaled, redraw]);

  const onMouseUp = useCallback(() => {
    cropState.current.dragging = false;
  }, []);

  const applyCrop = useCallback((origDataUrl, canvasEl, rect) => {
    return new Promise((resolve, reject) => {
      if (!rect || rect.w < 4 || rect.h < 4) {
        reject(new Error('Selection too small. Drag a larger area.'));
        return;
      }
      const img = new Image();
      img.onload = () => {
        const scaleX = img.naturalWidth / canvasEl.width;
        const scaleY = img.naturalHeight / canvasEl.height;
        const out = document.createElement('canvas');
        out.width = Math.round(rect.w * scaleX);
        out.height = Math.round(rect.h * scaleY);
        out.getContext('2d').drawImage(
          img,
          rect.x * scaleX, rect.y * scaleY, rect.w * scaleX, rect.h * scaleY,
          0, 0, out.width, out.height
        );
        resolve(out.toDataURL('image/png'));
      };
      img.src = origDataUrl;
    });
  }, []);

  return { initCanvas, onMouseDown, onMouseMove, onMouseUp, applyCrop };
}

// ─── Single Question Card ─────────────────────────────────────────────────────
function QuestionCard({ question, index, total, onChange, onRemove }) {
  const { id, qNum, maxMarks, pages, file, origDataUrl, croppedDataUrl, cropMode } = question;
  const isPdf = file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const [cropRect, setCropRect] = useState(null);
  const crop = useCrop();

  const handleFile = useCallback((f) => {
    if (!f) return;
    const isPdfFile = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
    if (isPdfFile) {
      onChange(id, { file: f, origDataUrl: null, croppedDataUrl: null, cropMode: false });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      onChange(id, { file: f, origDataUrl: e.target.result, croppedDataUrl: e.target.result, cropMode: false });
    };
    reader.readAsDataURL(f);
  }, [id, onChange]);

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const startCrop = async () => {
    onChange(id, { cropMode: true });
    setTimeout(async () => {
      if (canvasRef.current && origDataUrl) {
        await crop.initCanvas(origDataUrl, canvasRef.current);
        setCropRect(null);
      }
    }, 30);
  };

  const handleApplyCrop = async () => {
    try {
      const dataUrl = await crop.applyCrop(origDataUrl, canvasRef.current, cropRect);
      onChange(id, { croppedDataUrl: dataUrl, cropMode: false });
      setCropRect(null);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCancelCrop = () => {
    onChange(id, { cropMode: false });
    setCropRect(null);
  };

  const handleResetCrop = () => {
    onChange(id, { croppedDataUrl: origDataUrl });
  };

  const isCropped = croppedDataUrl && origDataUrl && croppedDataUrl !== origDataUrl;

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 mb-6">

      {/* Card header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50 rounded-t-xl">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold">
            {index + 1}
          </div>
          <span className="text-sm font-medium text-gray-800">Question {index + 1}</span>
        </div>
        {total > 1 && (
          <button
            type="button"
            onClick={() => onRemove(id)}
            className="text-xs font-medium text-red-400 hover:text-red-600"
          >
            Remove
          </button>
        )}
      </div>

      {/* Fields */}
      <div className="p-6 space-y-6">

        {/* Question Number */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Question Number</label>
          <input
            type="text"
            inputMode="numeric"
            value={qNum}
            placeholder={`e.g. ${index + 1}`}
            onChange={e => onChange(id, { qNum: e.target.value.replace(/\D/g, '') })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
          />
        </div>

        {/* Max Marks */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Marks</label>
          <input
            type="text"
            inputMode="numeric"
            value={maxMarks}
            placeholder="e.g. 20"
            onChange={e => onChange(id, { maxMarks: e.target.value.replace(/\D/g, '') })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
          />
          <p className="text-xs text-gray-400 mt-1">
            The maximum marks an examiner can award for this question.
          </p>
        </div>

        {/* Pages */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Answer Pages</label>
          <input
            type="text"
            inputMode="numeric"
            value={pages}
            placeholder="e.g. 2"
            onChange={e => onChange(id, { pages: e.target.value.replace(/\D/g, '') })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
          />
          <p className="text-xs text-gray-400 mt-1">
            How many scanned pages make up a student's answer to this question.
          </p>
        </div>

        {/* File upload / preview */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Question File{' '}
            <span className="text-gray-400 font-normal">(image, PDF, JPG, PNG, etc.)</span>
          </label>

          {!file ? (
            /* Upload zone */
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,application/pdf"
                className="hidden"
                onChange={e => handleFile(e.target.files[0])}
              />
              <span className="text-4xl block mb-2">🖼️</span>
              <span className="text-sm text-gray-500">
                Click or drag to upload — image, PDF, JPG, PNG
              </span>
            </div>

          ) : isPdf ? (
            /* PDF preview */
            <div>
              <div className="border border-gray-200 rounded-lg p-6 flex flex-col items-center gap-2 bg-gray-50">
                <span className="text-5xl">📄</span>
                <span className="text-sm text-gray-500 break-all text-center">{file.name}</span>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-3 py-1"
                >
                  🔄 Replace file
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  className="hidden"
                  onChange={e => handleFile(e.target.files[0])}
                />
              </div>
            </div>

          ) : cropMode ? (
            /* Crop mode */
            <div>
              <div className="relative rounded-lg overflow-hidden bg-black flex justify-center">
                <canvas
                  ref={canvasRef}
                  className="block max-w-full cursor-crosshair"
                  style={{ maxHeight: 280 }}
                  onMouseDown={e => crop.onMouseDown(e, canvasRef.current, origDataUrl, setCropRect)}
                  onMouseMove={e => crop.onMouseMove(e, canvasRef.current, origDataUrl, setCropRect)}
                  onMouseUp={crop.onMouseUp}
                />
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
                  <p className="text-white text-xs text-center max-w-[200px] leading-relaxed bg-black/40 rounded px-2 py-1">
                    Drag to select the area to keep
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleApplyCrop}
                      className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded-lg font-medium"
                    >
                      Apply crop
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelCrop}
                      className="px-4 py-1.5 bg-white/20 text-white text-xs rounded-lg border border-white/30"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>

          ) : (
            /* Image preview */
            <div>
              <div className="rounded-lg overflow-hidden bg-black flex justify-center">
                <img
                  src={croppedDataUrl}
                  alt="Question preview"
                  className="max-w-full object-contain"
                  style={{ maxHeight: 280 }}
                />
              </div>
              <div className="flex gap-2 mt-2 flex-wrap">
                <button
                  type="button"
                  onClick={startCrop}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-3 py-1"
                >
                  ✂️ Crop
                </button>
                {isCropped && (
                  <button
                    type="button"
                    onClick={handleResetCrop}
                    className="text-xs font-medium text-gray-600 hover:text-gray-800 border border-gray-200 rounded px-3 py-1"
                  >
                    ↩ Reset crop
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-3 py-1"
                >
                  🔄 Replace file
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  className="hidden"
                  onChange={e => handleFile(e.target.files[0])}
                />
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
let idCounter = 0;
const newQuestion = (num) => ({
  id: ++idCounter,
  qNum: String(num),
  maxMarks: '',
  pages: '',
  file: null,
  origDataUrl: null,
  croppedDataUrl: null,
  cropMode: false,
});

export default function CreateQuestionPage() {
  const [paperId, setPaperId] = useState('');
  const [paperIdLocked, setPaperIdLocked] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const lockPaperId = () => {
    if (!paperId.trim()) { setError('Enter a Paper ID first.'); return; }
    setError('');
    setPaperIdLocked(true);
    setQuestions([newQuestion(1)]);
  };

  const unlockPaperId = () => {
    setPaperIdLocked(false);
    setQuestions([]);
    setError('');
    setSuccess('');
  };

  const addQuestion = () => {
    setQuestions(prev => [...prev, newQuestion(prev.length + 1)]);
  };

  const removeQuestion = (id) => {
    setQuestions(prev => {
      if (prev.length === 1) return prev;
      return prev.filter(q => q.id !== id).map((q, i) => ({ ...q, qNum: String(i + 1) }));
    });
  };

  const updateQuestion = (id, patch) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q));
  };

  const handleSubmit = async () => {
    setError('');
    setSuccess('');
    for (const q of questions) {
      if (!q.maxMarks) { setError(`Question ${q.qNum}: max marks is required.`); return; }
      if (!q.pages)    { setError(`Question ${q.qNum}: answer pages is required.`); return; }
      if (!q.file)     { setError(`Question ${q.qNum}: no file uploaded.`); return; }
    }
    setLoading(true);
    try {
      for (const q of questions) {
        let fileToUpload = q.file;
        if (q.croppedDataUrl && q.croppedDataUrl !== q.origDataUrl) {
          const res = await fetch(q.croppedDataUrl);
          const blob = await res.blob();
          fileToUpload = new File([blob], q.file.name.replace(/\.[^.]+$/, '.png'), { type: 'image/png' });
        }
        await api.createQuestion(paperId, parseInt(q.qNum), parseInt(q.maxMarks), parseInt(q.pages), fileToUpload);
      }
      setSuccess(`${questions.length} question${questions.length > 1 ? 's' : ''} created for paper "${paperId}".`);
      setQuestions([newQuestion(1)]);
    } catch (err) {
      setError(err.message || 'Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-2">Create Question Paper</h1>
      <p className="text-gray-500 mb-8">
        Add all questions for this exam, then submit them together.
      </p>

      {/* Alerts */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-300 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-300 text-green-700 rounded-lg text-sm">
          {success}
        </div>
      )}

      {/* Paper ID setup / locked bar */}
      {!paperIdLocked ? (
        <div className="max-w-xl bg-white rounded-xl shadow-lg border border-gray-200 p-8 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Paper ID</label>
            <input
              type="text"
              value={paperId}
              onChange={e => setPaperId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && lockPaperId()}
              placeholder="e.g. MATH101-2024"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            />
            <p className="text-xs text-gray-400 mt-1">
              A unique identifier for this exam. All questions share the same Paper ID.
            </p>
          </div>
          <button
            type="button"
            onClick={lockPaperId}
            className="mt-6 w-full py-3 bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700 transition"
          >
            Lock ID &amp; start adding questions →
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-6 max-w-xl">
          <span className="text-sm text-gray-700">
            Paper: <strong className="text-blue-700">{paperId}</strong>
          </span>
          <button
            type="button"
            onClick={unlockPaperId}
            className="text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            Change paper
          </button>
        </div>
      )}

      {/* Question cards */}
      <div className="max-w-xl">
        {questions.map((q, i) => (
          <QuestionCard
            key={q.id}
            question={q}
            index={i}
            total={questions.length}
            onChange={updateQuestion}
            onRemove={removeQuestion}
          />
        ))}
      </div>

      {/* Add + Submit bar */}
      {paperIdLocked && (
        <div className="max-w-xl flex items-center justify-between pt-2">
          <span className="text-sm text-gray-500">
            {questions.length} question{questions.length !== 1 ? 's' : ''} added
          </span>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={addQuestion}
              disabled={loading}
              className="flex items-center gap-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition disabled:opacity-50"
            >
              + Add question
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className={`py-2.5 px-5 bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700 transition text-sm ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? 'Submitting…' : `Submit ${questions.length > 1 ? `all ${questions.length} questions` : 'question'}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}