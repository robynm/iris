'use client';

import { useState, useRef, useEffect, type ChangeEvent } from 'react';

type Status = 'idle' | 'resizing' | 'loading' | 'removing' | 'success' | 'error';
type Mode = 'edit' | 'flatlay' | 'removebg';

// Max edge length for uploads. 1280px keeps the base64 payload well under
// Vercel's 4.5MB request-body limit for the /api/remove-bg function while
// still looking good on phone screens and keeping token costs predictable.
const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.8;
const PROMPT = 'Turn this image into a professional looking product flatlay image. Show the entire piece of clothing, the colors and fabric texture, but put it on a white background and clean up the alignment and wrinkles. Don\'t add anything new to the image.';

type UsageInfo = { enabled: boolean; total?: number; today?: number };

export default function Home() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [sourceDims, setSourceDims] = useState<{ w: number; h: number } | null>(
    null
  );
  const [prompt, setPrompt] = useState(PROMPT);
  const [resultImage, setResultImage] = useState<string | null>(null);
  // Transparent-background PNG produced by the remove-background pathway.
  const [transparentImage, setTransparentImage] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load usage on mount
  useEffect(() => {
    fetch('/api/usage')
      .then((r) => r.json())
      .then(setUsage)
      .catch(() => {});
  }, []);

  // Run background removal on the server (/api/remove-bg) and return the
  // resulting transparent PNG as a Blob the caller can turn into an object URL.
  const stripBackground = async (image: string): Promise<Blob> => {
    const base64 = image.includes(',') ? image.split(',')[1] : image;
    const res = await fetch('/api/remove-bg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64 }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Background removal failed');
    }
    const bytes = Uint8Array.from(atob(data.image), (c) => c.charCodeAt(0));
    return new Blob([bytes], { type: 'image/png' });
  };

  // Resize an image File to a JPEG data URL with max edge length MAX_EDGE.
  const resizeImage = (file: File): Promise<{ dataUrl: string; w: number; h: number }> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let { width, height } = img;
        const longestEdge = Math.max(width, height);

        if (longestEdge > MAX_EDGE) {
          const scale = MAX_EDGE / longestEdge;
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas not supported'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        resolve({ dataUrl, w: width, h: height });
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Could not read image'));
      };

      img.src = objectUrl;
    });

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please choose an image file.');
      setStatus('error');
      return;
    }

    setStatus('resizing');
    setErrorMsg('');

    try {
      const { dataUrl, w, h } = await resizeImage(file);
      setSourceImage(dataUrl);
      setSourceDims({ w, h });
      setResultImage(null);
      setTransparentImage(null);
      setStatus('idle');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to read image');
      setStatus('error');
    }
  };

  const handleGenerate = async () => {
    if (!sourceImage || !prompt.trim()) return;
    setStatus('loading');
    setErrorMsg('');
    setResultImage(null);
    setTransparentImage(null);

    try {
      const base64 = sourceImage.split(',')[1];

      const res = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: 'image/jpeg',
          prompt: prompt.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Generation failed');
      }

      const generated = `data:image/png;base64,${data.image}`;

      // Update usage from the response if KV is enabled
      if (data.usage) {
        setUsage({ enabled: true, ...data.usage });
      }

      setResultImage(generated);
      setStatus('success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setErrorMsg(msg);
      setStatus('error');
    }
  };

  // Remove-background pathway: strip the background straight from the upload,
  // no AI generation step.
  const handleRemoveBackground = async () => {
    if (!sourceImage) return;
    setStatus('removing');
    setErrorMsg('');
    setResultImage(null);
    setTransparentImage(null);

    try {
      const blob = await stripBackground(sourceImage);
      const url = URL.createObjectURL(blob);
      setTransparentImage(url);
      setStatus('success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setErrorMsg(msg);
      setStatus('error');
    }
  };

  const handleReset = () => {
    setSourceImage(null);
    setSourceDims(null);
    setResultImage(null);
    setTransparentImage(null);
    setPrompt(PROMPT);
    setStatus('idle');
    setErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleBackToModes = () => {
    handleReset();
    setMode(null);
  };

  const downloadResult = () => {
    // Remove-bg downloads the transparent PNG; flatlay and edit download the
    // generated result.
    const href = mode === 'removebg' ? transparentImage : resultImage;
    if (!href) return;
    const link = document.createElement('a');
    link.href = href;
    link.download =
      mode === 'flatlay'
        ? `flatlay-${Date.now()}.png`
        : mode === 'removebg'
          ? `transparent-${Date.now()}.png`
          : `edited-${Date.now()}.png`;
    link.click();
  };

  // ---- Mode picker (home) ----------------------------------------------
  if (mode === null) {
    return (
      <main style={styles.main}>
        <header style={styles.header}>
          <h1 style={styles.title}>🌈 Iris</h1>
          <p style={styles.subtitle}>Edit images and create clean product flatlays</p>
          {usage?.enabled && (
            <div style={styles.usageBar}>
              <span>
                <strong style={styles.usageNum}>{usage.today}</strong> today
              </span>
              <span style={styles.usageDivider}>·</span>
              <span>
                <strong style={styles.usageNum}>{usage.total}</strong> total
              </span>
            </div>
          )}
        </header>

        <section style={styles.section}>
          <div style={styles.modeLabel}>Choose a pathway</div>

          <button
            type="button"
            onClick={() => setMode('edit')}
            style={styles.modeCard}
          >
            <span style={styles.modeIcon}>✏️</span>
            <span style={styles.modeText}>
              <span style={styles.modeName}>Edit an image</span>
              <span style={styles.modeDesc}>
                Describe any change and let Gemini apply it.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMode('flatlay')}
            style={styles.modeCard}
          >
            <span style={styles.modeIcon}>🧺</span>
            <span style={styles.modeText}>
              <span style={styles.modeName}>Flatlay</span>
              <span style={styles.modeDesc}>
                Generate a clean product flatlay on a white background.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMode('removebg')}
            style={styles.modeCard}
          >
            <span style={styles.modeIcon}>✂️</span>
            <span style={styles.modeText}>
              <span style={styles.modeName}>Remove background</span>
              <span style={styles.modeDesc}>
                Strip the background to a transparent PNG. No AI, just your photo.
              </span>
            </span>
          </button>
        </section>
      </main>
    );
  }

  const isFlatlay = mode === 'flatlay';
  const isRemoveBg = mode === 'removebg';
  const showTransparent = isRemoveBg;
  const busy = status === 'loading' || status === 'removing';
  const displayImage = showTransparent ? transparentImage : resultImage;

  return (
    <main style={styles.main}>
      <header style={styles.header}>
        <button
          type="button"
          onClick={handleBackToModes}
          style={styles.backButton}
        >
          ← Pathways
        </button>
        <h1 style={styles.title}>
          {isFlatlay
            ? '🧺 Flatlay'
            : isRemoveBg
              ? '✂️ Remove background'
              : '✏️ Edit'}
        </h1>
        <p style={styles.subtitle}>
          {isFlatlay
            ? 'Product flatlay on a white background'
            : isRemoveBg
              ? 'Transparent PNG, no AI'
              : 'Edit images with Gemini'}
        </p>
        {usage?.enabled && (
          <div style={styles.usageBar}>
            <span>
              <strong style={styles.usageNum}>{usage.today}</strong> today
            </span>
            <span style={styles.usageDivider}>·</span>
            <span>
              <strong style={styles.usageNum}>{usage.total}</strong> total
            </span>
          </div>
        )}
      </header>

      <section style={styles.section}>
        {!sourceImage ? (
          <label style={styles.uploadBox}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={styles.hiddenInput}
              disabled={status === 'resizing'}
            />
            <div style={styles.uploadIcon}>📷</div>
            <div style={styles.uploadLabel}>
              {status === 'resizing' ? 'Preparing…' : 'Tap to choose an image'}
            </div>
            <div style={styles.uploadHint}>or take a photo</div>
          </label>
        ) : (
          <div style={styles.imageWrapper}>
            <img src={sourceImage} alt="Source" style={styles.image} />
            <button
              type="button"
              onClick={handleReset}
              style={styles.changeButton}
            >
              Change
            </button>
            {sourceDims && (
              <div style={styles.dimsBadge}>
                {sourceDims.w} × {sourceDims.h}
              </div>
            )}
          </div>
        )}
      </section>

      {sourceImage && (
        <section style={styles.section}>
          {isRemoveBg ? (
            <div style={styles.promptBox}>
              <div style={styles.promptLabel}>Remove background</div>
              <p style={styles.promptText}>
                The background is stripped from your photo to a transparent PNG —
                no AI generation, the image isn&apos;t changed.
              </p>
            </div>
          ) : isFlatlay ? (
            <div style={styles.promptBox}>
              <div style={styles.promptLabel}>Default flatlay prompt</div>
              <p style={styles.promptText}>{prompt}</p>
            </div>
          ) : (
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the edit... e.g. 'make it look like a watercolor painting'"
              style={styles.textarea}
              rows={3}
              disabled={busy}
            />
          )}

          <button
            type="button"
            onClick={isRemoveBg ? handleRemoveBackground : handleGenerate}
            disabled={busy || (!isRemoveBg && !prompt.trim())}
            style={{
              ...styles.generateButton,
              opacity: busy || (!isRemoveBg && !prompt.trim()) ? 0.5 : 1,
            }}
          >
            {status === 'loading'
              ? 'Generating…'
              : status === 'removing'
                ? 'Removing background…'
                : isFlatlay
                  ? 'Generate flatlay'
                  : isRemoveBg
                    ? 'Remove background'
                    : 'Generate'}
          </button>
        </section>
      )}

      {status === 'error' && <div style={styles.error}>{errorMsg}</div>}

      {displayImage && (
        <section style={styles.section}>
          <div style={styles.resultLabel}>
            {showTransparent ? 'Transparent PNG' : 'Result'}
          </div>
          <div
            style={{
              ...styles.imageWrapper,
              ...(showTransparent ? styles.checkerboard : {}),
            }}
          >
            <img src={displayImage} alt="Result" style={styles.image} />
          </div>
          <button
            type="button"
            onClick={downloadResult}
            style={styles.downloadButton}
          >
            ⬇ Download PNG
          </button>
        </section>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    maxWidth: 520,
    margin: '0 auto',
    padding: '24px 16px 80px',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  header: {
    textAlign: 'center',
    paddingTop: 8,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 8,
    background: '#161616',
    color: '#ccc',
    border: '1px solid #2a2a2a',
    padding: '6px 12px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  usageBar: {
    display: 'inline-flex',
    gap: 8,
    alignItems: 'center',
    marginTop: 10,
    padding: '6px 12px',
    background: '#161616',
    border: '1px solid #2a2a2a',
    borderRadius: 999,
    fontSize: 12,
    color: '#888',
  },
  usageNum: {
    color: '#f5f5f5',
    fontWeight: 600,
  },
  usageDivider: { color: '#444' },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  modeLabel: {
    fontSize: 13,
    color: '#888',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    textAlign: 'center',
  },
  modeCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '18px 16px',
    background: '#161616',
    border: '1px solid #2a2a2a',
    borderRadius: 16,
    textAlign: 'left',
    cursor: 'pointer',
  },
  modeIcon: { fontSize: 28, lineHeight: 1 },
  modeText: { display: 'flex', flexDirection: 'column', gap: 4 },
  modeName: { fontSize: 16, fontWeight: 600, color: '#f5f5f5' },
  modeDesc: { fontSize: 13, color: '#888', lineHeight: 1.4 },
  uploadBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '48px 16px',
    background: '#161616',
    border: '2px dashed #2a2a2a',
    borderRadius: 16,
    cursor: 'pointer',
    transition: 'border-color 0.2s',
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    pointerEvents: 'none',
  },
  uploadIcon: { fontSize: 40 },
  uploadLabel: { fontSize: 16, fontWeight: 500 },
  uploadHint: { fontSize: 13, color: '#888' },
  imageWrapper: {
    position: 'relative',
    background: '#161616',
    borderRadius: 16,
    overflow: 'hidden',
  },
  checkerboard: {
    backgroundColor: '#fff',
    backgroundImage:
      'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
    backgroundSize: '20px 20px',
    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
  },
  image: {
    width: '100%',
    height: 'auto',
    display: 'block',
  },
  changeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(8px)',
    color: '#fff',
    padding: '6px 12px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
  },
  dimsBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(8px)',
    color: '#ccc',
    padding: '4px 10px',
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 500,
    fontVariantNumeric: 'tabular-nums',
  },
  promptBox: {
    padding: 14,
    background: '#161616',
    border: '1px solid #2a2a2a',
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  promptLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  promptText: { fontSize: 14, color: '#ddd', lineHeight: 1.5 },
  textarea: {
    width: '100%',
    padding: 14,
    background: '#161616',
    border: '1px solid #2a2a2a',
    borderRadius: 12,
    color: '#f5f5f5',
    resize: 'vertical',
    outline: 'none',
    minHeight: 80,
  },
  generateButton: {
    padding: '14px 20px',
    background: '#fff',
    color: '#000',
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 600,
    transition: 'opacity 0.2s',
  },
  resultLabel: {
    fontSize: 13,
    color: '#888',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  downloadButton: {
    padding: '12px 20px',
    background: '#161616',
    color: '#f5f5f5',
    border: '1px solid #2a2a2a',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 500,
  },
  error: {
    padding: 12,
    background: '#2a1212',
    border: '1px solid #5a2020',
    borderRadius: 12,
    color: '#ff8080',
    fontSize: 14,
  },
};
