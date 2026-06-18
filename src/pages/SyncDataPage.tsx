import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { supabase } from '../lib/supabase';

const TEMPLATE_HEADERS = [
    "UserEmail", "Date", "Amount", "Ref", "Particulars", 
    "Inv_LoanDr", "Inv_LoanCr"
];

export default function SyncDataPage() {
  const [activeTab, setActiveTab] = useState<'manual'|'csv'>('manual');
  const [users, setUsers] = useState<any[]>([]);

  // Manual Form State
  const [mDate, setMDate] = useState(new Date().toISOString().split('T')[0]);
  const [mEmail, setMEmail] = useState('');
  const [mAmount, setMAmount] = useState('0');
  const [mRef, setMRef] = useState('');
  const [mParticulars, setMParticulars] = useState('');
  
  const [mSharesDr, setMSharesDr] = useState('0'); const [mSharesCr, setMSharesCr] = useState('0');

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
     supabase.from('users').select('id, email, name').then(({data}) => {
         if (data) setUsers(data);
     });
  }, []);

  const downloadTemplate = () => {
     const csv = Papa.unparse([TEMPLATE_HEADERS]);
     const blob = new Blob([csv], { type: 'text/csv' });
     const url = window.URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = 'coop_import_template.csv';
     a.click();
  };

  const parseNumber = (val: any) => {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? 0 : parsed;
  }

  const handleManualSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setMsg('');

      const user = users.find(u => u.email === mEmail);
      if (!user) {
          setMsg('User email not found in active users.');
          setLoading(false);
          return;
      }

      const tx = {
          userId: user.id,
          createdAt: new Date(mDate).toISOString(),
          amount: parseNumber(mAmount),
          ref: mRef,
          particulars: mParticulars,
          shares: { dr: parseNumber(mSharesDr), cr: parseNumber(mSharesCr) }
      };

      const { error } = await supabase.from('transactions').insert([tx]);
      if (error) setMsg('Error: ' + error.message);
      else {
          setMsg('Transaction added successfully!');
          // reset form
          setMAmount('0'); setMRef(''); setMParticulars('');
          setMSharesDr('0'); setMSharesCr('0');
      }
      setLoading(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setLoading(true);
      setMsg('');

      Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: async (results) => {
              const headers = results.meta.fields || [];
              const missing = TEMPLATE_HEADERS.filter(h => !headers.includes(h));
              
              if (missing.length > 0) {
                  setMsg(`Invalid CSV format. Missing columns: ${missing.join(', ')}`);
                  setLoading(false);
                  return;
              }

              const rows = results.data as any[];
              const toInsert = [];
              let errorFound = false;

              for (let i=0; i<rows.length; i++) {
                  const row = rows[i];
                  const u = users.find(user => user.email === row.UserEmail);
                  if (!u) {
                      setMsg(`Row ${i+1}: User email '${row.UserEmail}' not found in active users.`);
                      errorFound = true;
                      break;
                  }
                  toInsert.push({
                      userId: u.id,
                      createdAt: row.Date ? new Date(row.Date).toISOString() : new Date().toISOString(),
                      amount: parseNumber(row.Amount),
                      ref: row.Ref || '',
                      particulars: row.Particulars || '',
                      shares: { dr: parseNumber(row.Inv_LoanDr), cr: parseNumber(row.Inv_LoanCr) }
                  });
              }

              if (errorFound) {
                  setLoading(false);
                  return;
              }

              if (toInsert.length === 0) {
                  setMsg("No valid rows found in CSV.");
                  setLoading(false);
                  return;
              }

              const { error } = await supabase.from('transactions').insert(toInsert);
              if (error) {
                  setMsg('Batch insert error: ' + error.message);
              } else {
                  setMsg(`Successfully imported ${toInsert.length} transactions.`);
              }
              setLoading(false);
          },
          error: (err) => {
              setMsg("Error parsing CSV: " + err.message);
              setLoading(false);
          }
      });
  };

  const NumberInput = ({ label, val, setter }: any) => (
      <div>
         <label className="block text-[9px] uppercase font-bold text-slate-500">{label}</label>
         <input type="number" step="0.01" value={val} onChange={e=>setter(e.target.value)} className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500" />
      </div>
  );

  return (
    <div className="p-6 flex-1 overflow-hidden flex flex-col bg-slate-50">
      
      <div className="flex gap-4 mb-6 shrink-0 border-b border-slate-200 pb-2">
         <button onClick={() => setActiveTab('manual')} className={`text-xs font-bold uppercase tracking-tight pb-2 ${activeTab === 'manual' ? 'text-emerald-600 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-800'}`}>Manual Entry Form</button>
         <button onClick={() => setActiveTab('csv')} className={`text-xs font-bold uppercase tracking-tight pb-2 ${activeTab === 'csv' ? 'text-emerald-600 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-800'}`}>CSV Upload Layer</button>
      </div>

      {msg && <div className={`mb-4 p-3 rounded text-sm ${msg.includes('error')||msg.includes('Invalid')||msg.includes('not found') ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{msg}</div>}

      <div className="flex-1 bg-white border border-slate-200 rounded-lg shadow-sm overflow-auto p-6">
        {activeTab === 'manual' && (
           <form onSubmit={handleManualSubmit} className="max-w-4xl max-h-full">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                   <div className="space-y-4">
                       <h4 className="text-xs font-bold text-slate-700 uppercase tracking-tight border-b border-slate-100 pb-2">General Details</h4>
                       <div>
                           <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">User Email</label>
                           <select required value={mEmail} onChange={e=>setMEmail(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-emerald-500 bg-white">
                               <option value="">Select User</option>
                               {users.map(u => <option key={u.id} value={u.email}>{u.email} ({u.name})</option>)}
                           </select>
                       </div>
                       <div className="flex gap-4">
                           <div className="flex-1">
                               <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Date</label>
                               <input type="date" required value={mDate} onChange={e=>setMDate(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-emerald-500" />
                           </div>
                           <div className="flex-1">
                               <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Total Amount (For display)</label>
                               <input type="number" step="0.01" required value={mAmount} onChange={e=>setMAmount(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-emerald-500" />
                           </div>
                       </div>
                       <div>
                           <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Reference No.</label>
                           <input type="text" value={mRef} onChange={e=>setMRef(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-emerald-500" placeholder="e.g. TR-2023X" />
                       </div>
                       <div>
                           <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Particulars / Description</label>
                           <textarea required value={mParticulars} onChange={e=>setMParticulars(e.target.value)} rows={3} className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-emerald-500" placeholder="Monthly Contribution..."></textarea>
                       </div>
                   </div>

                   <div className="space-y-4">
                       <h4 className="text-xs font-bold text-slate-700 uppercase tracking-tight border-b border-slate-100 pb-2">Ledger Entries</h4>
                       <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded border border-slate-100">
                           <p className="col-span-2 text-[10px] font-bold text-slate-600 uppercase">Inv_Loan</p>
                           <NumberInput label="Debit (Dr)" val={mSharesDr} setter={setMSharesDr} />
                           <NumberInput label="Credit (Cr)" val={mSharesCr} setter={setMSharesCr} />
                       </div>
                   </div>
               </div>
               
               <div className="flex justify-end pt-4 border-t border-slate-200">
                   <button disabled={loading} type="submit" className="px-6 py-2 bg-emerald-600 text-white text-sm font-bold rounded hover:bg-emerald-700 disabled:opacity-50">
                       {loading ? 'Submitting...' : 'Submit Transaction'}
                   </button>
               </div>
           </form>
        )}

        {activeTab === 'csv' && (
            <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50">
               <h3 className="text-lg font-bold text-slate-700 mb-2">Upload Data via CSV</h3>
               <p className="text-sm text-slate-500 mb-6 text-center max-w-md">Batch import transactions. Ensure you are using the precise strict template to prevent database consistency errors.</p>
               
               <div className="flex gap-4">
                  <button onClick={downloadTemplate} className="px-4 py-2 border border-slate-300 bg-white text-slate-700 font-bold text-sm rounded hover:bg-slate-100 shadow-sm">
                      Download Template
                  </button>
                  <label className={`px-4 py-2 bg-emerald-600 text-white font-bold text-sm rounded cursor-pointer hover:bg-emerald-700 shadow-sm ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      {loading ? 'Processing...' : 'Upload CSV File'}
                      <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={loading} />
                  </label>
               </div>
            </div>
        )}
      </div>

    </div>
  );
}
