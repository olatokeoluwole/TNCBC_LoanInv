import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AuthPage() {
  const { session, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isFirstTimeSetup, setIsFirstTimeSetup] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (loading) {
    return <div className="h-screen w-full flex items-center justify-center bg-slate-50"><p>Loading...</p></div>;
  }

  if (session) {
    return <Navigate to="/" replace />;
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setMsg('');

    try {
      if (isFirstTimeSetup) {
        // Find if user is pre-registered to allow setup
        const { data: preRegUser } = await supabase.from('pre_registered').select('*').eq('email', email).single();
        if (!preRegUser && email !== 'olatokeoluwole@gmail.com') { // Allow root admin email to register
            throw new Error("Email not pre-registered by admin. Cannot set up account.");
        }

        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        setMsg('Check your email for confirmation link before logging in.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin,
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Error configuring Google auth.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md border border-slate-200">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Coop Investment Portal</h2>
        <p className="text-sm text-slate-500 mb-6">Standard user or Admin login</p>
        
        {error && <div className="bg-rose-50 text-rose-600 p-3 rounded mb-4 text-sm">{error}</div>}
        {msg && <div className="bg-emerald-50 text-emerald-600 p-3 rounded mb-4 text-sm">{msg}</div>}

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 focus:outline-none text-sm bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 focus:outline-none text-sm bg-white"
            />
          </div>
          
          <div className="flex items-center text-sm mt-2">
            <input 
              type="checkbox" 
              id="firstTime" 
              checked={isFirstTimeSetup}
              onChange={(e) => setIsFirstTimeSetup(e.target.checked)}
              className="mr-2 rounded text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="firstTime" className="text-slate-600">First Time Setup (Set Password)</label>
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-emerald-600 text-white font-semibold py-2 px-4 rounded hover:bg-emerald-700 transition disabled:opacity-50"
          >
            {isSubmitting ? 'Processing...' : (isFirstTimeSetup ? 'Set Password & Sign Up' : 'Sign In')}
          </button>
        </form>

        <div className="mt-6 flex items-center before:mt-0.5 before:flex-1 before:border-t before:border-slate-300 after:mt-0.5 after:flex-1 after:border-t after:border-slate-300">
           <p className="mx-4 mb-0 text-center text-sm font-semibold text-slate-500">OR</p>
        </div>

        <button 
          onClick={handleGoogleAuth}
          className="w-full mt-6 bg-white border border-slate-300 text-slate-700 font-semibold py-2 px-4 rounded hover:bg-slate-50 transition flex justify-center items-center gap-2"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
