import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut } from 'lucide-react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { role, userProfile, signOut } = useAuth();
  const location = useLocation();

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || 'U';
  };

  const navItems = [
    { name: 'DASHBOARD', path: '/' },
    { name: 'TRANSACTIONS', path: '/transactions' },
    ...(role === 'admin' ? [
      { name: 'MANAGE USERS', path: '/users' },
      { name: 'SYNC DATA', path: '/sync-data' }
    ] : [])
  ];

  return (
    <div className="bg-slate-50 h-screen w-full flex flex-row font-sans text-slate-900 overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 shrink-0 hidden md:flex">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-white font-bold text-lg tracking-tight">Coop Investment</h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">Management Portal</p>
        </div>
        <nav className="flex-1 py-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`px-6 py-2 flex items-center transition-colors ${
                  isActive 
                    ? 'bg-slate-800 text-white border-l-4 border-emerald-500' 
                    : 'hover:bg-slate-800 hover:text-white cursor-pointer'
                }`}
              >
                <span className="text-xs font-semibold">{item.name}</span>
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-slate-800 bg-slate-950">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded bg-emerald-600 flex items-center justify-center text-white font-bold text-xs uppercase">
                {getInitials(userProfile?.name)}
              </div>
              <div>
                <p className="text-xs font-bold text-white truncate max-w-[100px]">{userProfile?.name || 'User'}</p>
                <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-emerald-400 font-medium uppercase tracking-tighter">
                  {role}
                </span>
              </div>
            </div>
            <button onClick={signOut} className="text-slate-400 hover:text-white">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden p-4 bg-slate-900 text-white flex justify-between items-center">
          <h1 className="font-bold tracking-tight">Coop Investment</h1>
          <button onClick={signOut}><LogOut size={16} /></button>
        </div>
         {/* Top Header Bar for Desktop (can keep responsive) */}
        <header className="h-14 bg-white border-b border-slate-200 hidden md:flex items-center justify-end px-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
              <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></div>
              CONNECTED TO SUPABASE
            </div>
          </div>
        </header>

        {/* Content Area */}
        {children}
        
        {/* Mobile Bottom Nav */}
        <div className="md:hidden flex justify-around bg-slate-900 text-white mt-auto py-2 px-1 text-xs font-semibold shrink-0">
          {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
              <Link
                  key={item.path}
                  to={item.path}
                  className={`p-2 ${isActive ? 'text-emerald-400 border-t-2 border-emerald-400 -mt-2.5 pt-2.5' : 'text-slate-400'}`}
              >
                  {item.name}
              </Link>
              )
          })}
        </div>
      </main>
    </div>
  );
}
