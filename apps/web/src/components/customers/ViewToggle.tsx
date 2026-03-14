import { List, LayoutGrid, Columns } from 'lucide-react';

export type ViewMode = 'list' | 'grid' | 'kanban';

interface ViewToggleProps {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

const BUTTONS: { mode: ViewMode; Icon: typeof List; label: string }[] = [
  { mode: 'list', Icon: List, label: 'List view' },
  { mode: 'grid', Icon: LayoutGrid, label: 'Grid view' },
  { mode: 'kanban', Icon: Columns, label: 'Kanban view' },
];

export function ViewToggle({ viewMode, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center border border-[#E2DED9] rounded-lg overflow-hidden divide-x divide-[#E2DED9] h-9">
      {BUTTONS.map(({ mode, Icon, label }) => (
        <button
          key={mode}
          onClick={() => {
            if (viewMode === mode) return;
            onChange(mode);
          }}
          aria-pressed={viewMode === mode ? 'true' : 'false'}
          aria-label={label}
          className={[
            'w-9 h-9 flex items-center justify-center transition-colors duration-150',
            viewMode === mode
              ? 'bg-[#1A7A6E] text-white'
              : 'bg-white text-[#6B6560] hover:bg-[#F0EFEC] hover:text-[#141210]',
          ].join(' ')}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  );
}
