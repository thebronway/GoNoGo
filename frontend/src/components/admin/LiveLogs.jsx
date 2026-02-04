import React, { useEffect, useState } from 'react';
import AdminLayout from './AdminLayout';
import api from '../../services/api';
import { Smartphone, Search, ArrowUpDown } from 'lucide-react';

const LiveLogs = () => {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [tz, setTz] = useState("UTC");

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Logs and Settings (for Timezone)
        const [logData, settingsData] = await Promise.all([
            api.get("/api/admin/logs?limit=200"),
            api.get("/api/admin/settings")
        ]);
        
        setLogs(logData);
        
        // Extract Timezone
        if (Array.isArray(settingsData.config)) {
             const foundTz = settingsData.config.find(c => c.key === "app_timezone");
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
    if (!isoString) return "-";
    try {
        return new Date(isoString).toLocaleTimeString('en-US', { timeZone: tz });
    } catch (e) {
        return new Date(isoString).toLocaleTimeString();
    }
  };

  const getStatusColor = (status) => {
    if (status === "CACHE_HIT") return "text-purple-400";
    if (status === "SUCCESS") return "text-green-400";
    if (status === "RATE_LIMIT") return "text-orange-400";
    if (status === "FAIL" || status === "ERROR") return "text-red-400";
    return "text-gray-400";
  };

  // Filter Logic
  const filteredLogs = logs.filter(log => {
      const s = search.toLowerCase();
      return (
          (log.input_icao || "").toLowerCase().includes(s) ||
          (log.client_id || "").toLowerCase().includes(s) ||
          (log.ip_address || "").includes(s) ||
          (log.status || "").toLowerCase().includes(s)
      );
  });

  return (
    <AdminLayout>
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Live Traffic Logs</h1>
            <p className="text-neutral-500 text-sm">Recent analysis requests ({tz})</p>
        </div>
        
        {/* Search Bar */}
        <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-2.5 text-neutral-500 w-4 h-4" />
            <input 
                type="text" 
                placeholder="Search logs..." 
                className="w-full bg-neutral-900 border border-neutral-700 rounded-full pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
        </div>
      </div>

      <div className="border border-neutral-800 rounded bg-neutral-900/20 overflow-x-auto shadow-2xl">
        <table className="w-full text-left whitespace-nowrap text-xs">
            <thead className="bg-neutral-800 text-neutral-400 sticky top-0 uppercase tracking-wider">
            <tr>
                <th className="p-3">Time</th>
                <th className="p-3">Client</th>
                <th className="p-3">IP</th>
                <th className="p-3">Input</th>
                <th className="p-3">Weather</th>
                <th className="p-3">Output</th>
                <th className="p-3">Status</th>
                <th className="p-3">Expire</th>
                <th className="p-3 text-right">Latency</th>
            </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800 text-neutral-300 font-mono">
            {loading ? (
                <tr><td colSpan="9" className="p-8 text-center text-blue-500 animate-pulse">LOADING LOGS...</td></tr>
            ) : filteredLogs.length === 0 ? (
                <tr><td colSpan="9" className="p-8 text-center text-neutral-500">No logs found.</td></tr>
            ) : filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-neutral-800 transition-colors group">
                    <td className="p-3 text-neutral-500">{formatTime(log.timestamp)}</td>
                    <td className="p-3 text-purple-300">
                            {log.client_id && log.client_id !== "UNKNOWN" ? (
                            <div className="flex items-center gap-2" title={log.client_id}>
                                <Smartphone className="w-3 h-3 text-purple-500" />
                                <span>{log.client_id.substring(0, 6)}...</span>
                            </div>
                            ) : <span className="text-gray-600">-</span>}
                    </td>
                    <td className="p-3 text-blue-400/70">{log.ip_address}</td>
                    <td className="p-3 font-bold text-white">{log.input_icao}</td>
                    <td className="p-3 text-yellow-200/80">{log.weather_icao || "-"}</td>
                    <td className="p-3 text-blue-200/80">{log.resolved_icao}</td>
                    <td className={`p-3 font-bold ${getStatusColor(log.status)}`}>{log.status}</td>
                    <td className="p-3 text-neutral-500">
                        {log.expiration_timestamp ? formatTime(log.expiration_timestamp) : "-"}
                    </td>
                    <td className="p-3 text-right text-neutral-500">{log.duration_seconds?.toFixed(3)}s</td>
                </tr>
            ))}
            </tbody>
        </table>
      </div>
    </AdminLayout>
  );
};

export default LiveLogs;