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

  // 6. Seed Standard Jewellery Products if none exist
  const productCount = (db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number }).count;
  if (productCount === 0) {
    const { v4: uuidv4 } = await import('uuid');
    const ringCat = db.prepare("SELECT id FROM categories WHERE code = 'RNG'").get() as { id: string } | undefined;
    const nckCat = db.prepare("SELECT id FROM categories WHERE code = 'NCK'").get() as { id: string } | undefined;
    const bngCat = db.prepare("SELECT id FROM categories WHERE code = 'BNG'").get() as { id: string } | undefined;
    const brcCat = db.prepare("SELECT id FROM categories WHERE code = 'BRC'").get() as { id: string } | undefined;

    const products = [
      { code: 'PRD-RNG-01', name: 'Gold Ring Classic', category_id: ringCat?.id, metal: 'GOLD', purity: '22K', hsn: '711319' },
      { code: 'PRD-NCK-01', name: 'Gold Necklace Royal', category_id: nckCat?.id, metal: 'GOLD', purity: '22K', hsn: '711319' },
      { code: 'PRD-BNG-01', name: 'Gold Bangle Traditional', category_id: bngCat?.id, metal: 'GOLD', purity: '22K', hsn: '711319' },
      { code: 'PRD-BRC-01', name: 'Silver Men Bracelet 925', category_id: brcCat?.id, metal: 'SILVER', purity: '925', hsn: '711311' },
    ];

    const insertProduct = db.prepare(`
      INSERT INTO products (id, product_code, name, category_id, default_metal, default_purity, default_unit, hsn_code)
      VALUES (?, ?, ?, ?, ?, ?, 'g', ?)
    `);

    for (const p of products) {
      if (p.category_id) {
        insertProduct.run(uuidv4(), p.code, p.name, p.category_id, p.metal, p.purity, p.hsn);
      }
    }
    console.log('[Seed] Populated standard jewellery products');
  }

  // 7. Seed Initial Demo Stock Items if none exist
  const stockCount = (db.prepare('SELECT COUNT(*) as count FROM stock_items').get() as { count: number }).count;
  if (stockCount === 0) {
    const { v4: uuidv4 } = await import('uuid');
    const gold = db.prepare("SELECT id FROM metals WHERE code = 'GOLD'").get() as { id: string } | undefined;
    const silver = db.prepare("SELECT id FROM metals WHERE code = 'SILVER'").get() as { id: string } | undefined;
    const p22k = gold ? (db.prepare("SELECT id, tunch_percent FROM metal_purities WHERE metal_id = ? AND code = '22K'").get(gold.id) as { id: string; tunch_percent: number } | undefined) : undefined;
    const p925 = silver ? (db.prepare("SELECT id, tunch_percent FROM metal_purities WHERE metal_id = ? AND code = '925'").get(silver.id) as { id: string; tunch_percent: number } | undefined) : undefined;

    const ringProd = db.prepare("SELECT id FROM products WHERE product_code = 'PRD-RNG-01'").get() as { id: string } | undefined;
    const nckProd = db.prepare("SELECT id FROM products WHERE product_code = 'PRD-NCK-01'").get() as { id: string } | undefined;
    const bngProd = db.prepare("SELECT id FROM products WHERE product_code = 'PRD-BNG-01'").get() as { id: string } | undefined;
    const brcProd = db.prepare("SELECT id FROM products WHERE product_code = 'PRD-BRC-01'").get() as { id: string } | undefined;

    if (gold && silver && p22k && p925 && ringProd && nckProd && bngProd && brcProd) {
      const demoItems = [
        {
          tag_no: 'GOLD-R-001',
          product_id: ringProd.id,
          metal_id: gold.id,
          purity_id: p22k.id,
          gross_weight: 8.500,
          less_weight: 0.200,
          net_weight: 8.300,
          tunch_percent: 91.67,
          fine_weight: 7.6086,
          wastage_percent: 2.5,
          making_charge: 850.0,
          rate_per_gram: 7190.0,
          metal_value: 54705.83,
          huid: 'HD9281',
          notes: '22K CZ Designer Ring',
        },
        {
          tag_no: 'GOLD-N-002',
          product_id: nckProd.id,
          metal_id: gold.id,
          purity_id: p22k.id,
          gross_weight: 24.750,
          less_weight: 0.500,
          net_weight: 24.250,
          tunch_percent: 91.67,
          fine_weight: 22.2299,
          wastage_percent: 3.0,
          making_charge: 2500.0,
          rate_per_gram: 7190.0,
          metal_value: 159833.18,
          huid: 'HD9282',
          notes: 'Bridal Floral Choker Necklace',
        },
        {
          tag_no: 'GOLD-B-003',
          product_id: bngProd.id,
          metal_id: gold.id,
          purity_id: p22k.id,
          gross_weight: 16.200,
          less_weight: 0.000,
          net_weight: 16.200,
          tunch_percent: 91.67,
          fine_weight: 14.8505,
          wastage_percent: 2.0,
          making_charge: 1600.0,
          rate_per_gram: 7190.0,
          metal_value: 106775.10,
          huid: 'HD9283',
          notes: 'Kada Style Single Bangle',
        },
        {
          tag_no: 'SILVER-B-001',
          product_id: brcProd.id,
          metal_id: silver.id,
          purity_id: p925.id,
          gross_weight: 35.000,
          less_weight: 0.000,
          net_weight: 35.000,
          tunch_percent: 92.50,
          fine_weight: 32.3750,
          wastage_percent: 0.0,
          making_charge: 600.0,
          rate_per_gram: 87.40,
          metal_value: 2829.58,
          huid: null,
          notes: '925 Heavy Link Gents Bracelet',
        },
      ];

      const insertStock = db.prepare(`
        INSERT INTO stock_items (
          id, tag_no, product_id, metal_id, purity_id,
          gross_weight, less_weight, net_weight,
          tunch_percent, fine_weight, wastage_percent, making_charge,
          rate_per_gram, metal_value, current_value,
          acquisition_type, status, huid, notes,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          'OPENING_STOCK', 'IN_STOCK', ?, ?,
          datetime('now'), datetime('now')
        )
      `);

      const insertMovement = db.prepare(`
        INSERT INTO stock_movements (
          id, stock_item_id, movement_type, reference_type,
          from_status, to_status, quantity,
          gross_weight, net_weight, fine_weight,
          notes, created_at
        ) VALUES (
          ?, ?, 'OPENING_STOCK', 'INVENTORY_OPENING',
          NULL, 'IN_STOCK', 1,
          ?, ?, ?,
          'Seeded initial opening stock', datetime('now')
        )
      `);

      for (const item of demoItems) {
        const itemId = uuidv4();
        insertStock.run(
          itemId,
          item.tag_no,
          item.product_id,
          item.metal_id,
          item.purity_id,
          item.gross_weight,
          item.less_weight,
          item.net_weight,
          item.tunch_percent,
          item.fine_weight,
          item.wastage_percent,
          item.making_charge,
          item.rate_per_gram,
          item.metal_value,
          item.metal_value,
          item.huid,
          item.notes
        );

        insertMovement.run(
          uuidv4(),
          itemId,
          item.gross_weight,
          item.net_weight,
          item.fine_weight
        );
      }
      console.log('[Seed] Populated initial demo stock items with opening movements');
    }
  }
}

