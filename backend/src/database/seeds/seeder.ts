import { userRepository } from '../../repositories/user.repository.js';
import { shopRepository } from '../../repositories/shop.repository.js';
import { settingRepository } from '../../repositories/setting.repository.js';
import { auditRepository } from '../../repositories/audit.repository.js';
import { hashPassword } from '../../utils/password.js';

export async function runSeeds(): Promise<void> {
  // 1. Seed Shop if none exists
  const existingShop = shopRepository.getShop();
  if (!existingShop) {
    const shop = shopRepository.create({
      name: 'Jewel Suite Demo Store',
      address: '101 Goldsmith Market, Zaveri Bazaar',
      phone: '+91 98765 43210',
      email: 'contact@jewelsuite.local',
    });
    console.log(`[Seed] Created default shop: ${shop.name}`);
  }

  // 2. Seed Default Settings
  const defaultSettings: Record<string, string> = {
    'store.currency_symbol': '₹',
    'store.currency_code': 'INR',
    'store.weight_unit': 'g',
    'store.weight_precision': '3',
    'store.tax_gst_enabled': 'true',
    'store.default_gold_gst_percent': '3.0',
    'app.initialized': 'true',
  };

  for (const [key, val] of Object.entries(defaultSettings)) {
    if (settingRepository.get(key) === null) {
      settingRepository.set(key, val);
    }
  }

  // 3. Seed Default Admin User if no users exist
  const userCount = userRepository.count();
  if (userCount === 0) {
    const defaultUsername = 'admin';
    const defaultPassword = 'admin123';
    const passwordHash = await hashPassword(defaultPassword);

    const adminUser = userRepository.create({
      username: defaultUsername,
      password_hash: passwordHash,
      role: 'Admin',
      is_active: 1,
    });

    auditRepository.log({
      user_id: adminUser.id,
      action: 'SYSTEM_BOOTSTRAP',
      entity_type: 'USER',
      entity_id: adminUser.id,
      metadata: { username: defaultUsername, role: 'Admin' },
    });

    console.log(`[Seed] Created initial Admin user: '${defaultUsername}' (password: '${defaultPassword}')`);
  }

  // 4. Seed Standard Metals & Purities
  const { getDb } = await import('../connection/db.js');
  const db = getDb();

  const metalCount = (db.prepare('SELECT COUNT(*) as count FROM metals').get() as { count: number }).count;
  if (metalCount === 0) {
    const { v4: uuidv4 } = await import('uuid');

    // Metals definition
    const metals = [
      { code: 'GOLD', name: 'Gold' },
      { code: 'SILVER', name: 'Silver' },
      { code: 'PLATINUM', name: 'Platinum' },
      { code: 'DIAMOND', name: 'Diamond' },
    ];

    const metalIds: Record<string, string> = {};
    const insertMetal = db.prepare('INSERT INTO metals (id, code, name) VALUES (?, ?, ?)');
    for (const m of metals) {
      const id = uuidv4();
      insertMetal.run(id, m.code, m.name);
      metalIds[m.code] = id;
    }

    // Purities definition
    const purities = [
      { metal: 'GOLD', code: '24K', name: '24 Karat 999', tunch: 99.90 },
      { metal: 'GOLD', code: '22K', name: '22 Karat 916', tunch: 91.67 },
      { metal: 'GOLD', code: '18K', name: '18 Karat 750', tunch: 75.00 },
      { metal: 'GOLD', code: '14K', name: '14 Karat 585', tunch: 58.50 },
      { metal: 'SILVER', code: '999', name: 'Fine Silver 999', tunch: 99.90 },
      { metal: 'SILVER', code: '925', name: 'Sterling Silver 925', tunch: 92.50 },
      { metal: 'PLATINUM', code: '950', name: 'Platinum 950', tunch: 95.00 },
      { metal: 'DIAMOND', code: 'VVS1', name: 'VVS1 Clarity', tunch: null },
      { metal: 'DIAMOND', code: 'VS2', name: 'VS2 Clarity', tunch: null },
    ];

    const purityIds: Record<string, string> = {};
    const insertPurity = db.prepare('INSERT INTO metal_purities (id, metal_id, code, name, tunch_percent) VALUES (?, ?, ?, ?, ?)');
    for (const p of purities) {
      const id = uuidv4();
      insertPurity.run(id, metalIds[p.metal], p.code, p.name, p.tunch);
      purityIds[`${p.metal}_${p.code}`] = id;
    }

    // Baseline metal rates
    const initialRates = [
      { metal: 'GOLD', purity: '24K', rate: 7850.0, unit: 'gram' },
      { metal: 'GOLD', purity: '22K', rate: 7190.0, unit: 'gram' },
      { metal: 'GOLD', purity: '18K', rate: 5890.0, unit: 'gram' },
      { metal: 'SILVER', code: '999', purity: '999', rate: 94.50, unit: 'gram' },
      { metal: 'SILVER', code: '925', purity: '925', rate: 87.40, unit: 'gram' },
      { metal: 'PLATINUM', purity: '950', rate: 3450.0, unit: 'gram' },
    ];

    const insertRate = db.prepare('INSERT INTO metal_rates (id, metal_id, purity_id, rate, unit, effective_from) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))');
    for (const r of initialRates) {
      const mId = metalIds[r.metal];
      const pId = purityIds[`${r.metal}_${r.purity}`];
      if (mId && pId) {
        insertRate.run(uuidv4(), mId, pId, r.rate, r.unit);
      }
    }
    console.log('[Seed] Populated standard Metals, Purities, and Initial Rates');
  }

  // 5. Seed Standard Jewellery Categories
  const categoryCount = (db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number }).count;
  if (categoryCount === 0) {
    const { v4: uuidv4 } = await import('uuid');
    const categories = [
      { name: 'Rings', code: 'RNG', description: 'Finger rings in gold, silver, and diamond' },
      { name: 'Bangles', code: 'BNG', description: 'Traditional and modern bangles & kadas' },
      { name: 'Necklaces', code: 'NCK', description: 'Chokers, bridal sets, and necklaces' },
      { name: 'Chains', code: 'CHN', description: 'Machine and hand-crafted chains' },
      { name: 'Earrings', code: 'EAR', description: 'Studs, jhumkas, and drop earrings' },
      { name: 'Bracelets', code: 'BRC', description: 'Men and women wrist bracelets' },
      { name: 'Pendants', code: 'PND', description: 'Religious and designer pendants' },
      { name: 'Nose Pins', code: 'NSP', description: 'Nath, nose studs and pins' },
      { name: 'Anklets', code: 'ANK', description: 'Silver payals and anklets' },
      { name: 'Coins', code: 'CON', description: 'Bullion 24K and silver 999 coins/bars' },
      { name: 'Other', code: 'OTH', description: 'Miscellaneous ornaments' },
    ];

    const insertCategory = db.prepare('INSERT INTO categories (id, name, code, description) VALUES (?, ?, ?, ?)');
    for (const c of categories) {
      insertCategory.run(uuidv4(), c.name, c.code, c.description);
    }
    console.log('[Seed] Populated standard jewellery categories');
  }
}
