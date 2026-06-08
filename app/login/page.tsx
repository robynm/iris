'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Wrong password');
      }

      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setLoading(false);
    }
  };

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <div style={styles.icon}>🌈</div>
        <h1 style={styles.title}>Iris</h1>
        <p style={styles.subtitle}>Enter password to continue</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            style={styles.input}
            autoFocus
            autoComplete="current-password"
          />

          {error && <div style={styles.error}>{error}</div>}

          <button
            type="submit"
            disabled={!password || loading}
            style={{
              ...styles.button,
              opacity: !password || loading ? 0.5 : 1,
            }}
          >
            {loading ? 'Checking…' : 'Unlock'}
          </button>
        </form>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    background: '#161616',
    border: '1px solid #2a2a2a',
    borderRadius: 16,
    padding: 28,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  icon: { fontSize: 40, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' },
  subtitle: { fontSize: 13, color: '#888', marginBottom: 16 },
  form: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  input: {
    width: '100%',
    padding: 14,
    background: '#0a0a0a',
    border: '1px solid #2a2a2a',
    borderRadius: 12,
    color: '#f5f5f5',
    outline: 'none',
  },
  button: {
    padding: '14px 20px',
    background: '#fff',
    color: '#000',
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 600,
    transition: 'opacity 0.2s',
  },
  error: {
    padding: 10,
    background: '#2a1212',
    border: '1px solid #5a2020',
    borderRadius: 10,
    color: '#ff8080',
    fontSize: 13,
    textAlign: 'center',
  },
};
