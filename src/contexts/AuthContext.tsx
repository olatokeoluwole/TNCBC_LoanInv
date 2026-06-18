import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';

type UserRole = 'admin' | 'standard' | null;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: UserRole;
  loading: boolean;
  signOut: () => Promise<void>;
  userProfile: any;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkUserRole(session.user);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkUserRole(session.user);
      } else {
        setRole(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUserRole = async (user: User) => {
    try {
      // 1. Super Admin fallback check
      if (user.email === 'olatokeoluwole@gmail.com') {
        const { data: existingSuperAdmin, error: selectErr } = await supabase.from('users').select('*').eq('email', user.email).single();
        
        if (selectErr && selectErr.code !== 'PGRST116') {
          console.error("Error fetching Super Admin:", selectErr);
        }

        if (!existingSuperAdmin) {
           const { error: insertErr } = await supabase.from('users').insert([{ id: user.id, email: user.email, name: 'Super Admin', role: 'admin' }]);
           if (insertErr) {
             console.error("Error creating Super Admin (Possible RLS issue?):", insertErr);
           }
        } else if (existingSuperAdmin.role !== 'admin') {
           const { error: updateErr } = await supabase.from('users').update({ role: 'admin' }).eq('id', existingSuperAdmin.id);
           if (updateErr) console.error("Error updating Super Admin role:", updateErr);
        } 
        
        if (existingSuperAdmin && !existingSuperAdmin.id) {
            const { error: fixIdErr } = await supabase.from('users').update({ id: user.id }).eq('email', user.email);
            if (fixIdErr) console.error("Error fixing Super Admin ID:", fixIdErr);
        }

        // Even if DB fetching/inserting fails (e.g. due to RLS), let the super admin in.
        setRole('admin');
        setUserProfile(existingSuperAdmin || { id: user.id, email: user.email, name: 'Super Admin', role: 'admin' });
        setLoading(false);
        return;
      }

      // 2. Check if user is in 'users' array
      let { data: profile, error: profileErr } = await supabase.from('users').select('*').eq('email', user.email).single();
      
      if (profileErr && profileErr.code !== 'PGRST116') {
         console.error("Error fetching profile:", profileErr);
      }

      if (profile) {
        setRole(profile.role);
        setUserProfile(profile);
        setLoading(false);
        return;
      }

      // 3. User not in 'users' yet. Check 'pre_registered'
      const { data: preRegisteredUser } = await supabase.from('pre_registered').select('*').eq('email', user.email).single();
      
      if (preRegisteredUser) {
        // They are pre-registered, let's move them to users
        const { data: newProfile, error: createError } = await supabase.from('users').insert([{
          id: user.id,
          email: user.email,
          name: preRegisteredUser.name || user.user_metadata?.full_name || 'User',
          role: preRegisteredUser.role || 'standard'
        }]).select().single();

        if (newProfile) {
           // Success! Remove from pre_registered
           await supabase.from('pre_registered').delete().eq('email', user.email);
           setRole(newProfile.role);
           setUserProfile(newProfile);
           setLoading(false);
           return;
        }
      }

      // 4. If they reach here, they are not registered at all.
      // Delete their auth record (they are not allowed)
      // Since we can't delete auth record directly from client, we sign them out immediately
      // and maybe call an edge function if we truly want to delete auth, but signing out is sufficient block
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setRole(null);
      setUserProfile(null);
      alert('You are not authorized to log into this system. Please contact the administrator.');

    } catch (err) {
      console.error('Error checking user role:', err);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, role, loading, signOut, userProfile }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
