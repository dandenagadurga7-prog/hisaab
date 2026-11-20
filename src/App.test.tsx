import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '@/App';
import { __resetHisaabState, useStore } from '@/store/useStore';
import { navigate } from '@/router';
import { addCredit, seedCustomer, seedSample, setUrl, SAMPLE_TEXT } from '@/test/helpers';

function q<T extends Element = HTMLElement>(selector: string): T | null {
  return document.querySelector<T>(selector);
}

describe('Hisaab — mandatory tester selectors', () => {
  it('renders the sample ledger with the exact total and balances', async () => {
    setUrl('/?today=2026-11-15');
    seedSample();
    render(<App />);

    const total = q('#total-outstanding');
    expect(total).not.toBeNull();
    expect(total?.textContent).toContain('11,820');
    expect(total?.getAttribute('data-amount')).toBe('11820');

    const ravi = q('[data-customer="9000000101"]');
    expect(ravi).not.toBeNull();
    expect(ravi?.querySelector('[data-balance]')?.textContent).toContain('670');

    const sunita = q('[data-customer="9000000102"]');
    expect(sunita?.querySelector('[data-balance]')?.textContent).toContain('3,470');

    const remind = q<HTMLAnchorElement>('a[data-remind="9000000101"]');
    expect(remind).not.toBeNull();
    const href = remind?.getAttribute('href') ?? '';
    expect(href.startsWith('https://wa.me/919000000101?text=')).toBe(true);
    const decoded = decodeURIComponent(href.split('?text=')[1] ?? '');
    expect(decoded).toContain('Ravi Kumar');
    expect(decoded).toContain('₹670');

    // 8 customers rendered, each with a balance element.
    await waitFor(() => {
      expect(document.querySelectorAll('[data-customer]')).toHaveLength(8);
    });
    expect(document.querySelectorAll('[data-balance]').length).toBeGreaterThanOrEqual(8);
  });

  it('imports through #import-box and #import-go and recalculates', async () => {
    setUrl('/?today=2026-11-15');
    render(<App />);

    act(() => navigate('/import'));

    const box = (await waitFor(() => q<HTMLTextAreaElement>('#import-box'))) as HTMLTextAreaElement;
    expect(box).not.toBeNull();

    fireEvent.change(box, { target: { value: SAMPLE_TEXT } });
    const go = q<HTMLButtonElement>('#import-go');
    expect(go).not.toBeNull();
    fireEvent.click(go as HTMLButtonElement);

    await waitFor(() => {
      expect(useStore.getState().customers).toHaveLength(8);
      expect(useStore.getState().transactions).toHaveLength(38);
    });

    act(() => navigate('/'));

    await waitFor(() => {
      expect(q('#total-outstanding')?.textContent).toContain('11,820');
    });
  });

  it('records a payment and updates every surface without a reload', async () => {
    setUrl('/?today=2026-11-15');
    const customer = seedCustomer('Ravi Kumar', '9000000101');
    addCredit(customer.id, 500, '2026-11-01');

    render(<App />);

    fireEvent.click(q('[data-customer="9000000101"]') as HTMLElement);
    await waitFor(() => expect(q('[data-balance]')).not.toBeNull());
    expect(q('[data-balance]')?.textContent).toContain('500');

    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: /Payment received/i }));
    await user.type(screen.getByLabelText('Amount'), '300');
    await user.click(screen.getByRole('button', { name: 'Add entry' }));

    await waitFor(() => {
      expect(q('[data-balance]')?.textContent).toContain('200');
    });

    act(() => navigate('/'));
    await waitFor(() => {
      expect(q('#total-outstanding')?.textContent).toContain('₹200');
      expect(q('#total-outstanding')?.getAttribute('data-amount')).toBe('200');
    });
  });

  it('keeps a payment screenshot after a reload', async () => {
    setUrl('/?today=2026-11-15');
    const customer = seedCustomer('Screenshot Customer', '9000000101');

    const first = render(<App />);
    fireEvent.click(q('[data-customer="9000000101"]') as HTMLElement);

    const input = (await waitFor(() => q<HTMLInputElement>('#shot-input'))) as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.getAttribute('accept')).toContain('image/png');

    const user = userEvent.setup();
    const file = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'receipt.png', {
      type: 'image/png',
    });
    await user.upload(input, file);
    await user.type(screen.getByLabelText('Amount'), '250');
    await user.click(screen.getByRole('button', { name: 'Add entry' }));

    await waitFor(
      () => {
        expect(q('img[data-shot]')).not.toBeNull();
      },
      { timeout: 4000 },
    );
    const shotId = q('img[data-shot]')?.getAttribute('data-shot');
    expect(shotId).toBeTruthy();

    first.unmount();
    __resetHisaabState();
    render(<App />);

    await waitFor(
      () => {
        expect(q(`img[data-shot="${shotId}"]`)).not.toBeNull();
      },
      { timeout: 4000 },
    );
    expect(useStore.getState().transactions[0]?.screenshotId).toBe(shotId);
    expect(useStore.getState().customers[0]?.id).toBe(customer.id);
  });

  it('defaults the entry date to ?today=', async () => {
    setUrl('/?today=2026-11-15');
    const customer = seedCustomer();
    render(<App />);

    fireEvent.click(q(`[data-customer="${customer.phone}"]`) as HTMLElement);

    const dateInput = (await waitFor(() =>
      q<HTMLInputElement>('input[name="date"]'),
    )) as HTMLInputElement;
    expect(dateInput.value).toBe('2026-11-15');
    expect(dateInput.getAttribute('max')).toBe('2026-11-15');
  });
});

describe('Hisaab — customer flows', () => {
  it('validates the phone number and then creates the customer', async () => {
    render(<App />);
    const user = userEvent.setup();

    expect(screen.getByRole('heading', { name: 'Your khata is empty' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Add your first customer' }));
    const dialog = await screen.findByRole('dialog');

    await user.type(within(dialog).getByLabelText('Name'), 'Ravi Kumar');
    await user.type(within(dialog).getByLabelText('Phone'), '12345');
    await user.click(within(dialog).getByRole('button', { name: 'Add customer' }));

    expect(await within(dialog).findByText('Enter exactly 10 digits.')).toBeTruthy();
    expect(document.querySelectorAll('[data-customer]')).toHaveLength(0);

    const phone = within(dialog).getByLabelText('Phone');
    await user.clear(phone);
    await user.type(phone, '9000000101');
    await user.click(within(dialog).getByRole('button', { name: 'Add customer' }));

    await waitFor(() => {
      expect(q('[data-customer="9000000101"]')).not.toBeNull();
    });
    expect(useStore.getState().customers).toHaveLength(1);
  });

  it('rejects a duplicate phone number', async () => {
    seedCustomer('Ravi Kumar', '9000000101');
    render(<App />);
    const user = userEvent.setup();

    await user.click(screen.getAllByRole('button', { name: 'Add customer' })[0] as HTMLElement);
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), 'Another Ravi');
    await user.type(within(dialog).getByLabelText('Phone'), '9000000101');
    await user.click(within(dialog).getByRole('button', { name: 'Add customer' }));

    expect(
      await within(dialog).findByText('This phone number already belongs to another customer.'),
    ).toBeTruthy();
    expect(useStore.getState().customers).toHaveLength(1);
  });

  it('deletes a customer only after confirmation', async () => {
    const customer = seedCustomer('Ravi Kumar', '9000000101');
    addCredit(customer.id, 250, useStore.getState().today);
    render(<App />);
    const user = userEvent.setup();

    fireEvent.click(q('[data-customer="9000000101"]') as HTMLElement);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy());

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/permanently removes the customer/)).toBeTruthy();
    expect(useStore.getState().customers).toHaveLength(1);

    await user.click(within(dialog).getByRole('button', { name: 'Delete permanently' }));
    await waitFor(() => expect(useStore.getState().customers).toHaveLength(0));
    expect(useStore.getState().transactions).toHaveLength(0);
  });

  it('loads demo data from the empty state and shows the sample total', async () => {
    setUrl('/?today=2026-11-15');
    render(<App />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Load sample JSON' }));

    await waitFor(() => {
      expect(useStore.getState().customers).toHaveLength(8);
      expect(q('#total-outstanding')?.textContent).toContain('11,820');
    });
  });
});

describe('Hisaab — search, overdue and language', () => {
  it('filters customers by name and by phone', async () => {
    setUrl('/?today=2026-11-15');
    seedSample();
    render(<App />);
    const user = userEvent.setup();

    const search = screen.getByPlaceholderText('Search by name or phone…');
    await user.type(search, 'sunita');
    await waitFor(() => expect(document.querySelectorAll('[data-customer]')).toHaveLength(1));
    expect(q('[data-customer="9000000102"]')).not.toBeNull();

    await user.clear(search);
    await user.type(search, '0107');
    await waitFor(() => expect(document.querySelectorAll('[data-customer]')).toHaveLength(1));
    expect(q('[data-customer="9000000107"]')).not.toBeNull();
  });

  it('lists overdue customers worst-first', async () => {
    setUrl('/?today=2026-11-15');
    seedSample();
    render(<App />);

    act(() => navigate('/overdue'));

    await waitFor(() => {
      expect(document.querySelectorAll('a[data-remind]')).toHaveLength(4);
    });

    const text = document.body.textContent ?? '';
    expect(text).toContain('Sunita Devi');
    expect(text).toContain('Prakash Rao');
    expect(text).toContain('61 days');
  });

  it('switches the interface to Hindi and Telugu', async () => {
    seedSample();
    render(<App />);
    const user = userEvent.setup();

    const selects = screen.getAllByLabelText('Language');
    expect(selects.length).toBeGreaterThan(0);

    await user.selectOptions(selects[0] as HTMLElement, 'hi');
    await waitFor(() => {
      expect(screen.getAllByText(/कुल बकाया/).length).toBeGreaterThan(0);
    });

    const hindiSelects = screen.getAllByLabelText('भाषा');
    await user.selectOptions(hindiSelects[0] as HTMLElement, 'te');
    await waitFor(() => {
      expect(screen.getAllByText(/మొత్తం బాకీ/).length).toBeGreaterThan(0);
    });
  });
});

describe('Hisaab — settings', () => {
  it('saves shop details and shows a UPI link on the customer page', async () => {
    setUrl('/?today=2026-11-15');
    const customer = seedCustomer('Ravi Kumar', '9000000101');
    addCredit(customer.id, 500, '2026-11-01');
    render(<App />);
    const user = userEvent.setup();

    act(() => navigate('/settings'));
    const shopInput = await screen.findByLabelText('Shop name');
    await user.clear(shopInput);
    await user.type(shopInput, 'Lakshmi Provision Store');
    await user.type(screen.getByLabelText(/UPI ID/), 'lakshmi@okhdfcbank');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(useStore.getState().settings.shopName).toBe('Lakshmi Provision Store');
      expect(useStore.getState().settings.upiId).toBe('lakshmi@okhdfcbank');
    });

    act(() => navigate(`/customer/${customer.id}`));
    const upi = await waitFor(() => q<HTMLAnchorElement>('a[href^="upi://pay"]'));
    expect(upi).not.toBeNull();
    expect(upi?.getAttribute('href')).toContain('am=500.00');
  });
});
