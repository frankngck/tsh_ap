/**
 * server/seedData.js
 * Stage 1: bills, bill items, payments, suppliers.
 * Stage 2: purchase orders, delivery orders, PO/DO items, bill links, reminder logs.
 * Usage: node server/seedData.js
 * Safe to re-run — skips or updates existing records.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const bcrypt = require('bcryptjs');
const {
  User,
  Bill, BillItem, Payment, Supplier,
  PurchaseOrder, PurchaseOrderItem,
  DeliveryOrder, DeliveryOrderItem,
  ReminderLog, sequelize,
} = require('./models');

// ─── Supplier definitions ─────────────────────────────────────────
// category ENUM: RAW_MATERIALS | COMPONENTS | SERVICES | PACKAGING | OTHER
const SUPPLIER_DEFS = [
  {
    companyName:   'Alcom Group',
    contactPerson: 'David Lim',
    email:         'accounts@alcomgroup.com.sg',
    phone:         '6312-4400',
    address:       '8 Tuas Avenue 3, Singapore 639405',
    category:      'RAW_MATERIALS',
    paymentTerms:  30,
    bankAccount:   '003-123456-7',
  },
  {
    companyName:   'MechParts Pte Ltd',
    contactPerson: 'Kevin Ng',
    email:         'sales@mechparts.sg',
    phone:         '6456-8800',
    address:       '30 Bukit Batok Crescent, #07-18, Singapore 658079',
    category:      'COMPONENTS',
    paymentTerms:  30,
    bankAccount:   '541-234567-8',
  },
  {
    companyName:   'SG Steel Industries',
    contactPerson: 'Henry Tan',
    email:         'henry.tan@sgsteel.com.sg',
    phone:         '6781-2200',
    address:       '12 Jurong Island Highway, Singapore 627663',
    category:      'RAW_MATERIALS',
    paymentTerms:  30,
    bankAccount:   '302-456789-0',
  },
  {
    companyName:   'QuickLogistics Pte Ltd',
    contactPerson: 'Priya Sharma',
    email:         'ops@quicklogistics.sg',
    phone:         '6512-3344',
    address:       '3 Changi South Street 2, Singapore 486548',
    category:      'OTHER',
    paymentTerms:  14,
    bankAccount:   '003-987654-3',
  },
  {
    companyName:   'Component Plus Pte Ltd',
    contactPerson: 'Raymond Chia',
    email:         'raymond@componentplus.com.sg',
    phone:         '6234-9900',
    address:       '10 Ubi Crescent, #05-60, Singapore 408564',
    category:      'COMPONENTS',
    paymentTerms:  30,
    bankAccount:   '104-567890-1',
  },
  {
    companyName:   'PackRight Solutions',
    contactPerson: 'Susan Ong',
    email:         'susan@packright.sg',
    phone:         '6378-6600',
    address:       '18 Woodlands Loop, Singapore 738320',
    category:      'PACKAGING',
    paymentTerms:  30,
    bankAccount:   '622-678901-2',
  },
];

// ─── Bill data ────────────────────────────────────────────────────
const BILL_DEFS = [
  {
    billNumber: 'BIL-001',
    supplier:   'Alcom Group',
    billDate:   '2026-04-01',
    dueDate:    '2026-05-01',
    subtotal:   16743.00,
    gstAmount:  1507.00,
    total:      18250.00,
    amountPaid: 10000.00,
    status:     'APPROVED',
    notes:      'PO Ref: PO-2026-001',
    items: [
      { description: 'Aluminium Sheet 5052-H32 (2mm x 1200x2400)',   quantity: 500, unitPrice: 18.50,  amount: 9250.00 },
      { description: 'Aluminium Extrusion T-Slot 40x40mm (3m bar)',   quantity: 200, unitPrice: 24.21,  amount: 4842.00 },
      { description: 'Aluminium Rod 25mm dia (3m)',                   quantity: 100, unitPrice: 26.51,  amount: 2651.00 },
    ],
  },
  {
    billNumber: 'BIL-002',
    supplier:   'MechParts Pte Ltd',
    billDate:   '2026-04-20',
    dueDate:    '2026-05-20',
    subtotal:   30092.00,
    gstAmount:  2708.00,
    total:      32800.00,
    amountPaid: 0.00,
    status:     'RECEIVED',
    notes:      'PO Ref: PO-2025-11',
    items: [
      { description: 'Precision Bearing 6205-2RS (30x52x15mm)',       quantity: 200, unitPrice: 45.20,  amount: 9040.00 },
      { description: 'Servo Motor 100W DC 24V (with encoder)',        quantity:  50, unitPrice: 285.00, amount: 14250.00 },
      { description: 'Shaft Coupling 25mm Rigid Jaw Type',            quantity: 150, unitPrice: 22.68,  amount: 3402.00 },
      { description: 'Linear Guide Rail 500mm (with carriage block)', quantity:  80, unitPrice: 42.50,  amount: 3400.00 },
    ],
  },
  {
    billNumber: 'BIL-003',
    supplier:   'SG Steel Industries',
    billDate:   '2026-03-10',
    dueDate:    '2026-04-09',
    subtotal:   11468.00,
    gstAmount:  1032.00,
    total:      12500.00,
    amountPaid: 12500.00,
    status:     'PAID',
    notes:      null,
    items: [
      { description: 'Steel Rod 20mm dia (6m length)',                quantity: 300, unitPrice: 24.50,  amount: 7350.00 },
      { description: 'Steel Sheet 3mm (1200x2400mm cold-rolled)',     quantity:  50, unitPrice: 82.36,  amount: 4118.00 },
    ],
  },
  {
    billNumber: 'BIL-004',
    supplier:   'QuickLogistics Pte Ltd',
    billDate:   '2026-04-16',
    dueDate:    '2026-04-30',
    subtotal:    5028.00,
    gstAmount:    452.00,
    total:        5480.00,
    amountPaid:  5480.00,
    status:     'PAID',
    notes:      null,
    items: [
      { description: 'Sea Freight Service — FCL 20ft (Port Klang)',    quantity:   2, unitPrice: 1800.00, amount: 3600.00 },
      { description: 'Port Handling & Terminal Handling Charge (THC)', quantity:   2, unitPrice:  420.00, amount:  840.00 },
      { description: 'Documentation & Customs Clearance Fee',          quantity:   2, unitPrice:  294.00, amount:  588.00 },
    ],
  },
  {
    billNumber: 'BIL-005',
    supplier:   'Component Plus Pte Ltd',
    billDate:   '2026-03-31',
    dueDate:    '2026-04-30',
    subtotal:   20275.00,
    gstAmount:   1825.00,
    total:      22100.00,
    amountPaid:     0.00,
    status:     'DISPUTED',
    notes:      'PO Ref: PO-2026-004 — 3-way match failure. Invoice total S$22,100 does not match PO approved amount of S$19,800. Discrepancy of S$2,300 under investigation.',
    items: [
      { description: 'PCB Substrate FR4 2-Layer (100x80mm)',           quantity: 500, unitPrice:  18.50, amount: 9250.00 },
      { description: 'SMT Component Kit BOM-2025-05 (full BOM set)',   quantity:   1, unitPrice: 6125.00, amount: 6125.00 },
      { description: 'Capacitor 100uF 50V Electrolytic (reel of 500)', quantity:  50, unitPrice:   48.00, amount: 2400.00 },
      { description: 'Resistor Array 10kΩ SMD 1206 (reel of 5000)',   quantity: 100, unitPrice:   25.00, amount: 2500.00 },
    ],
  },
  {
    billNumber: 'BIL-006',
    supplier:   'SG Steel Industries',
    billDate:   '2026-02-13',
    dueDate:    '2026-03-15',
    subtotal:    7523.00,
    gstAmount:    677.00,
    total:        8200.00,
    amountPaid:  8200.00,
    status:     'PAID',
    notes:      null,
    items: [
      { description: 'Steel Angle Bar 50x50x5mm (6m length)',          quantity: 200, unitPrice: 18.50, amount: 3700.00 },
      { description: 'Steel Channel 100x50x5mm (6m length)',           quantity: 100, unitPrice: 38.23, amount: 3823.00 },
    ],
  },
  {
    billNumber: 'BIL-007',
    supplier:   'PackRight Solutions',
    billDate:   '2026-03-02',
    dueDate:    '2026-04-01',
    subtotal:    2936.00,
    gstAmount:    264.00,
    total:        3200.00,
    amountPaid:  3200.00,
    status:     'PAID',
    notes:      null,
    items: [
      { description: 'Corrugated Export Box 400x300x300mm (pack/20)',  quantity: 500, unitPrice:  2.80, amount: 1400.00 },
      { description: 'Bubble Wrap Roll 500mm x 50m',                   quantity:  30, unitPrice: 28.00, amount:  840.00 },
      { description: 'Stretch Film Pallet Wrap 500mm x 300m (core)',   quantity:  20, unitPrice: 34.80, amount:  696.00 },
    ],
  },
  {
    billNumber: 'BIL-008',
    supplier:   'Alcom Group',
    billDate:   '2026-04-15',
    dueDate:    '2026-05-15',
    subtotal:    7569.00,
    gstAmount:    681.00,
    total:        8250.00,
    amountPaid:     0.00,
    status:     'APPROVED',
    notes:      null,
    items: [
      { description: 'Aluminium Plate 6061-T6 (1000x500x5mm)',         quantity:  50, unitPrice: 85.00, amount: 4250.00 },
      { description: 'Aluminium Angle Bar 25x25x3mm (6m)',             quantity: 100, unitPrice: 33.19, amount: 3319.00 },
    ],
  },
];

// ─── Payment data ─────────────────────────────────────────────────
// method ENUM: BANK_TRANSFER | CHEQUE | GIRO | TELEGRAPHIC_TRANSFER
const PAYMENT_DEFS = [
  { billNumber: 'BIL-003', paymentDate: '2026-04-24', amount: 12500.00, method: 'BANK_TRANSFER',       referenceNumber: 'IBG-26042401',   notes: 'Full settlement — bank transfer' },
  { billNumber: 'BIL-004', paymentDate: '2026-04-18', amount:  5480.00, method: 'GIRO',                referenceNumber: 'GIRO-26041801',   notes: 'Full settlement — GIRO' },
  { billNumber: 'BIL-006', paymentDate: '2026-04-01', amount:  8200.00, method: 'BANK_TRANSFER',       referenceNumber: 'TT-AP-2026-006',  notes: 'Full settlement — telegraphic transfer (TT)' },
  { billNumber: 'BIL-007', paymentDate: '2026-04-05', amount:  3200.00, method: 'CHEQUE',              referenceNumber: 'CHQ-000412',      notes: 'Full settlement — cheque no. 000412' },
  { billNumber: 'BIL-001', paymentDate: '2026-04-10', amount: 10000.00, method: 'BANK_TRANSFER',       referenceNumber: 'TT-AP-2026-001',  notes: 'Partial payment — balance $8,250 outstanding' },
];

// ─── Stage 2: Purchase Orders ─────────────────────────────────────
// PO status ENUM: DRAFT | SENT | CONFIRMED | PART_RECEIVED | COMPLETED | CANCELLED
const PO_DEFS = [
  {
    poNumber:            'PO-2026-001',
    supplier:            'Alcom Group',
    poDate:              '2026-04-01',
    expectedDate:        '2026-04-15',
    status:              'CONFIRMED',
    subtotal:            22448.80,
    gstAmount:            2020.39,
    total:               24469.19,
    notes:               'Aluminium stock replenishment Q2 2026',
    historicalUpdatedAt: '2026-04-03 09:00:00',
    items: [
      { description: 'Aluminium Sheet 5052-H32 (2mm x 1200x2400)', quantity: 700, unitPrice: 18.50,  amount: 12950.00 },
      { description: 'Aluminium Extrusion T-Slot 40x40mm (3m bar)', quantity: 250, unitPrice: 24.21,  amount:  6052.50 },
      { description: 'Aluminium Rod 25mm dia (3m)',                  quantity: 130, unitPrice: 26.51,  amount:  3446.30 },
    ],
  },
  {
    poNumber:            'PO-2026-002',
    supplier:            'MechParts Pte Ltd',
    poDate:              '2026-04-05',
    expectedDate:        '2026-04-20',
    status:              'SENT',
    subtotal:            16800.00,
    gstAmount:            1512.00,
    total:               18312.00,
    notes:               'Machining supplies — awaiting supplier acknowledgement',
    historicalUpdatedAt: '2026-04-05 10:00:00',
    items: [
      { description: 'High-Speed Steel End Mill 10mm 4-Flute',  quantity: 200, unitPrice: 46.00, amount: 9200.00 },
      { description: 'CNC Machined Steel Block 150x100x40mm',   quantity:  80, unitPrice: 95.00, amount: 7600.00 },
    ],
  },
  {
    poNumber:            'PO-2026-003',
    supplier:            'SG Steel Industries',
    poDate:              '2026-05-20',
    expectedDate:        '2026-06-10',
    status:              'DRAFT',
    subtotal:             7800.00,
    gstAmount:             702.00,
    total:                8502.00,
    notes:               'Structural steel for new production line',
    historicalUpdatedAt: null,
    items: [
      { description: 'Hot-Rolled Steel H-Beam 200x100mm (6m)', quantity: 40, unitPrice: 195.00, amount: 7800.00 },
    ],
  },
  {
    poNumber:            'PO-2026-004',
    supplier:            'QuickLogistics Pte Ltd',
    poDate:              '2026-03-15',
    expectedDate:        '2026-04-01',
    status:              'PART_RECEIVED',
    subtotal:             6240.00,
    gstAmount:             561.60,
    total:                6801.60,
    notes:               'Logistics services Q1 2026',
    historicalUpdatedAt: '2026-04-02 14:00:00',
    items: [
      { description: 'Freight Forwarding Service — Sea (per consignment)', quantity:  2, unitPrice: 1200.00, amount: 2400.00 },
      { description: 'Customs Brokerage & Documentation',                  quantity:  2, unitPrice:  450.00, amount:  900.00 },
      { description: 'Warehouse Storage (pallet/week)',                    quantity: 20, unitPrice:   85.00, amount: 1700.00 },
      { description: 'Last Mile Delivery — 3-ton lorry',                  quantity:  4, unitPrice:  310.00, amount: 1240.00 },
    ],
  },
  {
    poNumber:            'PO-2026-005',
    supplier:            'Component Plus Pte Ltd',
    poDate:              '2026-03-01',
    expectedDate:        '2026-03-20',
    status:              'COMPLETED',
    subtotal:            13900.00,
    gstAmount:            1251.00,
    total:               15151.00,
    notes:               'Electronic components for prototype batch',
    historicalUpdatedAt: '2026-03-20 16:00:00',
    items: [
      { description: 'Microcontroller Module ESP32-WROOM (box of 50)',       quantity:  60, unitPrice:  95.00, amount:  5700.00 },
      { description: 'PCB Prototyping Service 2-Layer 100x80mm (batch)',     quantity:  40, unitPrice: 125.00, amount:  5000.00 },
      { description: 'Electronic Test Cable Assembly Set',                   quantity: 100, unitPrice:  32.00, amount:  3200.00 },
    ],
  },
];

// ─── Stage 2: Delivery Orders ─────────────────────────────────────
// DO status ENUM: RECEIVED | INSPECTED | ACCEPTED | REJECTED
const DO_DEFS = [
  {
    doNumber:     'DO-2026-001',
    poRef:        'PO-2026-001',
    supplier:     'Alcom Group',
    receivedDate: '2026-04-14',
    status:       'ACCEPTED',
    notes:        'Full delivery received. All items inspected and accepted.',
    items: [
      { description: 'Aluminium Sheet 5052-H32 (2mm x 1200x2400)', quantityReceived: 500 },
      { description: 'Aluminium Extrusion T-Slot 40x40mm (3m bar)', quantityReceived: 200 },
      { description: 'Aluminium Rod 25mm dia (3m)',                  quantityReceived: 100 },
    ],
  },
  {
    doNumber:     'DO-2026-002',
    poRef:        'PO-2026-004',
    supplier:     'QuickLogistics Pte Ltd',
    receivedDate: '2026-04-02',
    status:       'RECEIVED',
    notes:        'Last Mile Delivery short by 1 trip. Follow up with supplier.',
    items: [
      { description: 'Freight Forwarding Service — Sea (per consignment)', quantityReceived:  2 },
      { description: 'Customs Brokerage & Documentation',                  quantityReceived:  2 },
      { description: 'Warehouse Storage (pallet/week)',                    quantityReceived: 20 },
      { description: 'Last Mile Delivery — 3-ton lorry',                  quantityReceived:  3 },
    ],
  },
  {
    doNumber:     'DO-2026-003',
    poRef:        'PO-2026-005',
    supplier:     'Component Plus Pte Ltd',
    receivedDate: '2026-03-18',
    status:       'ACCEPTED',
    notes:        'Complete delivery. Components inspected and accepted.',
    items: [
      { description: 'Microcontroller Module ESP32-WROOM (box of 50)',   quantityReceived:  60 },
      { description: 'PCB Prototyping Service 2-Layer 100x80mm (batch)', quantityReceived:  40 },
      { description: 'Electronic Test Cable Assembly Set',               quantityReceived: 100 },
    ],
  },
];

// ─── Main ─────────────────────────────────────────────────────────
async function run() {
  try {
    await sequelize.authenticate();
    console.log('✓ Connected to database\n');

    // ── Step 0: Upsert seed users ────────────────────────────────
    console.log('─── Users ───────────────────────────────────────');
    const USER_DEFS = [
      { email: 'admin@tsh.sg',   password: 'password123', name: 'Admin User',      role: 'admin' },
      { email: 'clerk@tsh.sg',   password: 'clerk',       name: 'AP Clerk',        role: 'clerk' },
      { email: 'manager@tsh.sg', password: 'manager',     name: 'Finance Manager', role: 'manager' },
    ];
    for (const def of USER_DEFS) {
      const hashed = await bcrypt.hash(def.password, 10);
      const [user, created] = await User.findOrCreate({
        where:    { email: def.email },
        defaults: { password: hashed, name: def.name, role: def.role },
      });
      if (!created) {
        await user.update({ password: hashed, name: def.name, role: def.role });
      }
      console.log(`  ${created ? 'CREATED' : 'updated'} [${user.id}] ${def.role.padEnd(7)} – ${def.email}`);
    }

    // ── Step 1: Ensure required suppliers exist ──────────────────
    console.log('\n─── Suppliers ───────────────────────────────────');
    const supIdMap = {};

    for (const def of SUPPLIER_DEFS) {
      const [sup, created] = await Supplier.findOrCreate({
        where:    { companyName: def.companyName },
        defaults: def,
      });
      supIdMap[def.companyName] = sup.id;
      console.log(`  ${created ? 'CREATED' : 'found  '} [${sup.id}] ${sup.companyName}`);
    }

    // ── Step 2: Clean existing seed bills ────────────────────────
    console.log('\n─── Clearing existing seed bills ───────────────');
    const billNums = BILL_DEFS.map((b) => b.billNumber);
    let cleared = 0;

    for (const bn of billNums) {
      const existing = await Bill.findOne({ where: { billNumber: bn } });
      if (existing) {
        await Payment.destroy({ where: { billId: existing.id } });
        await BillItem.destroy({ where: { billId: existing.id } });
        await existing.destroy();
        console.log(`  Deleted ${bn}`);
        cleared++;
      }
    }
    if (cleared === 0) console.log('  Nothing to clear.');

    // ── Step 3: Create bills + items ─────────────────────────────
    console.log('\n─── Creating bills ──────────────────────────────');
    const billIdMap = {};

    for (const def of BILL_DEFS) {
      const supplierId = supIdMap[def.supplier];
      if (!supplierId) {
        console.error(`  ERROR: Supplier "${def.supplier}" not found — skipping ${def.billNumber}`);
        continue;
      }

      const bill = await Bill.create({
        billNumber: def.billNumber,
        supplierId,
        billDate:   def.billDate,
        dueDate:    def.dueDate,
        subtotal:   def.subtotal,
        gstAmount:  def.gstAmount,
        total:      def.total,
        amountPaid: def.amountPaid,
        status:     def.status,
        notes:      def.notes || null,
      });

      billIdMap[def.billNumber] = bill.id;

      for (const item of def.items) {
        await BillItem.create({
          billId:      bill.id,
          description: item.description,
          quantity:    item.quantity,
          unitPrice:   item.unitPrice,
          amount:      item.amount,
        });
      }

      const outstanding = def.total - def.amountPaid;
      console.log(
        `  ${def.billNumber}  ${def.status.padEnd(9)}  S$${def.total.toFixed(2).padStart(9)}` +
        `  (${def.items.length} items${outstanding > 0 ? `  outstanding S$${outstanding.toFixed(2)}` : '  PAID IN FULL'})`
      );
    }

    // ── Step 4: Create payments ───────────────────────────────────
    console.log('\n─── Creating payments ───────────────────────────');

    for (const p of PAYMENT_DEFS) {
      const billId = billIdMap[p.billNumber];
      if (!billId) {
        console.error(`  ERROR: Bill "${p.billNumber}" not found — skipping payment`);
        continue;
      }
      await Payment.create({
        billId,
        paymentDate:     p.paymentDate,
        amount:          p.amount,
        method:          p.method,
        referenceNumber: p.referenceNumber || null,
        notes:           p.notes           || null,
      });
      console.log(
        `  ${p.billNumber}  ${p.paymentDate}  S$${p.amount.toFixed(2).padStart(9)}` +
        `  ${p.method}  ref: ${p.referenceNumber || '—'}`
      );
    }

    // ── Step 5: Purchase Orders ───────────────────────────────────
    console.log('\n─── Stage 2: Purchase Orders ────────────────────');
    const poIdMap     = {};
    const poItemsByPo = {};

    // Clear DOs first (FK: delivery_order_items → purchase_order_items)
    for (const d of DO_DEFS) {
      const existing = await DeliveryOrder.findOne({ where: { doNumber: d.doNumber } });
      if (existing) {
        await DeliveryOrderItem.destroy({ where: { deliveryOrderId: existing.id } });
        await existing.destroy();
        console.log(`  Pre-clear DO ${d.doNumber}`);
      }
    }

    for (const def of PO_DEFS) {
      const existing = await PurchaseOrder.findOne({ where: { poNumber: def.poNumber } });
      if (existing) {
        await PurchaseOrderItem.destroy({ where: { purchaseOrderId: existing.id } });
        await existing.destroy();
        console.log(`  Cleared ${def.poNumber}`);
      }
    }

    for (const def of PO_DEFS) {
      const supplierId = supIdMap[def.supplier];
      if (!supplierId) {
        console.error(`  ERROR: Supplier "${def.supplier}" not found — skipping ${def.poNumber}`);
        continue;
      }

      const po = await PurchaseOrder.create({
        poNumber:     def.poNumber,
        supplierId,
        poDate:       def.poDate,
        expectedDate: def.expectedDate,
        status:       def.status,
        subtotal:     def.subtotal,
        gstAmount:    def.gstAmount,
        total:        def.total,
        notes:        def.notes || null,
      });

      poIdMap[def.poNumber] = po.id;

      const createdItems = [];
      for (const item of def.items) {
        const pi = await PurchaseOrderItem.create({
          purchaseOrderId: po.id,
          description:     item.description,
          quantity:        item.quantity,
          unitPrice:       item.unitPrice,
          amount:          item.amount,
        });
        createdItems.push(pi);
      }
      poItemsByPo[def.poNumber] = createdItems;

      if (def.historicalUpdatedAt) {
        await sequelize.query(
          'UPDATE purchase_orders SET updatedAt = ? WHERE id = ?',
          { replacements: [def.historicalUpdatedAt, po.id] }
        );
      }

      console.log(`  CREATED [${po.id}] ${def.poNumber}  ${def.status.padEnd(12)}  S$${def.total.toFixed(2).padStart(9)}  (${def.items.length} items)`);
    }

    // ── Step 6: Delivery Orders ───────────────────────────────────
    console.log('\n─── Stage 2: Delivery Orders ────────────────────');
    const doIdMap = {};

    for (const def of DO_DEFS) {
      const supplierId      = supIdMap[def.supplier];
      const purchaseOrderId = poIdMap[def.poRef];

      if (!supplierId || !purchaseOrderId) {
        console.error(`  ERROR: Missing supplier or PO for ${def.doNumber} — skipping`);
        continue;
      }

      const doRecord = await DeliveryOrder.create({
        doNumber:       def.doNumber,
        purchaseOrderId,
        supplierId,
        receivedDate:   def.receivedDate,
        status:         def.status,
        notes:          def.notes || null,
      });

      doIdMap[def.doNumber] = doRecord.id;

      const poItems = poItemsByPo[def.poRef] || [];
      for (const item of def.items) {
        const matchedPOItem = poItems.find(
          (pi) => pi.description.toLowerCase() === item.description.toLowerCase()
        );
        await DeliveryOrderItem.create({
          deliveryOrderId:  doRecord.id,
          poItemId:         matchedPOItem ? matchedPOItem.id : null,
          description:      item.description,
          quantityReceived: item.quantityReceived,
        });
      }
      console.log(`  CREATED [${doRecord.id}] ${def.doNumber}  ${def.status.padEnd(8)}  ${def.receivedDate}  (${def.items.length} items)`);
    }

    // ── Step 7: Update bills with PO/DO links ────────────────────
    console.log('\n─── Stage 2: Bill → PO/DO Links ─────────────────');

    const billLinks = [
      { billNumber: 'BIL-001', poRef: 'PO-2026-001', doRef: 'DO-2026-001', matchStatus: 'MATCHED' },
      { billNumber: 'BIL-005', poRef: 'PO-2026-004', doRef: 'DO-2026-002', matchStatus: 'DISCREPANCY' },
    ];

    for (const link of billLinks) {
      const bill = await Bill.findOne({ where: { billNumber: link.billNumber } });
      if (!bill) { console.error(`  ERROR: ${link.billNumber} not found`); continue; }
      await bill.update({
        purchaseOrderId: poIdMap[link.poRef] || null,
        deliveryOrderId: doIdMap[link.doRef] || null,
        matchStatus:     link.matchStatus,
      });
      console.log(`  ${link.billNumber}  →  ${link.poRef} / ${link.doRef}  [${link.matchStatus}]`);
    }

    // ── Step 8: Reminder Logs ─────────────────────────────────────
    // Schema: type, sentAt, recordCount, totalAmount, details, status
    console.log('\n─── Stage 2: Reminder Logs ──────────────────────');

    const today      = new Date();
    const yesterday  = new Date(today); yesterday.setDate(today.getDate() - 1);
    const twoDaysAgo = new Date(today); twoDaysAgo.setDate(today.getDate() - 2);

    const yyyymmdd = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const existingCount = await ReminderLog.count({
      where: {
        sentAt: { [require('sequelize').Op.gte]: new Date(yyyymmdd(twoDaysAgo) + 'T00:00:00Z') },
      },
    });

    if (existingCount > 0) {
      console.log(`  ${existingCount} reminder log(s) already exist for this period — skipping.`);
    } else {
      const reminderBatches = [
        {
          sentAt:      new Date(yyyymmdd(yesterday) + 'T00:00:00Z'),
          type:        'AP_PAYMENT',
          status:      'SENT',
          bills:       ['BIL-001', 'BIL-002', 'BIL-005', 'BIL-008'],
        },
        {
          sentAt:      new Date(yyyymmdd(twoDaysAgo) + 'T00:00:00Z'),
          type:        'AP_PAYMENT',
          status:      'SENT',
          bills:       ['BIL-001', 'BIL-002', 'BIL-008'],
        },
        {
          sentAt:      new Date(yyyymmdd(yesterday) + 'T01:00:00Z'),
          type:        'PO_FOLLOWUP',
          status:      'SENT',
          bills:       ['BIL-002'],
        },
      ];

      for (const batch of reminderBatches) {
        const billAmounts = batch.bills
          .map((bn) => BILL_DEFS.find((b) => b.billNumber === bn))
          .filter(Boolean)
          .map((b) => b.total - b.amountPaid);

        const totalAmount   = billAmounts.reduce((s, a) => s + a, 0);
        const detailsJson   = JSON.stringify({ bills: batch.bills });

        await ReminderLog.create({
          type:        batch.type,
          sentAt:      batch.sentAt,
          recordCount: batch.bills.length,
          totalAmount,
          details:     detailsJson,
          status:      batch.status,
        });
        console.log(`  ${batch.type.padEnd(12)}  ${yyyymmdd(batch.sentAt)}  ${batch.bills.length} record(s)  S$${totalAmount.toFixed(2)}`);
      }
    }

    // ── Summary ───────────────────────────────────────────────────
    const billCount    = await Bill.count();
    const paymentCount = await Payment.count();
    const itemCount    = await BillItem.count();
    const poCount      = await PurchaseOrder.count();
    const doCount      = await DeliveryOrder.count();
    const logTotal     = await ReminderLog.count();

    const outstanding = BILL_DEFS
      .filter((b) => ['RECEIVED', 'APPROVED', 'DISPUTED'].includes(b.status))
      .reduce((s, b) => s + b.total - b.amountPaid, 0);
    const paid = BILL_DEFS
      .filter((b) => b.status === 'PAID')
      .reduce((s, b) => s + b.total, 0);

    console.log('\n═══════════════════════════════════════════════');
    console.log('  Seed complete!');
    console.log(`  Bills in DB       : ${billCount}  (${BILL_DEFS.length} seed bills)`);
    console.log(`  Bill items        : ${itemCount}`);
    console.log(`  Payments          : ${paymentCount}`);
    console.log(`  Purchase Orders   : ${poCount}`);
    console.log(`  Delivery Orders   : ${doCount}`);
    console.log(`  Reminder logs     : ${logTotal}`);
    console.log(`  Outstanding (AP)  : S$${outstanding.toFixed(2)}`);
    console.log(`  Paid (seed bills) : S$${paid.toFixed(2)}`);
    console.log('═══════════════════════════════════════════════\n');

    process.exit(0);
  } catch (err) {
    console.error('\n✗ Seed failed:', err.message);
    if (err.errors) err.errors.forEach((e) => console.error(' ', e.message));
    process.exit(1);
  }
}

run();
