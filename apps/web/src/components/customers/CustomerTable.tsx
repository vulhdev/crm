import { ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import type { Customer } from '@crm/types';
import type { SortDirection } from '@/hooks/useCustomers';
import { CustomerTableRow } from './CustomerTableRow';
import { TableLoadingSkeleton } from './TableLoadingSkeleton';
import { EmptyState } from './EmptyState';

interface CustomerTableProps {
  customers: Customer[];
  allCustomersEmpty: boolean;
  isLoading: boolean;
  sortColumn: keyof Customer | null;
  sortDirection: SortDirection;
  onSort: (col: keyof Customer) => void;
  onEdit: (c: Customer) => void;
  onAddCustomer: () => void;
  onClearFilters: () => void;
}

interface ThProps {
  label: string;
  col: keyof Customer;
  currentSort: keyof Customer | null;
  direction: SortDirection;
  onSort: (col: keyof Customer) => void;
  width?: string;
}

function SortableTh({ label, col, currentSort, direction, onSort, width }: ThProps) {
  const isActive = currentSort === col;
  return (
    <th
      style={{ width }}
      className="px-4 h-10 text-left font-['DM_Sans'] font-medium text-[11.5px] uppercase tracking-[0.06em] text-[#6B6560] cursor-pointer select-none"
      onClick={() => onSort(col)}
    >
      <div className="flex items-center gap-1.5">
        {label}
        <span className={isActive ? 'text-[#1A7A6E]' : 'text-[#6B6560]/50'}>
          {isActive ? (
            direction === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />
          ) : (
            <ChevronsUpDown size={13} />
          )}
        </span>
      </div>
    </th>
  );
}

export function CustomerTable({
  customers,
  allCustomersEmpty,
  isLoading,
  sortColumn,
  sortDirection,
  onSort,
  onEdit,
  onAddCustomer,
  onClearFilters,
}: CustomerTableProps) {
  return (
    <div
      className="bg-white border border-[#E2DED9] rounded-[10px] overflow-hidden"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <table className="w-full border-collapse">
        <thead className="bg-[#F0EFEC] border-b border-[#E2DED9]">
          <tr>
            <SortableTh
              label="Name"
              col="firstName"
              currentSort={sortColumn}
              direction={sortDirection}
              onSort={onSort}
              width="30%"
            />
            <SortableTh
              label="Company"
              col="company"
              currentSort={sortColumn}
              direction={sortDirection}
              onSort={onSort}
              width="18%"
            />
            <SortableTh
              label="Status"
              col="status"
              currentSort={sortColumn}
              direction={sortDirection}
              onSort={onSort}
              width="12%"
            />
            <SortableTh
              label="Last Contact"
              col="lastContactDate"
              currentSort={sortColumn}
              direction={sortDirection}
              onSort={onSort}
              width="14%"
            />
            <th className="px-4 h-10" style={{ width: '80px' }} />
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <TableLoadingSkeleton />
          ) : customers.length === 0 ? (
            <EmptyState
              variant={allCustomersEmpty ? 'empty' : 'no-results'}
              onAddCustomer={allCustomersEmpty ? onAddCustomer : undefined}
              onClearFilters={!allCustomersEmpty ? onClearFilters : undefined}
            />
          ) : (
            customers.map((c) => (
              <CustomerTableRow key={c.id} customer={c} onEdit={onEdit} />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
