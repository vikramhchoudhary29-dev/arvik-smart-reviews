import { z } from 'zod';
export const dateOnly = z.iso
  .date()
  .refine(
    (v) => Number(v.slice(0, 4)) >= 2000 && Number(v.slice(0, 4)) <= 2199,
    'Use a date between 2000 and 2199',
  );
export const paise = z.number().int().min(0).max(1000000000);
export const isoDay = (value: Date) => value.toISOString().slice(0, 10);
export const utcDate = (day: string) => new Date(day + 'T00:00:00Z');
export function annualExpiry(startsOn: string) {
  const date = utcDate(startsOn);
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  date.setUTCDate(date.getUTCDate() - 1);
  return isoDay(date);
}
export const nextDay = (day: string) => isoDay(new Date(utcDate(day).getTime() + 86400000));
export type Period = {
  id: string;
  startsOn: string;
  expiresOn: string;
  annualFeePaise: number;
  paidPaise: number;
  duePaise: number;
  paymentStatus: string;
  currency: string;
  status: string;
  daysRemaining: number;
  payments: {
    id: string;
    amountPaise: number;
    paidOn: string;
    method: string;
    reference: string;
    voided: boolean;
  }[];
  notes?: string;
};
export function periodStatus(startsOn: string, expiresOn: string, now = new Date()) {
  const today = isoDay(now),
    daysRemaining = Math.round(
      (utcDate(expiresOn).getTime() - utcDate(today).getTime()) / 86400000,
    );
  return {
    status:
      today < startsOn
        ? 'UPCOMING'
        : daysRemaining < 0
          ? 'EXPIRED'
          : daysRemaining <= 30
            ? 'EXPIRING_SOON'
            : 'ACTIVE',
    daysRemaining,
  };
}
export function money(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value / 100);
}
export function rupeesToPaise(value: string) {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value))
    throw Error('Enter a valid INR amount with up to two decimal places.');
  const [whole, fraction = ''] = value.split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (amount > 1000000000) throw Error('Amount is too large.');
  return amount;
}
export function renewalWhatsAppLink(
  number: string,
  businessName: string,
  period: Pick<Period, 'expiresOn' | 'annualFeePaise'>,
) {
  const raw = number.replace(/\D/g, '');
  const digits = raw.length === 10 ? '91' + raw : raw;
  if (!/^[1-9]\d{9,14}$/.test(digits)) return null;
  const message = `Hello, this is Arvik Digital. This is a yearly renewal reminder for Arvik Smart Reviews for ${businessName}. Your subscription expiry date is ${period.expiresOn}. Yearly renewal fee: ${money(period.annualFeePaise)}. Please contact us to arrange renewal. Thank you!`;
  return 'https://wa.me/' + digits + '?text=' + encodeURIComponent(message);
}
