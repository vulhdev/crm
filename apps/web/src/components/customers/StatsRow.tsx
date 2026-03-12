import { Users2, TrendingUp, UserPlus, UserMinus } from 'lucide-react';
import type { Customer } from '@crm/types';
import { MetricCard } from './MetricCard';

interface StatsRowProps {
  customers: Customer[];
}

export function StatsRow({ customers }: StatsRowProps) {
  const total = customers.length;
  const active = customers.filter((c) => c.status === 'Active').length;
  const leads = customers.filter((c) => c.status === 'Lead').length;
  const churned = customers.filter((c) => c.status === 'Churned').length;

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <MetricCard
        label="Total Customers"
        value={total}
        icon={<Users2 size={16} />}
      />
      <MetricCard
        label="Active"
        value={active}
        icon={<TrendingUp size={16} />}
        valueColor="#1A7A6E"
      />
      <MetricCard
        label="New Leads"
        value={leads}
        icon={<UserPlus size={16} />}
        valueColor="#3D5BD9"
      />
      <MetricCard
        label="Churned"
        value={churned}
        icon={<UserMinus size={16} />}
        valueColor="#B85C0A"
      />
    </div>
  );
}
