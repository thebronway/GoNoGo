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

  return (
    <div className={`${colorClass} ${riskAnimation} border rounded-xl h-full min-h-[7.5rem] p-1 flex flex-col relative overflow-hidden transition-colors duration-300`}>
      
      {/* SECTION 1 (TOP) */}
      <div className={`flex-1 flex flex-col justify-center items-center ${subValue ? 'border-b border-white/10' : ''}`}>
          <span className="text-[9px] md:text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-0.5">
            {label}
          </span>
          <span className={`font-bold ${textColor} text-center leading-tight transition-all whitespace-pre-line ${
              value && value.length > 40 ? 'text-[10px] md:text-xs' : 
              value && value.length > 30 ? 'text-sm md:text-base' : 
              'text-lg md:text-xl'
          }`}>
              {value}
          </span>
      </div>

      {/* SECTION 2 (BOTTOM) - Only renders if subValue exists */}
      {subValue && (
        <div className="flex-1 flex flex-col justify-center items-center bg-black/10">
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