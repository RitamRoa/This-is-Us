import { PendingUpload } from '../types';

const STORAGE_KEY = 'this-is-us-pending-uploads';

const hasStorage = () => typeof window !== 'undefined' && !!window.localStorage;

const readQueue = (): PendingUpload[] => {
  if (!hasStorage()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PendingUpload[];
  } catch (error) {
    console.error('Failed to read offline queue', error);
    return [];
  }
};

const writeQueue = (queue: PendingUpload[]) => {
  if (!hasStorage()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
};

export const listPendingUploads = (): PendingUpload[] => readQueue();

export const enqueueUpload = (item: PendingUpload) => {
  const queue = readQueue();
  queue.push(item);
  writeQueue(queue);
};

export const clearUpload = (id: string) => {
  const queue = readQueue().filter((item) => item.id !== id);
  writeQueue(queue);
};

export const clearAllUploads = () => {
  if (!hasStorage()) return;
  localStorage.removeItem(STORAGE_KEY);
};
