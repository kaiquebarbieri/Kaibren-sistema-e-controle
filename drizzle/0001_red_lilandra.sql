CREATE TABLE `monthly_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`periodYear` int NOT NULL,
	`periodMonth` int NOT NULL,
	`totalPedidos` int NOT NULL DEFAULT 0,
	`totalCliente` decimal(14,4) NOT NULL DEFAULT '0.0000',
	`totalMondial` decimal(14,4) NOT NULL DEFAULT '0.0000',
	`totalComissaoEvertonMondial` decimal(14,4) NOT NULL DEFAULT '0.0000',
	`totalLucro` decimal(14,4) NOT NULL DEFAULT '0.0000',
	`margemMedia` decimal(14,6) NOT NULL DEFAULT '0.000000',
	`atualizadoEm` bigint unsigned NOT NULL,
	CONSTRAINT `monthly_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`productId` int,
	`sku` varchar(128) NOT NULL,
	`titulo` text NOT NULL,
	`quantidade` int NOT NULL DEFAULT 1,
	`tabelaNovaCk` decimal(14,4) NOT NULL DEFAULT '0.0000',
	`imposto` decimal(14,4) NOT NULL DEFAULT '0.0000',
	`comissao` decimal(14,4) NOT NULL DEFAULT '0.7500',
	`valorProduto` decimal(14,4) NOT NULL DEFAULT '0.0000',
	`precoDesejado` decimal(14,4) NOT NULL DEFAULT '0.0000',
	`precoFinal` decimal(14,4) NOT NULL DEFAULT '0.0000',
	`margemFinal` decimal(14,6) NOT NULL DEFAULT '0.000000',
	`lucroUnitario` decimal(14,4) NOT NULL DEFAULT '0.0000',
	`totalCliente` decimal(14,4) NOT NULL DEFAULT '0.0000',
	`totalMondial` decimal(14,4) NOT NULL DEFAULT '0.0000',
	`totalComissaoEvertonMondial` decimal(14,4) NOT NULL DEFAULT '0.0000',
	`totalLucro` decimal(14,4) NOT NULL DEFAULT '0.0000',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerName` varchar(255) NOT NULL,
	`customerReference` varchar(255),
	`status` enum('draft','created','finalized','cancelled') NOT NULL DEFAULT 'draft',
	`periodYear` int NOT NULL,
	`periodMonth` int NOT NULL,
	`notes` text,
	`totalCliente` decimal(14,4) NOT NULL DEFAULT '0.0000',
	`totalMondial` decimal(14,4) NOT NULL DEFAULT '0.0000',
	`totalComissaoEvertonMondial` decimal(14,4) NOT NULL DEFAULT '0.0000',
	`totalLucro` decimal(14,4) NOT NULL DEFAULT '0.0000',
	`margemPedido` decimal(14,6) NOT NULL DEFAULT '0.000000',
	`totalItens` int NOT NULL DEFAULT 0,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`finalizedAt` timestamp,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_uploads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`originalFileKey` varchar(512) NOT NULL,
	`originalFileUrl` text NOT NULL,
	`fileHash` varchar(128),
	`sourceSheetName` varchar(128) NOT NULL DEFAULT 'Tabela',
	`importedRows` int NOT NULL DEFAULT 0,
	`uploadedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_uploads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uploadId` int,
	`sku` varchar(128) NOT NULL,
	`titulo` text NOT NULL,
	`tabelaNovaCk` decimal(14,4) NOT NULL DEFAULT '0.0000',
	`imposto` decimal(14,4) NOT NULL DEFAULT '0.0000',
	`comissao` decimal(14,4) NOT NULL DEFAULT '0.7500',
	`valorProduto` decimal(14,4) NOT NULL DEFAULT '0.0000',
	`precoDesejado` decimal(14,4) NOT NULL DEFAULT '0.0000',
	`margemDesejada` decimal(14,6),
	`precoFinal` decimal(14,4) NOT NULL DEFAULT '0.0000',
	`margemFinal` decimal(14,6) NOT NULL DEFAULT '0.000000',
	`lucro` decimal(14,4) NOT NULL DEFAULT '0.0000',
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_sku_unique` UNIQUE(`sku`)
);
