import { create } from 'zustand';
import type { Customer, UpdateCustomerDto, CreateCustomerDto } from '@crm/types';
import { apiFetch } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

interface CustomerState {
  customers: Customer[];
  isLoading: boolean;
  error: string | null;
  fetchCustomers: () => Promise<void>;
  updateCustomer: (id: string, data: UpdateCustomerDto) => Promise<void>;
  addCustomer: (data: CreateCustomerDto) => Promise<Customer>;
}

export const useCustomerStore = create<CustomerState>((set, get) => ({
  customers: [],
  isLoading: false,
  error: null,

  fetchCustomers: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiFetch('/customers');
      if (!res.ok) throw new Error(`Failed to fetch customers (${res.status})`);
      const data = (await res.json()) as Customer[];
      set({ customers: data });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load customers' });
    } finally {
      set({ isLoading: false });
    }
  },

  updateCustomer: async (id, data) => {
    const prev = get().customers;
    set({ customers: prev.map((c) => (c.id === id ? { ...c, ...data } : c)) });
    try {
      const res = await apiFetch(`/customers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      toast({ title: 'Customer updated', description: 'Status updated successfully.' });
    } catch (err) {
      set({ customers: prev });
      toast({
        title: 'Update failed',
        description: err instanceof Error ? err.message : 'Something went wrong',
        variant: 'destructive',
      });
      throw err;
    }
  },

  addCustomer: async (data) => {
    const res = await apiFetch('/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    const created = (await res.json()) as Customer;
    set({ customers: [...get().customers, created] });
    return created;
  },
}));
