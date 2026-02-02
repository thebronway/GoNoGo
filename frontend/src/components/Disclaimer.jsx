import React from 'react';
import { AlertTriangle, ShieldAlert, FileWarning } from 'lucide-react'; // Assuming you have lucide-react installed since you used Fuel

const Disclaimer = () => {
  return (
    <div className="max-w-3xl mx-auto text-gray-300 space-y-8 pt-10 px-4">
      
      {/* HEADER */}
      <div className="space-y-2 border-b border-neutral-800 pb-6">
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <ShieldAlert className="text-orange-500 w-8 h-8" />
          Legal Disclaimer
        </h1>
        <p className="text-lg text-orange-400/80 font-medium">
          Critical Safety Information & Terms of Use
        </p>
      </div>

      {/* PRIMARY WARNING BOX */}
      <div className="bg-orange-900/10 border border-orange-500/50 rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>
        <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          Not for Operational Navigation
        </h2>
        <p className="text-gray-300 leading-relaxed">
          <strong>GoNoGo AI is for educational and situational awareness purposes only.</strong> It is 
          <span className="text-white font-bold underline decoration-orange-500 decoration-2 underline-offset-2 ml-1">
             NOT a substitute for an official weather briefing 
          </span>. 
          Pilots must always obtain a standard briefing via 1800-WX-BRIEF or other FAA-approved sources prior to flight.
        </p>
      </div>

      {/* DETAILED SECTIONS */}
      <div className="grid md:grid-cols-2 gap-6">
        
        {/* AI Limitations */}
        <div className="bg-neutral-800/30 rounded-lg p-5 border border-neutral-700/50">
          <h3 className="font-bold text-white mb-3 text-lg">AI Limitations</h3>
          <ul className="list-disc list-inside space-y-2 text-sm text-neutral-400">
            <li>
              <strong className="text-neutral-200">Hallucinations:</strong> Large Language Models (LLMs) can sound confident but be factually incorrect.
            </li>
            <li>
              <strong className="text-neutral-200">Interpretation Errors:</strong> The AI may misinterpret complex NOTAM syntax or overlapping weather phenomena.
            </li>
            <li>
              <strong className="text-neutral-200">Verify Everything:</strong> Always cross-check the AI summary against the raw data provided in the dashboard.
            </li>
          </ul>
        </div>

        {/* Data Limitations */}
        <div className="bg-neutral-800/30 rounded-lg p-5 border border-neutral-700/50">
          <h3 className="font-bold text-white mb-3 text-lg">Data Limitations</h3>
          <ul className="list-disc list-inside space-y-2 text-sm text-neutral-400">
            <li>
              <strong className="text-neutral-200">Latency:</strong> Data is fetched via API and may not reflect real-time conditions instantly.
            </li>
            <li>
              <strong className="text-neutral-200">Missing Layers:</strong> This tool currently does <span className="text-orange-400">NOT</span> check dynamic TFRs (VIP/Stadiums), Icing, or Turbulence layers.
            </li>
            <li>
              <strong className="text-neutral-200">Source:</strong> Data is sourced from FAA APIs but processed through third-party intermediaries.
            </li>
          </ul>
        </div>
      </div>

      {/* FINAL LEGALESE */}
      <div className="p-6 text-xs text-neutral-500 text-justify border-t border-neutral-800">
        <p className="mb-2">
          <strong className="text-neutral-400">Limitation of Liability:</strong> By using this application, you acknowledge that the developer assumes no liability for any accidents, incidents, violations, or damages resulting from the use of this software. The software is provided "AS IS", without warranty of any kind, express or implied.
        </p>
        <p>
          <strong className="text-neutral-400">Pilot in Command:</strong> The Pilot in Command (PIC) is solely responsible for the safety of the flight and for ensuring all data used for flight planning is current and accurate, in accordance with FAR 91.103.
        </p>
      </div>

    </div>
  );
};

export default Disclaimer;