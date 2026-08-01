// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import type { HTMLAttributes } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StepRow } from './StepRow';

describe('StepRow', () => {
  it('accepts all three state types', () => {
    const states = ['pending', 'current', 'done'] as const;
    for (const state of states) {
      const props = { label: 'Test', state, index: 1 };
      expect(props.state).toBe(state);
    }
  });

  it('accepts optional index and trailing props', () => {
    const props1 = { label: 'Test', state: 'pending' as const };
    expect(props1.state).toBe('pending');

    const props2 = { label: 'Test', state: 'current' as const, index: 2, trailing: 'now' };
    expect(props2.trailing).toBe('now');
  });

  it('renders input field when onChangeLabel is provided', () => {
    const handleChange = vi.fn();
    render(<StepRow label="Editable step" state="pending" onChangeLabel={handleChange} />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('Editable step');

    fireEvent.change(input, { target: { value: 'Updated step' } });
    expect(handleChange).toHaveBeenCalledWith('Updated step');
  });

  it('renders delete button when onDelete is provided', () => {
    const handleDelete = vi.fn();
    render(<StepRow label="Step to delete" state="pending" onDelete={handleDelete} />);

    const deleteBtn = screen.getByRole('button', { name: /delete step/i });
    expect(deleteBtn).toBeInTheDocument();

    fireEvent.click(deleteBtn);
    expect(handleDelete).toHaveBeenCalledTimes(1);
  });

  it('renders the bullet as a clickable toggle when onToggleDone is provided', () => {
    const handleToggle = vi.fn();
    render(<StepRow label="Toggle me" state="pending" onToggleDone={handleToggle} />);

    const toggleBtn = screen.getByRole('button', { name: /mark step complete/i });
    expect(toggleBtn).toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it('labels the toggle button for un-marking a done step', () => {
    const handleToggle = vi.fn();
    render(<StepRow label="Done step" state="done" onToggleDone={handleToggle} />);

    expect(screen.getByRole('button', { name: /mark step incomplete/i })).toBeInTheDocument();
  });

  it('renders a plain, non-interactive bullet when onToggleDone is omitted', () => {
    render(<StepRow label="Static step" state="done" />);

    expect(screen.queryByRole('button', { name: /mark step/i })).not.toBeInTheDocument();
  });

  it('renders drag handle when dragHandleProps are provided', () => {
    const dragProps: HTMLAttributes<HTMLSpanElement> = {
      'aria-label': 'Custom handle',
    };

    render(<StepRow label="Draggable step" state="pending" dragHandleProps={dragProps} />);

    const dragHandle = screen.getByLabelText('Custom handle');
    expect(dragHandle).toBeInTheDocument();
    expect(dragHandle.textContent).toBe('⋮⋮');
  });
});
