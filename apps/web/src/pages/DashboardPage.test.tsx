import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Customer } from '@crm/types';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockCustomers: Customer[] = [
  {
    id: 'c1',
    firstName: 'Alice',
    lastName: 'Smith',
    email: 'alice@example.com',
    phone: '555-0001',
    company: 'Acme',
    status: 'Active',
    lastContactDate: '2024-03-01',
    notes: '',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'c2',
    firstName: 'Bob',
    lastName: 'Jones',
    email: 'bob@example.com',
    phone: '555-0002',
    company: 'Beta',
    status: 'Lead',
    lastContactDate: '2024-02-15',
    notes: '',
    createdAt: '2024-01-02T00:00:00Z',
  },
];

const mockHook = {
  customers: mockCustomers,
  filteredCustomers: mockCustomers,
  isLoading: false,
  error: null,
  searchQuery: '',
  statusFilter: 'All' as const,
  sortColumn: null,
  sortDirection: 'asc' as const,
  drawerOpen: false,
  editingCustomer: null,
  fetchCustomers: vi.fn(),
  openAddDrawer: vi.fn(),
  openEditDrawer: vi.fn(),
  closeDrawer: vi.fn(),
  submitCustomer: vi.fn(),
  updateCustomer: vi.fn().mockResolvedValue(undefined),
  setSearchQuery: vi.fn(),
  setStatusFilter: vi.fn(),
  setSortColumn: vi.fn(),
};

vi.mock('@/hooks/useCustomers', () => ({
  useCustomers: () => mockHook,
}));

vi.mock('@/components/customers/CustomerTable', () => ({
  CustomerTable: ({ customers }: { customers: Customer[] }) => (
    <div data-testid="customer-table" data-count={customers.length} />
  ),
}));

vi.mock('@/components/customers/CustomerGrid', () => ({
  CustomerGrid: ({ customers }: { customers: Customer[] }) => (
    <div data-testid="customer-grid" data-count={customers.length} />
  ),
}));

vi.mock('@/components/customers/CustomerKanban', () => ({
  CustomerKanban: ({ customers }: { customers: Customer[] }) => (
    <div data-testid="customer-kanban" data-count={customers.length} />
  ),
}));

vi.mock('@/components/customers/ViewToggle', () => ({
  ViewToggle: ({
    viewMode,
    onChange,
  }: {
    viewMode: string;
    onChange: (m: string) => void;
  }) => (
    <div data-testid="view-toggle" data-viewmode={viewMode}>
      <button onClick={() => onChange('list')}>List</button>
      <button onClick={() => onChange('grid')}>Grid</button>
      <button onClick={() => onChange('kanban')}>Kanban</button>
    </div>
  ),
}));

vi.mock('@/components/layout/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/layout/Topbar', () => ({
  Topbar: () => <div data-testid="topbar" />,
}));

vi.mock('@/components/customers/StatsRow', () => ({
  StatsRow: () => <div data-testid="stats-row" />,
}));

vi.mock('@/components/customers/CustomerFilters', () => ({
  CustomerFilters: () => <div data-testid="customer-filters" />,
}));

vi.mock('@/components/customers/CustomerDrawer', () => ({
  CustomerDrawer: () => <div data-testid="customer-drawer" />,
}));

import React from 'react';

// ─── Tests ──────────────────────────────────────────────────────────────────

import { DashboardPage } from './DashboardPage';

describe('DashboardPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders ViewToggle', () => {
    render(<DashboardPage />);
    expect(screen.getByTestId('view-toggle')).toBeInTheDocument();
  });

  it('defaults to list view when no localStorage value is set', () => {
    render(<DashboardPage />);
    expect(screen.getByTestId('view-toggle')).toHaveAttribute('data-viewmode', 'list');
    expect(screen.getByTestId('customer-table')).toBeInTheDocument();
    expect(screen.queryByTestId('customer-grid')).not.toBeInTheDocument();
    expect(screen.queryByTestId('customer-kanban')).not.toBeInTheDocument();
  });

  it('restores viewMode from localStorage', () => {
    localStorage.setItem('crm:customerViewMode', 'grid');
    render(<DashboardPage />);
    expect(screen.getByTestId('view-toggle')).toHaveAttribute('data-viewmode', 'grid');
    expect(screen.getByTestId('customer-grid')).toBeInTheDocument();
    expect(screen.queryByTestId('customer-table')).not.toBeInTheDocument();
  });

  it('switching to grid shows CustomerGrid', async () => {
    render(<DashboardPage />);
    await userEvent.click(screen.getByText('Grid'));
    expect(screen.getByTestId('customer-grid')).toBeInTheDocument();
    expect(screen.queryByTestId('customer-table')).not.toBeInTheDocument();
  });

  it('switching to kanban shows CustomerKanban', async () => {
    render(<DashboardPage />);
    await userEvent.click(screen.getByText('Kanban'));
    expect(screen.getByTestId('customer-kanban')).toBeInTheDocument();
    expect(screen.queryByTestId('customer-table')).not.toBeInTheDocument();
  });

  it('switching back to list from grid shows CustomerTable', async () => {
    render(<DashboardPage />);
    await userEvent.click(screen.getByText('Grid'));
    await userEvent.click(screen.getByText('List'));
    expect(screen.getByTestId('customer-table')).toBeInTheDocument();
    expect(screen.queryByTestId('customer-grid')).not.toBeInTheDocument();
  });

  it('passes filteredCustomers to each view component', async () => {
    render(<DashboardPage />);
    // List view — data-count matches filteredCustomers.length
    expect(screen.getByTestId('customer-table')).toHaveAttribute(
      'data-count',
      String(mockCustomers.length)
    );

    await userEvent.click(screen.getByText('Grid'));
    expect(screen.getByTestId('customer-grid')).toHaveAttribute(
      'data-count',
      String(mockCustomers.length)
    );

    await userEvent.click(screen.getByText('Kanban'));
    expect(screen.getByTestId('customer-kanban')).toHaveAttribute(
      'data-count',
      String(mockCustomers.length)
    );
  });

  it('persists viewMode to localStorage on change', async () => {
    render(<DashboardPage />);
    await userEvent.click(screen.getByText('Kanban'));
    expect(localStorage.getItem('crm:customerViewMode')).toBe('kanban');
  });
});
