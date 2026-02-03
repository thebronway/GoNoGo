import React, { useEffect, useState } from 'react';
import AdminLayout from './AdminLayout';
import { Smartphone, Monitor } from 'lucide-react';

const AdminDashboard = () => {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tz, setTz] = useState("UTC");

  useEffect(() => {
    const fetchData = async () => {
      const key = localStorage.getItem("gonogo_admin_key");
      const headers = { "X-Admin-Key": key };

      try {
        const [logRes, statRes, setRes] = await Promise.all([
            fetch("/api/logs?limit=100", { headers }),
            fetch("/api/stats", { headers }),
            fetch("/api/admin/settings", { headers })
        ]);
        
        if (logRes.ok) setLogs(await logRes.json());
        if (statRes.ok) setStats(await statRes.json());
        if (setRes.ok) {
            const sData = await setRes.json();
            // Handle both structure possibilities safely
            let foundTz = null;
            if (Array.isArray(sData.config)) {
                 foundTz = sData.config.find(c => c.key === "app_timezone");
            }
            if (foundTz) setTz(foundTz.value);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatTime = (isoString) => {
    try {
        return new Date(isoString).toLocaleTimeString('en-US', { timeZone: tz });
    } catch (e) {
        return new Date(isoString).toLocaleTimeString(); // Fallback
    }
  };

  const getStatusColor = (status) => {
    if (status === "CACHE_HIT") return "text-purple-400";
    if (status === "SUCCESS") return "text-green-400";
    if (status === "RATE_LIMIT") return "text-orange-400";
    if (status === "FAIL" || status === "ERROR") return "text-red-400";
    return "text-gray-400";
  };

  const getPct = (val, total) => {
    if (!total || total === 0) return "0%";
    return Math.round((val / total) * 100) + "%";
  };

  const StatColumn = ({ title, data }) => (
    <div className="bg-neutral-900 border border-neutral-800 p-4 rounded flex flex-col gap-3 min-w-[220px]">
        <h3 className="text-blue-400 font-bold text-xs uppercase tracking-widest border-b border-neutral-800 pb-2 mb-1">{title}</h3>
        <div>
            <span className="text-[10px] text-neutral-500 uppercase block">Total Requests</span>
            <span className="text-2xl font-mono text-white">{data?.total || 0}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] bg-neutral-950/50 p-2 rounded border border-neutral-800/50">
            <div className="text-green-500 font-bold">SUCCESS</div>
            <div className="text-right text-gray-400">
                {data?.breakdown?.success || 0} <span className="text-neutral-600">({getPct(data?.breakdown?.success, data?.total)})</span>
            </div>
            <div className="text-purple-400 font-bold">CACHE</div>
            <div className="text-right text-gray-400">
                {data?.breakdown?.cache || 0} <span className="text-neutral-600">({getPct(data?.breakdown?.cache, data?.total)})</span>
            </div>
            <div className="text-orange-400 font-bold">LIMIT</div>
            <div className="text-right text-gray-400">
                {data?.breakdown?.limit || 0} <span className="text-neutral-600">({getPct(data?.breakdown?.limit, data?.total)})</span>
            </div>
            <div className="text-red-500 font-bold">FAIL</div>
            <div className="text-right text-gray-400">
                {data?.breakdown?.fail || 0} <span className="text-neutral-600">({getPct(data?.breakdown?.fail, data?.total)})</span>
            </div>
        </div>
        <div className="space-y-2 mt-1">
            <div className="flex justify-between items-baseline">
                <span className="text-[10px] text-neutral-500 uppercase">Avg Speed</span>
                <span className="text-xs font-mono text-green-400">{data?.avg_latency || 0}s</span>
            </div>
            <div className="flex justify-between items-baseline">
                <span className="text-[10px] text-neutral-500 uppercase">Top Apt</span>
                <span className="text-xs font-mono text-yellow-400">{data?.top_airport || "-"}</span>
            </div>
            <div className="flex justify-between items-baseline">
                <span className="text-[10px] text-neutral-500 uppercase">Top Client</span>
                <span className="text-xs font-mono text-gray-400 truncate max-w-[120px]" title={data?.top_user}>
                    {data?.top_user || "-"}
                </span>
            </div>
            <div className="flex justify-between items-baseline border-t border-neutral-800 pt-2">
                <span className="text-[10px] text-orange-500 uppercase font-bold">Most Blocked</span>
                <span className="text-xs font-mono text-orange-400 truncate max-w-[120px]" title={data?.top_blocked}>
                    {data?.top_blocked || "-"}
                </span>
            </div>
        </div>
    </div>
  );

  return (
    <AdminLayout>
      {loading ? <div className="text-blue-500 animate-pulse">LOADING METRICS...</div> : (
        <div className="space-y-8 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {stats && ["1h", "24h", "7d", "30d", "60d", "90d"].map(key => (
               stats[key] ? <StatColumn key={key} title={key} data={stats[key]} /> : null
            ))}
          </div>

          <div>
            <h2 className="text-sm font-bold text-neutral-500 mb-3 uppercase tracking-wider">Recent Live Logs ({tz})</h2>
            <div className="border border-neutral-800 rounded bg-neutral-900/20 overflow-x-auto shadow-2xl">
                <table className="w-full text-left whitespace-nowrap text-xs">
                    <thead className="bg-neutral-800 text-neutral-400 sticky top-0">
                    <tr>
                        <th className="p-3">TIME</th>
                        <th className="p-3">CLIENT ID</th>
                        <th className="p-3">IP ADDRESS</th>
                        <th className="p-3">INPUT</th>
                        <th className="p-3">STATUS</th>
                        <th className="p-3">LATENCY</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800 text-neutral-300 font-mono">
                    {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-neutral-800 transition-colors group">
                        <td className="p-3 text-neutral-500">{formatTime(log.timestamp)}</td>
                        <td className="p-3 text-purple-300">
                             {log.client_id && log.client_id !== "UNKNOWN" ? (
                                <div className="flex items-center gap-2" title={log.client_id}>
                                    <Smartphone className="w-3 h-3 text-purple-500" />
                                    <span>{log.client_id.substring(0, 8)}...</span>
                                </div>
                             ) : (
                                <span className="text-gray-600">-</span>
                             )}
                        </td>
                        <td className="p-3 text-blue-400/70 group-hover:text-blue-300">{log.ip_address}</td>
                        <td className="p-3 font-bold text-white">{log.input_icao}</td>
                        <td className={`p-3 font-bold ${getStatusColor(log.status)}`}>{log.status}</td>
                        <td className="p-3 text-neutral-500">{log.duration_seconds?.toFixed(3)}s</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminDashboard;