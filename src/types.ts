export type OverlayMode = 'light' | 'dark';

export interface SharedPhoto {
  id: string;
  imageUrl: string;
  caption: string;
  senderId: string;
  createdAt: number;
  downloadedBy: string[];
  expiresAt?: number;
}

export interface PendingUpload {
  id: string;
  caption: string;
  imageBase64: string;
  createdAt: number;
}
