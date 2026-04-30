-- ── Produtos: expansão completa ──────────────────────────────────────────
-- Inspirado no GeFinance (reference_gefinance_v3.md seção 14):
-- Histórico de custo/venda, custos fixos associados, multi-depósito,
-- kits compostos, marcas, categorias, fiscal.

-- ── Marcas ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `product_brands` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(160) NOT NULL UNIQUE,
  `notes` TEXT NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO `product_brands` (`name`) VALUES
  ('Mondial'),
  ('Genérico');

-- ── Categorias ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `product_categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `parentId` INT NULL,
  `name` VARCHAR(160) NOT NULL,
  `slug` VARCHAR(180) NOT NULL UNIQUE,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_cat_parent` (`parentId`)
);

INSERT IGNORE INTO `product_categories` (`name`, `slug`) VALUES
  ('Peças Air Fryer',  'pecas-air-fryer'),
  ('Peças Liquidificador', 'pecas-liquidificador'),
  ('Peças Ventilador',  'pecas-ventilador'),
  ('Peças Batedeira',   'pecas-batedeira'),
  ('Outras',            'outras');

-- ── Depósitos ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `product_warehouses` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(160) NOT NULL UNIQUE,
  `address` VARCHAR(255) NULL,
  `isDefault` TINYINT(1) NOT NULL DEFAULT 0,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO `product_warehouses` (`name`, `isDefault`) VALUES
  ('Loja Taboão',  1),
  ('Galpão CK',    0);

-- ── Campos extras em products ──────────────────────────────────────────
ALTER TABLE `products`
  ADD COLUMN `brandId`         INT NULL AFTER `id`,
  ADD COLUMN `categoryId`      INT NULL AFTER `brandId`,
  ADD COLUMN `internalCode`    VARCHAR(64) NULL AFTER `sku`,
  ADD COLUMN `ncm`             VARCHAR(16) NULL AFTER `internalCode`,
  ADD COLUMN `gtin`            VARCHAR(20) NULL AFTER `ncm`,
  ADD COLUMN `cest`            VARCHAR(12) NULL AFTER `gtin`,
  ADD COLUMN `taxOriginCode`   VARCHAR(4)  NULL AFTER `cest`,
  ADD COLUMN `unitOfMeasure`   VARCHAR(8)  NOT NULL DEFAULT 'UN' AFTER `taxOriginCode`,
  ADD COLUMN `weightKg`        DECIMAL(10,4) NULL AFTER `unitOfMeasure`,
  ADD COLUMN `notes`           TEXT NULL AFTER `weightKg`,
  ADD COLUMN `isKit`           TINYINT(1) NOT NULL DEFAULT 0 AFTER `isActive`,
  ADD KEY `idx_prod_brand`    (`brandId`),
  ADD KEY `idx_prod_category` (`categoryId`);

-- ── Histórico de preço de custo ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `product_cost_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `productId` INT NOT NULL,
  `cost` DECIMAL(14,4) NOT NULL,
  `validFrom` VARCHAR(10) NOT NULL,
  `supplier` VARCHAR(160) NULL,
  `sourceDoc` VARCHAR(120) NULL,
  `notes` TEXT NULL,
  `createdByUserId` INT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_cost_product_date` (`productId`, `validFrom`),
  CONSTRAINT `fk_cost_product`
    FOREIGN KEY (`productId`) REFERENCES `products`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- ── Histórico de preço de venda ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `product_sale_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `productId` INT NOT NULL,
  `price` DECIMAL(14,4) NOT NULL,
  `validFrom` VARCHAR(10) NOT NULL,
  `channel` VARCHAR(64) NULL,
  `notes` TEXT NULL,
  `createdByUserId` INT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_sale_product_date` (`productId`, `validFrom`),
  CONSTRAINT `fk_sale_product`
    FOREIGN KEY (`productId`) REFERENCES `products`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- ── Custos fixos rateados ao produto ────────────────────────────────────
CREATE TABLE IF NOT EXISTS `product_fixed_costs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `productId` INT NOT NULL,
  `label` VARCHAR(160) NOT NULL,
  `amount` DECIMAL(14,4) NOT NULL,
  `period` ENUM('por_unidade','mensal','anual') NOT NULL DEFAULT 'por_unidade',
  `notes` TEXT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_fixcost_product` (`productId`),
  CONSTRAINT `fk_fixcost_product`
    FOREIGN KEY (`productId`) REFERENCES `products`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- ── Multi-depósito ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `product_stocks` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `productId` INT NOT NULL,
  `warehouseId` INT NOT NULL,
  `quantity` INT NOT NULL DEFAULT 0,
  `minStock` INT NOT NULL DEFAULT 0,
  `maxStock` INT NULL,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_product_warehouse` (`productId`, `warehouseId`),
  CONSTRAINT `fk_stock_product`
    FOREIGN KEY (`productId`) REFERENCES `products`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_stock_warehouse`
    FOREIGN KEY (`warehouseId`) REFERENCES `product_warehouses`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- ── Itens de kit (SKU composto) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `product_kit_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `kitProductId` INT NOT NULL,
  `componentProductId` INT NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_kit_component` (`kitProductId`, `componentProductId`),
  CONSTRAINT `fk_kit_parent`
    FOREIGN KEY (`kitProductId`) REFERENCES `products`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_kit_component`
    FOREIGN KEY (`componentProductId`) REFERENCES `products`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
);
