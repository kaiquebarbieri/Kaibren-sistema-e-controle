CREATE TABLE `marketing_strategies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`triggerType` varchar(128) NOT NULL,
	`description` text NOT NULL,
	`exampleMessage` text NOT NULL,
	`emoji` varchar(16) NOT NULL DEFAULT '',
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `marketing_strategies_id` PRIMARY KEY(`id`)
);
