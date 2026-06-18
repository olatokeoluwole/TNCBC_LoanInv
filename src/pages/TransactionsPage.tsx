import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';

export default function TransactionsPage() {
  const { role, userProfile } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [receipts, setReceipts] = useState<any[]>([]);

  useEffect(() => {
    fetchTransactions();
    if (role === 'admin') fetchReceipts();
  }, [role, userProfile]);

  const fetchTransactions = async () => {
    setLoading(true);
    let q = supabase.from('transactions').select(`*, users ( email, name )`).order('createdAt', { ascending: true }); // Need ascending to calculate running balance correctly forward, then reverse for newest first
    
    if (role === 'standard') {
       q = q.eq('userId', userProfile.id);
    }
    
    const { data } = await q;
    
    if (data) {
        // Calculate running balances per user
        const userBals = new Map();
        
        const prepared = data.map(t => {
           if (!userBals.has(t.userId)) {
               userBals.set(t.userId, { sh: 0, sa: 0, lo: 0, li: 0, sp: 0 });
           }
           const b = userBals.get(t.userId);
           
           b.sh += (t.shares?.cr || 0) - (t.shares?.dr || 0);
           b.sa += (t.saving?.cr || 0) - (t.saving?.dr || 0);
           b.lo += (t.loans?.dr || 0) - (t.loans?.cr || 0);
           b.li += (t.loanInterest?.dr || 0) - (t.loanInterest?.cr || 0);
           b.sp += (t.specialSavings?.cr || 0) - (t.specialSavings?.dr || 0);

           return { ...t, _bals: { ...b } };
        });

        // the prompt says "ordered by newest first", so we reverse after calculating
        setTransactions(prepared.reverse());
    }
    setLoading(false);
  };

  const fetchReceipts = async () => {
      const { data } = await supabase.from('receipts').select('*, users(email)').order('createdAt', { ascending: false });
      if (data) setReceipts(data);
  }

  const formatCurrency = (num: number, hideSymbol = false) => {
    if (num === 0 || !num) return '-';
    // We add symbol directly in table
    return new Intl.NumberFormat('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 700 * 1024) {
          alert('File size exceeds 700KB limit.');
          return;
      }
      if (file.type !== 'application/pdf') {
          alert('Only PDF files are allowed.');
          return;
      }

      setUploadingReceipt(true);
      const reader = new FileReader();
      reader.onload = async () => {
          const base64 = reader.result?.toString().split(',')[1];
          const { error } = await supabase.from('receipts').insert([{
              userId: userProfile.id,
              fileName: file.name,
              fileData: base64,
              status: 'pending',
              createdAt: new Date().toISOString()
          }]);
          if (error) alert('Error uploading: ' + error.message);
          else alert('Receipt uploaded successfully.');
          setUploadingReceipt(false);
      };
      reader.readAsDataURL(file);
  };

  const toggleReceiptStatus = async (id: string, currentStatus: string) => {
      await supabase.from('receipts').update({ status: currentStatus === 'pending' ? 'seen' : 'pending' }).eq('id', id);
      fetchReceipts();
  };
  const clearReceipt = async (id: string) => {
      await supabase.from('receipts').delete().eq('id', id);
      fetchReceipts();
  }

  const exportCSV = () => {
      const csvData = transactions.map(t => ({
          Date: new Date(t.createdAt).toLocaleDateString(),
          ...(role === 'admin' ? { User: t.users?.email } : {}),
          Amount: t.amount,
          Particulars: t.particulars,
          Ref: t.ref,
          'Inv_Loan Dr': t.shares?.dr || 0, 'Inv_Loan Cr': t.shares?.cr || 0, 'Inv_Loan Bal': t._bals.sh,
      }));
      const csv = Papa.unparse(csvData);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'transactions.csv';
      a.click();
  }

  const exportPDF = () => {
      const doc = new jsPDF('landscape');
      doc.text("Transactions Ledger", 14, 15);
      
      const head = [[
          "Date", 
          ...(role === 'admin' ? ["User"] : []),
          "Amount", "Ref", "Particulars", 
          "Inv_Ln Dr", "Inv_Ln Cr", "Inv_Ln Bal"
      ]];

      const body = transactions.map(t => [
          new Date(t.createdAt).toLocaleDateString(),
          ...(role === 'admin' ? [t.users?.email] : []),
          t.amount, t.ref, t.particulars,
          t.shares?.dr||0, t.shares?.cr||0, t._bals.sh
      ]);

      autoTable(doc, {
          head, body,
          startY: 20,
          styles: { fontSize: 6 },
          headStyles: { fillColor: [15, 23, 42] }
      });
      doc.save('transactions.pdf');
  }

  return (
    <div className="p-6 flex-1 overflow-hidden flex flex-col bg-slate-50 relative">

      {/* Admin Receipts View */}
      {role === 'admin' && receipts.length > 0 && (
         <div className="mb-6 bg-white border border-slate-200 rounded-lg shadow-sm">
             <div className="px-4 py-2 border-b border-slate-100 bg-slate-50">
                 <h3 className="text-xs font-bold text-slate-700 uppercase tracking-tight">Pending Receipts ({receipts.filter(r=>r.status==='pending').length})</h3>
             </div>
             <div className="p-4 overflow-x-auto">
                 <div className="flex gap-4">
                     {receipts.map(r => (
                         <div key={r.id} className="border border-slate-200 rounded p-3 w-64 shrink-0 bg-slate-50 flex flex-col">
                             <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-bold text-slate-500 truncate">{r.users?.email}</span>
                                <span className={`text-[9px] px-1.5 rounded uppercase font-bold ${r.status==='pending'?'bg-amber-100 text-amber-700':'bg-emerald-100 text-emerald-700'}`}>{r.status}</span>
                             </div>
                             <p className="text-xs truncate font-medium text-slate-700 mb-4" title={r.fileName}>{r.fileName}</p>
                             <div className="flex gap-2 mt-auto">
                                <a href={`data:application/pdf;base64,${r.fileData}`} download={r.fileName} className="flex-1 text-center py-1 bg-slate-800 text-white rounded text-[10px] font-bold uppercase hover:bg-slate-700">Download</a>
                                <button onClick={() => toggleReceiptStatus(r.id, r.status)} className="flex-1 py-1 border border-slate-300 bg-white text-slate-700 rounded text-[10px] font-bold uppercase hover:bg-slate-100">Toggle</button>
                                <button onClick={() => clearReceipt(r.id)} className="px-2 py-1 border border-rose-200 bg-rose-50 text-rose-700 rounded text-[10px] font-bold uppercase hover:bg-rose-100">X</button>
                             </div>
                         </div>
                     ))}
                 </div>
             </div>
         </div>
      )}

      {/* Main Table */}
      <div className="flex-1 bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col min-h-0">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-tight">Transactions Ledger</h3>
          <div className="flex gap-2 flex-wrap">
            {role === 'standard' && (
                <label className="px-3 py-1.5 text-[10px] font-bold bg-emerald-600 text-white rounded hover:bg-emerald-700 uppercase cursor-pointer flex items-center">
                    {uploadingReceipt ? 'Uploading...' : 'Upload Receipt (PDF)'}
                    <input type="file" accept=".pdf" className="hidden" onChange={handleReceiptUpload} disabled={uploadingReceipt} />
                </label>
            )}
            <button onClick={exportCSV} className="px-3 py-1.5 text-[10px] font-bold bg-white border border-slate-300 rounded hover:bg-slate-50 uppercase shadow-sm">Export CSV</button>
            <button onClick={exportPDF} className="px-3 py-1.5 text-[10px] font-bold bg-white border border-slate-300 rounded hover:bg-slate-50 uppercase shadow-sm">Export PDF</button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
           {loading ? (
               <div className="p-4 text-sm text-slate-500">Loading ledger...</div>
           ) : (
            <table className="w-full text-left border-collapse min-w-[1200px]">
                <thead className="bg-slate-100 sticky top-0 z-10 shadow-sm shadow-slate-200/50">
                    <tr className="border-b border-slate-200">
                        <th rowSpan={2} className="p-2 text-[10px] font-bold text-slate-600 uppercase border-r border-slate-200 w-24">Date</th>
                        {role === 'admin' && <th rowSpan={2} className="p-2 text-[10px] font-bold text-slate-600 uppercase border-r border-slate-200 w-32">Username</th>}
                        <th rowSpan={2} className="p-2 text-[10px] font-bold text-slate-600 uppercase border-r border-slate-200 w-20">Amount</th>
                        <th rowSpan={2} className="p-2 text-[10px] font-bold text-slate-600 uppercase border-r border-slate-200 w-32">Particulars</th>
                        <th rowSpan={2} className="p-2 text-[10px] font-bold text-slate-600 uppercase border-r border-slate-200 w-20">Ref</th>
                        <th colSpan={3} className="p-1 text-[9px] font-bold text-center text-slate-500 uppercase border-r border-slate-200 bg-slate-200/30">Inv_Loan</th>
                    </tr>
                    <tr className="border-b border-slate-200 bg-slate-50">
                        {/* Inv_Loan */}
                        <th className="p-1 text-[9px] font-medium text-slate-500 uppercase text-center border-r border-slate-100 bg-slate-200/20 w-16">Dr</th>
                        <th className="p-1 text-[9px] font-medium text-slate-500 uppercase text-center border-r border-slate-100 bg-slate-200/20 w-16">Cr</th>
                        <th className="p-1 text-[9px] font-bold text-slate-700 uppercase text-center border-r border-slate-200 bg-slate-200/40 w-20">Bal</th>
                    </tr>
                </thead>
                <tbody className="text-[11px] font-mono">
                  {transactions.length === 0 ? (
                      <tr><td colSpan={25} className="p-4 text-center font-sans text-slate-500">No transactions recorded.</td></tr>
                  ) : (
                    transactions.map((t) => (
                        <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="p-2 border-r border-slate-100 text-slate-600 font-sans">{new Date(t.createdAt).toLocaleDateString()}</td>
                            {role === 'admin' && <td className="p-2 border-r border-slate-100 font-sans truncate max-w-[120px]" title={t.users?.email}>{t.users?.email}</td>}
                            <td className="p-2 border-r border-slate-100 font-bold" title={t.amount}>₦{formatCurrency(t.amount)}</td>
                            <td className="p-2 border-r border-slate-100 font-sans truncate max-w-[120px]" title={t.particulars}>{t.particulars}</td>
                            <td className="p-2 border-r border-slate-100 text-slate-500">{t.ref}</td>
                            
                            {/* Inv_Loan */}
                            <td className="p-1 text-center border-r border-slate-100 text-slate-500">{formatCurrency(t.shares?.dr)}</td>
                            <td className="p-1 text-center border-r border-slate-100 text-emerald-600">{formatCurrency(t.shares?.cr)}</td>
                            <td className="p-1 text-center font-bold bg-slate-50/50">{formatCurrency(t._bals.sh)}</td>
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
