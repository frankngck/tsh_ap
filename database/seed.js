require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { User, Supplier, sequelize } = require('../server/models');

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('Connected to database.');

    // Admin user
    const existing = await User.findOne({ where: { username: 'admin' } });
    if (!existing) {
      await User.create({
        username: 'admin',
        password: 'admin123',
        email: 'admin@tsh-ap.local',
        fullName: 'System Administrator',
        role: 'ADMIN',
        status: 'ACTIVE',
      });
      console.log('Created admin user  (username: admin / password: admin123)');
    } else {
      console.log('Admin user already exists — skipped.');
    }

    // Sample suppliers
    const suppliers = [
      {
        supplierCode: 'SUP-001',
        companyName: 'ABC Office Supplies Pte Ltd',
        contactPerson: 'John Tan',
        email: 'john@abc-supplies.com',
        phone: '6123-4567',
        address: '10 Jurong East Street 12, #03-01, Singapore 609684',
        category: 'Office Supplies',
        paymentTerms: 30,
        gstRegistered: true,
        gstNumber: '20012345A',
        bankName: 'DBS Bank',
        bankAccount: '0121234567',
        status: 'ACTIVE',
      },
      {
        supplierCode: 'SUP-002',
        companyName: 'XYZ IT Solutions Sdn Bhd',
        contactPerson: 'Mary Lim',
        email: 'mary@xyz-it.com',
        phone: '6234-5678',
        address: '25 Changi Business Park, #05-10, Singapore 486058',
        category: 'IT Equipment',
        paymentTerms: 45,
        gstRegistered: true,
        gstNumber: '20098765B',
        bankName: 'OCBC Bank',
        bankAccount: '5411234567',
        status: 'ACTIVE',
      },
      {
        supplierCode: 'SUP-003',
        companyName: 'FastFreight Logistics Ltd',
        contactPerson: 'Kumar Raj',
        email: 'kumar@fastfreight.com',
        phone: '6345-6789',
        address: '1 Tuas Road, Singapore 638491',
        category: 'Logistics',
        paymentTerms: 14,
        gstRegistered: false,
        status: 'ACTIVE',
      },
    ];

    for (const s of suppliers) {
      const exists = await Supplier.findOne({ where: { supplierCode: s.supplierCode } });
      if (!exists) {
        await Supplier.create(s);
        console.log(`Created supplier: ${s.supplierCode} – ${s.companyName}`);
      } else {
        console.log(`Supplier ${s.supplierCode} already exists — skipped.`);
      }
    }

    console.log('\nSeed completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
