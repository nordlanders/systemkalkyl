import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const MAX_SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours
const SESSION_START_KEY = 'session_start_time';
const LAST_ACTIVITY_KEY = 'last_activity_time';

export function useSessionTimeout() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxSessionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTimeout = useCallback(async (reason: string) => {
    toast({
      title: 'Session avslutad',
      description: reason,
      variant: 'destructive',
    });
    sessionStorage.removeItem(SESSION_START_KEY);
    await signOut();
  }, [signOut, toast]);

  const resetInactivityTimer = useCallback(() => {
    if (!user) return;
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      handleTimeout('Du har loggats ut på grund av inaktivitet (30 minuter).');
    }, INACTIVITY_TIMEOUT_MS);
  }, [user, handleTimeout]);

  // Inactivity tracking
  useEffect(() => {
    if (!user) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    const handler = () => resetInactivityTimer();

    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    resetInactivityTimer();

    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [user, resetInactivityTimer]);

  // Max session duration
  useEffect(() => {
    if (!user) {
      sessionStorage.removeItem(SESSION_START_KEY);
      if (maxSessionTimer.current) clearTimeout(maxSessionTimer.current);
      return;
    }

    let sessionStart = sessionStorage.getItem(SESSION_START_KEY);
    if (!sessionStart) {
      sessionStart = Date.now().toString();
      sessionStorage.setItem(SESSION_START_KEY, sessionStart);
    }

    const elapsed = Date.now() - parseInt(sessionStart, 10);
    const remaining = MAX_SESSION_DURATION_MS - elapsed;

    if (remaining <= 0) {
      handleTimeout('Din session har löpt ut (max 8 timmar). Logga in igen.');
      return;
    }

    maxSessionTimer.current = setTimeout(() => {
      handleTimeout('Din session har löpt ut (max 8 timmar). Logga in igen.');
    }, remaining);

    return () => {
      if (maxSessionTimer.current) clearTimeout(maxSessionTimer.current);
    };
  }, [user, handleTimeout]);
}
