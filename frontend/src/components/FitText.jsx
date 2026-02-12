import React, { useRef, useLayoutEffect } from 'react';

const FitText = ({ children, className = "", multiline = false }) => {
  const containerRef = useRef(null);
  const textRef = useRef(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;

    const resize = () => {
      // 1. Reset to base scale to measure natural size
      text.style.transform = 'scale(1)';
      
      const parentW = container.offsetWidth;
      const parentH = container.offsetHeight;
      const textW = text.offsetWidth;
      const textH = text.offsetHeight;
      
      if (parentW === 0 || parentH === 0 || textW === 0 || textH === 0) return;

      // 2. Calculate ratios with safety buffers
      const wRatio = (parentW * 0.9) / textW;
      const hRatio = (parentH * 0.85) / textH;
      
      // 3. Limit scale to 1 (Never grow larger than base font), shrink if needed
      const scale = Math.min(wRatio, hRatio, 1);
      
      // 4. Apply
      text.style.transform = `scale(${scale})`;
    };

    // Initial sizing
    resize();
    
    // Watch for window resizing or layout changes
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [children, multiline]);

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center overflow-hidden px-1">
      <span 
        ref={textRef} 
        className={`font-bold origin-center transition-transform duration-200 text-2xl md:text-3xl ${
            multiline 
            ? 'whitespace-pre text-center leading-normal' 
            : 'whitespace-nowrap leading-none'
        } ${className}`}
      >
        {children}
      </span>
    </div>
  );
};

export default FitText;