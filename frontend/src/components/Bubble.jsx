import React from 'react';

const Bubble = ({ label, value, subLabel, subValue, highlight, risk }) => {
  let colorClass = "bg-neutral-800 border-neutral-700";
  let textColor = "text-white";
  let riskAnimation = "";
  
  // Logic for Category Highlight (VFR/IFR)
  if (highlight) {
    if (value === "VFR") colorClass = "bg-green-900/40 border-green-600";
    else if (value === "MVFR") colorClass = "bg-blue-900/40 border-blue-600";
    else if (value === "IFR") colorClass = "bg-red-900/40 border-red-600";
    else colorClass = "bg-pink-900/40 border-pink-600"; // LIFR
  }

  // Logic for Risk Levels (Wind)
  if (risk) {
    const isRed = risk === "EXCEEDS PROFILE" || risk === "HIGH";
    const isYellow = risk === "NEAR LIMITS" || risk === "MODERATE";
    
    if (isRed) {
        colorClass = "bg-red-900/40 border-red-500"; 
        riskAnimation = "animate-pulse";
    } else if (isYellow) {
        colorClass = "bg-yellow-900/40 border-yellow-500"; 
        textColor = "text-yellow-200";
    } else {
        colorClass = "bg-green-900/20 border-green-800";
    }
  }

  // Split content if it has a pipe (for Wind Gusts)
  const contentParts = value ? value.split('|') : [];

  return (
    <div className={`${colorClass} ${riskAnimation} border rounded-xl h-full min-h-[7.5rem] p-2 flex flex-col relative overflow-hidden transition-colors duration-300`}>
      
      {/* SECTION 1 (TOP) */}
      <div className={`flex-1 flex flex-col justify-center items-center ${subValue ? 'border-b border-white/10 mb-1 pb-1' : ''}`}>
          <span className="text-[9px] md:text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">
            {label}
          </span>
          
          {/* PRIMARY VALUE */}
          <span className={`font-bold ${textColor} text-center leading-tight whitespace-pre-line transition-all ${
              contentParts[0] && contentParts[0].length > 15 ? 'text-sm md:text-lg' : 'text-lg md:text-2xl'
          }`}>
              {contentParts[0]}
          </span>

          {/* SECONDARY LINE (GUSTS) */}
          {contentParts[1] && (
            <span className="text-xs md:text-sm text-neutral-300 font-medium mt-1 animate-pulse">
                {contentParts[1].trim()}
            </span>
          )}
      </div>

      {/* SECTION 2 (BOTTOM) - Only renders if subValue exists */}
      {subValue && (
        <div className="flex-1 flex flex-col justify-center items-center bg-black/10 pt-1">
             <span className="text-[9px] md:text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-0.5">
                {subLabel}
             </span>
             <span className={`text-lg md:text-xl font-bold ${textColor} text-center leading-none`}>
                {subValue}
             </span>
        </div>
      )}
    </div>
  );
};

export default Bubble;