import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function ManageUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [preReg, setPreReg] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('standard');
  const [adding, setAdding] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data: usersData } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    const { data: preRegData } = await supabase.from('pre_registered').select('*').order('created_at', { ascending: false });
    
    setUsers(usersData || []);
    setPreReg(preRegData || []);
    setLoading(false);
  };

  const handleAddPreReg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail) return;
    setAdding(true);
    
    // Check if email already exists in users or pre_registered
    const existsInUsers = users.find(u => u.email === newEmail);
    const existsInPreReg = preReg.find(u => u.email === newEmail);

    setErrorMessage('');
    setSuccessMessage('');

    if (existsInUsers || existsInPreReg) {
        setErrorMessage("Email already registered or pre-registered.");
        setAdding(false);
        return;
    }

    const { error } = await supabase.from('pre_registered').insert([{
        name: newName,
        email: newEmail,
        role: newRole
    }]);

    if (!error) {
        setNewName('');
        setNewEmail('');
        setSuccessMessage('User added successfully!');
        fetchUsers();
    } else {
        setErrorMessage("Error adding user: " + error.message);
    }
    setAdding(false);
  };

  const handleDelete = async (id: string, type: 'user' | 'pre_reg') => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    if (type === 'pre_reg') {
       const { error } = await supabase.from('pre_registered').delete().eq('id', id);
       if (error) setErrorMessage("Delete error: " + error.message);
    } else {
       const { error } = await supabase.from('users').delete().eq('id', id);
       if (error) setErrorMessage("Delete error: " + error.message);
    }
    fetchUsers();
  };

  const handleChangeRole = async (id: string, currentRole: string, type: 'user' | 'pre_reg') => {
      const newRoleToSet = currentRole === 'admin' ? 'standard' : 'admin';
      if (type === 'pre_reg') {
          const { error } = await supabase.from('pre_registered').update({ role: newRoleToSet }).eq('id', id);
          if (error) setErrorMessage("Update error: " + error.message);
      } else {
          const { error } = await supabase.from('users').update({ role: newRoleToSet }).eq('id', id);
          if (error) setErrorMessage("Update error: " + error.message);
      }
      fetchUsers();
  }

  const allUsers = [
    ...preReg.map(u => ({ ...u, status: 'Pending Sync', type: 'pre_reg' })),
    ...users.map(u => ({ ...u, status: 'Active', type: 'user' }))
  ];

  return (
    <div className="p-6 flex-1 overflow-hidden flex flex-col bg-slate-50">
      
      {/* Add User Form */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 mb-6 shrink-0">
         <h3 className="text-xs font-bold text-slate-700 uppercase tracking-tight mb-4">Pre-register New User</h3>
         {errorMessage && <div className="mb-4 p-2 bg-rose-50 text-rose-600 text-sm border border-rose-200 rounded">{errorMessage}</div>}
         {successMessage && <div className="mb-4 p-2 bg-emerald-50 text-emerald-600 text-sm border border-emerald-200 rounded">{successMessage}</div>}
         <form onSubmit={handleAddPreReg} className="flex flex-col sm:flex-row gap-4 items-end">
             <div className="flex-1 w-full">
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Name</label>
                <input required type="text" value={newName} onChange={e => setNewName(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-emerald-500" />
             </div>
             <div className="flex-1 w-full">
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Email</label>
                <input required type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-emerald-500" />
             </div>
             <div className="w-full sm:w-48">
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Role</label>
                <select value={newRole} onChange={e => setNewRole(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-emerald-500 bg-white">
                    <option value="standard">Standard</option>
                    <option value="admin">Admin</option>
                </select>
             </div>
             <button disabled={adding} type="submit" className="w-full sm:w-auto px-6 py-1.5 bg-emerald-600 text-white text-sm font-bold rounded hover:bg-emerald-700 disabled:opacity-50">
                 {adding ? 'Adding...' : 'Add User'}
             </button>
         </form>
      </div>

      {/* Users Table */}
      <div className="flex-1 bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col min-h-0">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-tight">System Users</h3>
        </div>
        <div className="flex-1 overflow-auto">
           {loading ? (
             <div className="p-4 text-sm text-slate-500">Loading users...</div>
           ) : (
            <table className="w-full text-left border-collapse min-w-[600px]">
                <thead className="bg-slate-100 sticky top-0 z-10 shadow-sm shadow-slate-200/50">
                    <tr>
                        <th className="p-2 text-[10px] font-bold text-slate-600 uppercase border-b border-r border-slate-200">Name</th>
                        <th className="p-2 text-[10px] font-bold text-slate-600 uppercase border-b border-r border-slate-200">Email</th>
                        <th className="p-2 text-[10px] font-bold text-slate-600 uppercase border-b border-r border-slate-200">Role</th>
                        <th className="p-2 text-[10px] font-bold text-slate-600 uppercase border-b border-r border-slate-200">Status</th>
                        <th className="p-2 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="text-[12px]">
                    {allUsers.length === 0 ? (
                        <tr><td colSpan={5} className="p-4 text-center text-slate-500">No users found</td></tr>
                    ) : (
                        allUsers.map((u) => (
                            <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="p-2 border-r border-slate-100 font-medium">{u.name}</td>
                                <td className="p-2 border-r border-slate-100 text-slate-600">{u.email}</td>
                                <td className="p-2 border-r border-slate-100">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-tighter ${u.role === 'admin' ? 'bg-slate-800 text-emerald-400' : 'bg-slate-200 text-slate-600'}`}>
                                        {u.role}
                                    </span>
                                </td>
                                <td className="p-2 border-r border-slate-100">
                                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${u.status === 'Active' ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-amber-700 bg-amber-50 border border-amber-200'}`}>
                                        {u.status}
                                    </span>
                                </td>
                                <td className="p-2 text-right">
                                    <button onClick={() => handleChangeRole(u.id, u.role, u.type)} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase mr-3">
                                        Swap Role
                                    </button>
                                    <button onClick={() => handleDelete(u.id, u.type)} className="text-[10px] font-bold text-rose-600 hover:text-rose-800 uppercase">
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
           )}
        </div>
      </div>

    </div>
  );
}
