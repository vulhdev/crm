import { useState } from 'react';
import type { Customer, CustomerStatus, CreateCustomerDto } from '@crm/types';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusBadge } from './StatusBadge';

interface CustomerFormProps {
  initialData?: Customer;
  onSubmit: (data: CreateCustomerDto) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  formId?: string;
}

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  status: CustomerStatus;
  lastContactDate: string;
  notes: string;
};

type FormErrors = Partial<Record<keyof FormData, string>>;

const STATUS_OPTIONS: CustomerStatus[] = ['Lead', 'Active', 'Churned', 'Archived'];

const EMPTY_FORM: FormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  company: '',
  status: 'Lead',
  lastContactDate: '',
  notes: '',
};

function toIsoDate(value: string): string {
  if (!value) return '';
  // date input returns YYYY-MM-DD — keep as-is (valid ISO date)
  return value;
}

function toDateInputValue(iso: string): string {
  if (!iso) return '';
  // Take only the date portion if it contains a time component
  return iso.split('T')[0] ?? iso;
}

export function CustomerForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting,
  formId,
}: CustomerFormProps) {
  const [form, setForm] = useState<FormData>(() => {
    if (initialData) {
      return {
        firstName: initialData.firstName,
        lastName: initialData.lastName,
        email: initialData.email,
        phone: initialData.phone ?? '',
        company: initialData.company ?? '',
        status: initialData.status,
        lastContactDate: toDateInputValue(initialData.lastContactDate),
        notes: initialData.notes ?? '',
      };
    }
    return { ...EMPTY_FORM };
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FormData, boolean>>>({});

  function validate(data: FormData): FormErrors {
    const errs: FormErrors = {};
    if (!data.firstName.trim()) errs.firstName = 'First name is required';
    if (!data.lastName.trim()) errs.lastName = 'Last name is required';
    if (!data.email.trim()) {
      errs.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errs.email = 'Enter a valid email address';
    }
    if (!data.status) errs.status = 'Status is required';
    return errs;
  }

  function handleChange<K extends keyof FormData>(field: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function handleBlur(field: keyof FormData) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const errs = validate(form);
    setErrors((prev) => ({ ...prev, [field]: errs[field] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setTouched({
        firstName: true,
        lastName: true,
        email: true,
        status: true,
      });
      return;
    }

    const dto: CreateCustomerDto = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      company: form.company.trim(),
      status: form.status,
      lastContactDate: toIsoDate(form.lastContactDate),
      notes: form.notes.trim(),
    };

    await onSubmit(dto);
  }

  function fieldClass(field: keyof FormData) {
    return `h-9 border-[#E2DED9] bg-white text-[13.5px] font-['DM_Sans'] focus-visible:ring-[#1A7A6E] ${
      touched[field] && errors[field] ? 'border-[#C94040]' : ''
    }`;
  }

  return (
    <form id={formId} onSubmit={(e) => { void handleSubmit(e); }} className="flex flex-col gap-4">
      {/* First + Last name */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block font-['DM_Sans'] font-medium text-[12px] text-[#6B6560] mb-1.5">
            First Name <span className="text-[#C94040]">*</span>
          </label>
          <Input
            value={form.firstName}
            onChange={(e) => handleChange('firstName', e.target.value)}
            onBlur={() => handleBlur('firstName')}
            className={fieldClass('firstName')}
            placeholder="Jane"
            disabled={isSubmitting}
          />
          {touched.firstName && errors.firstName && (
            <p className="mt-1 text-[11px] text-[#C94040] font-['DM_Sans']">{errors.firstName}</p>
          )}
        </div>
        <div>
          <label className="block font-['DM_Sans'] font-medium text-[12px] text-[#6B6560] mb-1.5">
            Last Name <span className="text-[#C94040]">*</span>
          </label>
          <Input
            value={form.lastName}
            onChange={(e) => handleChange('lastName', e.target.value)}
            onBlur={() => handleBlur('lastName')}
            className={fieldClass('lastName')}
            placeholder="Smith"
            disabled={isSubmitting}
          />
          {touched.lastName && errors.lastName && (
            <p className="mt-1 text-[11px] text-[#C94040] font-['DM_Sans']">{errors.lastName}</p>
          )}
        </div>
      </div>

      {/* Email */}
      <div>
        <label className="block font-['DM_Sans'] font-medium text-[12px] text-[#6B6560] mb-1.5">
          Email <span className="text-[#C94040]">*</span>
        </label>
        <Input
          type="email"
          value={form.email}
          onChange={(e) => handleChange('email', e.target.value)}
          onBlur={() => handleBlur('email')}
          className={fieldClass('email')}
          placeholder="jane@example.com"
          disabled={isSubmitting}
        />
        {touched.email && errors.email && (
          <p className="mt-1 text-[11px] text-[#C94040] font-['DM_Sans']">{errors.email}</p>
        )}
      </div>

      {/* Phone + Company */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block font-['DM_Sans'] font-medium text-[12px] text-[#6B6560] mb-1.5">
            Phone
          </label>
          <Input
            type="tel"
            value={form.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            className="h-9 border-[#E2DED9] bg-white text-[13.5px] font-['DM_Sans'] focus-visible:ring-[#1A7A6E]"
            placeholder="+1 555 000 0000"
            disabled={isSubmitting}
          />
        </div>
        <div>
          <label className="block font-['DM_Sans'] font-medium text-[12px] text-[#6B6560] mb-1.5">
            Company
          </label>
          <Input
            value={form.company}
            onChange={(e) => handleChange('company', e.target.value)}
            className="h-9 border-[#E2DED9] bg-white text-[13.5px] font-['DM_Sans'] focus-visible:ring-[#1A7A6E]"
            placeholder="Acme Inc."
            disabled={isSubmitting}
          />
        </div>
      </div>

      {/* Status + Last Contact Date */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block font-['DM_Sans'] font-medium text-[12px] text-[#6B6560] mb-1.5">
            Status <span className="text-[#C94040]">*</span>
          </label>
          <Select
            value={form.status}
            onValueChange={(v: string) => handleChange('status', v as CustomerStatus)}
            disabled={isSubmitting}
          >
            <SelectTrigger className="h-9 border-[#E2DED9] bg-white text-[13.5px] font-['DM_Sans']">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s} className="text-[13.5px] font-['DM_Sans']">
                  <span className="flex items-center gap-2">
                    <StatusBadge status={s} />
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {touched.status && errors.status && (
            <p className="mt-1 text-[11px] text-[#C94040] font-['DM_Sans']">{errors.status}</p>
          )}
        </div>
        <div>
          <label className="block font-['DM_Sans'] font-medium text-[12px] text-[#6B6560] mb-1.5">
            Last Contact Date
          </label>
          <Input
            type="date"
            value={form.lastContactDate}
            onChange={(e) => handleChange('lastContactDate', e.target.value)}
            className="h-9 border-[#E2DED9] bg-white text-[13.5px] font-['DM_Sans'] focus-visible:ring-[#1A7A6E]"
            disabled={isSubmitting}
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block font-['DM_Sans'] font-medium text-[12px] text-[#6B6560] mb-1.5">
          Notes
        </label>
        <Textarea
          value={form.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          className="min-h-[90px] border-[#E2DED9] bg-white text-[13.5px] font-['DM_Sans'] focus-visible:ring-[#1A7A6E] resize-none"
          placeholder="Any notes about this customer..."
          disabled={isSubmitting}
        />
      </div>

      {/* Footer buttons (for inline usage without CustomerDrawer) */}
      <div className="hidden">
        <Button type="submit" disabled={isSubmitting}>Save</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
