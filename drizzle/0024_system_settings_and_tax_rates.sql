-- Cria system_settings (key/value global), company_tax_rates (aliquotas por mes)
-- e company_tax_exceptions (ICMS/DIFAL/ST por UF ou produto)

CREATE TABLE IF NOT EXISTS `system_settings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(64) NOT NULL UNIQUE,
  `value` TEXT NOT NULL,
  `description` VARCHAR(255) NULL,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed do toggle de fonte de data para o DRE (sale | invoice)
INSERT IGNORE INTO `system_settings` (`key`, `value`, `description`)
VALUES ('dateSource', 'sale', 'Fonte de data do DRE: sale (data da venda) ou invoice (data da NF)');

CREATE TABLE IF NOT EXISTS `company_tax_rates` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `cnpjId` INT NOT NULL,
  `year` INT NOT NULL,
  `month` INT NOT NULL,
  `effectiveRate` DECIMAL(6,3) NOT NULL DEFAULT 0,
  `irpjRate` DECIMAL(6,3) NULL,
  `csllRate` DECIMAL(6,3) NULL,
  `pisRate` DECIMAL(6,3) NULL,
  `cofinsRate` DECIMAL(6,3) NULL,
  `icmsRate` DECIMAL(6,3) NULL,
  `issRate` DECIMAL(6,3) NULL,
  `rbt12` DECIMAL(14,2) NULL,
  `notes` TEXT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_rate_cnpj_mes` (`cnpjId`, `year`, `month`),
  CONSTRAINT `fk_rates_cnpj`
    FOREIGN KEY (`cnpjId`) REFERENCES `my_cnpjs`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS `company_tax_exceptions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `cnpjId` INT NOT NULL,
  `exceptionType` ENUM('icms_interestadual','difal','st','produto','outro') NOT NULL,
  `ufDestino` VARCHAR(2) NULL,
  `productRef` VARCHAR(64) NULL,
  `rate` DECIMAL(6,3) NOT NULL,
  `validFrom` VARCHAR(10) NOT NULL,
  `validUntil` VARCHAR(10) NULL,
  `notes` TEXT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_exc_cnpj` (`cnpjId`),
  CONSTRAINT `fk_exc_cnpj`
    FOREIGN KEY (`cnpjId`) REFERENCES `my_cnpjs`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
);
