import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';

vi.mock('idb-keyval', () => {
  const m = new Map<string, unknown>();
  return { get: vi.fn(async (k: string) => m.get(k)), set: vi.fn(async (k: string, v: unknown) => void m.set(k, v)) };
});

import App from '../App';
import { useStore } from '../store';
import { pilots } from '../data';

describe('Profile and Compare', () => {
  afterEach(cleanup);
  beforeEach(() => {
    window.location.hash = '';
    useStore.setState({ assessments: {}, ready: false, currentAssessmentId: null, compareIds: [] });
  });

  it('Profile for Estonia: 49 cells, hatched unknowns, full headline', async () => {
    const id = useStore.getState().loadPilot(pilots.find((p) => p.raw.country === 'Estonia')!.id)!;
    expect(id).toBeTruthy();
    window.location.hash = `#/a/${id}/profile`;
    const { container } = render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: /Estonia/ })).toBeInTheDocument();
    const cells = container.querySelectorAll('[data-subdomain]');
    expect(cells).toHaveLength(49);
    const unknown = container.querySelectorAll('[data-subdomain][data-stage="unknown"]');
    expect(unknown).toHaveLength(9);
    unknown.forEach((u) => expect(u.querySelector('rect')!.getAttribute('fill')).toBe('url(#pat-unknown)'));
    const badge = screen.getByTitle('How this number was made');
    expect(within(badge).getByText(/Coverage \d+%/)).toBeInTheDocument();
    expect(within(badge).getByText(/Range \d+%–\d+%/)).toBeInTheDocument();
    expect(within(badge).getByText(/Priority setting/)).toBeInTheDocument();
    expect(within(badge).getByText('Externally assessed')).toBeInTheDocument();
  });

  it('Compare defaults to Estonia vs Philippines with difference marks', async () => {
    window.location.hash = '#/compare';
    const { container } = render(<App />);
    await within(container).findByRole('heading', { level: 2, name: /Estonia/ }); 
    expect(within(container).getByRole('heading', { level: 2, name: /Philippines/ })).toBeInTheDocument();
    expect(container.querySelectorAll('[data-subdomain]').length).toBe(98);
    expect(container.textContent).toMatch(/[Δ]\d|\?≠/);
    expect(screen.getByText(/differ by 2 or more stages/)).toBeInTheDocument();
  });
});
