-- Shopee Chat — Conversas, Mensagens, KB e Eventos

CREATE TABLE `shopee_conversations` (
  `id` int AUTO_INCREMENT NOT NULL,
  `shopId` varchar(32) NOT NULL,
  `conversationId` varchar(64) NOT NULL,
  `buyerId` varchar(64) NOT NULL,
  `buyerName` varchar(255),
  `buyerAvatar` varchar(500),
  `unreadCount` int DEFAULT 0,
  `latestMessageId` varchar(64),
  `latestMessageText` text,
  `latestMessageFrom` enum('buyer','seller') DEFAULT 'buyer',
  `latestMessageAt` timestamp NULL,
  `status` enum('open','answered','escalated','closed') DEFAULT 'open',
  `agentLastAction` enum('none','auto_replied','shadow_drafted','escalated','kaique_replied') DEFAULT 'none',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `shopee_conversations_id` PRIMARY KEY(`id`),
  UNIQUE KEY `shopee_conv_unique` (`shopId`, `conversationId`),
  KEY `shopee_conv_status_idx` (`status`),
  KEY `shopee_conv_updated_idx` (`updatedAt`)
);

CREATE TABLE `shopee_messages` (
  `id` int AUTO_INCREMENT NOT NULL,
  `shopId` varchar(32) NOT NULL,
  `conversationId` varchar(64) NOT NULL,
  `messageId` varchar(64) NOT NULL,
  `fromId` varchar(64) NOT NULL,
  `fromRole` enum('buyer','seller','agent') NOT NULL,
  `messageType` varchar(32) DEFAULT 'text',
  `content` text,
  `agentSource` enum('ai_auto','ai_shadow','kaique_refined','kaique_raw'),
  `agentConfidence` int,
  `itemId` varchar(64),
  `sentAt` timestamp NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `shopee_messages_id` PRIMARY KEY(`id`),
  UNIQUE KEY `shopee_msg_unique` (`shopId`, `messageId`),
  KEY `shopee_msg_conv_idx` (`conversationId`, `sentAt`)
);

CREATE TABLE `shopee_chat_knowledge` (
  `id` int AUTO_INCREMENT NOT NULL,
  `type` enum('produto','regra_geral','tom_voz','aprendizado') NOT NULL,
  `scope` varchar(128),
  `title` varchar(255) NOT NULL,
  `body` text NOT NULL,
  `source` enum('curator','kaique','learned') NOT NULL DEFAULT 'curator',
  `isActive` int NOT NULL DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `shopee_chat_knowledge_id` PRIMARY KEY(`id`),
  KEY `shopee_kb_type_idx` (`type`),
  KEY `shopee_kb_scope_idx` (`scope`)
);

CREATE TABLE `shopee_chat_events` (
  `id` int AUTO_INCREMENT NOT NULL,
  `conversationId` varchar(64),
  `eventType` varchar(64) NOT NULL,
  `payload` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `shopee_chat_events_id` PRIMARY KEY(`id`),
  KEY `shopee_evt_conv_idx` (`conversationId`),
  KEY `shopee_evt_type_idx` (`eventType`),
  KEY `shopee_evt_created_idx` (`createdAt`)
);
