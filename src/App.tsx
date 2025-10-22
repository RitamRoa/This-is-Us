import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, CSSProperties, FormEvent } from 'react';
import CameraScreen from './components/CameraScreen';
import FeedScreen from './components/FeedScreen';
import NotificationHandler from './components/NotificationHandler';
import {
  getPendingUploads,
  getCurrentUserId,
  setActiveCoupleId,
  subscribeToPartnerFeed,
  downloadSharedPhoto
} from './services';
import type { PendingUpload, SharedPhoto } from './types';

const App = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'dark';
    const stored = localStorage.getItem('this-is-us-theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [activeTab, setActiveTab] = useState<'feed' | 'camera'>(() => {
    if (typeof window === 'undefined') return 'feed';
    const params = new URLSearchParams(window.location.search);
    return params.get('intent') === 'send' ? 'camera' : 'feed';
  });
  const [coupleCode, setCoupleCode] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('this-is-us-couple');
  });
  const [codeInput, setCodeInput] = useState(coupleCode ?? '');
  const [photos, setPhotos] = useState<SharedPhoto[]>([]);
  const [pendingUploads, setPendingUploadsState] = useState<PendingUpload[]>(() => getPendingUploads());
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(getCurrentUserId());
  const [downloadingPhotoId, setDownloadingPhotoId] = useState<string | null>(null);
  const intentParam = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('intent');
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('this-is-us-theme', theme);
    }
  }, [theme]);

  useEffect(() => {
    if (!coupleCode) return;
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    const connect = async () => {
      setIsLoading(true);
      try {
        const uid = await setActiveCoupleId(coupleCode);
        setPendingUploadsState(getPendingUploads());
        if (!cancelled) {
          setUserId(uid);
          unsubscribe = await subscribeToPartnerFeed((items) => {
            setPhotos(items);
            setIsLoading(false);
          });
        }
      } catch (error) {
        setErrorMessage((error as Error).message);
        setIsLoading(false);
      }
    };

    void connect();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [coupleCode]);

  useEffect(() => {
    const handleOnline = () => {
      setPendingUploadsState(getPendingUploads());
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const onRefresh = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 800);
  };

  const onPhotoSent = () => {
    setActiveTab('feed');
    setPendingUploadsState(getPendingUploads());
  };

  const handleDownloadPhoto = async (photo: SharedPhoto) => {
    if (downloadingPhotoId && downloadingPhotoId !== photo.id) {
      return;
    }
    setErrorMessage(null);
    setDownloadingPhotoId(photo.id);
    try {
      await downloadSharedPhoto(photo);
      if (userId) {
        setPhotos((prev) =>
          prev.map((item) =>
            item.id === photo.id
              ? {
                  ...item,
                  downloadedBy: item.downloadedBy.includes(userId)
                    ? item.downloadedBy
                    : [...item.downloadedBy, userId]
                }
              : item
          )
        );
      }
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setDownloadingPhotoId(null);
    }
  };

  const handlePairSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!codeInput.trim()) return;
    const cleaned = codeInput.trim().toLowerCase();
    if (typeof window !== 'undefined') {
      localStorage.setItem('this-is-us-couple', cleaned);
    }
    setCoupleCode(cleaned);
  };

  const handleGenerateCode = () => {
    const newCode = (typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    )
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 6)
      .toUpperCase();
    setCodeInput(newCode);
  };

  const navItems = useMemo(
    () => [
      { id: 'feed', label: 'Feed' },
      { id: 'camera', label: 'Camera' }
    ] as const,
    []
  );

  const toggleTheme = () => setTheme((prev: 'light' | 'dark') => (prev === 'dark' ? 'light' : 'dark'));

  return (
    <div style={appShellStyle}>
      <NotificationHandler coupleId={coupleCode} />
      <div style={cardShellStyle}>
        <header style={topBarStyle}>
          <span style={{ fontWeight: 600 }}>This is Us</span>
          <button onClick={toggleTheme} style={themeButtonStyle}>
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        </header>

        {!coupleCode ? (
          <form onSubmit={handlePairSubmit} style={pairFormStyle}>
            <h1 style={{ margin: '12px 0 8px', fontSize: '1.5rem' }}>Pair with your person</h1>
            <p style={helperTextStyle}>
              Share the same code on both phones to keep your gallery private and synced.
            </p>
            <input
              value={codeInput}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setCodeInput(event.target.value)}
              style={pairInputStyle}
              placeholder="Enter shared code"
            />
            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
              <button type="button" onClick={handleGenerateCode} style={ghostButtonStyle}>
                Generate code
              </button>
              <button type="submit" style={primaryButtonStyle}>
                Pair devices
              </button>
            </div>
            {errorMessage && <p style={errorTextStyle}>{errorMessage}</p>}
          </form>
        ) : (
          <>
            <nav style={tabBarStyle}>
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  style={{
                    ...tabButtonStyle,
                    background: activeTab === item.id ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                    color: activeTab === item.id ? '#c7d2fe' : 'var(--muted)'
                  }}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            {errorMessage && <p style={errorTextStyle}>{errorMessage}</p>}

            {activeTab === 'feed' ? (
              <FeedScreen
                photos={photos}
                isLoading={isLoading}
                onRefresh={onRefresh}
                currentUserId={userId}
                onDownloadPhoto={handleDownloadPhoto}
                downloadingPhotoId={downloadingPhotoId}
              />
            ) : (
              <CameraScreen
                coupleId={coupleCode}
                onSent={onPhotoSent}
                intent={intentParam === 'send' ? 'send' : 'default'}
                pendingUploads={pendingUploads}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

const appShellStyle: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '32px'
};

const cardShellStyle: CSSProperties = {
  width: '100%',
  maxWidth: '520px',
  borderRadius: '24px',
  background: 'var(--surface)',
  boxShadow: '0 25px 60px rgba(15, 23, 42, 0.3)',
  border: '1px solid rgba(148, 163, 184, 0.15)',
  overflow: 'hidden'
};

const topBarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '18px 24px',
  borderBottom: '1px solid rgba(148, 163, 184, 0.15)'
};

const themeButtonStyle: CSSProperties = {
  borderRadius: '999px',
  padding: '8px 16px',
  border: '1px solid rgba(148, 163, 184, 0.2)',
  background: 'transparent',
  color: 'var(--card-fg)',
  cursor: 'pointer'
};

const pairFormStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '16px',
  padding: '32px'
};

const helperTextStyle: CSSProperties = {
  textAlign: 'center',
  color: 'var(--muted)',
  margin: 0
};

const pairInputStyle: CSSProperties = {
  width: '100%',
  borderRadius: '12px',
  padding: '14px',
  fontSize: '1rem',
  border: '1px solid rgba(148, 163, 184, 0.25)',
  background: 'rgba(148, 163, 184, 0.08)',
  color: 'var(--card-fg)'
};

const tabBarStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  padding: '12px',
  gap: '8px'
};

const tabButtonStyle: CSSProperties = {
  borderRadius: '12px',
  padding: '12px',
  border: 'none',
  cursor: 'pointer',
  fontSize: '0.95rem',
  transition: 'background 140ms ease'
};

const ghostButtonStyle: CSSProperties = {
  flex: 1,
  borderRadius: '12px',
  padding: '14px',
  border: '1px solid rgba(148, 163, 184, 0.2)',
  background: 'transparent',
  color: 'var(--card-fg)',
  cursor: 'pointer'
};

const primaryButtonStyle: CSSProperties = {
  flex: 1,
  borderRadius: '12px',
  padding: '14px',
  border: 'none',
  background: 'linear-gradient(160deg, #6366f1, #8b5cf6)',
  color: '#ffffff',
  cursor: 'pointer'
};

const errorTextStyle: CSSProperties = {
  color: '#fda4af',
  fontSize: '0.85rem',
  textAlign: 'center',
  margin: '0 24px 16px'
};

export default App;
