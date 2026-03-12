import { useState } from 'react';
import { X } from 'lucide-react';
import type { Customer, CreateCustomerDto } from '@crm/types';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { CustomerForm } from './CustomerForm';

interface CustomerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCustomer: Customer | null;
  onSubmit: (data: CreateCustomerDto) => Promise<void>;
}

function formatDate(iso: string): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

export function CustomerDrawer({
  open,
  onOpenChange,
  editingCustomer,
  onSubmit,
}: CustomerDrawerProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEdit = editingCustomer !== null;

  // We use a key to force CustomerForm remount when switching between add/edit
  const formKey = editingCustomer ? editingCustomer.id : 'new';

  async function handleSubmit(data: CreateCustomerDto) {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
    } finally {
      setIsSubmitting(false);
    }
  }

  // We use a ref trick: expose a submit trigger via a hidden button inside the form
  // Instead, we'll manage the submit from the drawer footer by triggering form submit
  const formId = 'customer-form';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[440px] sm:max-w-[440px] p-0 flex flex-col"
        style={{ boxShadow: 'var(--shadow-modal)' }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-5 border-b border-[#E2DED9] flex items-start justify-between">
          <div>
            <SheetTitle className="font-['Plus_Jakarta_Sans'] font-semibold text-[16px] text-[#141210]">
              {isEdit ? 'Edit Customer' : 'Add Customer'}
            </SheetTitle>
            {isEdit && editingCustomer.lastContactDate && (
              <SheetDescription className="font-['DM_Sans'] text-[12px] text-[#6B6560] mt-0.5">
                Last updated {formatDate(editingCustomer.lastContactDate)}
              </SheetDescription>
            )}
            {!isEdit && (
              <SheetDescription className="font-['DM_Sans'] text-[12px] text-[#6B6560] mt-0.5">
                Fill in the details to create a new customer.
              </SheetDescription>
            )}
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1.5 rounded-md text-[#6B6560]/60 hover:bg-[#EEECEA] hover:text-[#141210] transition-colors mt-0.5"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <CustomerForm
            key={formKey}
            initialData={editingCustomer ?? undefined}
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
            isSubmitting={isSubmitting}
            formId={formId}
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E2DED9] flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="font-['DM_Sans'] text-[13px] border-[#E2DED9] text-[#6B6560] hover:text-[#141210]"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            size="sm"
            disabled={isSubmitting}
            className="font-['DM_Sans'] text-[13px] bg-[#1A7A6E] hover:bg-[#12604F] text-white min-w-[72px]"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Saving...
              </span>
            ) : (
              'Save'
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
