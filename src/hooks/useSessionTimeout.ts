import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const INACTIVITY_WARNING_MS = 25 * 60 * 1000; // 25 minutes (warn 5 min before)
const MAX_SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours
const MAX_SESSION_WARNING_MS = MAX_SESSION_DURATION_MS - 5 * 60 * 1000; // warn 5 min before
const SESSION_START_KEY = 'session_start_time';
const LAST_ACTIVITY_KEY = 'last_activity_time';

export function useSessionTimeout() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inactivityWarningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxSessionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxSessionWarningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasWarnedInactivity = useRef(false);
  const hasWarnedMaxSession = useRef(false);

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

  const showWarning = useCallback((message: string) => {
    toast({
      title: '⚠️ Varning',
      description: message,
      duration: 30000,
    });
  }, [toast]);

  const updateLastActivity = useCallback(() => {
    if (!user) return;
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  }, [user]);

  const resetInactivityTimer = useCallback(() => {
    if (!user) return;
    updateLastActivity();
    hasWarnedInactivity.current = false;

    if (inactivityWarningTimer.current) clearTimeout(inactivityWarningTimer.current);
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);

    inactivityWarningTimer.current = setTimeout(() => {
      hasWarnedInactivity.current = true;
      showWarning('Du kommer att loggas ut om 5 minuter på grund av inaktivitet. Rör musen eller tryck på en tangent för att stanna inloggad.');
    }, INACTIVITY_WARNING_MS);

    inactivityTimer.current = setTimeout(() => {
      handleTimeout('Du har loggats ut på grund av inaktivitet (30 minuter).');
    }, INACTIVITY_TIMEOUT_MS);
  }, [user, handleTimeout, updateLastActivity, showWarning]);

  // Check on mount if session or inactivity has expired (e.g. after closing browser)
  // Also handles inactivity tracking and max session duration
  useEffect(() => {
    if (!user) {
      localStorage.removeItem(SESSION_START_KEY);
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      if (inactivityWarningTimer.current) clearTimeout(inactivityWarningTimer.current);
      if (maxSessionTimer.current) clearTimeout(maxSessionTimer.current);
      if (maxSessionWarningTimer.current) clearTimeout(maxSessionWarningTimer.current);
      return;
    }

    const now = Date.now();
    let shouldLogout = false;
    let logoutReason = '';

    // Check inactivity since last recorded activity
    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (lastActivity) {
      const idle = now - parseInt(lastActivity, 10);
      if (idle >= INACTIVITY_TIMEOUT_MS) {
        shouldLogout = true;
        logoutReason = 'Du har loggats ut på grund av inaktivitet (30 minuter).';
      }
    }

    // Check max session duration
    let sessionStart = localStorage.getItem(SESSION_START_KEY);
    if (sessionStart) {
      const elapsed = now - parseInt(sessionStart, 10);
      if (elapsed >= MAX_SESSION_DURATION_MS) {
        shouldLogout = true;
        logoutReason = 'Din session har löpt ut (max 8 timmar). Logga in igen.';
      }
    }

    if (shouldLogout) {
      handleTimeout(logoutReason);
      return;
    }

    // --- Set up inactivity tracking ---
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    const handler = () => resetInactivityTimer();
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    resetInactivityTimer();

    // --- Set up max session timer ---
    if (!sessionStart) {
      sessionStart = now.toString();
      localStorage.setItem(SESSION_START_KEY, sessionStart);
    }

    const elapsed = now - parseInt(sessionStart, 10);
    const remaining = MAX_SESSION_DURATION_MS - elapsed;
    const warningRemaining = MAX_SESSION_WARNING_MS - elapsed;

    if (warningRemaining > 0 && !hasWarnedMaxSession.current) {
      maxSessionWarningTimer.current = setTimeout(() => {
        hasWarnedMaxSession.current = true;
        showWarning('Din session löper ut om 5 minuter. Spara ditt arbete.');
      }, warningRemaining);
    }

    maxSessionTimer.current = setTimeout(() => {
      handleTimeout('Din session har löpt ut (max 8 timmar). Logga in igen.');
    }, remaining);

    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      if (inactivityWarningTimer.current) clearTimeout(inactivityWarningTimer.current);
      if (maxSessionTimer.current) clearTimeout(maxSessionTimer.current);
      if (maxSessionWarningTimer.current) clearTimeout(maxSessionWarningTimer.current);
    };
  }, [user, handleTimeout, resetInactivityTimer, showWarning]);
}
