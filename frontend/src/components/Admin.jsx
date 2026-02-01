import React, { useEffect, useState } from 'react';

const Admin = () => {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const logRes = await fetch("/api/logs?limit=200");
        if (!logRes.ok) throw new Error("Failed to fetch logs");
        const logData = await logRes.json();
        setLogs(logData);

        const statRes = await fetch("/api/stats");
        if (statRes.ok) {
            const statData = await statRes.json();
            setStats(statData);
        }

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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
    // CHANGED: Increased min-w from 160px to 220px for more room
    <div className="bg-neutral-900 border border-neutral-800 p-4 rounded flex flex-col gap-3 min-w-[220px]">
        
        <h3 className="text-blue-400 font-bold text-xs uppercase tracking-widest border-b border-neutral-800 pb-2 mb-1">{title}</h3>
        
        <div>
            <span className="text-[10px] text-neutral-500 uppercase block">Total Requests</span>
            <span className="text-2xl font-mono text-white">{data?.total || 0}</span>
        </div>

        {/* Breakdown Grid */}
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

        {/* Secondary Stats */}
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
                <span className="text-[10px] text-neutral-500 uppercase">Top IP</span>
                {/* CHANGED: Increased max-w from w-24 to max-w-[150px] */}
                <span className="text-xs font-mono text-gray-400 truncate max-w-[150px] text-right" title={data?.top_ip}>
                    {data?.top_ip || "-"}
                </span>
            </div>

            <div className="flex justify-between items-baseline border-t border-neutral-800 pt-2">
                <span className="text-[10px] text-orange-500 uppercase font-bold">Most Blocked</span>
                {/* CHANGED: Increased max-w from w-24 to max-w-[150px] */}
                <span className="text-xs font-mono text-orange-400 truncate max-w-[150px] text-right" title={data?.top_blocked}>
                    {data?.top_blocked || "-"}
                </span>
            </div>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black p-4 md:p-8 font-mono text-xs text-gray-300">
      
      {/* HEADER */}
      <div className="flex justify-between items-end mb-8 border-b border-neutral-800 pb-4">
        <div>
            <h1 className="text-3xl font-black text-white tracking-tighter mb-1">COMMAND DECK</h1>
            <p className="text-xs text-neutral-500">SYSTEM METRICS & LOGS // ACCESS RESTRICTED</p>
        </div>
        <div className="text-right">
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-500 font-bold">LIVE</span>
             </div>
        </div>
      </div>
      
      {loading && <div className="text-blue-400 animate-pulse text-lg">ESTABLISHING UPLINK...</div>}
      {error && <div className="text-red-500 font-bold border border-red-500 p-4 rounded bg-red-900/10">CONNECTION FAILED: {error}</div>}

      {!loading && !error && (
        <div className="space-y-8 animate-fade-in">
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatColumn title="24 HOURS" data={stats['24h']} />
                <StatColumn title="7 DAYS" data={stats['7d']} />
                <StatColumn title="30 DAYS" data={stats['30d']} />
                <StatColumn title="ALL TIME" data={stats['All']} />
            </div>
          )}

          <div>
            <h2 className="text-sm font-bold text-neutral-500 mb-3 uppercase tracking-wider">Recent Transmissions ({logs.length})</h2>
            <div className="border border-neutral-800 rounded bg-neutral-900/20 overflow-x-auto shadow-2xl">
                <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-neutral-800 text-neutral-400 sticky top-0">
                    <tr>
                        <th className="p-3">TIME</th>
                        <th className="p-3">IP</th>
                        <th className="p-3">INPUT</th>
                        <th className="p-3">RESOLVED</th>
                        <th className="p-3">STATUS</th>
                        <th className="p-3">LATENCY</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800 text-neutral-300">
                    {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-neutral-800 transition-colors group">
                        <td className="p-3 text-neutral-500 font-mono">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="p-3 text-blue-400/70 group-hover:text-blue-300 font-mono">{log.ip_address}</td>
                        <td className="p-3 font-bold text-white">{log.input_icao}</td>
                        <td className="p-3 text-neutral-500">{log.resolved_icao || "-"}</td>
                        <td className={`p-3 font-bold ${getStatusColor(log.status)}`}>{log.status}</td>
                        <td className="p-3 font-mono text-neutral-400">{log.duration_seconds ? log.duration_seconds.toFixed(3) : '0.000'}s</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;