CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`reference` varchar(255),
	`document` varchar(64),
	`phone` varchar(64),
	`email` varchar(320),
	`city` varchar(160),
	`state` varchar(80),
	`notes` text,
	`isActive` int NOT NULL DEFAULT 1,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `monthly_snapshots` ADD `totalPedidosCliente` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `monthly_snapshots` ADD `totalPedidosPessoais` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `monthly_snapshots` ADD `totalComprasPessoais` decimal(14,4) DEFAULT '0.0000' NOT NULL;--> statement-breakpoint
ALTER TABLE `monthly_snapshots` ADD `totalVendasClientes` decimal(14,4) DEFAULT '0.0000' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `customerId` int;--> statement-breakpoint
ALTER TABLE `orders` ADD `orderType` enum('customer','personal') DEFAULT 'customer' NOT NULL;