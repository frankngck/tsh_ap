-- ============================================================
-- TSH Synergy Pte Ltd
-- Accounts Payable (AP) Module — Stage 3 Database Schema
-- Updated: Role-Based Access + Multi-Level Approval + Supplier Scorecard
-- MySQL 8 | Compatible with AR module for future integration
-- ============================================================

CREATE DATABASE IF NOT EXISTS tsh_apv3;
USE tsh_apv3;

-- ============================================================
-- INTEGRATION NOTE: When merging AR and AP into a single DB,
-- the `users` table is shared. Add a `module` ENUM column
-- ('AR','AP','BOTH') to control access per module.
-- All monetary fields use DECIMAL(12,2) for consistency.
-- All timestamps use Sequelize-managed createdAt/updatedAt.
-- GST rate: 9% (configurable via process.env.GST_RATE).
-- ============================================================

-- ============================================================
-- STAGE 3 CHANGES SUMMARY
-- ============================================================
-- Table: users
--   CHANGED: role ENUM expanded from ('admin','user')
--            to ('admin','clerk','manager')
--   CHANGED: DEFAULT role changed from 'user' to 'clerk'
--   ADDED:   2 new seed users (clerk@tsh.sg, manager@tsh.sg)
--
-- Table: bills
--   ADDED: approvalStage ENUM('NONE','PENDING_MANAGER','APPROVED_MANAGER')
--   ADDED: approvedByClerkId INT NULL (FK → users.id)
--   ADDED: approvedByManagerId INT NULL (FK → users.id)
--   ADDED: approvedAt DATETIME NULL
--   ADDED: managerApprovedAt DATETIME NULL
--
-- New FK relationships:
--   bills.approvedByClerkId   → users.id
--   bills.approvedByManagerId → users.id
--
-- All other tables (suppliers, purchase_orders, purchase_order_items,
-- delivery_orders, delivery_order_items, bill_items, payments,
-- reminder_logs) are UNCHANGED from Stage 2.
-- ============================================================

-- ============================================================
-- Table 1: users  [UPDATED — Stage 3]
-- Authentication and role-based access control.
-- Stage 3: role ENUM expanded to 3 named roles.
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id          INT           AUTO_INCREMENT PRIMARY KEY,
    email       VARCHAR(255)  NOT NULL UNIQUE,
    password    VARCHAR(255)  NOT NULL,                -- bcryptjs hashed
    name        VARCHAR(100)  NOT NULL,
    role        ENUM('admin','clerk','manager')         -- CHANGED: was ('admin','user')
                NOT NULL DEFAULT 'clerk',              -- CHANGED: was DEFAULT 'user'
    createdAt   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Table 2: suppliers  [UNCHANGED]
-- Supplier/vendor master data with category and bank details.
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
    id              INT             AUTO_INCREMENT PRIMARY KEY,
    companyName     VARCHAR(200)    NOT NULL,
    contactPerson   VARCHAR(100)    NOT NULL,
    email           VARCHAR(255)    NOT NULL,
    phone           VARCHAR(20)     NULL,
    address         VARCHAR(500)    NULL,
    postalCode      VARCHAR(10)     NULL,
    bankAccount     VARCHAR(50)     NULL,              -- for payment processing
    category        ENUM('RAW_MATERIALS','COMPONENTS','SERVICES','PACKAGING','OTHER')
                    NOT NULL DEFAULT 'OTHER',
    paymentTerms    INT             NULL DEFAULT 30,    -- days
    createdAt       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                    ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Table 3: purchase_orders  [UNCHANGED]
-- Purchase orders sent to suppliers.
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_orders (
    id              INT             AUTO_INCREMENT PRIMARY KEY,
    poNumber        VARCHAR(20)     NOT NULL UNIQUE,    -- PO-YYYY-NNN
    supplierId      INT             NOT NULL,
    poDate          DATE            NOT NULL,
    expectedDate    DATE            NOT NULL,
    subtotal        DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    gstAmount       DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    total           DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    status          ENUM('DRAFT','SENT','CONFIRMED','PART_RECEIVED','COMPLETED','CANCELLED')
                    NOT NULL DEFAULT 'DRAFT',
    sentDate        DATETIME        NULL,
    confirmedDate   DATETIME        NULL,
    notes           TEXT            NULL,
    createdAt       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                    ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (supplierId) REFERENCES suppliers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Table 4: purchase_order_items  [UNCHANGED]
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id              INT             AUTO_INCREMENT PRIMARY KEY,
    purchaseOrderId INT             NOT NULL,
    description     VARCHAR(500)    NOT NULL,
    quantity        INT             NOT NULL,
    unitPrice       DECIMAL(12,2)   NOT NULL,
    amount          DECIMAL(12,2)   NOT NULL,
    createdAt       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                    ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (purchaseOrderId) REFERENCES purchase_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Table 5: delivery_orders  [UNCHANGED]
-- ============================================================
CREATE TABLE IF NOT EXISTS delivery_orders (
    id              INT             AUTO_INCREMENT PRIMARY KEY,
    doNumber        VARCHAR(20)     NOT NULL UNIQUE,    -- DO-YYYY-NNN
    purchaseOrderId INT             NOT NULL,
    supplierId      INT             NOT NULL,
    receivedDate    DATE            NOT NULL,
    status          ENUM('RECEIVED','INSPECTED','ACCEPTED','REJECTED')
                    NOT NULL DEFAULT 'RECEIVED',
    receivedBy      VARCHAR(100)    NULL,
    notes           TEXT            NULL,
    createdAt       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                    ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (purchaseOrderId) REFERENCES purchase_orders(id),
    FOREIGN KEY (supplierId) REFERENCES suppliers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Table 6: delivery_order_items  [UNCHANGED]
-- ============================================================
CREATE TABLE IF NOT EXISTS delivery_order_items (
    id                  INT             AUTO_INCREMENT PRIMARY KEY,
    deliveryOrderId     INT             NOT NULL,
    poItemId            INT             NULL,
    description         VARCHAR(500)    NOT NULL,
    quantityReceived    INT             NOT NULL,
    remarks             TEXT            NULL,
    createdAt           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                        ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (deliveryOrderId) REFERENCES delivery_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (poItemId) REFERENCES purchase_order_items(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Table 7: bills  [UPDATED — Stage 3]
-- Added 5 columns for two-tier approval tracking.
-- approvalStage tracks where in the approval chain the bill sits.
-- approvedByClerkId / approvedByManagerId record who approved.
-- Both FK to users.id (nullable — not set until approved).
-- ============================================================
CREATE TABLE IF NOT EXISTS bills (
    id                  INT             AUTO_INCREMENT PRIMARY KEY,
    billNumber          VARCHAR(20)     NOT NULL UNIQUE,    -- BIL-NNN
    supplierId          INT             NOT NULL,
    purchaseOrderId     INT             NULL,
    deliveryOrderId     INT             NULL,
    billDate            DATE            NOT NULL,
    dueDate             DATE            NOT NULL,
    subtotal            DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    gstAmount           DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    total               DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    amountPaid          DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    status              ENUM('RECEIVED','APPROVED','PAID','DISPUTED')
                        NOT NULL DEFAULT 'RECEIVED',
    matchStatus         ENUM('PENDING','MATCHED','DISCREPANCY')
                        NOT NULL DEFAULT 'PENDING',
    -- ---- Stage 3: Two-tier approval columns ----------------
    approvalStage       ENUM('NONE','PENDING_MANAGER','APPROVED_MANAGER')
                        NOT NULL DEFAULT 'NONE',            -- NEW Stage 3
    approvedByClerkId   INT             NULL,               -- NEW Stage 3 (FK → users.id)
    approvedByManagerId INT             NULL,               -- NEW Stage 3 (FK → users.id)
    approvedAt          DATETIME        NULL,               -- NEW Stage 3: Tier 1 timestamp
    managerApprovedAt   DATETIME        NULL,               -- NEW Stage 3: Tier 2 timestamp
    -- --------------------------------------------------------
    notes               TEXT            NULL,
    createdAt           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                        ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (supplierId)          REFERENCES suppliers(id),
    FOREIGN KEY (purchaseOrderId)     REFERENCES purchase_orders(id),
    FOREIGN KEY (deliveryOrderId)     REFERENCES delivery_orders(id),
    FOREIGN KEY (approvedByClerkId)   REFERENCES users(id), -- NEW Stage 3
    FOREIGN KEY (approvedByManagerId) REFERENCES users(id)  -- NEW Stage 3
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Table 8: bill_items  [UNCHANGED]
-- ============================================================
CREATE TABLE IF NOT EXISTS bill_items (
    id              INT             AUTO_INCREMENT PRIMARY KEY,
    billId          INT             NOT NULL,
    description     VARCHAR(500)    NOT NULL,
    quantity        INT             NOT NULL,
    unitPrice       DECIMAL(12,2)   NOT NULL,
    amount          DECIMAL(12,2)   NOT NULL,
    createdAt       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                    ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (billId) REFERENCES bills(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Table 9: payments  [UNCHANGED]
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
    id                INT             AUTO_INCREMENT PRIMARY KEY,
    billId            INT             NOT NULL,
    paymentDate       DATE            NOT NULL,
    amount            DECIMAL(12,2)   NOT NULL,
    method            ENUM('BANK_TRANSFER','CHEQUE','GIRO','TELEGRAPHIC_TRANSFER')
                      NOT NULL,
    referenceNumber   VARCHAR(50)     NULL,
    notes             TEXT            NULL,
    createdAt         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                      ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (billId) REFERENCES bills(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Table 10: reminder_logs  [UNCHANGED]
-- ============================================================
CREATE TABLE IF NOT EXISTS reminder_logs (
    id              INT             AUTO_INCREMENT PRIMARY KEY,
    type            ENUM('AP_PAYMENT','PO_FOLLOWUP')   NOT NULL,
    sentAt          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    recordCount     INT             NOT NULL DEFAULT 0,
    totalAmount     DECIMAL(12,2)   NULL DEFAULT 0.00,
    status          ENUM('SENT','FAILED') NOT NULL DEFAULT 'SENT',
    details         TEXT            NULL,
    errorMessage    TEXT            NULL,
    createdAt       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Sample Data: 3 Users (Stage 3)  [UPDATED]
-- Passwords: bcrypt hashed (cost factor 10)
--   admin@tsh.sg   → password123
--   clerk@tsh.sg   → clerk
--   manager@tsh.sg → manager
-- ============================================================
INSERT INTO users (email, password, name, role) VALUES
('admin@tsh.sg',
 '$2a$10$xPBMHNqLg5Wnv2IqB7fZPOIGfjfNk.H3JMlhfT5Fj8YcqXjPW2lC',
 'Admin User', 'admin'),
('clerk@tsh.sg',
 '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh3y',
 'AP Clerk', 'clerk'),
('manager@tsh.sg',
 '$2a$10$TwIBiVznPInBBCHZV7a7F.Uc5tVaXuqBbkf8K0YWhLJFQBT2dXnxK',
 'Finance Manager', 'manager');

-- ============================================================
-- Sample Data: Suppliers  [UNCHANGED]
-- ============================================================
INSERT INTO suppliers (companyName, contactPerson, email, phone, category, bankAccount, paymentTerms) VALUES
('Alcom Group Pte Ltd',   'Tan Wei Lin', 'tanwl@alcom.sg',      '+65 6234 5678', 'RAW_MATERIALS', 'DBS 012-3456',  30),
('MechParts Global',      'Raj Kumar',   'raj@mechparts.com',   '+65 6345 6789', 'COMPONENTS',    'OCBC 789-0123', 45),
('SG Steel Industries',   'David Lee',   'david@sgsteel.sg',    '+65 6456 7890', 'RAW_MATERIALS', 'UOB 456-7890',  30),
('QuickLogistics SG',     'Amy Ng',      'amy@quicklog.sg',     '+65 6567 8901', 'SERVICES',      'DBS 234-5678',  15),
('Component Plus Ltd',    'John Ong',    'john@comp-plus.sg',   '+65 6678 9012', 'COMPONENTS',    'DBS 345-6789',  30),
('PackRight Industries',  'Linda Koh',   'linda@packright.sg',  '+65 6789 0123', 'PACKAGING',     'OCBC 567-8901', 30);

-- ============================================================
-- Migration Script (for existing Stage 2 databases)
-- Run this block instead of the CREATE TABLE statements above
-- if the tsh_ap database already exists from Stage 1/2.
-- ============================================================
-- Step A: Add name column if missing (Stage 2 may not have it)
-- ALTER TABLE users
--   ADD COLUMN IF NOT EXISTS name VARCHAR(100) NOT NULL DEFAULT 'User' AFTER email;

-- Step B: Update existing admin row before changing ENUM
-- UPDATE users SET role = 'admin', name = 'Admin User'
--   WHERE email = 'admin@tsh.sg';

-- Step C: Change role ENUM (must run AFTER Step B)
-- ALTER TABLE users
--   MODIFY COLUMN role ENUM('admin','clerk','manager') NOT NULL DEFAULT 'clerk';

-- Step D: Add new bill approval columns
-- ALTER TABLE bills
--   ADD COLUMN approvalStage ENUM('NONE','PENDING_MANAGER','APPROVED_MANAGER')
--     NOT NULL DEFAULT 'NONE' AFTER matchStatus,
--   ADD COLUMN approvedByClerkId   INT NULL AFTER approvalStage,
--   ADD COLUMN approvedByManagerId INT NULL AFTER approvedByClerkId,
--   ADD COLUMN approvedAt          DATETIME NULL AFTER approvedByManagerId,
--   ADD COLUMN managerApprovedAt   DATETIME NULL AFTER approvedAt;

-- Step E: Add new foreign keys on bills
-- ALTER TABLE bills
--   ADD CONSTRAINT fk_bills_clerk
--     FOREIGN KEY (approvedByClerkId) REFERENCES users(id),
--   ADD CONSTRAINT fk_bills_manager
--     FOREIGN KEY (approvedByManagerId) REFERENCES users(id);

-- Step F: Seed clerk and manager users
-- INSERT IGNORE INTO users (email, password, name, role) VALUES
-- ('clerk@tsh.sg',
--  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh3y',
--  'AP Clerk', 'clerk'),
-- ('manager@tsh.sg',
--  '$2a$10$TwIBiVznPInBBCHZV7a7F.Uc5tVaXuqBbkf8K0YWhLJFQBT2dXnxK',
--  'Finance Manager', 'manager');

-- ============================================================
-- Verification
-- ============================================================
-- USE tsh_ap;
-- SHOW TABLES;
-- Expected: 10 tables
--
-- SELECT id, email, name, role FROM users;
-- Expected: 3 rows — admin, clerk, manager
--
-- DESCRIBE bills;
-- Verify these new columns exist:
--   approvalStage        enum('NONE','PENDING_MANAGER','APPROVED_MANAGER')
--   approvedByClerkId    int (YES null)
--   approvedByManagerId  int (YES null)
--   approvedAt           datetime (YES null)
--   managerApprovedAt    datetime (YES null)
--
-- SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
-- FROM information_schema.KEY_COLUMN_USAGE
-- WHERE TABLE_SCHEMA = 'tsh_ap' AND REFERENCED_TABLE_NAME IS NOT NULL;
-- Expected: 13 foreign key relationships (was 11 in Stage 2)
