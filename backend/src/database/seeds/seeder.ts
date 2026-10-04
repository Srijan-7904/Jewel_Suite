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
}
