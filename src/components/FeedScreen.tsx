import type { CSSProperties } from 'react';
import { SharedPhoto } from '../types';
import PhotoCard from './PhotoCard';

interface FeedScreenProps {
  photos: SharedPhoto[];
  isLoading: boolean;
  onRefresh: () => void;
  currentUserId: string | null;
  onDownloadPhoto: (photo: SharedPhoto) => void;
  downloadingPhotoId: string | null;
}

const FeedScreen = ({
  photos,
  isLoading,
  onRefresh,
  currentUserId,
  onDownloadPhoto,
  downloadingPhotoId
}: FeedScreenProps) => {
  return (
    <section style={sectionStyle}>
      <header style={headerStyle}>
        <h1 style={{ margin: 0, fontSize: '1.35rem' }}>Shared memories</h1>
        <p style={subtitleStyle}>Everything you have traded back and forth, in a single, quiet feed.</p>
      </header>

      <div style={toolbarStyle}>
        <button onClick={onRefresh} style={refreshButtonStyle} disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
        <span style={metaStyle}>{photos.length} captured moment{photos.length === 1 ? '' : 's'}</span>
      </div>

      <div>
        {isLoading && <p style={metaStyle}>Loading the latest notes...</p>}
        {!isLoading && photos.length === 0 && <p style={metaStyle}>No photos yet. Send one to start the thread.</p>}
        {photos.map((photo) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            currentUserId={currentUserId}
            onDownload={onDownloadPhoto}
            isDownloading={downloadingPhotoId === photo.id}
          />
        ))}
      </div>
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
  gap: '18px'
};

const headerStyle: CSSProperties = {
  textAlign: 'center'
};

const subtitleStyle: CSSProperties = {
  color: 'var(--muted)',
  margin: '8px 0 0',
  lineHeight: 1.5
};

const toolbarStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
};

const metaStyle: CSSProperties = {
  color: 'var(--muted)',
  fontSize: '0.85rem'
};

const refreshButtonStyle: CSSProperties = {
  borderRadius: '999px',
  padding: '10px 18px',
  border: '1px solid rgba(148, 163, 184, 0.25)',
  background: 'rgba(148, 163, 184, 0.12)',
  color: 'var(--card-fg)',
  cursor: 'pointer'
};

export default FeedScreen;
