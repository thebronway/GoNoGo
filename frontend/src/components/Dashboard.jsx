import React, { useState } from 'react';
import Bubble from './Bubble';
import { TriangleAlert } from 'lucide-react';

const getClientId = () => {
  let id = localStorage.getItem("gonogo_client_id");
  if (!id) {
    id = crypto.randomUUID(); 
    localStorage.setItem("gonogo_client_id", id);
  }
  return id;
};

const Dashboard = () => {
  const [icao, setIcao] = useState('');
  const [plane, setPlane] = useState('small');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const handleAnalyze = async () => {
    if (!icao) return alert("Enter ICAO");
    setLoading(true);
    setError(null);
    
    const payload = { icao: icao, plane_size: plane };

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-ID": getClientId(),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorDetail = "An unexpected error occurred.";
        try {
          const errorData = await response.json();
          if (errorData.detail) errorDetail = errorData.detail;
        } catch (e) {
          errorDetail = `Server error: ${response.status} ${response.statusText}`;
        }
        const customError = new Error(errorDetail);
        customError.apiMessage = errorDetail; 
        throw customError;
      }

      const result = await response.json();
      
      if (result.error) {
        setError(result.error);
      } else {
        setData(result);
      }
      
    } catch (err) {
      if (err.apiMessage) setError(err.apiMessage);
      else if (err.message && err.message !== "Failed to fetch") setError(err.message);
      else setError("Failed to connect to API.");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setIcao('');
    setData(null);
    setError(null);
  };

  const analysis = data?.analysis || {};
  const timeline = analysis.timeline || {};
  const bubbles = analysis.bubbles || {};
  const raw = data?.raw_data || {};

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 pt-4">
      
      {/* SITE DESCRIPTION */}
      <div className="text-center space-y-4 mb-8">
        <h2 className="text-xl md:text-2xl font-light text-blue-200 tracking-tight">
          A Preflight App for Pilots to Decode Weather, Airspace and NOTAMs
        </h2>
        <div className="h-px bg-gradient-to-r from-transparent via-neutral-800 to-transparent w-full my-6"></div>
        <p className="text-neutral-400 text-sm max-w-2xl mx-auto leading-relaxed">
          Enter an Airport ICAO (e.g. <strong className="text-white">KBWI</strong>) or LID code (e.g. <strong className="text-white">2W5</strong>) 
          <br />and select your aircraft profile (crosswind tolerance) below.
        </p>
      </div>

      {/* CONTROLS */}
      <div className="flex flex-col md:flex-row gap-4 md:h-14">
        <input 
          value={icao} 
          onChange={(e) => setIcao(e.target.value.toUpperCase())}
          placeholder="SEARCH..." 
          disabled={data || loading} 
          className="flex-1 bg-neutral-800 border border-neutral-700 text-white text-center font-bold rounded-lg uppercase focus:outline-none focus:border-blue-500 transition-colors p-3 md:p-0 h-12 md:h-full disabled:opacity-50 disabled:cursor-not-allowed"
        />
        
        <div className="flex-1 relative h-12 md:h-full">
            <select 
                value={plane} 
                onChange={(e) => setPlane(e.target.value)}
                disabled={data || loading}
                className="w-full h-full bg-neutral-800 border border-neutral-700 text-white rounded-lg px-4 focus:outline-none focus:border-blue-500 cursor-pointer appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <option value="small">Small (Max X-Wind: 15kts)</option>
                <option value="medium">Medium (Max X-Wind: 20kts)</option>
                <option value="large">Large (Max X-Wind: 30kts)</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-400">▼</div>
        </div>

        <div className={`flex-1 grid gap-2 h-12 md:h-full ${data ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <button 
              onClick={handleAnalyze} 
              disabled={data || loading} 
              className="w-full h-full bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:bg-neutral-700 disabled:text-neutral-500 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? "ANALYZING..." : "ANALYZE"}
            </button>
            {data && (
              <button onClick={handleClear} className="w-full h-full bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors shadow-lg flex items-center justify-center">
                RESET
              </button>
            )}
        </div>
      </div>

      {error && <div className="p-4 bg-red-900/50 text-red-200 border border-red-700 rounded animate-fade-in">{error}</div>}

      {/* RESULTS */}
      {data && analysis && (
        <div className="space-y-8 animate-fade-in">
          
          {/* HEADER */}
          <div className="text-center pt-2 space-y-2">
            <div className="inline-block bg-neutral-800/50 border border-neutral-800 rounded px-3 py-1 mb-4 mt-2">
                <p className="text-[10px] text-neutral-500 uppercase tracking-wide">
                    Disclaimer: AI normalizes data and can make errors. Verify with official sources.
                </p>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
                {data.airport_name || icao}
            </h1>
            <div className="flex flex-col items-center justify-center gap-1 text-xs">
                {raw.weather_source !== icao ? (
                    <>
                        <p className="text-orange-400 font-bold flex items-center justify-center gap-2">
                          <TriangleAlert className="w-4 h-4" /> 
                          <span>Weather Source: {raw.weather_source}</span>
                        </p>
                        <p className="text-neutral-400">Airspace & NOTAMs Source: {icao}</p>
                    </>
                ) : (
                    <p className="text-neutral-500 uppercase tracking-widest font-bold">Mission Target</p>
                )}
            </div>
          </div>

          {/* SUMMARY */}
          <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-6 shadow-xl">
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-3">Mission Summary</h3>
            <p className="text-gray-200 leading-relaxed text-base">{analysis.executive_summary}</p>
          </div>

          {/* TIMELINE */}
          {timeline.t_06 && timeline.t_06 !== "NO_TAF" ? (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-5">
                    <span className="text-blue-400 font-bold text-xs block mb-2 uppercase tracking-wide">Next 6 Hours</span>
                    <p className="text-sm text-gray-300 leading-relaxed">{timeline.t_06}</p>
                </div>
                <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-5">
                    <span className="text-blue-400 font-bold text-xs block mb-2 uppercase tracking-wide">Next 12 Hours</span>
                    <p className="text-sm text-gray-300 leading-relaxed">{timeline.t_12}</p>
                </div>
             </div>
          ) : (
            <div className="p-4 border border-neutral-800 rounded-lg text-center">
                <p className="text-neutral-500 text-sm italic">Forecast (TAF) not available.</p>
            </div>
          )}

          {/* BUBBLES */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Bubble label="CATEGORY" value={analysis.flight_category} highlight={true} />
            <Bubble label="WIND" value={bubbles?.wind || "--"} risk={analysis.wind_risk} />
            <Bubble label="CEILING" value={bubbles?.ceiling || "--"} />
            <Bubble label="VISIBILITY" value={bubbles?.visibility || "--"} />
          </div>

          {/* RAW DATA */}
          <div className="pt-2">
            <details className="group bg-black border border-neutral-800 rounded-lg">
              <summary className="list-none cursor-pointer p-4 text-xs font-bold text-gray-400 hover:text-white transition-colors flex items-center justify-between select-none">
                <span>RAW METAR / TAF</span>
                <span className="text-gray-600 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="px-4 pb-4">
                <pre className="text-green-400 text-xs overflow-x-auto whitespace-pre-wrap font-mono">
                  METAR: {raw.metar}{"\n\n"}TAF: {raw.taf}
                </pre>
              </div>
            </details>
          </div>

          {/* AIRSPACE */}
          <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-6">
            <h3 className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-3">Airspace & TFRs</h3>
            {analysis.airspace_warnings?.length > 0 ? (
                <ul className="list-disc pl-5 text-orange-400 space-y-2 text-sm">
                    {analysis.airspace_warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
            ) : (
                <div className="space-y-2">
                    <p className="text-gray-400 text-sm flex items-start gap-2">
                      <span className="text-yellow-500 font-bold flex items-center gap-1 shrink-0">
                          <TriangleAlert className="w-4 h-4" /> LIMITATION:
                        </span>
                        <span>Only Checked Permanent Prohibited Zones (P-40, DC SFRA, etc).</span>
                    </p>
                    <p className="text-xs text-neutral-500">
                        Check dynamic TFRs at <a href="https://tfr.faa.gov/" target="_blank" rel="noreferrer" className="text-blue-400 underline">tfr.faa.gov</a>
                    </p>
                </div>
            )}
          </div>

          {/* NOTAMS */}
          <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-6">
            <h3 className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-3">Critical NOTAMs</h3>
            {analysis.critical_notams?.length > 0 ? (
                <ul className="list-disc pl-5 text-yellow-200 space-y-2 text-sm">
                    {analysis.critical_notams.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
            ) : (
                <p className="text-gray-500 italic text-sm">No critical NOTAMs flagged.</p>
            )}
          </div>

          {/* RAW NOTAMS */}
          <div className="pb-10">
            <details className="group bg-black border border-neutral-800 rounded-lg">
              <summary className="list-none cursor-pointer p-4 text-xs font-bold text-gray-400 hover:text-white transition-colors flex items-center justify-between select-none">
                <span>VIEW ALL RAW NOTAMS ({raw.notams?.length || 0})</span>
                <span className="text-gray-600 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="px-4 pb-4">
                <div className="h-96 overflow-y-scroll text-green-400 text-xs font-mono p-4 whitespace-pre-wrap">
                  {raw.notams?.filter(n => n.trim().length > 0).join('\n\n\n')} 
                </div>
              </div>
            </details>
          </div>

        </div>
      )}
    </div>
  );
};

export default Dashboard;