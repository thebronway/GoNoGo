import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import Bubble from '../Bubble';
import { Monitor, AlertTriangle, Clock, Plane } from 'lucide-react';

const NOTAMScroller = ({ notams }) => {
    if (!notams || notams.length === 0) return <div className="p-4 text-gray-500">No NOTAMs.</div>;

    return (
        <div className="relative h-full overflow-hidden bg-black/40 rounded-lg">
            <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-b from-neutral-900/90 via-transparent to-neutral-900/90 h-full"></div>
            <div className="animate-marquee py-4 space-y-6">
                {[...notams, ...notams].map((n, i) => (
                    <div key={i} className="px-6">
                        <p className="text-green-400 font-mono text-xl leading-relaxed uppercase whitespace-pre-wrap border-l-4 border-green-700 pl-4">
                            {n}
                        </p>
                    </div>
                ))}
            </div>
            <style>{`
                @keyframes marquee {
                    0% { transform: translateY(0); }
                    100% { transform: translateY(-50%); }
                }
                .animate-marquee {
                    animation: marquee ${Math.max(notams.length * 10, 30)}s linear infinite;
                }
            `}</style>
        </div>
    );
};

const TimelineCard = ({ title, summary }) => (
    <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 flex flex-col h-full relative overflow-hidden">
        <div className="border-b border-neutral-700 pb-2 mb-2 shrink-0">
             <span className="text-blue-400 font-bold text-sm md:text-base block uppercase tracking-widest truncate">
                {title}
             </span>
        </div>
        <p className="text-gray-200 text-base md:text-lg leading-relaxed overflow-y-auto">
            {summary || "No Forecast Available"}
        </p>
    </div>
);

// Helper for METAR Time Parsing
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

const KioskDisplay = () => {
    const { icao, profile } = useParams();
    const navigate = useNavigate();
    
    // State
    const [config, setConfig] = useState(null);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [lastMetarRaw, setLastMetarRaw] = useState(null);
    const [currentTime, setCurrentTime] = useState(new Date());

    const PROFILE_LIMITS = {
        small: "15KTS",
        medium: "20KTS",
        large: "30KTS"
    };

    // 1. Initial Authorization & Config Load
    useEffect(() => {
        const init = async () => {
            try {
                const conf = await api.get(`/api/kiosk/config/${icao}`);
                setConfig(conf);
                
                if (!profile) {
                    navigate(`/kiosk/${icao}/${conf.default_profile}`, { replace: true });
                } else if (!conf.allowed_profiles.includes(profile)) {
                    navigate(`/kiosk/${icao}/${conf.default_profile}`, { replace: true });
                } else {
                    loadAnalysis(profile, false); // Initial load, use cache
                }
            } catch (e) {
                navigate('/kiosk');
            }
        };
        init();
    }, [icao, profile]);

    // 2. Clock & Wake Lock
    useEffect(() => {
        const t = setInterval(() => setCurrentTime(new Date()), 1000);

        let wakeLock = null;
        const requestWakeLock = async () => {
            if ('wakeLock' in navigator) {
                try { wakeLock = await navigator.wakeLock.request('screen'); } 
                catch (err) { console.log(err); }
            }
        };
        requestWakeLock();

        return () => {
            clearInterval(t);
            wakeLock?.release();
        };
    }, []);

    // 3. Poller
    useEffect(() => {
        const poller = setInterval(async () => {
            if (!config) return;

            try {
                const res = await api.get(`/api/kiosk/peek/${icao}`);
                if (res.status === "success" && res.raw_metar) {
                    const cleanNew = res.raw_metar.replace(/\s/g, '');
                    const cleanOld = lastMetarRaw ? lastMetarRaw.replace(/\s/g, '') : '';
                    
                    if (cleanNew !== cleanOld) {
                        console.log("KIOSK: New METAR detected. Refreshing AI...");
                        loadAnalysis(profile, true); // Force refresh
                    }
                }
            } catch (e) { console.error("Poll failed", e); }
        }, 60 * 1000); 

        return () => clearInterval(poller);
    }, [config, lastMetarRaw, profile]);

    const loadAnalysis = async (pSize, force = false) => {
        setLoading(true);
        try {
            const res = await api.post("/api/analyze", { 
                icao: icao, 
                plane_size: pSize,
                force: force 
            });
            setData(res);
            setLastMetarRaw(res.raw_data?.metar);
        } catch (e) {
            console.error("Analysis load failed", e);
        } finally {
            setLoading(false);
        }
    };

    if (!data || loading) {
        return (
            <div className="w-screen h-screen bg-black flex flex-col items-center justify-center space-y-8">
                <img src="/logo.webp" className="w-64 md:w-96 animate-pulse" />
                <p className="text-blue-500 font-mono text-2xl tracking-[0.5em] animate-pulse">REFRESHING DATA...</p>
            </div>
        );
    }

    const { analysis, raw_data } = data;
    const timeline = analysis.timeline || {};
    const metarTimes = getMetarTime(raw_data.metar, data.airport_tz || 'UTC');

    const target = icao ? icao.toUpperCase() : "";
    const source = raw_data.weather_source ? raw_data.weather_source.toUpperCase() : "";
    const isDifferent = source && target && source !== target && source !== "K" + target;

    return (
        <div className="w-screen h-screen bg-neutral-900 text-white overflow-hidden font-sans p-6 grid grid-rows-[auto_1fr] gap-6 selection:bg-none cursor-none">
            
            {/* HEADER ROW */}
            <div className="flex justify-between items-end border-b-2 border-neutral-800 pb-4 shrink-0">
                <div className="flex items-center gap-10">
                    <img src="/logo.webp" className="h-20 w-auto object-contain" />
                    <div>
                        <h1 className="text-6xl font-black tracking-tighter text-white leading-none">{data.airport_name}</h1>
                        <div className="flex items-center gap-6 mt-3">
                            <span className="bg-blue-900/30 text-blue-400 border border-blue-800 px-3 py-1 rounded text-xl font-bold font-mono">
                                {icao.toUpperCase()}
                            </span>

                            {/* SPECI Indicator */}
                            {raw_data.metar?.includes("SPECI") && (
                                <span className="bg-yellow-900/40 text-yellow-500 border border-yellow-700/50 px-3 py-1 rounded text-xl font-bold font-mono animate-pulse shadow-[0_0_10px_rgba(234,179,8,0.2)]">
                                    Special / Unscheduled METAR
                                </span>
                            )}                           
                            
                            {/* METAR Time Bubble */}
                            {metarTimes && (
                                <div className="inline-flex items-center justify-center gap-2 text-sm font-mono text-blue-200 bg-blue-900/20 px-4 py-1 rounded-full border border-blue-900/30">
                                     <Clock className="w-4 h-4 text-blue-500" />
                                     <span className="text-[10px] uppercase tracking-widest text-blue-500 font-bold mr-1">METAR Generated:</span>
                                     <span className="text-blue-500 font-bold">UTC</span> {metarTimes.utc}
                                     <span className="w-px h-3 bg-blue-800/50 mx-1"></span>
                                     <span className="text-blue-500 font-bold">LCL</span> {metarTimes.local}
                                </div>
                            )}

                            {/* Grey Profile Bubble */}
                            <div className="inline-flex items-center justify-center gap-2 text-sm font-mono text-gray-300 bg-neutral-800/50 px-4 py-1 rounded-full border border-neutral-700/50">
                                 <Plane className="w-4 h-4 text-gray-500" />
                                 <span className="text-gray-500 font-bold">PROFILE</span> {profile.toUpperCase()} (MAX: {PROFILE_LIMITS[profile] || "--"})
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Clock */}
                <div className="text-right">
                    <div className="text-6xl font-mono font-bold text-gray-200">
                        {currentTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute:'2-digit' })}
                        <span className="text-2xl text-neutral-500 ml-2">LCL</span>
                    </div>
                    <div className="text-xl text-blue-500 font-mono font-bold mt-1">
                        {currentTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute:'2-digit', timeZone: 'UTC' })}Z
                    </div>
                </div>
            </div>

            {/* MAIN GRID Content */}
            <div className="grid grid-cols-12 gap-8 h-full min-h-0">
                
                {/* LEFT COL: AI Briefing & Bubbles (8 Cols) */}
                {/* Changed to flex flex-col gap-6 to match constant spacing */}
                <div className="col-span-8 flex flex-col gap-6 h-full min-h-0">
                    
                    {/* 1. Current Conditions Bubbles (Standard Labels) - Auto Height, Flex-None */}
                    <div className="grid grid-cols-4 gap-4 flex-none mb-6">
                        <Bubble label="CATEGORY" value={analysis.flight_category} highlight={true} />
                        {/* Split Wind Bubble */}
                        <Bubble 
                            label="WIND" 
                            value={analysis.bubbles?.wind || "--"} 
                            subLabel={`CROSSWIND RWY ${analysis.bubbles?.rwy || "??"}`}
                            subValue={analysis.bubbles?.x_wind || "--"}
                            risk={analysis.crosswind_status} 
                        />
                        <Bubble label="CEILING" value={analysis.bubbles?.ceiling} />
                        <Bubble label="VISIBILITY" value={analysis.bubbles?.visibility} />
                    </div>

                    {/* 2. Forecast Bubbles (TAF) */}
                    <div className="grid grid-cols-2 gap-4 flex-none">
                        <TimelineCard 
                            title={`Weather ${timeline.t_06?.time_label || "Next 6 Hours"}${isDifferent ? ` (${source})` : ""}`}
                            summary={timeline.t_06?.summary || timeline.t_06} 
                        />
                        <TimelineCard 
                            title={`Weather ${timeline.t_12?.time_label || "Next 12 Hours"}${isDifferent ? ` (${source})` : ""}`}
                            summary={timeline.t_12?.summary || timeline.t_12} 
                        />
                    </div>

                    {/* 3. AI Briefing Box - Takes Remaining Space */}
                    <div className="bg-neutral-800/40 border border-neutral-700/50 rounded-2xl p-6 flex-1 min-h-0 overflow-hidden relative shadow-2xl flex flex-col">
                         <h2 className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-4 border-b border-neutral-700 pb-2 flex items-center gap-2 shrink-0">
                            Briefing Overview
                         </h2>
                         
                         <div className="text-xl leading-relaxed text-gray-200 space-y-6 overflow-y-auto pb-12">
                            {/* WEATHER */}
                            <div>
                                <h3 className="text-blue-400 font-bold uppercase tracking-widest mb-2 border-b border-blue-900/30 w-fit">
                                    CURRENT WEATHER {isDifferent ? `(${source})` : ""}
                                </h3>
                                <p>{analysis.summary_weather || "No data."}</p>
                            </div>

                            {/* CROSSWIND */}
                            <div>
                                <h3 className="text-blue-400 font-bold uppercase tracking-widest mb-2 border-b border-blue-900/30 w-fit">
                                    CROSSWIND {isDifferent ? `(${source})` : ""}
                                </h3>
                                <p>{analysis.summary_crosswind || "No data."}</p>
                            </div>

                            {/* AIRSPACE */}
                            <div>
                                <h3 className="text-blue-400 font-bold uppercase tracking-widest mb-2 border-b border-blue-900/30 w-fit">
                                    AIRSPACE {isDifferent ? `(${target})` : ""}
                                </h3>
                                <p>{analysis.summary_airspace || "No data."}</p>
                            </div>

                            {/* NOTAMS */}
                            <div>
                                <h3 className="text-blue-400 font-bold uppercase tracking-widest mb-2 border-b border-blue-900/30 w-fit">
                                    NOTABLE NOTAMS {isDifferent ? `(${target})` : ""}
                                </h3>
                                <p>{analysis.summary_notams || "No data."}</p>
                            </div>
                         </div>
                         
                         {/* Warnings Footer */}
                         <div className="absolute bottom-0 left-0 right-0 bg-neutral-900/95 p-3 border-t border-red-900/50 flex items-center justify-between gap-4 overflow-hidden">
                            <div className="flex gap-4 overflow-x-auto whitespace-nowrap">
                                {analysis.airspace_warnings.map((w,i) => (
                                    <span key={i} className="text-red-400 font-bold flex items-center gap-2 text-base">
                                        <AlertTriangle size={18} /> {w}
                                    </span>
                                ))}
                                {(!analysis.airspace_warnings?.length) && (
                                    <span className="text-green-500/50 font-bold flex items-center gap-2">
                                        NO PERMANENT AIRSPACE RESTRICTIONS DETECTED
                                    </span>
                                )}
                            </div>
                            <span className="text-orange-500 font-bold text-xs uppercase tracking-widest shrink-0">
                                ALWAYS CHECK DYNAMIC TFRS AT TFR.FAA.GOV
                            </span>
                         </div>
                    </div>
                </div>

                {/* RIGHT COL: Raw Data (4 Cols) */}
                <div className="col-span-4 flex flex-col gap-6 h-full min-h-0">
                    
                    {/* METAR / TAF */}
                    <div className="bg-black border border-neutral-800 rounded-xl p-5 shrink-0 shadow-lg flex-none">
                        <h3 className="text-gray-500 font-bold text-xs uppercase mb-2">Raw METAR</h3>
                        <p className="font-mono text-green-400 text-lg leading-tight break-words">
                            {raw_data.metar}
                        </p>
                        
                        <div className="my-4 border-t border-neutral-900"></div>
                        
                        <h3 className="text-gray-500 font-bold text-xs uppercase mb-2">Terminal Forecast</h3>
                         <p className="font-mono text-blue-400 text-lg leading-tight whitespace-pre-wrap">
                            {raw_data.taf ? raw_data.taf.replace(/(FM|BECMG|TEMPO)/g, '\n$1') : "No TAF Available"}
                        </p>
                    </div>

                    {/* NOTAM SCROLLER - Takes remaining height */}
                    <div className="bg-neutral-900 border border-neutral-800 rounded-xl flex-1 min-h-0 flex flex-col overflow-hidden relative shadow-inner">
                        <div className="bg-neutral-800 p-3 z-20 shadow-md shrink-0">
                            <h3 className="text-orange-500 font-bold uppercase tracking-widest text-center">Active NOTAMs</h3>
                        </div>
                        <NOTAMScroller notams={raw_data.notams} />
                    </div>

                    {/* DISCLAIMER BOX - Fixed at bottom right */}
                    <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-3 shrink-0">
                        <p className="text-sm text-gray-300 font-medium flex items-center justify-center gap-1 text-center">
                            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                            <span className="font-bold text-red-500">DISCLAIMER:</span> 
                            <span>AI normalizes data and can make errors. Always verify with official sources.</span>
                        </p>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default KioskDisplay;