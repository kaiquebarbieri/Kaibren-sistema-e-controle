CREATE TABLE IF NOT EXISTS `ml_payment_fees` (
  `id` int AUTO_INCREMENT NOT NULL,
  `paymentId` bigint NOT NULL,
  `orderId` bigint NOT NULL,
  `account` varchar(32) NOT NULL,
  `transactionAmount` decimal(14,2) NOT NULL DEFAULT '0',
  `mlSaleFee` decimal(14,2) NOT NULL DEFAULT '0',
  `mpProcessingFee` decimal(14,2) NOT NULL DEFAULT '0',
  `mpFinancingFee` decimal(14,2) NOT NULL DEFAULT '0',
  `otherFees` decimal(14,2) NOT NULL DEFAULT '0',
  `netReceivedAmount` decimal(14,2) NOT NULL DEFAULT '0',
  `shippingAmount` decimal(14,2) NOT NULL DEFAULT '0',
  `dateApproved` timestamp NULL,
  `rawJson` text,
  `syncedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `ml_payment_fees_id` PRIMARY KEY(`id`),
  CONSTRAINT `ml_payment_fees_paymentId_unique` UNIQUE(`paymentId`)
);
CREATE INDEX `ml_payment_fees_orderId_idx` ON `ml_payment_fees` (`orderId`);
CREATE INDEX `ml_payment_fees_account_idx` ON `ml_payment_fees` (`account`);
CREATE INDEX `ml_payment_fees_dateApproved_idx` ON `ml_payment_fees` (`dateApproved`);
