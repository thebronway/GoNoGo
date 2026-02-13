import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Bubble from './Bubble';
import SEO from './SEO';
import ReportModal from './ReportModal';
import { TriangleAlert, Clock, Flag, Info } from 'lucide-react';

const getClientId = () => {
  let id = localStorage.getItem("gonogo_client_id");
  if (!id) {
    id = crypto.randomUUID(); 
    localStorage.setItem("gonogo_client_id", id);
  }
  return id;
};

// Helper to parse METAR time (Time Only, No Date)
const getMetarTime = (metarString, timezone) => {
  if (!metarString) return null;
  const match = metarString.match(/\b(\d{2})(\d{2})(\d{2})Z\b/);
  if (!match) return null;

  const [_, day, hour, minute] = match;
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), parseInt(day), parseInt(hour), parseInt(minute)));
  
  if (parseInt(day) > now.getUTCDate() + 1) {
      date.setUTCMonth(date.getUTCMonth() - 1);
  }

  const utcString = date.toLocaleTimeString('en-US', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false });
  const localString = date.toLocaleTimeString('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short' });

  return { utc: `${utcString}Z`, local: localString };
};

// Helper to format Raw TAF for readability
const formatTaf = (tafText) => {
    if (!tafText) return "";
    // Insert newlines before standard forecast change indicators to ensure full list is readable
    return tafText.replace(/(FM\d{6}|BECMG|TEMPO|PROB\d{2})/g, '\n$1');
};

const Dashboard = ({ onSearchStateChange }) => {
  const [icao, setIcao] = useState('');
  const [plane, setPlane] = useState('small');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    if (onSearchStateChange) onSearchStateChange(false);
  }, []);

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
        if (onSearchStateChange) onSearchStateChange(true);
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
    if (onSearchStateChange) onSearchStateChange(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleAnalyze();
    }
  };

  const analysis = data?.analysis || {};
  const timeline = analysis.timeline || {};
  const bubbles = analysis.bubbles || {};
  const raw = data?.raw_data || {};
  const target = icao ? icao.toUpperCase() : "";
  const source = raw.weather_source ? raw.weather_source.toUpperCase() : "";
  const isDifferent = source && target && source !== target && source !== "K" + target;
  
  const metarTimes = getMetarTime(raw.metar, data?.airport_tz || 'UTC');

  const ReportButton = () => (
    <button 
        onClick={() => setShowReport(true)}
        className="text-[10px] flex items-center gap-1 text-neutral-600 hover:text-red-400 transition-colors ml-auto"
        title="Report hallucination or error"
    >
        <Flag size={10} /> Report Issue
    </button>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 pt-4">
      <SEO 
        title="WxDecoder - Aviation Weather Analysis"
        description="Instant plain-English weather analysis for pilots. Decode METARs, TAFs, Airspace, and NOTAMs with AI. Free flight planning tool."
        path="/"
      />
      
      <div className="text-center space-y-4 mb-8">
        <h2 className="text-xl md:text-2xl font-light text-blue-200 tracking-tight">
          A Situational Awareness Tool for Pilots to Decode Weather, Airspace, & NOTAMs
        </h2>
        <div className="h-px bg-gradient-to-r from-transparent via-neutral-800 to-transparent w-full my-6"></div>
        <p className="text-neutral-400 text-sm max-w-2xl mx-auto leading-relaxed">
          Enter an Airport ICAO code (e.g. <strong className="text-white">KBOS</strong>) or LID code (e.g. <strong className="text-white">2W5</strong>) and select a crosswind tolerance below.
          <br />Searches for airports without METARs may take up to 30 seconds.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 md:h-14">
        <input 
          value={icao} 
          onChange={(e) => setIcao(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          placeholder="SEARCH..." 
          disabled={data || loading} 
          className="flex-1 bg-neutral-800 border border-neutral-700 text-white text-center font-bold rounded-lg uppercase focus:outline-none focus:border-blue-500 transition-colors p-3 md:p-0 h-12 md:h-full disabled:opacity-50 disabled:cursor-not-allowed"
        />
        
        <div className="flex-1 relative h-12 md:h-full">
            <select 
                value={plane} 
                onChange={(e) => setPlane(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={data || loading}
                className="w-full h-full bg-neutral-800 border border-neutral-700 text-white rounded-lg pl-4 pr-12 focus:outline-none focus:border-blue-500 cursor-pointer appearance-none disabled:opacity-50 disabled:cursor-not-allowed text-ellipsis overflow-hidden whitespace-nowrap"
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

      {data && analysis && (
        <div className="space-y-8 animate-fade-in">
          
          <div className="text-center pt-2 space-y-2">
            
            <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-3 mb-2 mx-auto max-w-2xl">
                <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
                    <TriangleAlert className="w-3 h-3 text-red-500" />
                    <span className="font-bold text-red-500">DISCLAIMER:</span> 
                    <span>AI normalizes data and can make errors. Always verify with official sources.</span>
                    <Link to="/disclaimer" className="underline ml-1 hover:text-white">Read full policy</Link>
                </p>
            </div>

            {data.is_cached && (
                <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-3 mb-4 mx-auto max-w-2xl animate-fade-in">
                    <div className="flex flex-col md:flex-row items-center justify-center gap-2 text-xs text-gray-400">
                        <span className="font-bold flex items-center gap-1 uppercase tracking-wider text-yellow-500">
                            <Clock className="w-3 h-3" /> Cached Summary:
                        </span>
                        <span>
                            Report retrieved recently. METAR unchanged. 
                            <span className="ml-1 text-neutral-500">Does not count towards rate limits.</span>
                        </span>
                    </div>
                </div>
            )}
            
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight py-4">
                {data.airport_name || icao}
            </h1>

            {/* METAR TIME & SOURCE DISPLAY (Updated Layout) */}
            {metarTimes && (
                <div className="flex flex-col items-center gap-2 mb-8">
                    
                    {/* SPECI ALERT */}
                    {raw.metar?.includes("SPECI") && (
                        <div className="mb-1 animate-pulse shadow-[0_0_15px_rgba(234,179,8,0.4)] bg-yellow-900/40 text-yellow-500 border border-yellow-700/50 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                             <TriangleAlert className="w-3 h-3" /> Special / Unscheduled METAR
                        </div>
                    )}

                    {/* BLUE BUBBLE: Standard Time Display */}
                    <div className="inline-flex items-center justify-center gap-2 text-xs font-mono text-blue-200 bg-blue-900/20 px-6 py-2 rounded-full border border-blue-900/30 shadow-lg shadow-blue-900/10">
                         <Clock className="w-3 h-3 text-blue-500" />
                         <span className="text-[10px] uppercase tracking-widest text-blue-500 font-bold mr-1">METAR Generated:</span>
                         <span title="Observation Time (UTC)">
                            <span className="text-blue-500">UTC</span> {metarTimes.utc}
                        </span>
                        <span className="w-px h-3 bg-blue-800/50 mx-1"></span>
                        <span title={`Local Time (${data.airport_tz})`}>
                            <span className="text-blue-500">Local</span> {metarTimes.local}
                        </span>
                    </div>

                    {/* YELLOW BUBBLE: Source (Stacked, Styled like Blue) */}
                    {raw.weather_dist > 0 && (
                        <div className="inline-flex items-center justify-center gap-2 text-xs font-mono text-yellow-200 bg-yellow-900/30 px-6 py-2 rounded-full border border-yellow-700/50 shadow-lg animate-fade-in">
                             <Info className="w-3 h-3 text-yellow-500" />
                             <span className="text-[10px] uppercase tracking-widest text-yellow-500 font-bold mr-1">METAR Source:</span>
                             <span>{raw.weather_name} ({raw.weather_source})</span>
                             <span className="w-px h-3 bg-yellow-700/50 mx-1"></span>
                             <span className="text-[10px] uppercase tracking-widest text-yellow-500 font-bold mr-1">Dist:</span>
                             <span>{raw.weather_dist}nm</span>
                        </div>
                    )}
                </div>
            )}
          </div>

          <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-6 relative">
            <div className="flex justify-between items-start mb-3">
                 <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Briefing Overview</h3>
                 <ReportButton />
            </div>
            
            <div className="text-gray-200 leading-relaxed text-base space-y-5">
                
                {/* WEATHER */}
                <div>
                    <h4 className="font-bold text-blue-400 mb-2 uppercase tracking-widest text-xs border-b border-neutral-700 pb-1">
                        CURRENT WEATHER {isDifferent ? `(${source})` : ""}
                    </h4>
                    <p>{analysis.summary_weather || "No weather summary available."}</p>
                </div>

                {/* CROSSWIND */}
                <div>
                    <h4 className="font-bold text-blue-400 mb-2 uppercase tracking-widest text-xs border-b border-neutral-700 pb-1">
                         CROSSWIND
                    </h4>
                    <p>{analysis.summary_crosswind || "No crosswind data."}</p>
                </div>

                {/* AIRSPACE */}
                <div>
                    <h4 className="font-bold text-blue-400 mb-2 uppercase tracking-widest text-xs border-b border-neutral-700 pb-1">
                         AIRSPACE
                    </h4>
                    <p>{analysis.summary_airspace || "No airspace warnings."}</p>
                </div>

                {/* NOTAMS */}
                <div>
                    <h4 className="font-bold text-blue-400 mb-2 uppercase tracking-widest text-xs border-b border-neutral-700 pb-1">
                         NOTABLE NOTAMS
                    </h4>
                    <p>{analysis.summary_notams || "No critical NOTAMs found."}</p>
                </div>

            </div>
          </div>

          {/* TIMELINE CARDS (Human Readable) */}
          {(!raw.taf || raw.taf.includes("No TAF available")) ? (
             /* NO TAF CARD */
             <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-5">
                <div className="border-b border-neutral-700 pb-2 mb-3">
                    <span className="text-blue-400 font-bold text-xs block uppercase tracking-wide">
                        NO TAF AVAILABLE
                    </span>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">--</p>
             </div>
          ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Forecast 1 */}
                <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-5">
                    <div className="border-b border-neutral-700 pb-2 mb-3">
                        <span className="text-blue-400 font-bold text-xs block uppercase tracking-wide">
                            {(timeline.forecast_1 === "NO_TAF" || timeline.forecast_1?.time_label === "NO_TAF") 
                                ? "NO TAF AVAILABLE" 
                                : `Weather ${timeline.forecast_1?.time_label || "Upcoming"}`
                            }
                            {(raw.weather_source && icao && raw.weather_source !== icao.toUpperCase() && raw.weather_source !== "K" + icao.toUpperCase()) ? ` (${raw.weather_source})` : ""}
                        </span>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed">
                        {(timeline.forecast_1 === "NO_TAF" || timeline.forecast_1?.summary === "NO_TAF" || timeline.forecast_1?.summary === "NO_TAF.") 
                            ? "--" 
                            : (timeline.forecast_1?.summary || timeline.forecast_1 || "Analysis unavailable")
                        }
                    </p>
                </div>
                {/* Forecast 2 */}
                <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-5">
                    <div className="border-b border-neutral-700 pb-2 mb-3">
                        <span className="text-blue-400 font-bold text-xs block uppercase tracking-wide">
                             {(timeline.forecast_2 === "NO_TAF" || timeline.forecast_2?.time_label === "NO_TAF") 
                                ? "NO ADDITIONAL TAF AVAILABLE" 
                                : `Weather ${timeline.forecast_2?.time_label || "Outlook"}`
                            }
                            {(raw.weather_source && icao && raw.weather_source !== icao.toUpperCase() && raw.weather_source !== "K" + icao.toUpperCase()) ? ` (${raw.weather_source})` : ""}
                        </span>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed">
                        {(timeline.forecast_2 === "NO_TAF" || timeline.forecast_2?.summary === "NO_TAF" || timeline.forecast_2?.summary === "NO_TAF.") 
                            ? "--" 
                            : (timeline.forecast_2?.summary || timeline.forecast_2 || "Analysis unavailable")
                        }
                    </p>
                </div>
             </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Bubble label="CATEGORY" value={analysis.flight_category} highlight={true} />
            <Bubble 
                label="WIND" 
                value={bubbles?.wind || "--"} 
                subLabel={`CROSSWIND RWY ${bubbles?.rwy || "??"}`}
                subValue={bubbles?.x_wind || "--"}
                risk={analysis.crosswind_status || analysis.wind_risk} 
            />
            <Bubble label="CEILING" value={bubbles?.ceiling || "--"} />
            <Bubble label="VISIBILITY" value={bubbles?.visibility || "--"} />
          </div>

          <div className="pt-2">
            <details className="group bg-black border border-neutral-800 rounded-lg">
              <summary className="list-none cursor-pointer p-4 text-xs font-bold text-gray-400 hover:text-white transition-colors flex items-center justify-between select-none">
                <span>RAW METAR / TAF</span>
                <span className="text-gray-600 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="px-4 pb-4">
                <pre className="text-green-400 text-xs overflow-x-auto whitespace-pre-wrap font-mono">
                  METAR: {raw.metar}{"\n\n"}
                  TAF: {formatTaf(raw.taf)}
                </pre>
              </div>
            </details>
          </div>

          <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-6 relative">
            <div className="flex justify-between items-start mb-3">
                <h3 className="text-neutral-500 text-xs font-bold uppercase tracking-widest">Airspace & TFRs</h3>
                <ReportButton />
            </div>
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
                        <span>Only Clear of Permanent Prohibited Zones (P-40, DC SFRA, etc).</span>
                    </p>
                    <p className="text-xs text-neutral-500">
                        Check dynamic TFRs at <a href="https://tfr.faa.gov/" target="_blank" rel="noreferrer" className="text-blue-400 underline">tfr.faa.gov</a>
                    </p>
                </div>
            )}
          </div>

          <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-6 relative">
            <div className="flex justify-between items-start mb-3">
                <h3 className="text-neutral-500 text-xs font-bold uppercase tracking-widest">Critical NOTAMs</h3>
                <ReportButton />
            </div>
            {analysis.critical_notams?.length > 0 ? (
                <ul className="list-disc pl-5 text-yellow-200 space-y-2 text-sm">
                    {analysis.critical_notams.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
            ) : (
                <p className="text-gray-500 italic text-sm">No critical NOTAMs flagged.</p>
            )}
          </div>

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

      <ReportModal 
        isOpen={showReport} 
        onClose={() => setShowReport(false)} 
        contextData={data ? {
            airport: data.airport_name,
            metar: raw.metar,
            taf: raw.taf,
            raw_notams: raw.notams,
            summary: analysis.summary_weather ? 
                [analysis.summary_weather, analysis.summary_crosswind, analysis.summary_airspace, analysis.summary_notams].join('\n\n') 
                : analysis.briefing_overview,
            airspace_analysis: analysis.airspace_warnings,
            notam_analysis: analysis.critical_notams,
            timeline: analysis.timeline
        } : null}
      />

        </div>
      )}
    </div>
  );
};

export default Dashboard;