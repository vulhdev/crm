import { Pencil } from 'lucide-react';
import type { Customer } from '@crm/types';
import { StatusBadge } from './StatusBadge';

interface CustomerTableRowProps {
  customer: Customer;
  onEdit: (c: Customer) => void;
}

const PALETTES = [
  { bg: '#E8F5F3', text: '#1A7A6E' },
  { bg: '#EEF0FB', text: '#3D5BD9' },
  { bg: '#FDF3E7', text: '#B85C0A' },
  { bg: '#FAEAEA', text: '#C94040' },
  { bg: '#EEECEA', text: '#6B6560' },
];

function getAvatarPalette(id: string) {
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return PALETTES[hash % PALETTES.length];
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

export function CustomerTableRow({ customer, onEdit }: CustomerTableRowProps) {
  const palette = getAvatarPalette(customer.id);
  const initials = `${customer.firstName[0] ?? ''}${customer.lastName[0] ?? ''}`.toUpperCase();

  return (
    <tr
      className="customer-row border-b border-[#E2DED9]/60 cursor-pointer"
      onClick={() => onEdit(customer)}
    >
      {/* Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-['DM_Sans'] font-medium shrink-0"
            style={{ backgroundColor: palette.bg, color: palette.text }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p className="font-['DM_Sans'] font-medium text-[13.5px] text-[#141210] truncate">
              {customer.firstName} {customer.lastName}
            </p>
            <p className="font-['DM_Sans'] text-[12px] text-[#6B6560] truncate">
              {customer.email}
            </p>
          </div>
        </div>
      </td>

      {/* Company */}
      <td className="px-4 py-3">
        <span className="font-['DM_Sans'] text-[13.5px] text-[#141210] truncate block max-w-[160px]">
          {customer.company || '—'}
        </span>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <StatusBadge status={customer.status} />
      </td>

      {/* Last Contact */}
      <td className="px-4 py-3">
        <span className="font-['DM_Mono'] text-[12.5px] text-[#6B6560]">
          {formatDate(customer.lastContactDate)}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(customer);
          }}
          className="p-1.5 rounded-md text-[#6B6560]/60 hover:bg-[#EEECEA] hover:text-[#1A7A6E] transition-colors"
          title="Edit customer"
        >
          <Pencil size={14} />
        </button>
      </td>
    </tr>
  );
}
