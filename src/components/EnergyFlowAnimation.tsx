import React from 'react';

export function EnergyFlowAnimation() {
  return (
    <div className="mt-3 pt-3 border-t border-foreground/10">
      <div className="flex items-center justify-between gap-1 w-full px-1">

        {/* Solar Icon */}
        <div className="energy-icon-container">
          <div className="energy-icon-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {/* Sun Rays */}
              <path d="M12 2v2M5 5l1.5 1.5M19 5l-1.5 1.5M12 20v2M5 19l1.5-1.5M19 19l-1.5-1.5M2 12h2M20 12h2" className="solar-ray-pulse" />
              {/* Solar Panel Frame */}
              <path d="M4 18h16M5 18l2-8h10l2 8" />
              {/* Solar Panel Grid */}
              <path d="M12 10v8M8 14h8" />
            </svg>
          </div>
          <span className="energy-icon-label">Solar</span>
        </div>

        {/* Flow Line: Solar â†’ Battery */}
        <div className="flex-1 relative h-4 mx-1 flex items-center">
          <div className="w-full energy-flow-track" />
        </div>

        {/* Battery Icon */}
        <div className="energy-icon-container">
          <div className="energy-icon-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="16" height="12" rx="2" ry="2" />
              <path d="M20 10v4" strokeLinecap="round" />
              {/* Segments */}
              <rect x="4" y="8" width="3" height="8" rx="0.5" fill="currentColor" className="battery-seg-1" />
              <rect x="8" y="8" width="3" height="8" rx="0.5" fill="currentColor" className="battery-seg-2" />
              <rect x="12" y="8" width="3" height="8" rx="0.5" fill="currentColor" className="battery-seg-3" />
            </svg>
          </div>
          <span className="energy-icon-label">Battery</span>
        </div>

        {/* Flow Line: Battery â†’ Grid */}
        <div className="flex-1 relative h-4 mx-1 flex items-center">
          <div className="w-full energy-flow-track" />
        </div>

        {/* Grid Icon */}
        <div className="energy-icon-container">
          <div className="energy-icon-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="grid-tower-pulse">
              {/* Tower Legs */}
              <path d="M6 22l4-18h4l4 18" />
              {/* Crossarms */}
              <path d="M3 9h18M2 14h20M9 4h6" />
              {/* Diagonals */}
              <path d="M10 9l2 5 2-5M8.5 14l3.5 8 3.5-8" />
            </svg>
          </div>
          <span className="energy-icon-label">Grid</span>
        </div>

      </div>
    </div>
  );
}
