-- ============================================================
-- TSH Accounts Payable (tsh_ap) Database Schema
-- Matches Sequelize models: timestamps:true, underscored:false
-- Run: mysql -u root < database/schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS tsh_ap
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE tsh_ap;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `reminder_logs`;
DROP TABLE IF EXISTS `payments`;
DROP TABLE IF EXISTS `bill_items`;
DROP TABLE IF EXISTS `bills`;
DROP TABLE IF EXISTS `delivery_order_items`;
DROP TABLE IF EXISTS `delivery_orders`;
DROP TABLE IF EXISTS `purchase_order_items`;
DROP TABLE IF EXISTS `purchase_orders`;
DROP TABLE IF EXISTS `suppliers`;
DROP TABLE IF EXISTS `users`;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- 1. users
-- ============================================================
CREATE TABLE IF NOT EXISTS `users` (
  `id`        INT            NOT NULL AUTO_INCREMENT,
  `username`  VARCHAR(100)   NOT NULL,
  `password`  VARCHAR(255)   NOT NULL,
  `email`     VARCHAR(150)   NOT NULL,
  `fullName`  VARCHAR(150)   NULL,
  `role`      ENUM('ADMIN','MANAGER','STAFF') NOT NULL DEFAULT 'STAFF',
  `status`    ENUM('ACTIVE','INACTIVE')       NOT NULL DEFAULT 'ACTIVE',
  `createdAt` DATETIME       NOT NULL,
  `updatedAt` DATETIME       NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`),
  UNIQUE KEY `uq_users_email`    (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. suppliers
-- ============================================================
CREATE TABLE IF NOT EXISTS `suppliers` (
  `id`            INT            NOT NULL AUTO_INCREMENT,
  `supplierCode`  VARCHAR(50)    NOT NULL,
  `companyName`   VARCHAR(200)   NOT NULL,
  `contactPerson` VARCHAR(150)   NULL,
  `email`         VARCHAR(150)   NULL,
  `phone`         VARCHAR(50)    NULL,
  `address`       TEXT           NULL,
  `category`      VARCHAR(100)   NULL,
  `paymentTerms`  INT            NOT NULL DEFAULT 30 COMMENT 'Days',
  `gstRegistered` TINYINT(1)     NOT NULL DEFAULT 0,
  `gstNumber`     VARCHAR(50)    NULL,
  `bankName`      VARCHAR(100)   NULL,
  `bankAccount`   VARCHAR(100)   NULL,
  `status`        ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `notes`         TEXT           NULL,
  `createdAt`     DATETIME       NOT NULL,
  `updatedAt`     DATETIME       NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_suppliers_code` (`supplierCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. purchase_orders
-- ============================================================
CREATE TABLE IF NOT EXISTS `purchase_orders` (
  `id`                   INT           NOT NULL AUTO_INCREMENT,
  `poNumber`             VARCHAR(50)   NOT NULL,
  `supplierId`           INT           NOT NULL,
  `orderDate`            DATE          NOT NULL,
  `expectedDeliveryDate` DATE          NULL,
  `status`               ENUM('DRAFT','SENT','PARTIAL','RECEIVED','CLOSED','CANCELLED')
                                       NOT NULL DEFAULT 'DRAFT',
  `subtotal`             DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `gstAmount`            DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total`                DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `notes`                TEXT          NULL,
  `createdAt`            DATETIME      NOT NULL,
  `updatedAt`            DATETIME      NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_po_number` (`poNumber`),
  KEY `idx_po_supplier` (`supplierId`),
  CONSTRAINT `fk_po_supplier`
    FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. purchase_order_items
-- ============================================================
CREATE TABLE IF NOT EXISTS `purchase_order_items` (
  `id`               INT           NOT NULL AUTO_INCREMENT,
  `purchaseOrderId`  INT           NOT NULL,
  `itemCode`         VARCHAR(100)  NULL,
  `description`      VARCHAR(500)  NOT NULL,
  `quantity`         DECIMAL(12,2) NOT NULL,
  `unitPrice`        DECIMAL(12,2) NOT NULL,
  `amount`           DECIMAL(12,2) NOT NULL,
  `quantityReceived` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `createdAt`        DATETIME      NOT NULL,
  `updatedAt`        DATETIME      NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_poi_po` (`purchaseOrderId`),
  CONSTRAINT `fk_poi_po`
    FOREIGN KEY (`purchaseOrderId`) REFERENCES `purchase_orders`(`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. delivery_orders
-- ============================================================
CREATE TABLE IF NOT EXISTS `delivery_orders` (
  `id`              INT          NOT NULL AUTO_INCREMENT,
  `doNumber`        VARCHAR(50)  NOT NULL,
  `purchaseOrderId` INT          NULL,
  `supplierId`      INT          NOT NULL,
  `deliveryDate`    DATE         NOT NULL,
  `status`          ENUM('PENDING','RECEIVED','PARTIAL') NOT NULL DEFAULT 'PENDING',
  `notes`           TEXT         NULL,
  `createdAt`       DATETIME     NOT NULL,
  `updatedAt`       DATETIME     NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_do_number` (`doNumber`),
  KEY `idx_do_supplier`  (`supplierId`),
  KEY `idx_do_po`        (`purchaseOrderId`),
  CONSTRAINT `fk_do_supplier`
    FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_do_po`
    FOREIGN KEY (`purchaseOrderId`) REFERENCES `purchase_orders`(`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. delivery_order_items
-- ============================================================
CREATE TABLE IF NOT EXISTS `delivery_order_items` (
  `id`                 INT           NOT NULL AUTO_INCREMENT,
  `deliveryOrderId`    INT           NOT NULL,
  `purchaseOrderItemId` INT          NULL,
  `description`        VARCHAR(500)  NULL,
  `quantity`           DECIMAL(12,2) NOT NULL,
  `createdAt`          DATETIME      NOT NULL,
  `updatedAt`          DATETIME      NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_doi_do`  (`deliveryOrderId`),
  KEY `idx_doi_poi` (`purchaseOrderItemId`),
  CONSTRAINT `fk_doi_do`
    FOREIGN KEY (`deliveryOrderId`) REFERENCES `delivery_orders`(`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_doi_poi`
    FOREIGN KEY (`purchaseOrderItemId`) REFERENCES `purchase_order_items`(`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 7. bills
-- ============================================================
CREATE TABLE IF NOT EXISTS `bills` (
  `id`              INT           NOT NULL AUTO_INCREMENT,
  `billNumber`      VARCHAR(50)   NOT NULL,
  `supplierId`      INT           NOT NULL,
  `purchaseOrderId` INT           NULL,
  `deliveryOrderId` INT           NULL,
  `billDate`        DATE          NOT NULL,
  `dueDate`         DATE          NOT NULL,
  `status`          ENUM('RECEIVED','APPROVED','PAID','DISPUTED') NOT NULL DEFAULT 'RECEIVED',
  `subtotal`        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `gstAmount`       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total`           DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `amountPaid`      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `notes`           TEXT          NULL,
  `disputeReason`   TEXT          NULL,
  `approvedBy`      INT           NULL,
  `approvedAt`      DATETIME      NULL,
  `createdAt`       DATETIME      NOT NULL,
  `updatedAt`       DATETIME      NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_bill_number` (`billNumber`),
  KEY `idx_bill_supplier`  (`supplierId`),
  KEY `idx_bill_po`        (`purchaseOrderId`),
  KEY `idx_bill_do`        (`deliveryOrderId`),
  KEY `idx_bill_status`    (`status`),
  KEY `idx_bill_due_date`  (`dueDate`),
  CONSTRAINT `fk_bill_supplier`
    FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_bill_po`
    FOREIGN KEY (`purchaseOrderId`) REFERENCES `purchase_orders`(`id`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_bill_do`
    FOREIGN KEY (`deliveryOrderId`) REFERENCES `delivery_orders`(`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 8. bill_items
-- ============================================================
CREATE TABLE IF NOT EXISTS `bill_items` (
  `id`          INT           NOT NULL AUTO_INCREMENT,
  `billId`      INT           NOT NULL,
  `itemCode`    VARCHAR(100)  NULL,
  `description` VARCHAR(500)  NOT NULL,
  `quantity`    DECIMAL(12,2) NOT NULL,
  `unitPrice`   DECIMAL(12,2) NOT NULL,
  `amount`      DECIMAL(12,2) NOT NULL,
  `createdAt`   DATETIME      NOT NULL,
  `updatedAt`   DATETIME      NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_bi_bill` (`billId`),
  CONSTRAINT `fk_bi_bill`
    FOREIGN KEY (`billId`) REFERENCES `bills`(`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 9. payments
-- ============================================================
CREATE TABLE IF NOT EXISTS `payments` (
  `id`            INT           NOT NULL AUTO_INCREMENT,
  `billId`        INT           NOT NULL,
  `paymentDate`   DATE          NOT NULL,
  `amount`        DECIMAL(12,2) NOT NULL,
  `paymentMethod` ENUM('BANK_TRANSFER','CHEQUE','CASH','GIRO','OTHER')
                                NOT NULL DEFAULT 'BANK_TRANSFER',
  `reference`     VARCHAR(200)  NULL,
  `notes`         TEXT          NULL,
  `recordedBy`    INT           NULL,
  `createdAt`     DATETIME      NOT NULL,
  `updatedAt`     DATETIME      NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pay_bill`   (`billId`),
  KEY `idx_pay_date`   (`paymentDate`),
  CONSTRAINT `fk_pay_bill`
    FOREIGN KEY (`billId`) REFERENCES `bills`(`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 10. reminder_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS `reminder_logs` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `billId`       INT          NOT NULL,
  `reminderType` VARCHAR(50)  NULL,
  `sentAt`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `recipient`    VARCHAR(150) NULL,
  `message`      TEXT         NULL,
  `status`       ENUM('SENT','FAILED') NOT NULL DEFAULT 'SENT',
  `createdAt`    DATETIME     NOT NULL,
  `updatedAt`    DATETIME     NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_rl_bill` (`billId`),
  CONSTRAINT `fk_rl_bill`
    FOREIGN KEY (`billId`) REFERENCES `bills`(`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
