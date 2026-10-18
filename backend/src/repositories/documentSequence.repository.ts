// backend/src/repositories/documentSequence.repository.ts
import { getDb, withTransaction } from '../database/connection/db.js';
import { DocumentType, DocumentSequenceConfig } from '../domain/settings.js';

interface SequenceRow {
  doc_type: string;
  prefix: string;
  starting_number: number;
  current_value: number;
  padding: number;
  financial_year_reset: number;
  financial_year: string | null;
  updated_at: string;
}

export class DocumentSequenceRepository {
  /**
   * Initializes default sequences and synchronizes with existing database records if current_value is 0.
   */
  initDefaults(): void {
    const db = getDb();
    const defaults: { doc_type: DocumentType; prefix: string; table: string; col: string }[] = [
      { doc_type: 'INVOICE', prefix: 'INV', table: 'sales_invoices', col: 'invoice_number' },
      { doc_type: 'PURCHASE', prefix: 'PUR', table: 'purchase_bills', col: 'purchase_number' },
      { doc_type: 'REPAIR', prefix: 'REP', table: 'repairs', col: 'repair_number' },
      { doc_type: 'EXCHANGE', prefix: 'EX', table: 'exchange_transactions', col: 'exchange_number' },
      { doc_type: 'WORKSHOP_JOB', prefix: 'JOB', table: 'workshop_jobs', col: 'job_number' },
      { doc_type: 'GIRVI_LOAN', prefix: 'GL', table: 'girvi_loans', col: 'loan_number' },
      { doc_type: 'SAVING_SCHEME', prefix: 'SCH', table: 'saving_schemes', col: 'scheme_number' },
    ];

    const currentYear = new Date().getFullYear().toString();

    withTransaction((txDb) => {
      for (const d of defaults) {
        txDb.prepare(`
          INSERT OR IGNORE INTO document_sequences (doc_type, prefix, starting_number, current_value, padding, financial_year_reset, financial_year)
          VALUES (?, ?, 1, 0, 6, 1, ?)
        `).run(d.doc_type, d.prefix, currentYear);

        // Check if current_value is 0; if so, sync with existing table max
        const row = txDb.prepare('SELECT current_value FROM document_sequences WHERE doc_type = ?').get(d.doc_type) as { current_value: number } | undefined;
        if (row && row.current_value === 0) {
          try {
            const maxRow = txDb.prepare(`SELECT ${d.col} as num FROM ${d.table} ORDER BY ${d.col} DESC LIMIT 1`).get() as { num: string } | undefined;
            if (maxRow && maxRow.num) {
              const match = maxRow.num.match(/(\d+)$/);
              if (match) {
                const maxVal = parseInt(match[1], 10);
                if (!isNaN(maxVal) && maxVal > 0) {
                  txDb.prepare('UPDATE document_sequences SET current_value = ? WHERE doc_type = ?').run(maxVal, d.doc_type);
                }
              }
            }
          } catch {
            // Table might not exist or empty, safely ignore
          }
        }
      }
    });
  }

  /**
   * Atomically increments and returns the next formatted document number.
   * Completely concurrency-safe using SQLite transaction & atomic update.
   */
  getNextNumber(docType: DocumentType): string {
    const db = getDb();
    const currentYear = new Date().getFullYear().toString();

    return withTransaction((txDb) => {
      // Ensure row exists
      txDb.prepare(`
        INSERT OR IGNORE INTO document_sequences (doc_type, prefix, starting_number, current_value, padding, financial_year_reset, financial_year)
        VALUES (?, ?, 1, 0, 6, 1, ?)
      `).run(docType, docType.substring(0, 3), currentYear);

      // Atomic update and RETURNING
      const updated = txDb.prepare(`
        UPDATE document_sequences
        SET current_value = CASE 
          WHEN current_value < starting_number THEN starting_number
          ELSE current_value + 1
        END,
        updated_at = datetime('now')
        WHERE doc_type = ?
        RETURNING prefix, starting_number, current_value, padding, financial_year_reset, financial_year
      `).get(docType) as SequenceRow;

      const prefixClean = updated.prefix.replace(/[-/]+$/, '');
      const yearPart = updated.financial_year_reset ? `-${currentYear}-` : '-';
      const paddedNum = updated.current_value.toString().padStart(updated.padding, '0');

      return `${prefixClean}${yearPart}${paddedNum}`;
    });
  }

  /**
   * Retrieves all document sequence configurations.
   */
  getAll(): DocumentSequenceConfig[] {
    const db = getDb();
    this.initDefaults();

    const rows = db.prepare(`
      SELECT doc_type, prefix, starting_number, current_value, padding, financial_year_reset, financial_year, updated_at
      FROM document_sequences
      ORDER BY doc_type ASC
    `).all() as SequenceRow[];

    return rows.map((r) => ({
      doc_type: r.doc_type as DocumentType,
      prefix: r.prefix,
      starting_number: r.starting_number,
      current_value: r.current_value,
      padding: r.padding,
      financial_year_reset: r.financial_year_reset === 1,
      financial_year: r.financial_year,
      updated_at: r.updated_at,
    }));
  }

  /**
   * Updates configuration for a specific document sequence.
   * Note: Starting number or prefix update does NOT rewrite historical documents.
   */
  updateConfig(docType: DocumentType, config: Partial<DocumentSequenceConfig>): void {
    const db = getDb();
    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (config.prefix !== undefined) {
      updates.push('prefix = ?');
      values.push(config.prefix.trim().toUpperCase());
    }
    if (config.starting_number !== undefined) {
      updates.push('starting_number = ?');
      values.push(Math.max(1, config.starting_number));
    }
    if (config.padding !== undefined) {
      updates.push('padding = ?');
      values.push(Math.min(10, Math.max(3, config.padding)));
    }
    if (config.financial_year_reset !== undefined) {
      updates.push('financial_year_reset = ?');
      values.push(config.financial_year_reset ? 1 : 0);
    }
    if (config.financial_year !== undefined) {
      updates.push('financial_year = ?');
      values.push(config.financial_year || '');
    }

    if (updates.length === 0) return;

    updates.push("updated_at = datetime('now')");
    values.push(docType);

    db.prepare(`
      UPDATE document_sequences
      SET ${updates.join(', ')}
      WHERE doc_type = ?
    `).run(...values);
  }
}

export const documentSequenceRepository = new DocumentSequenceRepository();
