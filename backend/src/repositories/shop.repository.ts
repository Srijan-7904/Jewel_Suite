import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/connection/db.js';

export interface ShopRecord {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export class ShopRepository {
  getShop(): ShopRecord | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM shops LIMIT 1').get() as ShopRecord | undefined;
    return row || null;
  }

  create(data: {
    id?: string;
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  }): ShopRecord {
    const db = getDb();
    const id = data.id || uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO shops (id, name, address, phone, email, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.name, data.address || null, data.phone || null, data.email || null, now, now);

    return this.getShop()!;
  }
}

export const shopRepository = new ShopRepository();
