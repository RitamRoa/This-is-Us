import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  Firestore,
  Unsubscribe,
  setDoc,
  doc,
  DocumentData,
  QuerySnapshot,
  QueryDocumentSnapshot,
  deleteDoc,
  updateDoc,
  arrayUnion
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  FirebaseStorage,
  deleteObject
} from 'firebase/storage';
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  User,
  Auth
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import {
  PushNotifications,
  PushNotificationToken,
  PushNotificationActionPerformed
} from '@capacitor/push-notifications';
import { enqueueUpload, clearUpload, listPendingUploads } from './offlineQueue';
import { PendingUpload, SharedPhoto } from '../types';
import { downloadPhoto } from './camera';

const firebaseConfig = {
  apiKey: 'AIzaSyC1W4iHsSCscMDf1_rJE4xTbmVdO1Q6-FU',
  authDomain: 'this-is-us-9890f.firebaseapp.com',
  projectId: 'this-is-us-9890f',
  storageBucket: 'this-is-us-9890f.firebasestorage.app',
  messagingSenderId: '645094215219',
  appId: '1:645094215219:web:0ff48b3fa8e8a2a4bd9d46',
  measurementId: 'G-PMLJH4MBB9'
};

const EXPIRATION_WINDOW_MS = 24 * 60 * 60 * 1000;

const validateFirebaseConfig = () => {
  const placeholders = Object.values(firebaseConfig).filter((value) =>
    typeof value === 'string' && value.startsWith('YOUR_')
  );
  if (placeholders.length > 0) {
    throw new Error(
      'Firebase configuration missing. Update firebaseConfig in src/services/firebase.ts before running the app.'
    );
  }
};

let app: FirebaseApp;
let db: Firestore;
let storage: FirebaseStorage;
let auth: Auth;
let currentUser: User | null = null;
let activeCoupleId: string | null = null;
let pushInitialized = false;
let authListenerAttached = false;

const ensureFirebase = async () => {
  validateFirebaseConfig();

  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else if (!app) {
    [app] = getApps();
  }

  if (!db) {
    db = getFirestore(app);
  }
  if (!storage) {
    storage = getStorage(app);
  }
  if (!auth) {
    auth = getAuth(app);
  }

  if (!currentUser) {
    try {
      const credential = auth.currentUser
        ? { user: auth.currentUser }
        : await signInAnonymously(auth);
      currentUser = credential.user;
    } catch (error) {
      console.error('Firebase anonymous auth failed', error);
      throw new Error('Unable to sign in to Firebase. Check your firebaseConfig credentials.');
    }

    if (!authListenerAttached) {
      onAuthStateChanged(auth, (user: User | null) => {
        currentUser = user;
      });
      authListenerAttached = true;
    }
  }

  return { app, db, storage, auth };
};

const requireCoupleId = () => {
  if (!activeCoupleId) {
    throw new Error('Couple ID not set. Call setActiveCoupleId before sending photos.');
  }
  return activeCoupleId;
};

const dataUrlToUint8Array = async (dataUrl: string) => {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
};

const persistMetadata = async (coupleId: string, storagePath: string, caption: string) => {
  const photosRef = collection(db, 'couples', coupleId, 'photos');
  await addDoc(photosRef, {
    imagePath: storagePath,
    caption,
    senderId: currentUser?.uid ?? 'unknown',
    createdAt: serverTimestamp(),
    expiresAt: Date.now() + EXPIRATION_WINDOW_MS,
    downloadedBy: []
  });
};

const flushQueueInternal = async () => {
  const coupleId = activeCoupleId;
  if (!coupleId || !navigator.onLine) return;
  const pending = listPendingUploads();
  if (!pending.length) return;

  for (const pendingItem of pending) {
    try {
      await performUpload(pendingItem, coupleId);
      clearUpload(pendingItem.id);
    } catch (error) {
      console.warn('Retry upload failed', error);
      break;
    }
  }
};

const performUpload = async (item: PendingUpload, coupleId: string) => {
  await ensureFirebase();
  const photoId = item.id;
  const storagePath = `couples/${coupleId}/${photoId}.jpg`;
  const storageRef = ref(storage, storagePath);
  const bytes = await dataUrlToUint8Array(item.imageBase64);
  await uploadBytes(storageRef, bytes, { contentType: 'image/jpeg' });
  await persistMetadata(coupleId, storagePath, item.caption);
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushQueueInternal().catch((error) => console.error('Failed to flush queue', error));
  });
}

export const setActiveCoupleId = async (coupleId: string) => {
  activeCoupleId = coupleId.trim();
  await ensureFirebase();
  await flushQueueInternal();
  return getCurrentUserId();
};

export const sendPhotoToPartner = async (imageData: string, text: string) => {
  await ensureFirebase();
  const coupleId = requireCoupleId();
  const uploadId = crypto.randomUUID();
  const payload: PendingUpload = {
    id: uploadId,
    caption: text,
    imageBase64: imageData,
    createdAt: Date.now()
  };

  if (!navigator.onLine) {
    enqueueUpload(payload);
    return { queued: true, id: uploadId };
  }

  try {
    await performUpload(payload, coupleId);
    return { queued: false, id: uploadId };
  } catch (error) {
    enqueueUpload(payload);
    throw error;
  }
};

const cleanupExpiredPhoto = async (coupleId: string, photoId: string, storagePath: string) => {
  try {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== 'storage/object-not-found') {
      console.warn('Failed to delete expired storage file', error);
    }
  }

  try {
    const photoRef = doc(db, 'couples', coupleId, 'photos', photoId);
    await deleteDoc(photoRef);
  } catch (error) {
    console.warn('Failed to delete expired Firestore document', error);
  }
};

export const subscribeToPartnerFeed = async (
  callback: (photos: SharedPhoto[]) => void
): Promise<Unsubscribe> => {
  await ensureFirebase();
  const coupleId = requireCoupleId();
  const photosRef = collection(db, 'couples', coupleId, 'photos');
  const feedQuery = query(photosRef, orderBy('createdAt', 'desc'));
  return onSnapshot(feedQuery, async (snapshot: QuerySnapshot<DocumentData>) => {
    const cleanupTasks: Promise<void>[] = [];
    const now = Date.now();
    const items = await Promise.all(
      snapshot.docs.map(async (docSnap: QueryDocumentSnapshot<DocumentData>) => {
        const data = docSnap.data();
        const storagePath = data.imagePath as string;
        const caption = (data.caption as string) ?? '';
        const senderId = (data.senderId as string) ?? 'unknown';
        const createdAtValue = data.createdAt?.toMillis?.() ?? data.createdAt ?? Date.now();
        const downloadedBy = Array.isArray(data.downloadedBy) ? (data.downloadedBy as string[]) : [];
        const expiresAt = typeof data.expiresAt === 'number'
          ? data.expiresAt
          : createdAtValue + EXPIRATION_WINDOW_MS;

        if (now >= expiresAt && downloadedBy.length === 0) {
          cleanupTasks.push(cleanupExpiredPhoto(coupleId, docSnap.id, storagePath));
          return null;
        }

        if (typeof data.expiresAt !== 'number') {
          cleanupTasks.push(
            updateDoc(doc(db, 'couples', coupleId, 'photos', docSnap.id), {
              expiresAt
            })
          );
        }

        const fileRef = ref(storage, storagePath);
        const imageUrl = await getDownloadURL(fileRef);
        const photo: SharedPhoto = {
          id: docSnap.id,
          imageUrl,
          caption,
          senderId,
          createdAt: createdAtValue,
          downloadedBy,
          expiresAt
        };
        return photo;
      })
    );

    const filtered = items.filter((item): item is SharedPhoto => item !== null);
    callback(filtered.sort((a: SharedPhoto, b: SharedPhoto) => b.createdAt - a.createdAt));

    if (cleanupTasks.length) {
      void Promise.all(cleanupTasks).catch((error) => {
        console.warn('Failed to process cleanup tasks', error);
      });
    }
  });
};

const imageUrlToDataUrl = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to download photo from storage.');
  }
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not process photo download.'));
      }
    };
    reader.onerror = () => reject(new Error('Could not process photo download.'));
    reader.readAsDataURL(blob);
  });
};

export const downloadSharedPhoto = async (photo: SharedPhoto) => {
  await ensureFirebase();
  const coupleId = requireCoupleId();
  try {
    const dataUrl = await imageUrlToDataUrl(photo.imageUrl);
    await downloadPhoto(dataUrl, `this-is-us-${photo.id}.jpg`);
    if (currentUser) {
      const photoRef = doc(db, 'couples', coupleId, 'photos', photo.id);
      await updateDoc(photoRef, {
        downloadedBy: arrayUnion(currentUser.uid)
      });
    }
  } catch (error) {
    console.error('Shared photo download failed', error);
    throw new Error('Unable to download photo. Please try again.');
  }
};

export const initializePushNotifications = async () => {
  if (pushInitialized) return;
  pushInitialized = true;
  if (!Capacitor.isNativePlatform()) {
    if ('Notification' in window && Notification.permission !== 'granted') {
      await Notification.requestPermission();
    }
    return;
  }

  try {
    await ensureFirebase();
    const coupleId = requireCoupleId();

    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') {
      throw new Error('Push notification permission denied.');
    }

    await PushNotifications.register();

    PushNotifications.addListener('registration', async (token: PushNotificationToken) => {
      if (!currentUser) return;
      const memberRef = doc(db, 'couples', coupleId, 'members', currentUser.uid);
      await setDoc(memberRef, {
        token: token.value,
        updatedAt: Date.now()
      });
    });

    PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (notification: PushNotificationActionPerformed) => {
        console.log('Notification action', notification); // Placeholder for deep links
      }
    );
  } catch (error) {
    pushInitialized = false;
    throw error;
  }
};

export const getCurrentUserId = () => currentUser?.uid ?? null;

export const getPendingUploads = () => listPendingUploads();
