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
    localStorage.removeItem(SESSION_START_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    await signOut();
  }, [signOut, toast]);

  const updateLastActivity = useCallback(() => {
    if (!user) return;
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  }, [user]);

  const resetInactivityTimer = useCallback(() => {
    if (!user) return;
    updateLastActivity();
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      handleTimeout('Du har loggats ut på grund av inaktivitet (30 minuter).');
    }, INACTIVITY_TIMEOUT_MS);
  }, [user, handleTimeout, updateLastActivity]);

  // Check on mount if session or inactivity has expired (e.g. after closing browser)
  useEffect(() => {
    if (!user) return;

    const now = Date.now();

    // Check max session duration
    const sessionStart = localStorage.getItem(SESSION_START_KEY);
    if (sessionStart) {
      const elapsed = now - parseInt(sessionStart, 10);
      if (elapsed >= MAX_SESSION_DURATION_MS) {
        handleTimeout('Din session har löpt ut (max 8 timmar). Logga in igen.');
        return;
      }
    }

    // Check inactivity since last recorded activity
    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (lastActivity) {
      const idle = now - parseInt(lastActivity, 10);
      if (idle >= INACTIVITY_TIMEOUT_MS) {
        handleTimeout('Du har loggats ut på grund av inaktivitet (30 minuter).');
        return;
      }
    }
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
      localStorage.removeItem(SESSION_START_KEY);
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      if (maxSessionTimer.current) clearTimeout(maxSessionTimer.current);
      return;
    }

    let sessionStart = localStorage.getItem(SESSION_START_KEY);
    if (!sessionStart) {
      sessionStart = Date.now().toString();
      localStorage.setItem(SESSION_START_KEY, sessionStart);
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
