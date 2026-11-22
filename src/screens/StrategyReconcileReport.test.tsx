import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('idb-keyval', () => {
  const m = new Map<string, unknown>();
  return { get: vi.fn(async (k: string) => m.get(k)), set: vi.fn(async (k: string, v: unknown) => void m.set(k, v)) };
});

import App from '../App';
import { useStore } from '../store';
import { pilots, strategyRules } from '../data';

const load = (country: string) => useStore.getState().loadPilot(pilots.find((p) => p.raw.country === country)!.id)!;

describe('Strategy, Reconcile, Report', () => {
  afterEach(cleanup);
  beforeEach(() => {
    window.location.hash = '';
    useStore.setState({ assessments: {}, ready: false, currentAssessmentId: null, compareIds: [] });
  });

  it('Strategy for Estonia shows the placeholder status and rule R2', async () => {
    const id = load('Estonia');
    window.location.hash = `#/a/${id}/strategy`;
    render(<App />);
    expect((await screen.findAllByText(/PLACEHOLDER/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText('R2').length).toBeGreaterThan(0);
    expect(screen.getByText(/not a verdict/)).toBeInTheDocument();
  });

  it('Reconcile computes and shows kappa for an imported second set', async () => {
    const id = load('Estonia');
    const ph = pilots.find((p) => p.raw.country === 'Philippines')!.raw;
    window.location.hash = `#/a/${id}/reconcile`;
    const { container } = render(<App />);
    expect(await screen.findByText(/No second rating set imported yet/)).toBeInTheDocument();
    const file = new File([JSON.stringify({ name: 'Second', ratings: ph.ratings })], 's.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: async () => JSON.stringify({ name: 'Second', ratings: ph.ratings }) });
    fireEvent.change(container.querySelector('input[type=file]')!, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText(/Linear weighted kappa/)).toBeInTheDocument());
    const summary = screen.getByLabelText('Agreement summary');
    expect(summary.textContent).toMatch(/kappa:\s*-?\d\.\d\d/);
    expect(summary.textContent).toMatch(/Pairs compared:\s*\d+/);
    expect(useStore.getState().assessments[id].secondAssessor?.name).toBe('Second');
  });

  it('Report for Philippines shows scores, strategy status and sources', async () => {
    const id = load('Philippines');
    window.location.hash = `#/a/${id}/report`;
    const { container } = render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: /Philippines/ })).toBeInTheDocument();
    expect(container.textContent).toMatch(/Coverage/);
    expect(container.textContent).toMatch(/\d+%–\d+%/);
    expect(container.textContent).toContain(strategyRules.status);
    const raw = pilots.find((p) => p.raw.country === 'Philippines')!.raw;
    expect(raw.sources!.length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { level: 2, name: 'Sources' })).toBeInTheDocument();
    expect(container.textContent).toContain(raw.sources![0].title);
    expect(screen.getByRole('button', { name: /Print/ })).toBeInTheDocument();
  });
});
