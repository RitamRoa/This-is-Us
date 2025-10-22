import { useEffect } from 'react';
import { initializePushNotifications } from '../services';

interface NotificationHandlerProps {
  coupleId: string | null;
}

const NotificationHandler = ({ coupleId }: NotificationHandlerProps) => {
  useEffect(() => {
    if (!coupleId) return;
    initializePushNotifications().catch((error) => {
      console.warn('Push notification setup failed', error);
    });
  }, [coupleId]);

  return null;
};

export default NotificationHandler;
