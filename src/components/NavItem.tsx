import React from 'react';
import { cn } from '@/lib/utils';

export function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-2 text-left transition-colors font-medium text-[11px] outline-none",
        active 
          ? "bg-accent-blue/10 border-r-2 border-accent-blue text-foreground" 
          : "hover:bg-foreground/5 text-foreground/60 hover:text-foreground"
      )}
    >
      <span className={cn("flex items-center justify-center opacity-70", active && "text-accent-blue opacity-100")}>{icon}</span>
      {label}
    </button>
  );
}

/* â”€â”€ Energy Flow Animation: Solar â†’ Battery â†’ Grid â”€â”€â”€ */
