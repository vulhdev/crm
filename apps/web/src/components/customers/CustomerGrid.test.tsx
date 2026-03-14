import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomerGrid } from './CustomerGrid';
import type { Customer } from '@crm/types';

const makeCustomer = (overrides: Partial<Customer> = {}): Customer => ({
  id: 'c1',
  firstName: 'Alice',
  lastName: 'Smith',
  email: 'alice@example.com',
  phone: '555-0001',
  company: 'Acme Corp',
  status: 'Active',
  lastContactDate: '2024-03-01',
  notes: '',
  createdAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('CustomerGrid', () => {
  const baseProps = {
    customers: [],
    allCustomersEmpty: false,
    isLoading: false,
    onEdit: vi.fn(),
    onAddCustomer: vi.fn(),
    onClearFilters: vi.fn(),
  };

  it('shows loading skeleton when isLoading=true', () => {
    render(<CustomerGrid {...baseProps} isLoading={true} />);
    expect(screen.getByTestId('grid-loading-skeleton')).toBeInTheDocument();
    // 8 skeleton cards are rendered as children — just verify the container exists
  });

  it('shows empty state when customers=[] and allCustomersEmpty=true', () => {
    render(
      <CustomerGrid {...baseProps} customers={[]} allCustomersEmpty={true} isLoading={false} />
    );
    expect(screen.getByText('No customers yet')).toBeInTheDocument();
  });

  it('shows no-results state when customers=[] and allCustomersEmpty=false', () => {
    render(
      <CustomerGrid {...baseProps} customers={[]} allCustomersEmpty={false} isLoading={false} />
    );
    expect(screen.getByText('No customers found')).toBeInTheDocument();
  });

  it('renders the correct number of cards', () => {
    const customers = [
      makeCustomer({ id: 'c1', firstName: 'Alice' }),
      makeCustomer({ id: 'c2', firstName: 'Bob' }),
      makeCustomer({ id: 'c3', firstName: 'Carol' }),
    ];
    render(<CustomerGrid {...baseProps} customers={customers} allCustomersEmpty={false} isLoading={false} />);
    expect(screen.getAllByTestId('customer-card')).toHaveLength(3);
  });

  it('renders customer name and email in each card', () => {
    const customers = [makeCustomer({ id: 'c1', firstName: 'Alice', lastName: 'Smith', email: 'alice@example.com' })];
    render(<CustomerGrid {...baseProps} customers={customers} allCustomersEmpty={false} isLoading={false} />);
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
  });

  it('calls onEdit with the correct customer when a card is clicked', async () => {
    const onEdit = vi.fn();
    const customer = makeCustomer({ id: 'c99', firstName: 'Eve' });
    render(
      <CustomerGrid
        {...baseProps}
        customers={[customer]}
        allCustomersEmpty={false}
        isLoading={false}
        onEdit={onEdit}
      />
    );
    await userEvent.click(screen.getByTestId('customer-card'));
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledWith(customer);
  });

  it('calls onAddCustomer when the Add Customer button in empty state is clicked', async () => {
    const onAddCustomer = vi.fn();
    render(
      <CustomerGrid
        {...baseProps}
        customers={[]}
        allCustomersEmpty={true}
        isLoading={false}
        onAddCustomer={onAddCustomer}
      />
    );
    await userEvent.click(screen.getByText('+ Add Customer'));
    expect(onAddCustomer).toHaveBeenCalledOnce();
  });

  it('calls onClearFilters when Clear filters button is clicked in no-results state', async () => {
    const onClearFilters = vi.fn();
    render(
      <CustomerGrid
        {...baseProps}
        customers={[]}
        allCustomersEmpty={false}
        isLoading={false}
        onClearFilters={onClearFilters}
      />
    );
    await userEvent.click(screen.getByText('Clear filters'));
    expect(onClearFilters).toHaveBeenCalledOnce();
  });
});
