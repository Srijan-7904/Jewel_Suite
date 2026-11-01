import { z } from 'zod';
import { supplierRepository, SupplierRecord, SupplierQueryParams } from '../repositories/supplier.repository.js';
import { PaginatedResult } from '../repositories/customer.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { financeRepository } from '../repositories/finance.repository.js';
import { getDb, withTransaction } from '../database/connection/db.js';
import { PartyType, EntryType, DebitCredit, PaymentMode, MetalEntryType } from '../domain/finance.js';
import { BadRequestError, NotFoundError, ConflictError } from '../utils/errors.js';

export const supplierSchema = z.object({
  supplier_code: z.string().trim().optional(),
  name: z.string().min(1, 'Supplier name is required').trim(),
  contact_person: z.string().trim().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  alternate_phone: z.string().trim().nullable().optional(),
  email: z.string().email('Invalid email address').or(z.literal('')).nullable().optional(),
  address: z.string().trim().nullable().optional(),
  city: z.string().trim().nullable().optional(),
  state: z.string().trim().nullable().optional(),
  pincode: z.string().trim().nullable().optional(),
  gstin: z.string().trim().nullable().optional(),

  // Granular Multi-Type Opening Balances
  opening_balance: z.number().default(0),
  opening_balance_type: z.enum(['DEBIT', 'CREDIT']).default('CREDIT'),
  opening_balance_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional().nullable(),
  opening_balance_ref: z.string().trim().optional().nullable(),
  opening_balance_notes: z.string().trim().optional().nullable(),

  opening_cash_balance: z.number().default(0),
  opening_cash_type: z.enum(['DEBIT', 'CREDIT']).default('CREDIT'),

  opening_bank_balance: z.number().default(0),
  opening_bank_type: z.enum(['DEBIT', 'CREDIT']).default('CREDIT'),

  opening_gold_weight: z.number().nonnegative('Gold opening weight must be 0 or positive').default(0),
  opening_gold_type: z.enum(['DEBIT', 'CREDIT']).default('CREDIT'),
  opening_gold_purity_id: z.string().trim().optional().nullable(),
  opening_gold_rate: z.number().nonnegative('Gold valuation rate must be positive or 0').default(0),
  opening_gold_value: z.number().nonnegative('Gold opening value must be positive or 0').default(0),

  opening_silver_weight: z.number().nonnegative('Silver opening weight must be 0 or positive').default(0),
  opening_silver_type: z.enum(['DEBIT', 'CREDIT']).default('CREDIT'),
  opening_silver_purity_id: z.string().trim().optional().nullable(),
  opening_silver_rate: z.number().nonnegative('Silver valuation rate must be positive or 0').default(0),
  opening_silver_value: z.number().nonnegative('Silver opening value must be positive or 0').default(0),

  notes: z.string().trim().nullable().optional(),
  is_active: z.number().int().min(0).max(1).default(1),
});

export const updateSupplierSchema = supplierSchema.partial();

export class SupplierService {
  list(params: SupplierQueryParams): PaginatedResult<SupplierRecord> {
    return supplierRepository.find(params);
  }

  getById(id: string): SupplierRecord {
    const supplier = supplierRepository.findById(id);
    if (!supplier) throw new NotFoundError('Supplier not found');
    return supplier;
  }

  create(data: unknown, userId?: string): SupplierRecord {
    const validated = supplierSchema.parse(data);

    if (validated.supplier_code) {
      const existing = supplierRepository.findByCode(validated.supplier_code);
      if (existing) throw new ConflictError(`Supplier code '${validated.supplier_code}' already exists`);
    }

    return withTransaction(() => {
      // 1. Calculate net monetary opening balance across Cash and Bank
      let cashBal = validated.opening_cash_balance;
      let cashType = validated.opening_cash_type;
      let bankBal = validated.opening_bank_balance;
      let bankType = validated.opening_bank_type;

      // Backward compatibility: If legacy opening_balance is provided and cash/bank are 0
      if (cashBal === 0 && bankBal === 0 && validated.opening_balance > 0) {
        cashBal = validated.opening_balance;
        cashType = validated.opening_balance_type;
      }

      // For supplier: CREDIT is positive (shop owes supplier), DEBIT is negative (supplier owes shop)
      const cashSigned = (cashType === 'CREDIT' ? 1 : -1) * cashBal;
      const bankSigned = (bankType === 'CREDIT' ? 1 : -1) * bankBal;
      const netMonetary = cashSigned + bankSigned;
      const netOpeningBalance = Math.abs(Number(netMonetary.toFixed(2)));
      const netOpeningType: 'DEBIT' | 'CREDIT' = netMonetary >= 0 ? 'CREDIT' : 'DEBIT';

      // 2. Calculate valuation amounts for metals if rate is provided and value is 0
      let goldVal = validated.opening_gold_value;
      if (validated.opening_gold_weight > 0 && validated.opening_gold_rate > 0 && (!goldVal || goldVal === 0)) {
        goldVal = Number((validated.opening_gold_weight * validated.opening_gold_rate).toFixed(2));
      }

      let silverVal = validated.opening_silver_value;
      if (validated.opening_silver_weight > 0 && validated.opening_silver_rate > 0 && (!silverVal || silverVal === 0)) {
        silverVal = Number((validated.opening_silver_weight * validated.opening_silver_rate).toFixed(2));
      }

      // 3. Create supplier record
      const supplier = supplierRepository.create({
        ...validated,
        email: validated.email || null,
        opening_balance: netOpeningBalance,
        opening_balance_type: netOpeningType,
        opening_cash_balance: cashBal,
        opening_cash_type: cashType,
        opening_bank_balance: bankBal,
        opening_bank_type: bankType,
        opening_gold_value: goldVal,
        opening_silver_value: silverVal,
      });

      const db = getDb();
      const opDate = validated.opening_balance_date || new Date().toISOString().split('T')[0];
      const refNumber = validated.opening_balance_ref || `OB-${supplier.supplier_code}`;
      const entryCreatedAt = `${opDate} 00:00:00`;

      // 4. Post Cash Opening Balance to General Ledger exactly once
      if (cashBal > 0) {
        financeRepository.createLedgerEntry({
          party_type: PartyType.SUPPLIER,
          party_id: supplier.id,
          entry_type: EntryType.OPENING_BALANCE,
          debit_credit: cashType as DebitCredit,
          amount: cashBal,
          reference_type: 'SUPPLIER_OPENING_BALANCE',
          reference_number: refNumber,
          description: `Cash Opening Balance${validated.opening_balance_notes ? ` (${validated.opening_balance_notes})` : ''}`,
          payment_method: PaymentMode.CASH,
          created_by: userId || null,
          created_at: entryCreatedAt,
        });
      }

      // 5. Post Bank Opening Balance to General Ledger exactly once
      if (bankBal > 0) {
        financeRepository.createLedgerEntry({
          party_type: PartyType.SUPPLIER,
          party_id: supplier.id,
          entry_type: EntryType.OPENING_BALANCE,
          debit_credit: bankType as DebitCredit,
          amount: bankBal,
          reference_type: 'SUPPLIER_OPENING_BALANCE',
          reference_number: refNumber,
          description: `Bank Opening Balance${validated.opening_balance_notes ? ` (${validated.opening_balance_notes})` : ''}`,
          payment_method: PaymentMode.BANK,
          created_by: userId || null,
          created_at: entryCreatedAt,
        });
      }

      // 6. Post Gold Opening Balance to Party Metal Ledger exactly once
      if (validated.opening_gold_weight > 0) {
        const goldRow = db.prepare(`SELECT id FROM metals WHERE code = 'GOLD' COLLATE NOCASE LIMIT 1`).get() as { id: string } | undefined;
        if (goldRow) {
          financeRepository.createPartyMetalLedgerEntry({
            party_type: PartyType.SUPPLIER,
            party_id: supplier.id,
            metal_id: goldRow.id,
            purity_id: validated.opening_gold_purity_id || null,
            entry_type: MetalEntryType.OPENING_BALANCE,
            debit_credit: validated.opening_gold_type as DebitCredit,
            weight: validated.opening_gold_weight,
            valuation_rate: validated.opening_gold_rate || 0,
            valuation_amount: goldVal || 0,
            reference_type: 'SUPPLIER_OPENING_BALANCE',
            reference_number: refNumber,
            description: `Gold Opening Balance (${validated.opening_gold_weight}g)${validated.opening_balance_notes ? ` (${validated.opening_balance_notes})` : ''}`,
            created_by: userId || null,
            created_at: entryCreatedAt,
          });
        }
      }

      // 7. Post Silver Opening Balance to Party Metal Ledger exactly once
      if (validated.opening_silver_weight > 0) {
        const silverRow = db.prepare(`SELECT id FROM metals WHERE code = 'SILVER' COLLATE NOCASE LIMIT 1`).get() as { id: string } | undefined;
        if (silverRow) {
          financeRepository.createPartyMetalLedgerEntry({
            party_type: PartyType.SUPPLIER,
            party_id: supplier.id,
            metal_id: silverRow.id,
            purity_id: validated.opening_silver_purity_id || null,
            entry_type: MetalEntryType.OPENING_BALANCE,
            debit_credit: validated.opening_silver_type as DebitCredit,
            weight: validated.opening_silver_weight,
            valuation_rate: validated.opening_silver_rate || 0,
            valuation_amount: silverVal || 0,
            reference_type: 'SUPPLIER_OPENING_BALANCE',
            reference_number: refNumber,
            description: `Silver Opening Balance (${validated.opening_silver_weight}g)${validated.opening_balance_notes ? ` (${validated.opening_balance_notes})` : ''}`,
            created_by: userId || null,
            created_at: entryCreatedAt,
          });
        }
      }

      // 8. Audit trail
      auditRepository.log({
        user_id: userId,
        action: 'SUPPLIER_CREATED',
        entity_type: 'SUPPLIER',
        entity_id: supplier.id,
        metadata: {
          code: supplier.supplier_code,
          name: supplier.name,
          opening_cash: cashBal,
          opening_bank: bankBal,
          opening_gold: validated.opening_gold_weight,
          opening_silver: validated.opening_silver_weight,
        },
      });

      return supplierRepository.findById(supplier.id)!;
    });
  }

  update(id: string, data: unknown, userId?: string): SupplierRecord {
    const validated = updateSupplierSchema.parse(data);
    const existing = supplierRepository.findById(id);
    if (!existing) throw new NotFoundError('Supplier not found');

    if (validated.supplier_code && validated.supplier_code !== existing.supplier_code) {
      const duplicate = supplierRepository.findByCode(validated.supplier_code);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError(`Supplier code '${validated.supplier_code}' already exists`);
      }
    }

    const updated = supplierRepository.update(id, validated as any);
    if (!updated) throw new BadRequestError('Failed to update supplier');

    auditRepository.log({
      user_id: userId,
      action: 'SUPPLIER_UPDATED',
      entity_type: 'SUPPLIER',
      entity_id: updated.id,
      metadata: { code: updated.supplier_code, changes: Object.keys(validated) },
    });

    return updated;
  }

  toggleActive(id: string, isActive: boolean, userId?: string): SupplierRecord {
    const existing = supplierRepository.findById(id);
    if (!existing) throw new NotFoundError('Supplier not found');

    const updated = supplierRepository.setActive(id, isActive);
    if (!updated) throw new BadRequestError('Failed to update supplier status');

    auditRepository.log({
      user_id: userId,
      action: isActive ? 'SUPPLIER_ACTIVATED' : 'SUPPLIER_DEACTIVATED',
      entity_type: 'SUPPLIER',
      entity_id: updated.id,
      metadata: { is_active: isActive ? 1 : 0 },
    });

    return updated;
  }
}

export const supplierService = new SupplierService();
