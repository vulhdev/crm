import { Pencil } from 'lucide-react';
import type { Customer } from '@crm/types';
import { EmptyState } from './EmptyState';
import { StatusBadge } from './StatusBadge';
import { getAvatarPalette } from '@/lib/avatarPalette';
import { formatDate } from '@/lib/formatDate';

interface CustomerGridProps {
  customers: Customer[];
  allCustomersEmpty: boolean;
  isLoading: boolean;
  onEdit: (c: Customer) => void;
  onAddCustomer: () => void;
  onClearFilters: () => void;
}

function SkeletonCard() {
  return (
    <div className="bg-white border border-[#E2DED9] rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="skeleton w-10 h-10 rounded-full shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="skeleton h-3.5 w-3/4 rounded" />
          <div className="skeleton h-3 w-1/2 rounded" />
        </div>
      </div>
      <div className="skeleton h-px w-full rounded mb-3" />
      <div className="space-y-2">
        <div className="skeleton h-3 w-2/3 rounded" />
        <div className="skeleton h-5 w-16 rounded-full" />
        <div className="skeleton h-3 w-1/2 rounded" />
      </div>
    </div>
  );
}

export function CustomerGrid({
  customers,
  allCustomersEmpty,
  isLoading,
  onEdit,
  onAddCustomer,
  onClearFilters,
}: CustomerGridProps) {
  if (isLoading) {
    return (
      <div
        data-testid="grid-loading-skeleton"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (customers.length === 0 && allCustomersEmpty) {
    return <EmptyState variant="empty" standalone onAddCustomer={onAddCustomer} />;
  }

  if (customers.length === 0 && !allCustomersEmpty) {
    return <EmptyState variant="no-results" standalone onClearFilters={onClearFilters} />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {customers.map((customer) => {
        const palette = getAvatarPalette(customer.id);
        const initials = `${customer.firstName[0] ?? ''}${customer.lastName[0] ?? ''}`.toUpperCase();

        return (
          <div
            key={customer.id}
            data-testid="customer-card"
            onClick={() => onEdit(customer)}
            className="group relative bg-white border border-[#E2DED9] rounded-xl p-4 cursor-pointer transition-all duration-150 hover:border-[#C5C0BA]"
            style={{}}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.boxShadow =
                '0 4px 12px rgba(13,31,45,0.10), 0 1px 4px rgba(13,31,45,0.06)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.boxShadow = '';
            }}
          >
            {/* Edit button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(customer);
              }}
              className="absolute top-3 right-3 p-1.5 rounded-md text-transparent group-hover:text-[#6B6560]/60 hover:!text-[#1A7A6E] hover:bg-[#EEECEA] transition-colors"
              title="Edit customer"
              aria-label="Edit customer"
            >
              <Pencil size={13} />
            </button>

            {/* Avatar + name */}
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-['DM_Sans'] font-medium shrink-0"
                style={{ backgroundColor: palette.bg, color: palette.text }}
              >
                {initials}
              </div>
              <div className="min-w-0 pr-6">
                <p className="font-['DM_Sans'] font-semibold text-[14px] text-[#141210] truncate">
                  {customer.firstName} {customer.lastName}
                </p>
                <p className="font-['DM_Sans'] text-[12px] text-[#6B6560] truncate">
                  {customer.email}
                </p>
              </div>
            </div>

            <hr className="border-[#E2DED9]/60 my-2" />

            {/* Details */}
            <div className="space-y-1.5">
              <p className="font-['DM_Sans'] text-[13px] text-[#141210] truncate">
                {customer.company || '—'}
              </p>
              <StatusBadge status={customer.status} />
              <p className="font-['DM_Mono'] text-[11.5px] text-[#6B6560]">
                {formatDate(customer.lastContactDate)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
