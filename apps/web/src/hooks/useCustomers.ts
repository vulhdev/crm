import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Customer, CustomerStatus, CreateCustomerDto, UpdateCustomerDto } from '@crm/types';
import { apiFetch } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

export type SortDirection = 'asc' | 'desc';

export interface UseCustomersReturn {
  customers: Customer[];
  filteredCustomers: Customer[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  statusFilter: CustomerStatus | 'All';
  sortColumn: keyof Customer | null;
  sortDirection: SortDirection;
  drawerOpen: boolean;
  editingCustomer: Customer | null;
  fetchCustomers: () => Promise<void>;
  openAddDrawer: () => void;
  openEditDrawer: (c: Customer) => void;
  closeDrawer: () => void;
  submitCustomer: (data: CreateCustomerDto | UpdateCustomerDto) => Promise<void>;
  updateCustomer: (id: string, data: UpdateCustomerDto) => Promise<void>;
  setSearchQuery: (q: string) => void;
  setStatusFilter: (s: CustomerStatus | 'All') => void;
  setSortColumn: (col: keyof Customer) => void;
}

export function useCustomers(): UseCustomersReturn {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | 'All'>('All');
  const [sortColumn, setSortColumnState] = useState<keyof Customer | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/customers');
      if (!res.ok) {
        throw new Error(`Failed to fetch customers (${res.status})`);
      }
      const data = (await res.json()) as Customer[];
      setCustomers(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load customers';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCustomers();
  }, [fetchCustomers]);

  const filteredCustomers = useMemo(() => {
    let result = [...customers];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'All') {
      result = result.filter((c) => c.status === statusFilter);
    }

    if (sortColumn) {
      result.sort((a, b) => {
        const aVal = a[sortColumn] ?? '';
        const bVal = b[sortColumn] ?? '';
        const cmp = String(aVal).localeCompare(String(bVal));
        return sortDirection === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [customers, searchQuery, statusFilter, sortColumn, sortDirection]);

  const openAddDrawer = useCallback(() => {
    setEditingCustomer(null);
    setDrawerOpen(true);
  }, []);

  const openEditDrawer = useCallback((c: Customer) => {
    setEditingCustomer(c);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setEditingCustomer(null);
  }, []);

  const submitCustomer = useCallback(
    async (data: CreateCustomerDto | UpdateCustomerDto) => {
      try {
        let res: Response;
        if (editingCustomer) {
          res = await apiFetch(`/customers/${editingCustomer.id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
          });
        } else {
          res = await apiFetch('/customers', {
            method: 'POST',
            body: JSON.stringify(data),
          });
        }

        if (!res.ok) {
          throw new Error(`Request failed (${res.status})`);
        }

        await fetchCustomers();
        closeDrawer();
        toast({
          title: editingCustomer ? 'Customer updated' : 'Customer added',
          description: editingCustomer
            ? 'The customer record has been updated successfully.'
            : 'New customer has been added successfully.',
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Something went wrong';
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        });
        throw err;
      }
    },
    [editingCustomer, fetchCustomers, closeDrawer]
  );

  const updateCustomer = useCallback(
    async (id: string, data: UpdateCustomerDto): Promise<void> => {
      const res = await apiFetch(`/customers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }
      await fetchCustomers();
    },
    [fetchCustomers]
  );

  const setSortColumn = useCallback(
    (col: keyof Customer) => {
      if (sortColumn === col) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortColumnState(col);
        setSortDirection('asc');
      }
    },
    [sortColumn]
  );

  return {
    customers,
    filteredCustomers,
    isLoading,
    error,
    searchQuery,
    statusFilter,
    sortColumn,
    sortDirection,
    drawerOpen,
    editingCustomer,
    fetchCustomers,
    openAddDrawer,
    openEditDrawer,
    closeDrawer,
    submitCustomer,
    updateCustomer,
    setSearchQuery,
    setStatusFilter,
    setSortColumn,
  };
}
