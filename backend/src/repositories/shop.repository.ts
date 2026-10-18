// backend/src/repositories/shop.repository.ts
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/connection/db.js';
import { ShopProfile } from '../domain/settings.js';

export interface ShopRecord {
  id: string;
  name: string;
  legal_name?: string | null;
  owner_name?: string | null;
  address: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
  phone: string | null;
  alternate_phone?: string | null;
  email: string | null;
  website?: string | null;
  gstin?: string | null;
  pan?: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  ifsc?: string | null;
  upi_id?: string | null;
  logo_path?: string | null;
  created_at: string;
  updated_at: string;
}

export class ShopRepository {
  getShop(): ShopRecord | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM shops LIMIT 1').get() as ShopRecord | undefined;
    return row || null;
  }

  getProfile(): ShopProfile | null {
    const shop = this.getShop();
    if (!shop) return null;
    return {
      id: shop.id,
      name: shop.name,
      legal_name: shop.legal_name || null,
      owner_name: shop.owner_name || null,
      address: shop.address || null,
      city: shop.city || null,
      state: shop.state || null,
      pincode: shop.pincode || null,
      country: shop.country || 'India',
      phone: shop.phone || null,
      alternate_phone: shop.alternate_phone || null,
      email: shop.email || null,
      website: shop.website || null,
      gstin: shop.gstin || null,
      pan: shop.pan || null,
      bank_name: shop.bank_name || null,
      account_number: shop.account_number || null,
      ifsc: shop.ifsc || null,
      upi_id: shop.upi_id || null,
      logo_path: shop.logo_path || null,
      updated_at: shop.updated_at,
    };
  }

  create(data: {
    id?: string;
    name: string;
    legal_name?: string | null;
    owner_name?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    country?: string | null;
    phone?: string | null;
    alternate_phone?: string | null;
    email?: string | null;
    website?: string | null;
    gstin?: string | null;
    pan?: string | null;
    bank_name?: string | null;
    account_number?: string | null;
    ifsc?: string | null;
    upi_id?: string | null;
    logo_path?: string | null;
  }): ShopRecord {
    const db = getDb();
    const id = data.id || uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO shops (
        id, name, legal_name, owner_name, address, city, state, pincode, country,
        phone, alternate_phone, email, website, gstin, pan, bank_name, account_number, ifsc, upi_id, logo_path,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name,
      data.legal_name || null,
      data.owner_name || null,
      data.address || null,
      data.city || null,
      data.state || null,
      data.pincode || null,
      data.country || 'India',
      data.phone || null,
      data.alternate_phone || null,
      data.email || null,
      data.website || null,
      data.gstin || null,
      data.pan || null,
      data.bank_name || null,
      data.account_number || null,
      data.ifsc || null,
      data.upi_id || null,
      data.logo_path || null,
      now,
      now
    );

    return this.getShop()!;
  }

  updateProfile(data: Partial<ShopProfile>): ShopProfile {
    const db = getDb();
    const current = this.getShop();
    const now = new Date().toISOString();

    if (!current) {
      this.create({
        name: data.name || 'Jewel Suite Store',
        ...data,
      });
      return this.getProfile()!;
    }

    const updates: string[] = [];
    const values: (string | null)[] = [];

    const allowedFields = [
      'name',
      'legal_name',
      'owner_name',
      'address',
      'city',
      'state',
      'pincode',
      'country',
      'phone',
      'alternate_phone',
      'email',
      'website',
      'gstin',
      'pan',
      'bank_name',
      'account_number',
      'ifsc',
      'upi_id',
      'logo_path',
    ] as const;

    for (const field of allowedFields) {
      if (field in data) {
        updates.push(`${field} = ?`);
        values.push((data as any)[field] ?? null);
      }
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(now);
      values.push(current.id);

      db.prepare(`
        UPDATE shops
        SET ${updates.join(', ')}
        WHERE id = ?
      `).run(...values);
    }

    return this.getProfile()!;
  }
}

export const shopRepository = new ShopRepository();
