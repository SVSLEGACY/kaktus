// @ts-nocheck -- ported as-is from the original kaktus app

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/kaktus/components/AuthProvider';
import { useRouter } from '@/kaktus/next/navigation';
import { getAdminPaymentSettings, updateAdminPaymentSettings, getPendingPayments, approvePayment, rejectPayment, PaymentTransaction, PaymentSettings } from '@/kaktus/lib/payments';
import { Check, X, Loader2, Upload, QrCode, Key, Plus, Trash2 } from 'lucide-react';
import { getApiPool, updateApiPool, ApiKeyData } from '@/kaktus/lib/admin';
import Link from '@/kaktus/next/link';

export default function AdminPanel() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [settings, setSettings] = useState<PaymentSettings>({ upiId: '', upiQrUrl: '' });
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeyData[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/admin');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      getAdminPaymentSettings().then(setSettings);
      loadPayments();
      
      getApiPool().then(async (pool) => {
        if (pool && pool.length > 0) {
          setApiKeys(pool);
        } else {
          // If Firestore is empty, try to migrate from localStorage so "jo already hai woh bhi dikhe"
          const stored = localStorage.getItem('gemini_api_keys');
          const oldKey = localStorage.getItem('gemini_api_key');
          let migrated = [];
          if (stored) {
            try {
              const keys = JSON.parse(stored);
              migrated = keys.map((k: any, i: number) => ({ key: k, label: 'My Key ' + (i+1), status: 'active', addedAt: new Date().toISOString() }));
            } catch(e) {}
          } else if (oldKey) {
            migrated = [{ key: oldKey, label: 'My Key 1', status: 'active', addedAt: new Date().toISOString() }];
          }
          
          if (migrated.length > 0) {
            setApiKeys(migrated);
            await updateApiPool(migrated);
          }
        }
      });

    }
  }, [user]);

  
  const handleAddApiKey = async () => {
    if (!newKey || !newLabel) return;
    const newApiKeys = [...apiKeys, { key: newKey, label: newLabel, status: 'active' as const, addedAt: new Date().toISOString() }];
    setApiKeys(newApiKeys);
    setNewKey('');
    setNewLabel('');
    await updateApiPool(newApiKeys);
  };

  const handleRemoveApiKey = async (indexToRemove: number) => {
    if (!confirm('Remove this API key?')) return;
    const newApiKeys = apiKeys.filter((_, idx) => idx !== indexToRemove);
    setApiKeys(newApiKeys);
    await updateApiPool(newApiKeys);
  };

  const loadPayments = async () => {
    const data = await getPendingPayments();
    setPayments(data);
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    await updateAdminPaymentSettings(settings);
    setSavingSettings(false);
    alert('Settings saved successfully!');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings({ ...settings, upiQrUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApprove = async (txn: PaymentTransaction) => {
    setActionLoading(txn.id);
    try {
      await approvePayment(txn);
      await loadPayments();
    } catch (e) {
      alert('Failed to approve');
    }
    setActionLoading(null);
  };

  const handleReject = async (txnId: string) => {
    if (!confirm('Are you sure you want to reject this payment?')) return;
    setActionLoading(txnId);
    try {
      await rejectPayment(txnId);
      await loadPayments();
    } catch (e) {
      alert('Failed to reject');
    }
    setActionLoading(null);
  };

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-black">Loading Admin...</div>;

  return (
    <div className="min-h-screen bg-gray-50 text-[#111] font-sans p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <Link href="/ide" className="text-green-600 font-medium hover:underline">Back to IDE</Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Settings Section */}
          <div className="md:col-span-1 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm h-fit">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <QrCode className="text-blue-600 w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold">Payment Settings</h2>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Your UPI ID</label>
                <input 
                  type="text" 
                  value={settings.upiId} 
                  onChange={e => setSettings({...settings, upiId: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 outline-none"
                  placeholder="e.g. shubham@okicici"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">UPI QR Code</label>
                {settings.upiQrUrl ? (
                  <div className="relative mb-2 inline-block">
                    <img src={settings.upiQrUrl} alt="QR" className="w-32 h-32 object-contain border border-gray-200 rounded-lg" />
                    <button onClick={() => setSettings({...settings, upiQrUrl: ''})} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-md">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div onClick={() => fileInputRef.current?.click()} className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 cursor-pointer hover:bg-gray-50 transition-colors">
                    <Upload size={24} className="mb-2" />
                    <span className="text-xs">Upload QR</span>
                  </div>
                )}
                <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
              </div>

              <button 
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center"
              >
                {savingSettings ? <Loader2 className="animate-spin w-5 h-5" /> : "Save Settings"}
              </button>
            </div>
          </div>

          {/* Pending Verifications Section */}
          <div className="md:col-span-2 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <h2 className="text-xl font-bold mb-6">Pending Verifications</h2>
            
            {payments.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Check className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p>No pending payments. You're all caught up!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {payments.map(txn => (
                  <div key={txn.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border border-orange-200 bg-orange-50/30 rounded-2xl gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono bg-white px-2 py-0.5 rounded border border-gray-200 text-sm font-semibold text-black">UTR: {txn.txnId}</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 uppercase tracking-wide">{txn.planId}</span>
                      </div>
                      <p className="text-sm text-gray-600">User: {txn.email || txn.uid}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {txn.createdAt ? new Date(txn.createdAt.toDate ? txn.createdAt.toDate() : txn.createdAt).toLocaleString() : 'Just now'}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleReject(txn.id)}
                        disabled={actionLoading === txn.id}
                        className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 font-semibold rounded-lg transition-colors flex items-center justify-center min-w-[100px]"
                      >
                        {actionLoading === txn.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reject"}
                      </button>
                      <button 
                        onClick={() => handleApprove(txn)}
                        disabled={actionLoading === txn.id}
                        className="px-4 py-2 bg-green-500 text-white hover:bg-green-600 font-semibold rounded-lg transition-colors flex items-center justify-center min-w-[100px]"
                      >
                        {actionLoading === txn.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Approve"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* API Pool Section */}
        <div className="mt-8 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <Key className="text-purple-600 w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">API Key Pool</h2>
              <p className="text-sm text-gray-500">Add multiple Gemini API keys here. The app will automatically rotate them.</p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex gap-4 items-end bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Label (e.g. Key 1)</label>
                <input 
                  type="text" 
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  placeholder="My First Key"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-200 outline-none"
                />
              </div>
              <div className="flex-[2]">
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">API Key</label>
                <input 
                  type="text" 
                  value={newKey}
                  onChange={e => setNewKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-200 outline-none font-mono text-sm"
                />
              </div>
              <button 
                onClick={handleAddApiKey}
                disabled={!newKey || !newLabel}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-bold px-6 py-2 rounded-lg transition-colors flex items-center gap-2 h-[42px]"
              >
                <Plus size={16} /> Add Key
              </button>
            </div>

            <div className="mt-4">
              {apiKeys.length === 0 ? (
                <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-xl">
                  <Key className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p>No API keys added yet. Add your first key above.</p>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-200 text-sm">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-gray-600">Label</th>
                        <th className="px-4 py-3 font-semibold text-gray-600">API Key</th>
                        <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-sm">
                      {apiKeys.map((k, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium">{k.label}</td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-500">{k.key.substring(0, 10)}...{k.key.substring(k.key.length - 4)}</td>
                          <td className="px-4 py-3">
                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide">
                              {k.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button 
                              onClick={() => handleRemoveApiKey(idx)}
                              className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors inline-flex"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
