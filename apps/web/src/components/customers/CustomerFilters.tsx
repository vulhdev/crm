import { Search, X } from 'lucide-react';
import type { CustomerStatus } from '@crm/types';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface CustomerFiltersProps {
  searchQuery: string;
  statusFilter: CustomerStatus | 'All';
  onSearchChange: (q: string) => void;
  onStatusChange: (s: CustomerStatus | 'All') => void;
  onClear: () => void;
}

const STATUS_OPTIONS: Array<CustomerStatus | 'All'> = [
  'All',
  'Lead',
  'Active',
  'Churned',
  'Archived',
];

export function CustomerFilters({
  searchQuery,
  statusFilter,
  onSearchChange,
  onStatusChange,
  onClear,
}: CustomerFiltersProps) {
  const hasFilters = searchQuery.trim() !== '' || statusFilter !== 'All';

  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6560] pointer-events-none"
        />
        <Input
          type="text"
          placeholder="Search customers..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9 w-[280px] border-[#E2DED9] bg-white text-[13.5px] font-['DM_Sans'] focus-visible:ring-[#1A7A6E]"
        />
      </div>

      <Select
        value={statusFilter}
        onValueChange={(v: string) => onStatusChange(v as CustomerStatus | 'All')}
      >
        <SelectTrigger className="w-[148px] h-9 border-[#E2DED9] bg-white text-[13.5px] font-['DM_Sans']">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((s) => (
            <SelectItem key={s} value={s} className="text-[13.5px] font-['DM_Sans']">
              {s === 'All' ? 'All Statuses' : s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-9 text-[13px] font-['DM_Sans'] text-[#6B6560] hover:text-[#141210] gap-1.5"
        >
          <X size={13} />
          Clear
        </Button>
      )}
    </div>
  );
}
