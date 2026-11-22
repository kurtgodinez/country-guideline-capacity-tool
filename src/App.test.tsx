import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('idb-keyval', () => {
  const m = new Map<string, unknown>();
  return {
    get: vi.fn(async (k: string) => m.get(k)),
    set: vi.fn(async (k: string, v: unknown) => void m.set(k, v)),
  };
});

import App from './App';
import { useStore } from './store';

describe('App smoke', () => {
  beforeEach(() => {
    window.location.hash = '';
    useStore.setState({ assessments: {}, ready: false, currentAssessmentId: null, compareIds: [] });
  });

  it('renders Home and loads the Estonia pilot with a national score and coverage', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Assessments' })).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Load pilot Estonia' }));
    const row = (await screen.findByRole('rowheader', { name: 'Estonia' })).closest('tr')!;
    expect(within(row).getByText(/^\d+%$/, { selector: "span" })).toBeInTheDocument();
    expect(within(row).getByText(/Coverage \d+%/)).toBeInTheDocument();
    expect(within(row).getByText(/Range \d+%–\d+%/)).toBeInTheDocument();
    expect(within(row).getByText(/Weakest: 3 Priority setting/)).toBeInTheDocument();
    expect(within(row).getAllByText(/assessed/i).length).toBeGreaterThan(0);
  });
});
