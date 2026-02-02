import React from 'react';

const About = () => {
  return (
    <div className="max-w-3xl mx-auto text-gray-300 space-y-8 pt-10 px-4">
      
      {/* HEADER */}
      <div className="space-y-2 border-b border-neutral-800 pb-6">
        <h1 className="text-3xl font-bold text-white tracking-tight">About GoNoGo AI</h1>
        <p className="text-lg text-blue-400 font-medium">
          Decoding Weather, Airspace, and NOTAMs for the Modern Pilot
        </p>
      </div>

      {/* MAIN STORY */}
      <div className="space-y-4 leading-relaxed text-gray-300">
        <p>
          GoNoGo AI was built to solve a friction point in aviation: raw data is reliable, but parsing it is tedious and feels archaic.
        </p>
        <p>
          By combining live FAA weather and NOTAM data with OpenAI's natural language processing, this tool acts as a 
          <span className="text-white font-semibold"> second set of eyes</span> during your preflight planning. 
          It doesn't replace the briefing—it translates it into actionable intelligence.
        </p>
      </div>

      {/* OBJECTIVES / FEATURES LIST */}
      <div className="bg-neutral-800/30 rounded-xl p-6 border border-neutral-800">
        <h2 className="text-xl font-bold text-white mb-4">The Mission</h2>
        <p className="mb-4">
          As a private pilot myself, my goal was to design a tool that could:
        </p>
        <ul className="list-disc list-inside space-y-3 text-sm md:text-base">
          <li>
            <strong className="text-gray-100">Decode Raw Data:</strong> Take METARs, TAFs and NOTAMs and decode into an executive summary.
          </li>
          <li>
            <strong className="text-gray-100">Trust but Verify:</strong> Display raw FAA data side-by-side with the AI summary for verification.
          </li>
          <li>
            <strong className="text-gray-100">Enhance Situational Awareness:</strong> Provide a quick-glance view for local flight planning and crosswind limitations.
          </li>
          <li>
            <strong className="text-gray-100">Work Seamlessly:</strong> Bridge the gap between legacy FAA APIs and modern AI capabilities.
          </li>
        </ul>
      </div>

      {/* DONATION SECTION */}
      <div className="pt-4">
        <div className="bg-yellow-900/10 border border-yellow-600/20 rounded-lg p-5">
          <h3 className="text-yellow-500 font-bold uppercase tracking-wider text-xs mb-2">
            Support the Project
          </h3>
          <p className="text-sm text-gray-400 leading-relaxed">
            If you are a pilot and find this tool useful in your preflight workflow, please consider supporting the project. 
            I know how expensive GA flying is, but server and API costs add up.
          </p>
          <p className="text-sm text-gray-400 mt-2">
            If you have the means, use the <span className="text-white font-semibold">"Donate: Buy a Fuel Top-Up"</span> button in the footer. 
            This tool is ad-free, open source and open to the entire avivation community.
          </p>
        </div>
      </div>

    </div>
  );
};

export default About;