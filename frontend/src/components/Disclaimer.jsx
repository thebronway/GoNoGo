import React from 'react';
import SEO from './SEO';
import { AlertTriangle, ShieldAlert, Database, ServerCrash } from 'lucide-react';

const Disclaimer = () => {
  return (
    <div className="max-w-3xl mx-auto text-gray-300 space-y-8 pt-10 px-4 pb-20">
      <SEO 
        title="Disclaimer - GoNoGo AI"
        description="Important legal disclaimer and operational limitations for using GoNoGo AI. Not a substitute for official briefings."
        path="/disclaimer"
      />
      
      {/* HEADER */}
      <div className="space-y-2 border-b border-neutral-800 pb-6">
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <ShieldAlert className="text-orange-500 w-8 h-8" />
          Terms of Use & Disclaimer
        </h1>
        <p className="text-lg text-neutral-400 font-medium">
          Operational Standards, Data Policies, and Liability
        </p>
      </div>

      {/* PRIMARY WARNING BOX (KILL BOX) */}
      <div className="bg-orange-900/10 border border-orange-500/50 rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>
        <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          Critical Safety Warning
        </h2>
        <p className="text-gray-300 leading-relaxed">
          <strong>GoNoGo AI is for educational and situational awareness purposes only.</strong> It is 
          <span className="text-white font-bold underline decoration-orange-500 decoration-2 underline-offset-2 ml-1">
             NOT a substitute for an official weather briefing
          </span>. 
          Pilots must always obtain a standard briefing via 1800-WX-BRIEF or other FAA-approved sources prior to flight.
        </p>
      </div>

      {/* SERVICE MECHANICS (NEW SECTION) */}
      <div className="bg-blue-900/10 border border-blue-500/30 rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-400" />
          Data Freshness & Caching Policy
        </h2>
        <div className="space-y-4 text-sm md:text-base text-gray-300">
          <p>
            To maintain service sustainability and manage API costs, GoNoGo AI utilizes a <strong>Smart Caching System</strong>.
          </p>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>
              <strong className="text-white">Shared Cache:</strong> If a user recently searched an airport, subsequent users may receive the cached data and AI summary to reduce processing time and costs.
            </li>
            <li>
              <strong className="text-white">Auto-Clear:</strong> The system monitors for new METAR releases. When a new METAR is published for an airport, the cache is automatically cleared, and a fresh AI analysis is generated.
            </li>
            <li>
              <strong className="text-white">Timestamp Verification:</strong> Always verify the "Observation Time" timestamp on the raw data to ensure you are looking at the most current report.
            </li>
          </ul>
        </div>
      </div>

      {/* DETAILED RISKS GRID */}
      <div className="grid md:grid-cols-2 gap-6">
        
        {/* AI Limitations */}
        <div className="bg-neutral-800/30 rounded-lg p-5 border border-neutral-700/50">
          <h3 className="font-bold text-white mb-3 text-lg">AI Limitations</h3>
          <ul className="list-disc list-inside space-y-2 text-sm text-neutral-400">
            <li>
              <strong className="text-neutral-200">Hallucinations:</strong> LLMs can sound confident but be factually incorrect.
            </li>
            <li>
              <strong className="text-neutral-200">Interpretation Errors:</strong> The AI may misinterpret complex NOTAM syntax.
            </li>
            <li>
              <strong className="text-neutral-200">Verify Everything:</strong> Always cross-check the AI summary against the raw data.
            </li>
          </ul>
        </div>

        {/* Service Reliability */}
        <div className="bg-neutral-800/30 rounded-lg p-5 border border-neutral-700/50">
          <h3 className="font-bold text-white mb-3 text-lg flex items-center gap-2">
            <ServerCrash className="w-4 h-4 text-neutral-400"/> Service Reliability
          </h3>
          <ul className="list-disc list-inside space-y-2 text-sm text-neutral-400">
            <li>
              <strong className="text-neutral-200">Uptime:</strong> We rely on third-party APIs (FAA & OpenAI). If these services are slow or down, GoNoGo AI may be unavailable.
            </li>
            <li>
              <strong className="text-neutral-200">No Warranty:</strong> This service is provided as a free tool for the community. We do not guarantee 100% uptime or data accuracy.
            </li>
          </ul>
        </div>
      </div>

      {/* LEGALESE FOOTER */}
      <div className="p-6 text-xs text-neutral-500 text-justify border-t border-neutral-800 mt-4">
        <p className="mb-2">
          <strong className="text-neutral-400">Limitation of Liability:</strong> By using this application, you acknowledge that the developer assumes no liability for any accidents, incidents, violations, or damages resulting from the use of this software. The software is provided "AS IS", without warranty of any kind.
        </p>
        <p>
          <strong className="text-neutral-400">Pilot in Command:</strong> The Pilot in Command (PIC) is solely responsible for the safety of the flight and for ensuring all data used for flight planning is current and accurate, in accordance with FAR 91.103.
        </p>
      </div>

    </div>
  );
};

export default Disclaimer;