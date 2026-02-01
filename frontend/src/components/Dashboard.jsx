import React, { useState } from 'react';
import Bubble from './Bubble';


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
    
    const payload = { 
      icao: icao, 
      plane_size: plane 
    };

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-ID": getClientId(), // <--- NEW: Sends your "Digital Badge"
        },
        body: JSON.stringify(payload),
      });

      // --- ERROR HANDLING LOGIC ---
      if (!response.ok) {
        // 1. Attempt to parse the custom JSON error from the backend
        let errorDetail = "An unexpected error occurred.";
        try {
          const errorData = await response.json();
          if (errorData.detail) {
            errorDetail = errorData.detail;
          }
        } catch (parseError) {
          // If the backend didn't send JSON (e.g., server crash), keep generic message
          errorDetail = `Server error: ${response.status} ${response.statusText}`;
        }

        // 2. Throw an error object that contains the specific message
        const customError = new Error(errorDetail);
        customError.apiMessage = errorDetail; 
        throw customError;
      }
      // --------------------------------

      const result = await response.json();
      
      if (result.error) {
        setError(result.error);
      } else {
        setData(result);
      }
      
    } catch (err) {
      console.error("Full Error Object:", err);
      
      // 3. Check for our custom property 'apiMessage'
      if (err.apiMessage) {
        setError(err.apiMessage);
      } else if (err.message && err.message !== "Failed to fetch") {
        setError(err.message);
      } else {
        setError("Failed to connect to API. Ensure Docker is running.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setIcao('');
    setData(null);
    setError(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      
      {/* CONTROLS */}
      <div className="flex flex-col md:flex-row gap-4 md:h-14">
        <input 
          value={icao} 
          onChange={(e) => setIcao(e.target.value.toUpperCase())}
          placeholder="SEARCH (ex. KBWI, 2W5)" 
          disabled={data || loading} // Lock when data exists
          className="flex-1 bg-neutral-800 border border-neutral-700 text-white text-center font-bold rounded-lg uppercase focus:outline-none focus:border-blue-500 transition-colors p-3 md:p-0 h-12 md:h-full disabled:opacity-50 disabled:cursor-not-allowed"
        />
        
        <div className="flex-1 relative h-12 md:h-full">
            <select 
                value={plane} 
                onChange={(e) => setPlane(e.target.value)}
                disabled={data || loading} // Lock when data exists
                className="w-full h-full bg-neutral-800 border border-neutral-700 text-white rounded-lg px-4 focus:outline-none focus:border-blue-500 cursor-pointer appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <option value="small">Small (Max X-Wind: 15kts)</option>
                <option value="medium">Medium (Max X-Wind: 20kts)</option>
                <option value="large">Large (Max X-Wind: 30kts)</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-400">▼</div>
        </div>

        <div className={`flex-1 grid gap-2 h-12 md:h-full ${data ? 'grid-cols-2' : 'grid-cols-1'}`}>
            
            {/* ANALYZE BUTTON */}
            <button 
              onClick={handleAnalyze} 
              disabled={data || loading} 
              className="w-full h-full bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:bg-neutral-700 disabled:text-neutral-500 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>ANALYZING...</span>
                </>
              ) : (
                "ANALYZE"
              )}
            </button>
            
            {/* RESET BUTTON */}
            {data && (
              <button 
                onClick={handleClear}
                className="w-full h-full bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors shadow-lg flex items-center justify-center"
              >
                RESET
              </button>
            )}
        </div>
      </div>

      {error && <div className="p-4 bg-red-900/50 text-red-200 border border-red-700 rounded animate-fade-in">{error}</div>}

      {/* RESULTS */}
      {data && data.analysis && (
        <div className="space-y-8 animate-fade-in">
          
          {/* HEADER SECTION */}
          <div className="text-center pt-2 space-y-2">
            
            {/* DISCLAIMER - Updated Text & Spacing */}
            <div className="inline-block bg-neutral-800/50 border border-neutral-800 rounded px-3 py-1 mb-4 mt-2">
                <p className="text-[10px] text-neutral-500 uppercase tracking-wide">
                    Disclaimer: AI normalizes data and can make errors. Verify with official sources.
                </p>
            </div>

            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
                {data.airport_name || icao}
            </h1>
            
            {/* SOURCE TRANSPARENCY */}
            <div className="flex flex-col items-center justify-center gap-1 text-xs">
                {data.raw_data.weather_source !== icao ? (
                    <>
                        <p className="text-orange-400 font-bold">⚠️ Weather Source: {data.raw_data.weather_source}</p>
                        <p className="text-neutral-400">Airspace & NOTAMs Source: {icao}</p>
                    </>
                ) : (
                    <p className="text-neutral-500 uppercase tracking-widest font-bold">Mission Target</p>
                )}
            </div>
          </div>

          {/* MISSION SUMMARY (Current Conditions + Airspace + Notams) */}
          <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-6 shadow-xl">
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-3">Mission Summary</h3>
            <p className="text-gray-200 leading-relaxed text-base">{data.analysis.executive_summary}</p>
          </div>

          {/* TIMELINE (Hidden if NO TAF) */}
          {data.analysis.timeline.t_06 !== "NO_TAF" ? (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-5">
                    <span className="text-blue-400 font-bold text-xs block mb-2 uppercase tracking-wide">Next 6 Hours</span>
                    <p className="text-sm text-gray-300 leading-relaxed">{data.analysis.timeline.t_06}</p>
                </div>
                <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-5">
                    <span className="text-blue-400 font-bold text-xs block mb-2 uppercase tracking-wide">Next 12 Hours</span>
                    <p className="text-sm text-gray-300 leading-relaxed">{data.analysis.timeline.t_12}</p>
                </div>
             </div>
          ) : (
            <div className="p-4 border border-neutral-800 rounded-lg text-center">
                <p className="text-neutral-500 text-sm italic">Forecast (TAF) not available for this station.</p>
            </div>
          )}

          {/* BUBBLES (Spelled Out Labels + Wind Risk) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Bubble label="CATEGORY" value={data.analysis.flight_category} highlight={true} />
            
            {/* Pass the new wind_risk data here */}
            <Bubble 
                label="WIND" 
                value={data.analysis.bubbles.wind} 
                risk={data.analysis.wind_risk} 
            />
            
            <Bubble label="CEILING" value={data.analysis.bubbles.ceiling} />
            <Bubble label="VISIBILITY" value={data.analysis.bubbles.visibility} />
          </div>

          {/* RAW METAR/TAF */}
          <div className="pt-2">
            <details className="group bg-black border border-neutral-800 rounded-lg">
              <summary className="list-none cursor-pointer p-4 text-xs font-bold text-gray-400 hover:text-white transition-colors flex items-center justify-between select-none">
                <span>RAW METAR / TAF</span>
                <span className="text-gray-600 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="px-4 pb-4">
                <pre className="text-green-400 text-xs overflow-x-auto whitespace-pre-wrap font-mono">
                  METAR: {data.raw_data.metar}{"\n\n"}TAF: {data.raw_data.taf}
                </pre>
              </div>
            </details>
          </div>

          {/* AIRSPACE */}
          <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-6">
            <h3 className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-3">Airspace & TFRs</h3>
            {data.analysis.airspace_warnings && data.analysis.airspace_warnings.length > 0 ? (
                <ul className="list-disc pl-5 text-orange-400 space-y-2 text-sm">
                    {data.analysis.airspace_warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
            ) : (
                <div className="space-y-2">
                    <p className="text-gray-400 text-sm">
                        <span className="text-yellow-500 font-bold">⚠️ LIMITATION:</span> Checked Permanent Prohibited Zones only (P-40, DC SFRA, etc).
                    </p>
                    <p className="text-xs text-neutral-500">
                        This tool DOES NOT check dynamic TFRs (VIP, Fire, Stadiums). 
                        <a href="https://tfr.faa.gov/" target="_blank" rel="noreferrer" className="text-blue-400 underline ml-1 hover:text-blue-300">
                            Verify officially at tfr.faa.gov
                        </a>
                    </p>
                </div>
            )}
          </div>

          {/* NOTAMs (Summary) */}
          <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-6">
            <h3 className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-3">Critical NOTAMs</h3>
            {data.analysis.critical_notams && data.analysis.critical_notams.length > 0 ? (
                <ul className="list-disc pl-5 text-yellow-200 space-y-2 text-sm">
                    {data.analysis.critical_notams.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
            ) : (
                <p className="text-gray-500 italic text-sm">No critical NOTAMs flagged.</p>
            )}
          </div>

          {/* RAW NOTAMS - Fixed: Single text block with explicit double line breaks */}
          <div className="pb-10">
            <details className="group bg-black border border-neutral-800 rounded-lg">
              <summary className="list-none cursor-pointer p-4 text-xs font-bold text-gray-400 hover:text-white transition-colors flex items-center justify-between select-none">
                <span>VIEW ALL RAW NOTAMS ({data.raw_data.notams.filter(n => n.trim().length > 0).length})</span>
                <span className="text-gray-600 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              
              <div className="px-4 pb-4">
                <div className="h-96 overflow-y-scroll text-green-400 text-xs font-mono p-4 whitespace-pre-wrap">
                  {data.raw_data.notams
                    .filter(notam => notam && notam.trim().length > 0) // Remove ghosts
                    .join('\n\n\n')} 
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