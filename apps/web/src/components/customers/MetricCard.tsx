import type { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: number;
  icon: ReactNode;
  valueColor?: string;
}

export function MetricCard({ label, value, icon, valueColor }: MetricCardProps) {
  return (
    <div
      className="bg-white border border-[#E2DED9] rounded-[10px] p-5"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-['DM_Sans'] font-medium text-[11.5px] uppercase tracking-wide text-[#6B6560]">
          {label}
        </span>
        <span className="text-[#6B6560]">{icon}</span>
      </div>
      <p
        className="font-['Plus_Jakarta_Sans'] font-bold text-[28px] leading-none"
        style={{ color: valueColor ?? '#141210' }}
      >
        {value}
      </p>
    </div>
  );
}
