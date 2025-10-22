import { Capacitor } from '@capacitor/core';
import {
  Camera,
  CameraResultType,
  CameraSource,
  PermissionStatus
} from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';

const ensureCameraPermissions = async () => {
  if (Capacitor.getPlatform() === 'web') {
    return;
  }

  const status = await Camera.checkPermissions();
  if (status.camera !== 'granted') {
    const request: PermissionStatus = await Camera.requestPermissions();
    if (request.camera !== 'granted') {
      throw new Error('Camera permission is required to take photos.');
    }
  }
};

const ensureFilesystemPermissions = async () => {
  if (Capacitor.getPlatform() === 'android') {
    const perm = await Filesystem.checkPermissions();
    if (perm.publicStorage !== 'granted') {
      const request = await Filesystem.requestPermissions();
      if (request.publicStorage !== 'granted') {
        throw new Error('Storage permission is required to save photos.');
      }
    }
  }
};

interface FileInputOptions {
  capture?: boolean;
}

const pickPhotoFromFileInput = ({ capture }: FileInputOptions = {}): Promise<string> =>
  new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (capture) {
      input.capture = 'environment';
    }
    input.style.display = 'none';

    const cleanup = () => {
      input.removeEventListener('change', handleChange);
      document.body.removeChild(input);
    };

    const handleChange = async () => {
      const file = input.files?.[0];
      cleanup();
      if (!file) {
        reject(new Error('No image selected.'));
        return;
      }
      try {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            reject(new Error('Unable to read selected image.'));
          }
        };
        reader.onerror = () => reject(new Error('Failed to read image file.'));
        reader.readAsDataURL(file);
      } catch (error) {
        reject(error);
      }
    };

    input.addEventListener('change', handleChange);
    document.body.appendChild(input);
    input.click();
  });

export const takePhoto = async (): Promise<string> => {
  if (Capacitor.getPlatform() === 'web') {
    return pickPhotoFromFileInput({ capture: true });
  }

  await ensureCameraPermissions();
  try {
    const capture = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      saveToGallery: false,
      source: CameraSource.Camera
    });

    if (!capture.dataUrl) {
      throw new Error('Unable to capture photo.');
    }

    return capture.dataUrl;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Not implemented')) {
      return pickPhotoFromFileInput({ capture: true });
    }
    throw error;
  }
};

export const choosePhotoFromGallery = async (): Promise<string> => {
  if (Capacitor.getPlatform() === 'web') {
    return pickPhotoFromFileInput({ capture: false });
  }

  await ensureCameraPermissions();
  try {
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      saveToGallery: false,
      source: CameraSource.Photos
    });

    if (!photo.dataUrl) {
      throw new Error('Unable to select photo.');
    }

    return photo.dataUrl;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Not implemented')) {
      return pickPhotoFromFileInput({ capture: false });
    }
    throw error;
  }
};

export const addTextOverlay = async (imageDataUrl: string, text: string): Promise<string> => {
  const image = new Image();
  image.src = imageDataUrl;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Could not load image for overlay.'));
  });

  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas rendering context unavailable.');
  }

  ctx.drawImage(image, 0, 0);

  if (text.trim().length > 0) {
    const padding = canvas.width * 0.05;
    const fontSize = Math.max(canvas.width, canvas.height) * 0.05;
    ctx.font = `bold ${fontSize}px 'Helvetica Neue', Helvetica, Arial, sans-serif`;
    ctx.fillStyle = 'rgba(15, 15, 15, 0.65)';
    ctx.fillRect(0, canvas.height - fontSize * 2.5, canvas.width, fontSize * 2.5);
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, padding, canvas.height - fontSize * 1.2, canvas.width - padding * 2);
  }

  return canvas.toDataURL('image/jpeg', 0.9);
};

const base64FromDataUrl = (dataUrl: string) => {
  const [header, data] = dataUrl.split(',');
  if (!data) {
    throw new Error('Invalid data URL provided.');
  }
  const mime = header.match(/data:(.*);base64/);
  return { mime: mime?.[1] ?? 'image/jpeg', base64: data };
};

export const downloadPhoto = async (imageDataUrl: string, fileName = `this-is-us-${Date.now()}.jpg`) => {
  await ensureFilesystemPermissions();
  const { base64 } = base64FromDataUrl(imageDataUrl);

  if (Capacitor.isNativePlatform()) {
    await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.External
    });
  } else {
    const link = document.createElement('a');
    link.href = imageDataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

export const savePhotoLocally = async (imageDataUrl: string, fileName = `this-is-us-${Date.now()}.jpg`) => {
  await ensureFilesystemPermissions();
  const { base64 } = base64FromDataUrl(imageDataUrl);
  await Filesystem.writeFile({
    path: fileName,
    data: base64,
    directory: Directory.Documents
  });
};
