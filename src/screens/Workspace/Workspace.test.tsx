import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('idb-keyval', () => ({ get: vi.fn(async () => undefined), set: vi.fn(async () => undefined) }));

import { useStore } from '../../store';
import { Workspace } from './Workspace';
import { HatchDefs } from '../../components/HatchDefs';

function setup(id: string) {
  render(
    <>
      <HatchDefs />
      <Workspace assessmentId={id} />
    </>,
  );
}
const treeBtn = (id: string) => within(screen.getByRole('navigation', { name: 'Subdomains' })).getByRole('button', { name: new RegExp(`^${id.replace('.', '\\.')}(?!\\d)`) });

describe('Workspace', () => {
  beforeEach(() => {
    window.location.hash = '#/a/x/workspace';
    useStore.setState({ assessments: {}, ready: true, currentAssessmentId: null, compareIds: [] });
  });

  it('shows 4 anchors and 3 gates for 1.2 and "Anchor not yet defined" for 1.1', async () => {
    const user = userEvent.setup();
    useStore.getState().loadPilot('pilot-estonia-2015');
    const id = Object.keys(useStore.getState().assessments)[0]!;
    setup(id);
    await user.click(treeBtn('1.2'));
    expect(screen.getByText('No instrument; the need is recognised.')).toBeInTheDocument();
    expect(screen.getByText(/^A first order or manual exists/)).toBeInTheDocument();
    expect(screen.getByText(/^The order is in force/)).toBeInTheDocument();
    expect(screen.getByText(/^Stable through at least one change/)).toBeInTheDocument();
    expect(screen.getAllByText(/^Gate: \d → \d$/)).toHaveLength(3);
    expect(screen.queryByText('Anchor not yet defined')).toBeNull();
    await user.click(treeBtn('1.1'));
    expect(screen.getAllByText('Anchor not yet defined')).toHaveLength(4);
    expect(screen.getAllByText('Gate not yet assigned')).toHaveLength(3);
  });

  it('does not save a stage without evidence and shows the message', async () => {
    const user = userEvent.setup();
    const id = useStore.getState().create('Testland', '2026', 'desk', 'self');
    setup(id);
    await user.click(treeBtn('1.1'));
    await user.keyboard('2');
    expect(screen.getByRole('alert')).toHaveTextContent('Add at least one evidence entry first, or choose Unknown.');
    expect(useStore.getState().assessments[id]!.ratings['1.1']).toBeUndefined();
    await user.keyboard('u');
    expect(useStore.getState().assessments[id]!.ratings['1.1']!.stage).toBe('unknown');
  });

  it('requires a reason when overriding the suggested stage', async () => {
    const user = userEvent.setup();
    const id = useStore.getState().create('Testland', '2026', 'desk', 'self');
    useStore.getState().setRating(id, '1.2', { stage: 'unknown', evidence: [{ text: 'Order 12' }] });
    setup(id);
    await user.click(treeBtn('1.2'));
    await user.keyboard('2'); // suggested is 0 with no answers
    const box = screen.getByLabelText(/Reason for choosing stage 2/);
    expect(useStore.getState().assessments[id]!.ratings['1.2']!.stage).toBe('unknown');
    await user.type(box, 'Reviewed in person');
    await user.click(screen.getByRole('button', { name: 'Save stage 2' }));
    const r = useStore.getState().assessments[id]!.ratings['1.2']!;
    expect(r.stage).toBe(2);
    expect(r.stageOverrideReason).toBe('Reviewed in person');
  });
});
