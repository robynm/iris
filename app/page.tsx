'use client';

import { useState, useRef, useEffect, type ChangeEvent } from 'react';

type Status = 'idle' | 'resizing' | 'loading' | 'success' | 'error';

// Max edge length for uploads. 1536px is a sweet spot: high enough to look
// good on phone screens, low enough to keep token costs predictable.
const MAX_EDGE = 1536;
const JPEG_QUALITY = 0.85;
const PROMPT = 'Turn this image into a professional looking product flatlay image. Show the entire piece of clothing, the colors and fabric texture, but put it on a white background and clean up the alignment and wrinkles. Don\'t add anything new to the image.';

type UsageInfo = { enabled: boolean; total?: number; today?: number };

export default function Home() {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [sourceDims, setSourceDims] = useState<{ w: number; h: number } | null>(
    null
  );
  const [prompt, setPrompt] = useState(PROMPT);
  const [resultImage, setResultImage] = useState<string | null>(null);
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
      setResultImage(`data:image/png;base64,${data.image}`);
      setStatus('success');

      // Update usage from the response if KV is enabled
      if (data.usage) {
        setUsage({ enabled: true, ...data.usage });
      }
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
    setPrompt(PROMPT);
    setStatus('idle');
    setErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadResult = () => {
    if (!resultImage) return;
    const link = document.createElement('a');
    link.href = resultImage;
    link.download = `edited-${Date.now()}.png`;
    link.click();
  };

  return (
    <main style={styles.main}>
      <header style={styles.header}>
        <h1 style={styles.title}>🍌 Nano Banana</h1>
        <p style={styles.subtitle}>Edit images with Gemini</p>
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
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the edit... e.g. 'make it look like a watercolor painting'"
            style={styles.textarea}
            rows={3}
            disabled={status === 'loading'}
          />

          <button
            type="button"
            onClick={handleGenerate}
            disabled={!prompt.trim() || status === 'loading'}
            style={{
              ...styles.generateButton,
              opacity: !prompt.trim() || status === 'loading' ? 0.5 : 1,
            }}
          >
            {status === 'loading' ? 'Generating…' : 'Generate'}
          </button>
        </section>
      )}

      {status === 'error' && <div style={styles.error}>{errorMsg}</div>}

      {resultImage && (
        <section style={styles.section}>
          <div style={styles.resultLabel}>Result</div>
          <div style={styles.imageWrapper}>
            <img src={resultImage} alt="Result" style={styles.image} />
          </div>
          <button
            type="button"
            onClick={downloadResult}
            style={styles.downloadButton}
          >
            ⬇ Download
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
