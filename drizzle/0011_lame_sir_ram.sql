CREATE TABLE `payable_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`supplier` varchar(255),
	`category` varchar(128) NOT NULL DEFAULT 'outros',
	`accountType` enum('boleto','fornecedor','cartao','emprestimo','imposto','outros') NOT NULL DEFAULT 'boleto',
	`amount` decimal(14,2) NOT NULL,
	`dueDate` varchar(10) NOT NULL,
	`status` enum('pending','paid','overdue') NOT NULL DEFAULT 'pending',
	`paidAmount` decimal(14,2),
	`paidAt` timestamp,
	`installmentLabel` varchar(64),
	`reminderDaysBefore` int NOT NULL DEFAULT 1,
	`description` text,
	`notes` text,
	`receiptUrl` text,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payable_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `loans` MODIFY COLUMN `totalInstallments` int;--> statement-breakpoint
ALTER TABLE `loans` MODIFY COLUMN `installmentAmount` decimal(14,2);--> statement-breakpoint
ALTER TABLE `loans` MODIFY COLUMN `dueDay` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `loans` ADD `loanType` enum('installment','sales_retention') DEFAULT 'installment' NOT NULL;--> statement-breakpoint
ALTER TABLE `loans` ADD `retentionPercent` decimal(8,4);--> statement-breakpoint
ALTER TABLE `loans` ADD `totalPaid` decimal(14,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `loans` ADD `retentionSource` varchar(128);