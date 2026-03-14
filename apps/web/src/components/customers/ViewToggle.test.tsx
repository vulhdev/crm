import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ViewToggle } from './ViewToggle';

describe('ViewToggle', () => {
  it('renders 3 buttons', () => {
    render(<ViewToggle viewMode="list" onChange={vi.fn()} />);
    expect(screen.getByLabelText('List view')).toBeInTheDocument();
    expect(screen.getByLabelText('Grid view')).toBeInTheDocument();
    expect(screen.getByLabelText('Kanban view')).toBeInTheDocument();
  });

  it('sets aria-pressed=true only on the active mode button', () => {
    render(<ViewToggle viewMode="grid" onChange={vi.fn()} />);
    expect(screen.getByLabelText('List view')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText('Grid view')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Kanban view')).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange with the new mode when clicking an inactive button', async () => {
    const onChange = vi.fn();
    render(<ViewToggle viewMode="list" onChange={onChange} />);
    await userEvent.click(screen.getByLabelText('Grid view'));
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('grid');
  });

  it('does not call onChange when clicking the already-active button', async () => {
    const onChange = vi.fn();
    render(<ViewToggle viewMode="kanban" onChange={onChange} />);
    await userEvent.click(screen.getByLabelText('Kanban view'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('calls onChange with list mode', async () => {
    const onChange = vi.fn();
    render(<ViewToggle viewMode="grid" onChange={onChange} />);
    await userEvent.click(screen.getByLabelText('List view'));
    expect(onChange).toHaveBeenCalledWith('list');
  });

  it('calls onChange with kanban mode', async () => {
    const onChange = vi.fn();
    render(<ViewToggle viewMode="list" onChange={onChange} />);
    await userEvent.click(screen.getByLabelText('Kanban view'));
    expect(onChange).toHaveBeenCalledWith('kanban');
  });
});
