CREATE TABLE `my_cnpjs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`razaoSocial` varchar(255) NOT NULL,
	`cnpj` varchar(32) NOT NULL,
	`nomeFantasia` varchar(255),
	`inscricaoEstadual` varchar(64),
	`notes` text,
	`isActive` int NOT NULL DEFAULT 1,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `my_cnpjs_id` PRIMARY KEY(`id`),
	CONSTRAINT `my_cnpjs_cnpj_unique` UNIQUE(`cnpj`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `cnpjId` int;