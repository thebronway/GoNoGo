import React, { useEffect, useState } from 'react';
import AdminLayout from './AdminLayout';
import api from '../../services/api';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch stats on mount (refreshing page re-triggers this)
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await api.get("/api/admin/stats");
        setStats(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const getPct = (val, total) => {
    if (!total || total === 0) return "0%";
    return Math.round((val / total) * 100) + "%";
  };

  const StatColumn = ({ title, data }) => (
    <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-xl flex flex-col gap-4 min-w-[220px]">
        <h3 className="text-blue-400 font-bold text-sm uppercase tracking-widest border-b border-neutral-800 pb-2 mb-1">{title}</h3>
        <div>
            <span className="text-xs text-neutral-500 uppercase block font-bold">Total Requests</span>
            {/* BIGGER FONT SIZE AS REQUESTED */}
            <span className="text-5xl font-black text-white tracking-tighter">{data?.total || 0}</span>
        </div>
        
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs bg-neutral-950/50 p-3 rounded border border-neutral-800/50">
            <div className="text-green-500 font-bold">SUCCESS</div>
            <div className="text-right text-gray-400 font-mono">
                {data?.breakdown?.success || 0} <span className="text-neutral-600">({getPct(data?.breakdown?.success, data?.total)})</span>
            </div>
            <div className="text-purple-400 font-bold">CACHE</div>
            <div className="text-right text-gray-400 font-mono">
                {data?.breakdown?.cache || 0} <span className="text-neutral-600">({getPct(data?.breakdown?.cache, data?.total)})</span>
            </div>
            <div className="text-orange-400 font-bold">LIMIT</div>
            <div className="text-right text-gray-400 font-mono">
                {data?.breakdown?.limit || 0} <span className="text-neutral-600">({getPct(data?.breakdown?.limit, data?.total)})</span>
            </div>
            <div className="text-red-500 font-bold">FAIL</div>
            <div className="text-right text-gray-400 font-mono">
                {data?.breakdown?.fail || 0} <span className="text-neutral-600">({getPct(data?.breakdown?.fail, data?.total)})</span>
            </div>
        </div>

        <div className="space-y-3 mt-2">
            <div className="flex justify-between items-baseline">
                <span className="text-xs text-neutral-500 uppercase font-bold">Avg Speed</span>
                <span className="text-sm font-mono text-green-400">{data?.avg_latency || 0}s</span>
            </div>
            <div className="flex justify-between items-baseline">
                <span className="text-xs text-neutral-500 uppercase font-bold">Top Apt</span>
                <span className="text-sm font-mono text-yellow-400">{data?.top_airport || "-"}</span>
            </div>
            <div className="flex justify-between items-baseline">
                <span className="text-xs text-neutral-500 uppercase font-bold">Top Client</span>
                <span className="text-sm font-mono text-gray-400 truncate max-w-[120px]" title={data?.top_user}>
                    {data?.top_user || "-"}
                </span>
            </div>
            <div className="flex justify-between items-baseline border-t border-neutral-800 pt-2">
                <span className="text-xs text-orange-500 uppercase font-bold">Most Blocked</span>
                <span className="text-sm font-mono text-orange-400 truncate max-w-[120px]" title={data?.top_blocked}>
                    {data?.top_blocked || "-"}
                </span>
            </div>
        </div>
    </div>
  );

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">System Statistics</h1>
        <p className="text-neutral-500 text-sm">Real-time performance metrics.</p>
      </div>

      {loading ? <div className="text-blue-500 animate-pulse">LOADING METRICS...</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-fade-in">
            {stats && ["1h", "24h", "7d", "30d", "60d", "90d"].map(key => (
               stats[key] ? <StatColumn key={key} title={key} data={stats[key]} /> : null
            ))}
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminDashboard;