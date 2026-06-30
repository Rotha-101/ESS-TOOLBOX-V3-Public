import React, { useState, useEffect } from 'react';

export function HeaderClock() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = currentTime.toLocaleString('en-US', {
    dateStyle: 'short',
    timeStyle: 'medium',
    hour12: false
  });

  return (
    <span className="uppercase tracking-wider font-mono">{formattedTime}</span>
  );
}
