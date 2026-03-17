CREATE TABLE `campaign_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`customerId` int NOT NULL,
	`customerName` varchar(255) NOT NULL,
	`customerPhone` varchar(64),
	`status` enum('pending','sent','delivered','clicked','converted') NOT NULL DEFAULT 'pending',
	`trackingCode` varchar(64) NOT NULL,
	`clickedAt` bigint unsigned,
	`convertedOrderId` int,
	`convertedAt` bigint unsigned,
	`sentAt` bigint unsigned,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `campaign_messages_id` PRIMARY KEY(`id`),
	CONSTRAINT `campaign_messages_trackingCode_unique` UNIQUE(`trackingCode`)
);
--> statement-breakpoint
CREATE TABLE `campaign_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`productId` int NOT NULL,
	`promoPrice` decimal(14,4),
	`originalPrice` decimal(14,4),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `campaign_products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`campaignType` enum('promotional','launch','seasonal','flash_sale','loyalty') NOT NULL DEFAULT 'promotional',
	`status` enum('draft','scheduled','active','completed','cancelled') NOT NULL DEFAULT 'draft',
	`discountLabel` varchar(255),
	`discountPercent` decimal(5,2),
	`bannerUrl` text,
	`bannerFileKey` varchar(512),
	`messageTemplate` text,
	`scheduledAt` bigint unsigned,
	`sentAt` bigint unsigned,
	`totalSent` int NOT NULL DEFAULT 0,
	`totalDelivered` int NOT NULL DEFAULT 0,
	`totalClicked` int NOT NULL DEFAULT 0,
	`totalConverted` int NOT NULL DEFAULT 0,
	`totalRevenue` decimal(14,4) NOT NULL DEFAULT '0.0000',
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaigns_id` PRIMARY KEY(`id`)
);
