import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Customer, CustomerStatus, CreateCustomerDto, UpdateCustomerDto } from '@crm/types';
import { toast } from '@/hooks/use-toast';
import { useCustomerStore } from '@/store/customerStore';

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
  // --- store-backed state ---
  const customers = useCustomerStore((s) => s.customers);
  const isLoading = useCustomerStore((s) => s.isLoading);
  const error = useCustomerStore((s) => s.error);
  const fetchCustomers = useCustomerStore((s) => s.fetchCustomers);
  const storeUpdateCustomer = useCustomerStore((s) => s.updateCustomer);
  const storeAddCustomer = useCustomerStore((s) => s.addCustomer);

  // --- view-local state ---
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | 'All'>('All');
  const [sortColumn, setSortColumnState] = useState<keyof Customer | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    void fetchCustomers();
  }, [fetchCustomers]);

  const filteredCustomers = useMemo(() => {
    let result = [...customers];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.company.toLowerCase().includes(q),
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
        if (editingCustomer) {
          await storeUpdateCustomer(editingCustomer.id, data as UpdateCustomerDto);
          // store fires success/failure toast for updates; just close the drawer
        } else {
          await storeAddCustomer(data as CreateCustomerDto);
          toast({
            title: 'Customer added',
            description: 'New customer has been added successfully.',
          });
        }
        closeDrawer();
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
    [editingCustomer, storeUpdateCustomer, storeAddCustomer, closeDrawer],
  );

  // Delegates directly to the store — no fetchCustomers() call, so isLoading
  // never flips to true during a Kanban drag (the optimistic update is instant).
  const updateCustomer = useCallback(
    async (id: string, data: UpdateCustomerDto): Promise<void> => {
      await storeUpdateCustomer(id, data);
    },
    [storeUpdateCustomer],
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
    [sortColumn],
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
