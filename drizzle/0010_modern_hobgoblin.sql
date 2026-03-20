CREATE TABLE `credit_card_invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardId` int NOT NULL,
	`periodYear` int NOT NULL,
	`periodMonth` int NOT NULL,
	`totalAmount` decimal(14,2) NOT NULL,
	`minimumAmount` decimal(14,2),
	`amountPaid` decimal(14,2),
	`status` enum('paid','pending','partial') NOT NULL DEFAULT 'pending',
	`paidAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `credit_card_invoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `credit_cards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`brand` varchar(64) NOT NULL DEFAULT 'outros',
	`lastFourDigits` varchar(4),
	`closingDay` int NOT NULL DEFAULT 1,
	`dueDay` int NOT NULL DEFAULT 10,
	`creditLimit` decimal(14,2),
	`isActive` int NOT NULL DEFAULT 1,
	`notes` text,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `credit_cards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fixed_cost_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fixedCostId` int NOT NULL,
	`periodYear` int NOT NULL,
	`periodMonth` int NOT NULL,
	`amountPaid` decimal(14,2) NOT NULL,
	`status` enum('paid','pending','overdue') NOT NULL DEFAULT 'pending',
	`paidAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fixed_cost_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fixed_costs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`category` varchar(128) NOT NULL DEFAULT 'outros',
	`amount` decimal(14,2) NOT NULL,
	`dueDay` int NOT NULL DEFAULT 1,
	`isActive` int NOT NULL DEFAULT 1,
	`notes` text,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fixed_costs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `loan_installments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`loanId` int NOT NULL,
	`installmentNumber` int NOT NULL,
	`periodYear` int NOT NULL,
	`periodMonth` int NOT NULL,
	`amount` decimal(14,2) NOT NULL,
	`status` enum('paid','pending','overdue') NOT NULL DEFAULT 'pending',
	`paidAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `loan_installments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `loans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`institution` varchar(255) NOT NULL,
	`totalAmount` decimal(14,2) NOT NULL,
	`totalInstallments` int NOT NULL,
	`installmentAmount` decimal(14,2) NOT NULL,
	`interestRate` decimal(8,4),
	`startDate` varchar(10) NOT NULL,
	`dueDay` int NOT NULL DEFAULT 1,
	`status` enum('active','paid_off') NOT NULL DEFAULT 'active',
	`isActive` int NOT NULL DEFAULT 1,
	`notes` text,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `loans_id` PRIMARY KEY(`id`)
);
