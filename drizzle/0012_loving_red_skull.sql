CREATE TABLE `loan_retention_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`loanId` int NOT NULL,
	`entryDate` varchar(10) NOT NULL,
	`periodYear` int NOT NULL,
	`periodMonth` int NOT NULL,
	`entryType` enum('daily','monthly','manual') NOT NULL DEFAULT 'daily',
	`eventCategory` enum('venda','taxa','antecipacao','devolucao','abatimento_emprestimo','ajuste') NOT NULL DEFAULT 'abatimento_emprestimo',
	`grossAmount` decimal(14,2),
	`netAmount` decimal(14,2),
	`retentionPercentApplied` decimal(8,4),
	`retainedAmount` decimal(14,2) NOT NULL DEFAULT '0.00',
	`sourceReference` varchar(255),
	`notes` text,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `loan_retention_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `payable_accounts` MODIFY COLUMN `accountType` enum('boleto','fornecedor','cartao','emprestimo','imposto','investimento','outros') NOT NULL DEFAULT 'boleto';--> statement-breakpoint
ALTER TABLE `payable_accounts` MODIFY COLUMN `status` enum('pending','paid','overdue','partial') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `payable_accounts` ADD `receiptFileKey` varchar(512);--> statement-breakpoint
ALTER TABLE `payable_accounts` ADD `paymentMethod` varchar(64);--> statement-breakpoint
ALTER TABLE `payable_accounts` ADD `isInvestment` int DEFAULT 0 NOT NULL;