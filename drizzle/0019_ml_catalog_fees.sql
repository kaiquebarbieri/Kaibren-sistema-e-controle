ALTER TABLE `ml_catalog_products` ADD COLUMN `platformFeePercent` decimal(5,2) NOT NULL DEFAULT '0';
ALTER TABLE `ml_catalog_products` ADD COLUMN `taxPercent` decimal(5,2) NOT NULL DEFAULT '0';
