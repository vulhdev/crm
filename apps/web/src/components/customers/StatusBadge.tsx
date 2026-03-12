import type { CustomerStatus } from '@crm/types';

interface StatusBadgeProps {
  status: CustomerStatus;
}

const statusConfig: Record<
  CustomerStatus,
  { bg: string; text: string; border: string }
> = {
  Lead: {
    bg: 'var(--badge-lead-bg)',
    text: 'var(--badge-lead-text)',
    border: 'var(--badge-lead-border)',
  },
  Active: {
    bg: 'var(--badge-active-bg)',
    text: 'var(--badge-active-text)',
    border: 'var(--badge-active-border)',
  },
  Churned: {
    bg: 'var(--badge-churned-bg)',
    text: 'var(--badge-churned-text)',
    border: 'var(--badge-churned-border)',
  },
  Archived: {
    bg: 'var(--badge-archived-bg)',
    text: 'var(--badge-archived-text)',
    border: 'var(--badge-archived-border)',
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className="inline-flex items-center gap-[5px] h-[22px] px-2 rounded-full border font-['DM_Sans'] font-medium text-[11.5px]"
      style={{
        backgroundColor: config.bg,
        color: config.text,
        borderColor: config.border,
      }}
    >
      <span
        className="w-1 h-1 rounded-full shrink-0"
        style={{ backgroundColor: config.text }}
      />
      {status}
    </span>
  );
}
