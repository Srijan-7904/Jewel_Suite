// backend/src/domain/finance.ts
// Jewel Suite: Finance, Ledger & Payment Domain Enums & Semantics

export enum PartyType {
  CUSTOMER = 'CUSTOMER',
  SUPPLIER = 'SUPPLIER',
  KARIGAR = 'KARIGAR',
  GIRVI_CLIENT = 'GIRVI_CLIENT',
  OTHER = 'OTHER',
}

export enum EntryType {
  SALE = 'SALE',
  SALE_PAYMENT = 'SALE_PAYMENT',
  PURCHASE = 'PURCHASE',
  PURCHASE_PAYMENT = 'PURCHASE_PAYMENT',
  OPENING_BALANCE = 'OPENING_BALANCE',
  ADJUSTMENT = 'ADJUSTMENT',
  KARIGAR_LABOUR = 'KARIGAR_LABOUR',
  KARIGAR_PAYMENT = 'KARIGAR_PAYMENT',
  REFUND = 'REFUND',
  OTHER = 'OTHER',
}

export enum DebitCredit {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

export enum PaymentType {
  RECEIPT = 'RECEIPT', // Money received by shop
  PAYMENT = 'PAYMENT', // Money paid out by shop
}

export enum PaymentMode {
  CASH = 'CASH',
  CARD = 'CARD',
  UPI = 'UPI',
  BANK = 'BANK',
  CREDIT = 'CREDIT',
  GOLD = 'GOLD',
  SILVER = 'SILVER',
  OTHER = 'OTHER',
}

/**
 * Calculates new party balance based on party type and transaction entry.
 *
 * Semantic Rules:
 * - CUSTOMER: Debits increase receivable; Credits decrease receivable.
 *   Net Balance = Total Debits - Total Credits (Positive = Customer owes shop)
 *
 * - SUPPLIER: Credits increase payable; Debits decrease payable.
 *   Net Balance = Total Credits - Total Debits (Positive = Shop owes supplier)
 *
 * - KARIGAR: Credits increase payable; Debits decrease payable.
 *   Net Balance = Total Credits - Total Debits (Positive = Shop owes karigar)
 */
export function calculateNextBalance(
  partyType: PartyType | string,
  currentBalance: number,
  debitCredit: DebitCredit | string,
  amount: number
): number {
  const normParty = partyType.toUpperCase();
  const normDC = debitCredit.toUpperCase();

  if (normParty === PartyType.CUSTOMER) {
    if (normDC === DebitCredit.DEBIT) {
      return Number((currentBalance + amount).toFixed(2));
    } else {
      return Number((currentBalance - amount).toFixed(2));
    }
  } else {
    // SUPPLIER, KARIGAR, and standard payables
    if (normDC === DebitCredit.CREDIT) {
      return Number((currentBalance + amount).toFixed(2));
    } else {
      return Number((currentBalance - amount).toFixed(2));
    }
  }
}
