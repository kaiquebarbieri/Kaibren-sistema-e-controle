CREATE TABLE `agent_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`level` enum('info','warning','critical') NOT NULL DEFAULT 'info',
	`title` varchar(255) NOT NULL,
	`message` text,
	`isRead` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_contracts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`supplier` varchar(255) NOT NULL,
	`contractType` varchar(128) NOT NULL DEFAULT 'fornecimento',
	`startDate` varchar(10) NOT NULL,
	`endDate` varchar(10),
	`value` decimal(14,2),
	`fileKey` varchar(512),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_contracts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`type` enum('analysis','alert','task','message') NOT NULL DEFAULT 'message',
	`content` text NOT NULL,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`status` enum('pending','running','done','failed') NOT NULL DEFAULT 'pending',
	`result` text,
	`scheduledAt` timestamp,
	`executedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(64) NOT NULL,
	`name` varchar(128) NOT NULL,
	`role` varchar(255) NOT NULL,
	`avatarEmoji` varchar(16) NOT NULL DEFAULT '',
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`lastActivity` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agents_id` PRIMARY KEY(`id`),
	CONSTRAINT `agents_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `integrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(128) NOT NULL,
	`accessToken` text,
	`accountId` varchar(255),
	`extraConfig` text,
	`status` enum('pending','connected','error') NOT NULL DEFAULT 'pending',
	`lastTestedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integrations_id` PRIMARY KEY(`id`),
	CONSTRAINT `integrations_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `marketplace_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`externalId` varchar(128) NOT NULL,
	`platform` varchar(32) NOT NULL,
	`accountName` varchar(128) NOT NULL,
	`status` varchar(64) NOT NULL,
	`statusLabel` varchar(128) NOT NULL,
	`buyerName` varchar(255) NOT NULL,
	`buyerCity` varchar(160),
	`buyerState` varchar(80),
	`productName` text NOT NULL,
	`productImage` text,
	`productSku` varchar(128),
	`quantity` int NOT NULL DEFAULT 1,
	`totalAmount` decimal(14,2) NOT NULL,
	`trackingCode` varchar(128),
	`itemsJson` text,
	`platformCreatedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketplace_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `marketplace_orders_externalId_unique` UNIQUE(`externalId`)
);
--> statement-breakpoint
CREATE TABLE `revenue_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` varchar(10) NOT NULL,
	`channel` varchar(64) NOT NULL,
	`amount` decimal(14,4) NOT NULL DEFAULT '0.0000',
	`orders` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `revenue_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `team_charges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`memberId` int NOT NULL,
	`date` varchar(10) NOT NULL,
	`messageSent` text,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `team_charges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`whatsapp` varchar(32) NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	`usesWhatsappOnly` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `team_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `team_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`memberId` int NOT NULL,
	`taskId` int,
	`date` varchar(10) NOT NULL,
	`status` enum('pendente','cumprido','nao_cumprido') NOT NULL DEFAULT 'pendente',
	`photoPath` varchar(512),
	`observation` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `team_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `team_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`memberId` int NOT NULL,
	`description` varchar(512) NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	CONSTRAINT `team_tasks_id` PRIMARY KEY(`id`)
);
