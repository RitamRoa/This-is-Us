import { motion } from 'framer-motion';
import type { CSSProperties } from 'react';
import { SharedPhoto } from '../types';

interface PhotoCardProps {
  photo: SharedPhoto;
  currentUserId: string | null;
  onDownload?: (photo: SharedPhoto) => void;
  isDownloading?: boolean;
}

const PhotoCard = ({ photo, currentUserId, onDownload, isDownloading = false }: PhotoCardProps) => {
  const isOwn = currentUserId === photo.senderId;
  const hasDownloaded = currentUserId ? photo.downloadedBy.includes(currentUserId) : false;
  return (
    <motion.article
      initial={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        background: 'var(--card-bg)',
        color: 'var(--card-fg)',
        borderRadius: '18px',
        marginBottom: '16px',
        boxShadow: '0 15px 35px rgba(15, 23, 42, 0.25)',
        overflow: 'hidden',
        border: isOwn ? '1px solid rgba(59,130,246,0.35)' : '1px solid rgba(148,163,184,0.15)'
      }}
    >
      <figure style={{ margin: 0 }}>
        <img
          src={photo.imageUrl}
          alt={photo.caption || 'Shared memory'}
          style={{ width: '100%', display: 'block' }}
          loading="lazy"
        />
        {photo.caption && (
          <figcaption
            style={{
              padding: '16px',
              fontSize: '0.95rem',
              letterSpacing: '0.01em',
              lineHeight: 1.5
            }}
          >
            {photo.caption}
          </figcaption>
        )}
      </figure>
      {onDownload && (
        <div style={actionBarStyle}>
          <button
            onClick={() => onDownload(photo)}
            style={downloadButtonStyle}
            disabled={isDownloading || hasDownloaded}
          >
            {hasDownloaded ? 'Downloaded' : isDownloading ? 'Downloading...' : 'Download'}
          </button>
          {photo.expiresAt && !hasDownloaded && (
            <span style={expiresStyle}>
              disappears{' '}
              {new Intl.DateTimeFormat(undefined, {
                hour: 'numeric',
                minute: '2-digit'
              }).format(new Date(photo.expiresAt))}
            </span>
          )}
        </div>
      )}
      <footer
        style={{
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.8rem',
          color: 'var(--muted)'
        }}
      >
        <span>{isOwn ? 'You' : 'Partner'}</span>
        <time dateTime={new Date(photo.createdAt).toISOString()}>
          {new Intl.DateTimeFormat(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short'
          }).format(photo.createdAt)}
        </time>
      </footer>
    </motion.article>
  );
};

export default PhotoCard;

const actionBarStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 16px',
  gap: '12px',
  borderTop: '1px solid rgba(148,163,184,0.12)'
};

const downloadButtonStyle: CSSProperties = {
  borderRadius: '999px',
  padding: '10px 18px',
  border: 'none',
  background: 'linear-gradient(160deg, #6ee7b7, #34d399)',
  color: '#0f172a',
  cursor: 'pointer',
  fontSize: '0.85rem',
  fontWeight: 600,
  transition: 'opacity 120ms ease'
};

const expiresStyle: CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--muted)'
};
