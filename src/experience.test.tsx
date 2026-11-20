import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

// Deterministic OCR for the scanner UI test. The real engine is exercised in
// the browser smoke run instead of jsdom; the pure parser stays real.
vi.mock('@/services/ocr', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/ocr')>();
  return {
    ...actual,
    scanReceipt: async () => ({
      rupees: 700,
      rawText: 'AMOUNT PAID\nRs. 700',
      source: 'ocr',
      durationMs: 12,
      ocrError: null,
    }),
  };
});

import App from '@/App';
import { useStore } from '@/store/useStore';
import { navigate } from '@/router';
import { parseAmountFromText } from '@/services/ocr';
import { addCredit, seedCustomer, setUrl, SAMPLE_TEXT } from '@/test/helpers';

function q<T extends Element = HTMLElement>(selector: string): T | null {
  return document.querySelector<T>(selector);
}

describe('success moments', () => {
  it('celebrates a recorded payment with the new balance', async () => {
    setUrl('/?today=2026-11-15');
    const customer = seedCustomer('Ravi Kumar', '9000000101');
    addCredit(customer.id, 500, '2026-11-01');

    render(<App />);
    fireEvent.click(q('[data-customer="9000000101"]') as HTMLElement);

    const user = userEvent.setup();
    await user.click(await screen.findByRole('radio', { name: /Payment received/i }));
    await user.type(screen.getByLabelText('Amount'), '300');
    await user.click(screen.getByRole('button', { name: 'Add entry' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Payment recorded')).toBeTruthy();
    expect(within(dialog).getByText('₹300')).toBeTruthy();
    expect(within(dialog).getByText('New balance')).toBeTruthy();
    expect(within(dialog).getByText('₹200')).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByText('Payment recorded')).toBeNull());
    expect(q('[data-balance]')?.textContent).toContain('200');
  });

  it('confirms a new customer with an opening balance', async () => {
    setUrl('/?today=2026-11-15');
    render(<App />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Add your first customer' }));
    const form = await screen.findByRole('dialog');
    await user.type(within(form).getByLabelText('Name'), 'Sita Devi');
    await user.type(within(form).getByLabelText('Phone'), '9000000123');
    await user.type(within(form).getByLabelText(/Opening balance/), '500');
    await user.click(within(form).getByRole('button', { name: 'Add customer' }));

    const success = await screen.findByRole('dialog');
    expect(within(success).getByText('Customer added')).toBeTruthy();
    expect(within(success).getByText(/Sita Devi/)).toBeTruthy();
    expect(within(success).getByText('Opening balance')).toBeTruthy();
    expect(useStore.getState().transactions).toHaveLength(1);

    await user.click(within(success).getByRole('button', { name: 'Add first entry' }));

    await waitFor(() => {
      expect(q('form[data-entry-form="new"]')).not.toBeNull();
    });
    expect(q('[data-balance]')?.textContent).toContain('500');
  });
});

describe('receipt scanner', () => {
  it('scans an image, fills the amount, and attaches the receipt', async () => {
    setUrl('/?today=2026-11-15');
    const customer = seedCustomer('Ravi Kumar', '9000000101');
    render(<App />);
    const user = userEvent.setup();

    fireEvent.click(q(`[data-customer="${customer.phone}"]`) as HTMLElement);
    await screen.findByRole('button', { name: 'Scan receipt' });

    await user.click(screen.getByRole('button', { name: 'Scan receipt' }));
    const scanner = await screen.findByRole('dialog');
    expect(within(scanner).getByText('Scan receipt')).toBeTruthy();

    const gallery = scanner.querySelector<HTMLInputElement>(
      '[data-testid="scan-gallery-input"]',
    ) as HTMLInputElement;
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'receipt.png', {
      type: 'image/png',
    });
    await user.upload(gallery, file);

    const useButton = await within(scanner).findByRole(
      'button',
      { name: /Use ₹700/i },
      { timeout: 8000 },
    );
    await user.click(useButton);

    await waitFor(() => {
      expect((q<HTMLInputElement>('input[name="amount"]') as HTMLInputElement).value).toBe('700');
    });
    expect(q('img[src^="blob:"]')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Add entry' }));
    await waitFor(() => {
      expect(q('[data-balance]')?.textContent).toContain('700');
    });
    expect(useStore.getState().transactions[0]?.screenshotId).toBeTruthy();
  });

  it('reads the amount out of receipt text', () => {
    expect(parseAmountFromText('AMOUNT PAID\nRs. 700\nRef 4288 9102 3344')?.rupees).toBe(700);
    expect(parseAmountFromText('Total: ₹1,250.50')?.rupees).toBe(1250.5);
    expect(parseAmountFromText('no numbers here')).toBeNull();
  });
});

describe('import success state', () => {
  it('shows the import celebration with the added counts', async () => {
    setUrl('/?today=2026-11-15');
    render(<App />);
    act(() => navigate('/import'));

    const box = (await waitFor(() => q('#import-box'))) as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: SAMPLE_TEXT } });
    fireEvent.click(q('#import-go') as HTMLButtonElement);

    await waitFor(() => {
      expect(screen.getByText('Import complete')).toBeTruthy();
    });
    expect(screen.getByText(/8 customers and 38 entries added/)).toBeTruthy();
  });
});
