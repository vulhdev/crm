import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import type { Customer, CustomerStatus, UpdateCustomerDto } from "@crm/types";
import { getAvatarPalette } from "@/lib/avatarPalette";
import { formatDate } from "@/lib/formatDate";

interface CustomerKanbanProps {
  customers: Customer[];
  allCustomersEmpty: boolean;
  isLoading: boolean;
  onEdit: (c: Customer) => void;
  onUpdate: (id: string, data: UpdateCustomerDto) => Promise<void>;
  onAddCustomer: () => void;
  onClearFilters: () => void;
}

const STATUSES: CustomerStatus[] = ["Lead", "Active", "Churned", "Archived"];

// ─── Kanban Card ────────────────────────────────────────────────────────────

interface KanbanCardProps {
  customer: Customer;
  onEdit: (c: Customer) => void;
  isOverlay?: boolean;
}

function KanbanCard({ customer, onEdit, isOverlay = false }: KanbanCardProps) {
  const draggable = useDraggable({ id: customer.id });
  const setNodeRef = isOverlay ? undefined : draggable.setNodeRef;
  const attributes = isOverlay ? {} : draggable.attributes;
  const listeners = isOverlay ? {} : draggable.listeners;
  const isDragging = isOverlay ? false : draggable.isDragging;

  const palette = getAvatarPalette(customer.id);
  const initials =
    `${customer.firstName[0] ?? ""}${customer.lastName[0] ?? ""}`.toUpperCase();

  return (
    <div
      ref={setNodeRef}
      data-testid="customer-kanban-card"
      onClick={() => onEdit(customer)}
      style={{ opacity: isDragging ? 0 : 1 }}
      className={`bg-white border border-[#E2DED9] rounded-lg p-3 cursor-grab active:cursor-grabbing transition-shadow hover:border-[#C5C0BA] hover:shadow-sm${isOverlay ? " shadow-xl rotate-[1.5deg] cursor-grabbing ring-1 ring-[#1A7A6E]/20" : ""}`}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-['DM_Sans'] font-medium shrink-0"
          style={{ backgroundColor: palette.bg, color: palette.text }}
        >
          {initials}
        </div>
        <div className="min-w-0">
          <p className="font-['DM_Sans'] font-semibold text-[13px] text-[#141210] truncate leading-tight">
            {customer.firstName} {customer.lastName}
          </p>
          <p className="font-['DM_Sans'] text-[11px] text-[#6B6560] truncate">
            {customer.email}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 mt-1">
        <p className="font-['DM_Sans'] text-[11.5px] text-[#6B6560] truncate">
          {customer.company || "—"}
        </p>
        <p className="font-['DM_Mono'] text-[10.5px] text-[#6B6560] shrink-0">
          {formatDate(customer.lastContactDate)}
        </p>
      </div>
    </div>
  );
}

// ─── Kanban Column ──────────────────────────────────────────────────────────

interface KanbanColumnProps {
  status: CustomerStatus;
  customers: Customer[];
  onEdit: (c: Customer) => void;
  isSourceColumn: boolean;
}

function KanbanColumn({
  status,
  customers,
  onEdit,
  isSourceColumn,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      data-testid={`kanban-column-${status}`}
      className="flex-1 min-w-0 rounded-xl p-3"
      style={{
        backgroundColor: isOver ? "rgba(26,122,110,0.06)" : "#EEECEA",
        border: isOver ? "1.5px solid #1A7A6E" : "1.5px solid transparent",
        transition: "background-color 150ms ease, border-color 150ms ease",
      }}
    >
      {/* Column header */}
      <div
        className="flex items-center justify-between px-1 pb-3"
        style={{ backgroundColor: "transparent" }}
      >
        <h3 className="font-['DM_Sans'] font-semibold text-[11px] tracking-widest text-[#6B6560] uppercase">
          {status}
        </h3>
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#E2DED9] font-['DM_Sans'] font-medium text-[11px] text-[#6B6560]">
          {customers.length}
        </span>
      </div>

      {/* Cards */}
      <div
        className={`flex flex-col gap-2 max-h-[calc(100vh-280px)] ${isSourceColumn ? "overflow-y-hidden" : "overflow-y-auto"}`}
      >
        {customers.length === 0 ? (
          <p className="font-['DM_Sans'] text-[12px] text-[#6B6560]/60 text-center py-8">
            No customers
          </p>
        ) : (
          customers.map((c) => (
            <KanbanCard key={c.id} customer={c} onEdit={onEdit} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Skeleton Column ────────────────────────────────────────────────────────

function SkeletonColumn() {
  return (
    <div className="flex-1 min-w-0 bg-[#EEECEA] rounded-xl p-3">
      <div className="flex items-center justify-between px-1 pb-3">
        <div className="skeleton h-3 w-16 rounded" />
        <div className="skeleton h-5 w-6 rounded-full" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-white border border-[#E2DED9] rounded-lg p-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="skeleton w-8 h-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton h-3 w-3/4 rounded" />
                <div className="skeleton h-2.5 w-1/2 rounded" />
              </div>
            </div>
            <div className="skeleton h-2.5 w-2/3 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Board ─────────────────────────────────────────────────────────────

export function CustomerKanban({
  customers,
  isLoading,
  onEdit,
  onUpdate,
}: CustomerKanbanProps) {
  const sensors = useSensors(useSensor(PointerSensor));
  const [activeId, setActiveId] = useState<string | null>(null);

  const activeCustomer = useMemo(
    () => customers.find((c) => c.id === activeId) ?? null,
    [activeId, customers],
  );

  const grouped = useMemo(() => {
    const map: Record<CustomerStatus, Customer[]> = {
      Lead: [],
      Active: [],
      Churned: [],
      Archived: [],
    };
    for (const c of customers) {
      map[c.status].push(c);
    }
    return map;
  }, [customers]);

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(active.id as string);
  };

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    const customer = customers.find((c) => c.id === active.id);
    if (!customer) return;
    const newStatus = over.id as CustomerStatus;
    if (newStatus === customer.status) return;
    void onUpdate(customer.id, { status: newStatus });
  }

  if (isLoading) {
    return (
      <div
        data-testid="kanban-loading-skeleton"
        className="flex gap-4 pb-4 w-full"
      >
        {STATUSES.map((s) => (
          <SkeletonColumn key={s} />
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      collisionDetection={pointerWithin}
    >
      <div className="flex gap-4 pb-4 min-h-[480px] w-full">
        {STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            customers={grouped[status] ?? []}
            onEdit={onEdit}
            isSourceColumn={
              activeId !== null &&
              (grouped[status] ?? []).some((c) => c.id === activeId)
            }
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
        {activeCustomer ? (
          <KanbanCard customer={activeCustomer} onEdit={() => {}} isOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
