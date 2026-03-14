import { Users, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  variant: 'empty' | 'no-results';
  standalone?: boolean;
  onAddCustomer?: () => void;
  onClearFilters?: () => void;
}

export function EmptyState({ variant, standalone, onAddCustomer, onClearFilters }: EmptyStateProps) {
  if (variant === 'empty') {
    const inner = (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-12 h-12 rounded-full bg-[#F0EFEC] flex items-center justify-center">
          <Users size={22} className="text-[#6B6560]" />
        </div>
        <div className="text-center">
          <p className="font-['DM_Sans'] font-medium text-[14px] text-[#141210]">
            No customers yet
          </p>
          <p className="font-['DM_Sans'] text-[13px] text-[#6B6560] mt-0.5">
            Add your first customer to get started.
          </p>
        </div>
        {onAddCustomer && (
          <Button
            size="sm"
            onClick={onAddCustomer}
            className="mt-1 bg-[#1A7A6E] hover:bg-[#12604F] text-white font-['DM_Sans'] text-[13px]"
          >
            + Add Customer
          </Button>
        )}
      </div>
    );
    if (standalone) return inner;
    return (
      <tr>
        <td colSpan={5}>{inner}</td>
      </tr>
    );
  }

  const inner = (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-12 h-12 rounded-full bg-[#F0EFEC] flex items-center justify-center">
        <SearchX size={22} className="text-[#6B6560]" />
      </div>
      <div className="text-center">
        <p className="font-['DM_Sans'] font-medium text-[14px] text-[#141210]">
          No customers found
        </p>
        <p className="font-['DM_Sans'] text-[13px] text-[#6B6560] mt-0.5">
          Try adjusting your search or clearing the filters.
        </p>
      </div>
      {onClearFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="mt-1 font-['DM_Sans'] text-[13px] text-[#6B6560] hover:text-[#141210]"
        >
          Clear filters
        </Button>
      )}
    </div>
  );
  if (standalone) return inner;
  return (
    <tr>
      <td colSpan={5}>{inner}</td>
    </tr>
  );
}
