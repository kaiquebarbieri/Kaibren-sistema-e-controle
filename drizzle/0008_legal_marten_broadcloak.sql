CREATE TABLE `bank_statements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bankName` varchar(128) NOT NULL,
	`periodMonth` int NOT NULL,
	`periodYear` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileUrl` text NOT NULL,
	`totalTransactions` int NOT NULL DEFAULT 0,
	`totalIdentified` int NOT NULL DEFAULT 0,
	`saldoInicial` decimal(14,2),
	`saldoFinal` decimal(14,2),
	`status` enum('pending','partial','completed') NOT NULL DEFAULT 'pending',
	`notes` text,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bank_statements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bank_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`statementId` int NOT NULL,
	`transactionDate` varchar(20) NOT NULL,
	`originalDescription` text NOT NULL,
	`amount` decimal(14,2) NOT NULL,
	`transactionType` enum('credit','debit') NOT NULL DEFAULT 'debit',
	`category` varchar(128),
	`userDescription` text,
	`isIdentified` int NOT NULL DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bank_transactions_id` PRIMARY KEY(`id`)
);
