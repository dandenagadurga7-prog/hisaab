import { useEffect, useId, useState, type FormEvent } from 'react';
import { UserPlus } from 'lucide-react';
import type { Customer, ErrorCode, FieldError } from '@/types';
import { useStore } from '@/store/useStore';
import { useT } from '@/hooks/useT';
import { navigate } from '@/router';
import { parseAmount } from '@/lib/money';
import { Button, Field, Input } from './ui';
import { Modal } from './Modal';
import { SuccessDialog } from './SuccessDialog';

function toMessageMap(t: ReturnType<typeof useT>, errors: FieldError[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const error of errors) {
    map[error.field] = t(`error.${error.code as ErrorCode}`);
  }
  return map;
}

export function AddCustomerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addCustomer = useStore((state) => state.addCustomer);
  const t = useT();
  const uid = useId();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [openingText, setOpeningText] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Customer | null>(null);
  const [openingPaise, setOpeningPaise] = useState(0);

  useEffect(() => {
    if (!open) {
      setName('');
      setPhone('');
      setOpeningText('');
      setErrors({});
      setBusy(false);
      setCreated(null);
      setOpeningPaise(0);
    }
  }, [open]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setErrors({});

    let opening = 0;
    if (openingText.trim() !== '') {
      const parsed = parseAmount(openingText);
      if (!parsed.ok) {
        setErrors({ opening: t('error.amount_invalid') });
        return;
      }
      opening = parsed.paise;
    }

    setBusy(true);
    const result = addCustomer(
      { name, phone },
      opening > 0
        ? { openingBalancePaise: opening, openingNote: t('success.openingBalance') }
        : undefined,
    );
    setBusy(false);

    if (!result.ok) {
      setErrors(toMessageMap(t, result.errors));
      return;
    }
    setOpeningPaise(opening);
    setCreated(result.value);
  };

  const finish = () => {
    setCreated(null);
    onClose();
  };

  const addFirstEntry = () => {
    const customer = created;
    setCreated(null);
    onClose();
    if (customer) navigate(`/customer/${customer.id}`);
  };

  return (
    <>
      <Modal
        open={open && !created}
        onClose={onClose}
        title={t('addCustomer.title')}
        description={t('addCustomer.subtitle')}
        icon={<UserPlus className="h-5 w-5" />}
        size="sm"
      >
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label={t('common.name')} htmlFor={`${uid}-name`} error={errors.name}>
            <Input
              id={`${uid}-name`}
              name="name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
              }}
              placeholder="Ravi Kumar"
              autoComplete="off"
              maxLength={90}
              aria-invalid={Boolean(errors.name)}
            />
          </Field>

          <Field
            label={t('common.phone')}
            htmlFor={`${uid}-phone`}
            hint={t('addCustomer.phoneHint')}
            error={errors.phone}
          >
            <Input
              id={`${uid}-phone`}
              name="phone"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value.replace(/[^\d+\s-]/g, '').slice(0, 18));
                if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
              }}
              placeholder="98765 43210"
              inputMode="numeric"
              autoComplete="tel"
              aria-invalid={Boolean(errors.phone)}
            />
          </Field>

          <Field
            label={t('addCustomer.opening')}
            htmlFor={`${uid}-opening`}
            hint={t('addCustomer.openingHint')}
            error={errors.opening}
            optional={t('common.optional')}
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted">
                ₹
              </span>
              <Input
                id={`${uid}-opening`}
                name="openingBalance"
                value={openingText}
                onChange={(event) => {
                  setOpeningText(event.target.value.replace(/[^\d.,]/g, ''));
                  if (errors.opening) setErrors((prev) => ({ ...prev, opening: '' }));
                }}
                placeholder="0"
                inputMode="decimal"
                autoComplete="off"
                className="pl-8 tabular"
                aria-invalid={Boolean(errors.opening)}
              />
            </div>
          </Field>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="secondary" size="md" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" size="md" loading={busy}>
              {t('addCustomer.save')}
            </Button>
          </div>
        </form>
      </Modal>

      <SuccessDialog
        open={Boolean(created)}
        kind="customer"
        title={t('success.customerTitle')}
        subtitle={t('success.customerBody', { name: created?.name ?? '' })}
        balancePaise={openingPaise > 0 ? openingPaise : undefined}
        balanceLabel={t('success.openingBalance')}
        primaryLabel={t('success.addFirstEntry')}
        onPrimary={addFirstEntry}
        secondaryLabel={t('success.done')}
        onSecondary={finish}
        onClose={finish}
      />
    </>
  );
}

export function EditCustomerDialog({
  customer,
  open,
  onClose,
}: {
  customer: Customer | null;
  open: boolean;
  onClose: () => void;
}) {
  const updateCustomer = useStore((state) => state.updateCustomer);
  const pushToast = useStore((state) => state.pushToast);
  const t = useT();
  const uid = useId();

  const [name, setName] = useState(customer?.name ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && customer) {
      setName(customer.name);
      setPhone(customer.phone);
      setErrors({});
    }
  }, [open, customer]);

  if (!customer) return null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const result = updateCustomer(customer.id, { name, phone });
    setBusy(false);
    if (!result.ok) {
      setErrors(toMessageMap(t, result.errors));
      return;
    }
    pushToast('toast.customerUpdated');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('editCustomer.title')}
      description={t('editCustomer.subtitle')}
      size="sm"
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label={t('common.name')} htmlFor={`${uid}-name`} error={errors.name}>
          <Input
            id={`${uid}-name`}
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={90}
            aria-invalid={Boolean(errors.name)}
          />
        </Field>

        <Field
          label={t('common.phone')}
          htmlFor={`${uid}-phone`}
          hint={t('addCustomer.phoneHint')}
          error={errors.phone}
        >
          <Input
            id={`${uid}-phone`}
            name="phone"
            value={phone}
            onChange={(event) =>
              setPhone(event.target.value.replace(/[^\d+\s-]/g, '').slice(0, 18))
            }
            inputMode="numeric"
            autoComplete="tel"
            aria-invalid={Boolean(errors.phone)}
          />
        </Field>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" loading={busy}>
            {t('customer.saveChanges')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
