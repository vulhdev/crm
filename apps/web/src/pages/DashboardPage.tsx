import { AlertCircle, RefreshCw } from 'lucide-react';
import { useCustomers } from '@/hooks/useCustomers';
import type { CreateCustomerDto } from '@crm/types';
import { AppShell } from '@/components/layout/AppShell';
import { Topbar } from '@/components/layout/Topbar';
import { StatsRow } from '@/components/customers/StatsRow';
import { CustomerFilters } from '@/components/customers/CustomerFilters';
import { CustomerTable } from '@/components/customers/CustomerTable';
import { CustomerDrawer } from '@/components/customers/CustomerDrawer';
import { Button } from '@/components/ui/button';

function ErrorNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
        <AlertCircle size={22} className="text-[#C94040]" />
      </div>
      <div className="text-center">
        <p className="font-['DM_Sans'] font-medium text-[14px] text-[#141210]">
          Failed to load customers
        </p>
        <p className="font-['DM_Sans'] text-[13px] text-[#6B6560] mt-0.5">
          {message}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={onRetry}
        className="mt-1 font-['DM_Sans'] text-[13px] gap-1.5 border-[#E2DED9]"
      >
        <RefreshCw size={13} />
        Try again
      </Button>
    </div>
  );
}

export function DashboardPage() {
  const hook = useCustomers();

  function handleClearFilters() {
    hook.setSearchQuery('');
    hook.setStatusFilter('All');
  }

  async function handleSubmit(data: CreateCustomerDto) {
    await hook.submitCustomer(data);
  }

  return (
    <AppShell>
      <Topbar title="Customers" />
      <div className="p-6 page-enter">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-['Plus_Jakarta_Sans'] font-semibold text-[22px] text-[#141210] leading-tight">
              Customers
            </h1>
            <p className="font-['DM_Sans'] text-[13px] text-[#6B6560] mt-0.5">
              {hook.isLoading ? (
                'Loading...'
              ) : (
                <>
                  {hook.filteredCustomers.length} of {hook.customers.length} customer
                  {hook.customers.length !== 1 ? 's' : ''}
                </>
              )}
            </p>
          </div>
          <Button
            onClick={hook.openAddDrawer}
            className="bg-[#1A7A6E] hover:bg-[#12604F] text-white font-['DM_Sans'] font-medium text-[13.5px] gap-1.5 h-9 px-4"
          >
            + Add Customer
          </Button>
        </div>

        {/* Stats row */}
        <StatsRow customers={hook.customers} />

        {/* Filters */}
        <CustomerFilters
          searchQuery={hook.searchQuery}
          statusFilter={hook.statusFilter}
          onSearchChange={hook.setSearchQuery}
          onStatusChange={hook.setStatusFilter}
          onClear={handleClearFilters}
        />

        {/* Table or error */}
        {hook.error ? (
          <ErrorNotice message={hook.error} onRetry={() => { void hook.fetchCustomers(); }} />
        ) : (
          <CustomerTable
            customers={hook.filteredCustomers}
            allCustomersEmpty={hook.customers.length === 0}
            isLoading={hook.isLoading}
            sortColumn={hook.sortColumn}
            sortDirection={hook.sortDirection}
            onSort={hook.setSortColumn}
            onEdit={hook.openEditDrawer}
            onAddCustomer={hook.openAddDrawer}
            onClearFilters={handleClearFilters}
          />
        )}
      </div>

      {/* Add/Edit drawer */}
      <CustomerDrawer
        open={hook.drawerOpen}
        onOpenChange={(open) => {
          if (!open) hook.closeDrawer();
        }}
        editingCustomer={hook.editingCustomer}
        onSubmit={handleSubmit}
      />
    </AppShell>
  );
}
