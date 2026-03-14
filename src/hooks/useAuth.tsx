import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type PermissionLevel = 'read_only' | 'read_write';

const PASSWORD_MAX_AGE_DAYS = 90;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  permissionLevel: PermissionLevel;
  canWrite: boolean;
  canApprove: boolean;
  approvalOrganizations: string[];
  loading: boolean;
  fullName: string | null;
  passwordExpired: boolean;
  clearPasswordExpired: () => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [permissionLevel, setPermissionLevel] = useState<PermissionLevel>('read_only');
  const [canApprove, setCanApprove] = useState(false);
  const [approvalOrganizations, setApprovalOrganizations] = useState<string[]>([]);
  const [fullName, setFullName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordExpired, setPasswordExpired] = useState(false);

  const canWrite = permissionLevel === 'read_write';
  const clearPasswordExpired = () => setPasswordExpired(false);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer role and permission check with setTimeout to prevent deadlock
        if (session?.user) {
          setTimeout(() => {
            checkAdminRole(session.user.id);
            checkPermissionLevel(session.user.id);
            fetchFullName(session.user.id);
            checkApprovalPermissions(session.user.id);
          }, 0);
        } else {
          setIsAdmin(false);
          setIsSuperAdmin(false);
          setPermissionLevel('read_only');
          setFullName(null);
          setCanApprove(false);
          setApprovalOrganizations([]);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        checkAdminRole(session.user.id);
        checkPermissionLevel(session.user.id);
        fetchFullName(session.user.id);
        checkApprovalPermissions(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function checkAdminRole(userId: string) {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .in('role', ['admin', 'superadmin'])
      .maybeSingle();
    
    setIsAdmin(!!data);
    setIsSuperAdmin(data?.role === 'superadmin');
  }

  async function checkPermissionLevel(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('permission_level')
      .eq('user_id', userId)
      .maybeSingle();
    
    setPermissionLevel(data?.permission_level ?? 'read_only');
  }

  async function fetchFullName(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', userId)
      .maybeSingle();
    
    setFullName(data?.full_name ?? null);
  }

  async function checkApprovalPermissions(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('can_approve, approval_organizations')
      .eq('user_id', userId)
      .maybeSingle();
    
    setCanApprove(data?.can_approve ?? false);
    setApprovalOrganizations(data?.approval_organizations ?? []);
  }

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (!error && data.user) {
      // Check if user is deactivated
      const { data: profile } = await supabase
        .from('profiles')
        .select('deactivated_at, password_changed_at')
        .eq('user_id', data.user.id)
        .maybeSingle();
      
      if (profile?.deactivated_at && new Date(profile.deactivated_at) <= new Date()) {
        await supabase.auth.signOut();
        return { error: new Error('Ditt konto har avslutats. Kontakta en administratör för mer information.') };
      }

      // Check password age
      const passwordChangedAt = profile?.password_changed_at ? new Date(profile.password_changed_at) : null;
      const daysSinceChange = passwordChangedAt 
        ? (Date.now() - passwordChangedAt.getTime()) / (1000 * 60 * 60 * 24)
        : PASSWORD_MAX_AGE_DAYS + 1; // Force change if never set
      
      if (daysSinceChange > PASSWORD_MAX_AGE_DAYS) {
        setPasswordExpired(true);
      }

      // Update last_login_at on successful login
      await supabase
        .from('profiles')
        .update({ last_login_at: new Date().toISOString() })
        .eq('user_id', data.user.id);
    }
    
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName }
      }
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    setIsSuperAdmin(false);
    setPermissionLevel('read_only');
    setFullName(null);
    setCanApprove(false);
    setApprovalOrganizations([]);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      isAdmin,
      isSuperAdmin,
      permissionLevel, 
      canWrite, 
      canApprove, 
      approvalOrganizations, 
      loading, 
      fullName, 
      signIn, 
      signUp, 
      signOut 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
