import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function DashboardPage() {
  const { role, userProfile } = useAuth();
  const [stats, setStats] = useState({
    totalShares: 0,
  });

  const [userBalances, setUserBalances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchEmail, setSearchEmail] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, [role, userProfile, searchEmail, startDate, endDate]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      let transactionsQuery = supabase.from('transactions').select(`
        *,
        users ( email, name )
      `);

      if (role === 'standard') {
        transactionsQuery = transactionsQuery.eq('userId', userProfile.id);
      }

      if (startDate) transactionsQuery = transactionsQuery.gte('createdAt', startDate);
      if (endDate) transactionsQuery = transactionsQuery.lte('createdAt', endDate);

      const { data: transactions, error } = await transactionsQuery;
      
      if (error) throw error;

      // Calculate totals
      let tShares = 0;
      
      // Temporary map for user balances (Admin view)
      const userMap = new Map();

      (transactions || []).forEach(t => {
        // Simple aggregate
        tShares += (t.shares?.cr || 0) - (t.shares?.dr || 0); // Assuming CR increases shares

        if (role === 'admin') {
          const uId = t.userId;
          if (!userMap.has(uId)) {
            userMap.set(uId, {
              email: t.users?.email || 'Unknown',
              lastActivity: t.createdAt,
              sharesDr: 0,
              sharesCr: 0,
            });
          }
          const u = userMap.get(uId);
          if (t.createdAt > u.lastActivity) u.lastActivity = t.createdAt;

          u.sharesDr += (t.shares?.dr || 0);
          u.sharesCr += (t.shares?.cr || 0);
        }
      });

      setStats({
        totalShares: tShares,
      });

      if (role === 'admin') {
        let balancesArray = Array.from(userMap.values());
        
        if (searchEmail) {
           balancesArray = balancesArray.filter(b => b.email.toLowerCase().includes(searchEmail.toLowerCase()));
        }

        // Sort by latest activity desc
        balancesArray.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
        setUserBalances(balancesArray);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num || 0);
  };

  return (
    <div className="p-6 flex-1 overflow-hidden flex flex-col bg-slate-50">
      
      {role === 'admin' && (
        <div className="flex flex-col sm:flex-row gap-4 mb-4 sm:hidden">
          <input type="text" placeholder="Search user email..." value={searchEmail} onChange={e => setSearchEmail(e.target.value)} className="bg-white border border-slate-200 rounded-md px-3 py-1.5 text-xs w-full focus:ring-1 focus:ring-emerald-500" />
          <div className="flex gap-2">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-xs border border-slate-200 rounded px-2 py-1 bg-white" />
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-xs border border-slate-200 rounded px-2 py-1 bg-white" />
          </div>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 shrink-0">
        <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Total Inv_Loan</p>
          <h2 className="text-2xl font-mono font-bold text-slate-800 leading-none">{formatCurrency(stats.totalShares)}</h2>
        </div>
      </div>

      {/* User Balances Summary Table (Admin View) */}
      {role === 'admin' && (
      <div className="flex-1 bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col min-h-0">
        
        {/* Desktop Admin Filters (in header area practically) */}
        <div className="px-4 py-3 border-b border-slate-100 hidden sm:flex justify-between items-center bg-slate-50">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-tight">User Balances Summary</h3>
            <div className="flex items-center gap-4">
               <input type="text" placeholder="Search user email..." value={searchEmail} onChange={e => setSearchEmail(e.target.value)} className="bg-white border border-slate-200 rounded-md px-3 py-1 text-xs w-64 focus:ring-1 focus:ring-emerald-500" />
               <div className="flex gap-2">
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}  className="text-xs border border-slate-200 rounded px-2 py-1 bg-white" />
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-xs border border-slate-200 rounded px-2 py-1 bg-white" />
               </div>
            </div>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
             <div className="p-4 text-sm text-slate-500">Loading data...</div>
          ) : (
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="bg-slate-100 sticky top-0 z-10 shadow-sm shadow-slate-200/50">
              <tr className="border-b border-slate-200">
                <th rowSpan={2} className="p-2 text-[10px] font-bold text-slate-600 uppercase border-r border-slate-200">Email / Username</th>
                <th rowSpan={2} className="p-2 text-[10px] font-bold text-slate-600 uppercase border-r border-slate-200">Last Activity</th>
                <th colSpan={3} className="p-1 text-[9px] font-bold text-center text-slate-500 uppercase border-r border-slate-200">Inv_Loan</th>
                <th rowSpan={2} className="p-2 text-[10px] font-bold text-right text-slate-600 uppercase">Total Net</th>
              </tr>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="p-1 text-[9px] font-medium text-slate-500 uppercase text-center border-r border-slate-100">Dr</th>
                <th className="p-1 text-[9px] font-medium text-slate-500 uppercase text-center border-r border-slate-100">Cr</th>
                <th className="p-1 text-[9px] font-bold text-slate-700 uppercase text-center border-r border-slate-200">Bal</th>
              </tr>
            </thead>
            <tbody className="text-[11px] font-mono">
              {userBalances.length === 0 ? (
                <tr><td colSpan={12} className="p-4 text-center text-slate-500 font-sans">No records found.</td></tr>
              ) : (
                userBalances.map((u, i) => {
                  const invBal = u.sharesCr - u.sharesDr;
                  const totalNet = invBal;

                  return (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-2 font-sans font-medium border-r border-slate-100 truncate max-w-[150px]" title={u.email}>{u.email}</td>
                      <td className="p-2 text-slate-500 border-r border-slate-100">{new Date(u.lastActivity).toLocaleDateString()}</td>
                      
                      <td className="p-1 text-center border-r border-slate-100">{u.sharesDr > 0 ? formatCurrency(u.sharesDr) : '-'}</td>
                      <td className="p-1 text-center border-r border-slate-100">{u.sharesCr > 0 ? formatCurrency(u.sharesCr) : '-'}</td>
                      <td className={`p-1 text-center font-bold border-r border-slate-200 ${invBal > 0 ? 'text-emerald-700' : invBal < 0 ? 'text-rose-700' : ''}`}>{formatCurrency(invBal)}</td>

                      <td className={`p-2 text-right font-bold tracking-tight ${totalNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {totalNet < 0 ? '-' : ''}₦{formatCurrency(Math.abs(totalNet))}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
