import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  takePhoto,
  addTextOverlay,
  downloadPhoto,
  savePhotoLocally,
  sendPhotoToPartner,
  choosePhotoFromGallery
} from '../services';
import { PendingUpload } from '../types';

interface CameraScreenProps {
  coupleId: string;
  onSent: () => void;
  intent?: 'send' | 'default';
  pendingUploads: PendingUpload[];
}

const CameraScreen = ({ coupleId, onSent, intent = 'default', pendingUploads }: CameraScreenProps) => {
  const [caption, setCaption] = useState('');
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isWebCameraActive, setIsWebCameraActive] = useState(false);
  const webVideoRef = useRef<HTMLVideoElement | null>(null);
  const webCaptureResolver = useRef<{
    resolve: (value: string) => void;
    reject: (reason?: unknown) => void;
  } | null>(null);
  const webStreamRef = useRef<MediaStream | null>(null);

  const cleanupWebCamera = () => {
    if (webStreamRef.current) {
      webStreamRef.current.getTracks().forEach((track) => track.stop());
      webStreamRef.current = null;
    }
    if (webVideoRef.current) {
      webVideoRef.current.srcObject = null;
    }
    setIsWebCameraActive(false);
  };

  const capturePhotoViaWebcam = async (): Promise<string> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera not supported on this browser.');
    }

    return new Promise<string>(async (resolve, reject) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'user' }
          }
        });
        webStreamRef.current = stream;
        webCaptureResolver.current = { resolve, reject };
        setIsWebCameraActive(true);
        requestAnimationFrame(() => {
          if (webVideoRef.current) {
            webVideoRef.current.srcObject = stream;
            void webVideoRef.current.play();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  };

  const handleConfirmWebPhoto = () => {
    const video = webVideoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || video.clientWidth || 1280;
    canvas.height = video.videoHeight || video.clientHeight || 720;
    const context = canvas.getContext('2d');
    if (!context) {
      setStatusMessage('Unable to access camera stream.');
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    cleanupWebCamera();
    webCaptureResolver.current?.resolve(dataUrl);
    webCaptureResolver.current = null;
  };

  const handleCancelWebCamera = () => {
    cleanupWebCamera();
    webCaptureResolver.current?.reject(new Error('Camera capture cancelled.'));
    webCaptureResolver.current = null;
  };

  useEffect(() => {
    if (intent === 'send' && !rawImage) {
      void handleTakePhoto();
    }
  }, [intent, rawImage]);

  useEffect(() => () => {
    cleanupWebCamera();
  }, []);

  const handleTakePhoto = async () => {
    try {
      setIsProcessing(true);
      const isWeb = Capacitor.getPlatform() === 'web';
      const photo = isWeb ? await capturePhotoViaWebcam() : await takePhoto();
      setRawImage(photo);
      setPreviewImage(photo);
      setStatusMessage('Photo captured. Add a caption and overlay.');
    } catch (error) {
      if ((error as Error)?.message !== 'Camera capture cancelled.') {
        setStatusMessage((error as Error).message);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePickFromGallery = async () => {
    try {
      setIsProcessing(true);
      const photo = await choosePhotoFromGallery();
      setRawImage(photo);
      setPreviewImage(photo);
      setStatusMessage('Photo selected. Add a caption and overlay.');
    } catch (error) {
      setStatusMessage((error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const applyOverlay = async () => {
    if (!rawImage) return;
    setIsProcessing(true);
    try {
      const next = await addTextOverlay(rawImage, caption);
      setPreviewImage(next);
      setStatusMessage('Overlay applied. Ready to send.');
    } catch (error) {
      setStatusMessage((error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const quickDownload = async () => {
    if (!previewImage) return;
    try {
      await downloadPhoto(previewImage);
      await savePhotoLocally(previewImage);
      setStatusMessage('Photo saved to gallery.');
    } catch (error) {
      setStatusMessage((error as Error).message);
    }
  };

  const handleSend = async () => {
    if (!previewImage) {
      setStatusMessage('Capture and overlay a photo first.');
      return;
    }
    setIsProcessing(true);
    try {
      const result = await sendPhotoToPartner(previewImage, caption);
      if (result.queued) {
        setStatusMessage('Offline. Your photo will send automatically when you reconnect.');
      } else {
        setStatusMessage('Photo delivered.');
      }
      setCaption('');
      setRawImage(null);
      setPreviewImage(null);
      onSent();
    } catch (error) {
      setStatusMessage((error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const canSend = useMemo(() => Boolean(previewImage && caption.trim().length >= 1), [previewImage, caption]);

  return (
    <section style={sectionStyle}>
      <header style={headerStyle}>
        <h1 style={{ fontSize: '1.35rem', margin: 0 }}>Capture today&apos;s moment</h1>
        <p style={subtitleStyle}>Take a shot, whisper a caption, share it instantly with your person.</p>
      </header>

      {pendingUploads.length > 0 && (
        <div style={noticeStyle}>
          {pendingUploads.length} photo{pendingUploads.length > 1 ? 's' : ''} waiting to send once you are back
          online.
        </div>
      )}

      <div style={frameStyle}>
        {previewImage ? (
          <img src={previewImage} alt="Preview" style={{ width: '100%', borderRadius: '12px' }} />
        ) : (
          <div style={placeholderStyle}>
            {intent === 'send' ? 'Ready when you are—tap capture.' : 'Tap capture to start.'}
          </div>
        )}
      </div>

      <textarea
        value={caption}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setCaption(event.target.value)}
        placeholder="Add a soft caption..."
        style={inputStyle}
        maxLength={180}
        rows={3}
      />

      <div style={buttonRowStyle}>
        <button onClick={handleTakePhoto} style={primaryButtonStyle} disabled={isProcessing}>
          {rawImage ? 'Retake' : 'Capture'}
        </button>
        <button onClick={handlePickFromGallery} style={ghostButtonStyle} disabled={isProcessing}>
          Upload Photo
        </button>
      </div>

      <div style={buttonRowStyle}>
        <button onClick={applyOverlay} style={ghostButtonStyle} disabled={!rawImage || isProcessing}>
          Apply Overlay
        </button>
        <button onClick={quickDownload} style={ghostButtonStyle} disabled={!previewImage || isProcessing}>
          Quick Download
        </button>
      </div>

      <div style={buttonRowStyle}>
        <button onClick={handleSend} style={sendButtonStyle} disabled={!canSend || isProcessing}>
          Send to Partner
        </button>
      </div>

      {isWebCameraActive && (
        <div style={webOverlayStyle}>
          <div style={webOverlayContentStyle}>
            <video ref={webVideoRef} style={webVideoStyle} playsInline muted />
            <div style={overlayButtonRowStyle}>
              <button onClick={handleConfirmWebPhoto} style={overlayPrimaryButtonStyle}>
                Take Photo
              </button>
              <button onClick={handleCancelWebCamera} style={overlayCancelButtonStyle}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {statusMessage && <p style={statusStyle}>{statusMessage}</p>}
    </section>
  );
};

const sectionStyle: CSSProperties = {
  width: '100%',
  maxWidth: '500px',
  margin: '0 auto',
  padding: '20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px'
};

const headerStyle: CSSProperties = {
  textAlign: 'center'
};

const subtitleStyle: CSSProperties = {
  margin: '8px 0 0',
  color: 'var(--muted)',
  lineHeight: 1.5
};

const frameStyle: CSSProperties = {
  width: '100%',
  aspectRatio: '3 / 4',
  borderRadius: '16px',
  background: 'rgba(148, 163, 184, 0.08)',
  display: 'grid',
  placeItems: 'center',
  overflow: 'hidden',
  border: '1px dashed rgba(148, 163, 184, 0.25)'
};

const placeholderStyle: CSSProperties = {
  color: 'var(--muted)',
  fontSize: '0.95rem'
};

const inputStyle: CSSProperties = {
  width: '100%',
  borderRadius: '12px',
  border: '1px solid rgba(148, 163, 184, 0.25)',
  padding: '14px',
  fontSize: '0.95rem',
  background: 'rgba(15, 23, 42, 0.35)',
  color: 'var(--card-fg)',
  outline: 'none',
  resize: 'vertical'
};

const buttonRowStyle: CSSProperties = {
  display: 'flex',
  gap: '12px',
  justifyContent: 'space-between'
};

const baseButtonStyle: CSSProperties = {
  flex: 1,
  borderRadius: '999px',
  padding: '14px',
  fontSize: '0.95rem',
  border: 'none',
  cursor: 'pointer',
  transition: 'transform 120ms ease, box-shadow 120ms ease'
};

const primaryButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  background: 'linear-gradient(160deg, #6366f1, #8b5cf6)',
  color: '#ffffff'
};

const ghostButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  background: 'rgba(148, 163, 184, 0.1)',
  color: 'var(--card-fg)'
};

const sendButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  background: 'linear-gradient(160deg, #ec4899, #f472b6)',
  color: '#ffffff'
};

const webOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  background: 'rgba(15, 23, 42, 0.85)',
  zIndex: 999
};

const webOverlayContentStyle: CSSProperties = {
  width: 'min(480px, 90vw)',
  background: 'rgba(15, 23, 42, 0.95)',
  padding: '20px',
  borderRadius: '20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  border: '1px solid rgba(148, 163, 184, 0.2)'
};

const webVideoStyle: CSSProperties = {
  width: '100%',
  borderRadius: '16px',
  background: '#000'
};

const overlayButtonRowStyle: CSSProperties = {
  display: 'flex',
  gap: '12px'
};

const overlayBaseButtonStyle: CSSProperties = {
  flex: 1,
  borderRadius: '999px',
  padding: '12px',
  fontSize: '0.95rem',
  border: 'none',
  cursor: 'pointer'
};

const overlayPrimaryButtonStyle: CSSProperties = {
  ...overlayBaseButtonStyle,
  background: 'linear-gradient(160deg, #6366f1, #8b5cf6)',
  color: '#ffffff'
};

const overlayCancelButtonStyle: CSSProperties = {
  ...overlayBaseButtonStyle,
  background: 'rgba(148, 163, 184, 0.15)',
  color: '#e2e8f0'
};

const noticeStyle: CSSProperties = {
  borderRadius: '12px',
  padding: '12px 16px',
  background: 'rgba(59, 130, 246, 0.12)',
  border: '1px solid rgba(59, 130, 246, 0.25)',
  color: '#93c5fd',
  fontSize: '0.85rem'
};

const statusStyle: CSSProperties = {
  textAlign: 'center',
  fontSize: '0.85rem',
  color: 'var(--muted)'
};

export default CameraScreen;
