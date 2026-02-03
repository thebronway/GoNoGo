import React, { useEffect, useState } from 'react';
import AdminLayout from './AdminLayout';
import { Search, ShieldAlert, ShieldCheck, Unlock, Smartphone, Monitor } from 'lucide-react';

const IpManager = () => {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Helper for Headers
  const getHeaders = () => ({
      "Content-Type": "application/json",
      "X-Admin-Key": localStorage.getItem("gonogo_admin_key")
  });

  const fetchClients = async () => {
    try {
      const res = await fetch("/api/admin/clients", { headers: getHeaders() });
      if (res.ok) setClients(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleUnblock = async (key) => {
    if (!confirm(`Unblock User?`)) return;
    try {
      // 1. Optimistic Update
      setClients(prev => prev.map(client => 
        client.limit_key === key ? { ...client, is_limited: false } : client
      ));

      // 2. Perform Request
      const res = await fetch("/api/admin/unblock", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ key })
      });
      
      // 3. Refresh Real Data
      if (res.ok) fetchClients(); 
    } catch (err) {
      alert("Failed to unblock");
      fetchClients(); // Revert on error
    }
  };

  const filtered = clients.filter(item => 
      (item.client_id || "").toLowerCase().includes(search.toLowerCase()) || 
      (item.last_ip || "").includes(search)
  );

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold text-white">Client & Traffic Manager</h2>
        <div className="relative">
            <Search className="absolute left-3 top-2.5 text-neutral-500 w-4 h-4" />
            <input 
                type="text" 
                placeholder="Search ID or IP..." 
                className="bg-neutral-900 border border-neutral-700 rounded-full pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 w-64"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
        </div>
      </div>

      <div className="border border-neutral-800 rounded bg-neutral-900/20 overflow-hidden">
        <table className="w-full text-left text-xs">
            <thead className="bg-neutral-800 text-neutral-400 uppercase tracking-wider">
                <tr>
                    <th className="p-4">Client Identity</th>
                    <th className="p-4">Last Known IP</th>
                    <th className="p-4">Requests</th>
                    <th className="p-4">Blocks</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Action</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800 text-gray-300">
                {filtered.map((row) => (
                    <tr key={row.limit_key} className="hover:bg-neutral-800/50">
                        <td className="p-4 font-mono text-blue-400">
                            <div className="flex items-center gap-2">
                                {row.client_id && row.client_id !== "UNKNOWN" ? (
                                    <>
                                        <Smartphone className="w-3 h-3 text-purple-400" />
                                        <span title={row.client_id}>{row.client_id.substring(0, 12)}...</span>
                                    </>
                                ) : (
                                    <>
                                        <Monitor className="w-3 h-3 text-gray-500" />
                                        <span className="italic text-gray-500">No ID (IP Fallback)</span>
                                    </>
                                )}
                            </div>
                        </td>
                        <td className="p-4 font-mono text-gray-400">{row.last_ip}</td>
                        <td className="p-4 font-bold text-white">{row.total}</td>
                        <td className="p-4 text-orange-400">{row.blocked_count}</td>
                        <td className="p-4">
                            {row.is_limited ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-900/30 text-red-400 border border-red-900 text-[10px] font-bold uppercase">
                                    <ShieldAlert className="w-3 h-3" /> Rate Limited
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-900/30 text-green-400 border border-green-900 text-[10px] font-bold uppercase">
                                    <ShieldCheck className="w-3 h-3" /> Active
                                </span>
                            )}
                        </td>
                        <td className="p-4 text-right">
                            {row.is_limited && (
                                <button 
                                    onClick={() => handleUnblock(row.limit_key)}
                                    className="text-white bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-[10px] font-bold uppercase inline-flex items-center gap-1"
                                >
                                    <Unlock className="w-3 h-3" /> Unblock
                                </button>
                            )}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
        {filtered.length === 0 && !loading && (
            <div className="p-8 text-center text-neutral-500">No clients found.</div>
        )}
      </div>
    </AdminLayout>
  );
};

export default IpManager;