import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomerKanban } from './CustomerKanban';
import type { Customer } from '@crm/types';

const makeCustomer = (overrides: Partial<Customer> = {}): Customer => ({
  id: 'c1',
  firstName: 'Alice',
  lastName: 'Smith',
  email: 'alice@example.com',
  phone: '555-0001',
  company: 'Acme Corp',
  status: 'Lead',
  lastContactDate: '2024-03-01',
  notes: '',
  createdAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('CustomerKanban', () => {
  const baseProps = {
    customers: [],
    allCustomersEmpty: false,
    isLoading: false,
    onEdit: vi.fn(),
    onUpdate: vi.fn().mockResolvedValue(undefined),
    onAddCustomer: vi.fn(),
    onClearFilters: vi.fn(),
  };

  it('renders 4 columns with correct data-testid attributes', () => {
    render(<CustomerKanban {...baseProps} />);
    expect(screen.getByTestId('kanban-column-Lead')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-Active')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-Churned')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-Archived')).toBeInTheDocument();
  });

  it('shows loading skeleton when isLoading=true', () => {
    render(<CustomerKanban {...baseProps} isLoading={true} />);
    expect(screen.getByTestId('kanban-loading-skeleton')).toBeInTheDocument();
  });

  it('does not show columns when isLoading=true', () => {
    render(<CustomerKanban {...baseProps} isLoading={true} />);
    expect(screen.queryByTestId('kanban-column-Lead')).not.toBeInTheDocument();
  });

  it('places cards in the correct columns by status', () => {
    const customers = [
      makeCustomer({ id: 'c1', firstName: 'Alice', status: 'Lead' }),
      makeCustomer({ id: 'c2', firstName: 'Bob', status: 'Active' }),
      makeCustomer({ id: 'c3', firstName: 'Carol', status: 'Active' }),
      makeCustomer({ id: 'c4', firstName: 'Dave', status: 'Churned' }),
    ];
    render(<CustomerKanban {...baseProps} customers={customers} />);

    const leadCol = screen.getByTestId('kanban-column-Lead');
    const activeCol = screen.getByTestId('kanban-column-Active');
    const churnedCol = screen.getByTestId('kanban-column-Churned');
    const archivedCol = screen.getByTestId('kanban-column-Archived');

    expect(leadCol.querySelectorAll('[data-testid="customer-kanban-card"]')).toHaveLength(1);
    expect(activeCol.querySelectorAll('[data-testid="customer-kanban-card"]')).toHaveLength(2);
    expect(churnedCol.querySelectorAll('[data-testid="customer-kanban-card"]')).toHaveLength(1);
    expect(archivedCol.querySelectorAll('[data-testid="customer-kanban-card"]')).toHaveLength(0);
  });

  it('shows count badges matching the number of cards in each column', () => {
    const customers = [
      makeCustomer({ id: 'c1', status: 'Lead' }),
      makeCustomer({ id: 'c2', status: 'Lead' }),
      makeCustomer({ id: 'c3', status: 'Active' }),
    ];
    render(<CustomerKanban {...baseProps} customers={customers} />);

    const leadCol = screen.getByTestId('kanban-column-Lead');
    const activeCol = screen.getByTestId('kanban-column-Active');

    // Count badges are spans containing the count number
    expect(leadCol.querySelector('span')).toHaveTextContent('2');
    expect(activeCol.querySelector('span')).toHaveTextContent('1');
  });

  it('calls onEdit with the correct customer when a card is clicked', async () => {
    const onEdit = vi.fn();
    const customer = makeCustomer({ id: 'c99', firstName: 'Eve', status: 'Lead' });
    render(<CustomerKanban {...baseProps} customers={[customer]} onEdit={onEdit} />);

    const card = screen.getByTestId('customer-kanban-card');
    fireEvent.click(card);
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledWith(customer);
  });

  it('shows "No customers" text in empty columns', () => {
    render(<CustomerKanban {...baseProps} customers={[]} />);
    // All 4 columns should show "No customers"
    const emptyMessages = screen.getAllByText('No customers');
    expect(emptyMessages).toHaveLength(4);
  });
});
