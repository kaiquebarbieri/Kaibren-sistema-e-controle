CREATE TABLE IF NOT EXISTS `ml_catalog_products` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `mlItemId` varchar(64) NOT NULL,
  `accountName` varchar(128) NOT NULL,
  `title` text NOT NULL,
  `sku` varchar(128),
  `imageUrl` text,
  `salePrice` decimal(14, 2) NOT NULL DEFAULT '0',
  `costPrice` decimal(14, 2) NOT NULL DEFAULT '0',
  `packagingCost` decimal(14, 2) NOT NULL DEFAULT '0',
  `status` varchar(32) NOT NULL DEFAULT 'active',
  `lastSyncAt` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT NOW(),
  `updatedAt` timestamp NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY `ml_catalog_products_mlItemId_unique` (`mlItemId`)
);
