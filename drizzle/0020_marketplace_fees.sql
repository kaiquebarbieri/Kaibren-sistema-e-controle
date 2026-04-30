CREATE TABLE `marketplace_fees` (
	`id` int AUTO_INCREMENT NOT NULL,
	`marketplace` enum('mercado_livre','shopee') NOT NULL,
	`feeType` enum('commission','fixed','transaction','shipping','storage') NOT NULL,
	`label` varchar(128) NOT NULL,
	`category` varchar(64),
	`listingType` varchar(32),
	`priceMin` decimal(10,2),
	`priceMax` decimal(10,2),
	`percentage` decimal(5,2) NOT NULL DEFAULT '0',
	`fixedAmount` decimal(10,2) NOT NULL DEFAULT '0',
	`active` int NOT NULL DEFAULT 1,
	`validFrom` varchar(10) NOT NULL,
	`validUntil` varchar(10),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketplace_fees_id` PRIMARY KEY(`id`)
);

-- Seeds iniciais — vigencia 2026-03-01 (Perplexity research 2026-04-19)

-- MERCADO LIVRE: comissoes por tipo de anuncio e categoria
INSERT INTO `marketplace_fees` (`marketplace`,`feeType`,`label`,`category`,`listingType`,`percentage`,`validFrom`,`notes`) VALUES
('mercado_livre','commission','Classico — Eletronicos','eletronicos','classico',13.00,'2026-03-02','Faixa 12-14% conforme subcategoria'),
('mercado_livre','commission','Premium — Eletronicos','eletronicos','premium',18.00,'2026-03-02','Faixa 17-19% conforme subcategoria'),
('mercado_livre','commission','Classico — Casa e Moveis','casa_moveis','classico',13.00,'2026-03-02','Faixa 11,5-14%'),
('mercado_livre','commission','Premium — Casa e Moveis','casa_moveis','premium',18.00,'2026-03-02','Faixa 16,5-19%'),
('mercado_livre','commission','Gratis','eletronicos','gratis',0.00,'2026-03-02','Max 60 dias, validacao de demanda');

-- MERCADO LIVRE: taxa fixa escalonada por preco
INSERT INTO `marketplace_fees` (`marketplace`,`feeType`,`label`,`priceMin`,`priceMax`,`fixedAmount`,`validFrom`,`notes`) VALUES
('mercado_livre','fixed','R$ 12,50 – 29',12.50,29.00,6.25,'2026-03-02',NULL),
('mercado_livre','fixed','R$ 29 – 50',29.00,50.00,6.50,'2026-03-02',NULL),
('mercado_livre','fixed','R$ 50 – 79',50.00,79.00,6.75,'2026-03-02',NULL),
('mercado_livre','fixed','Acima R$ 79',79.00,NULL,0.00,'2026-03-02','Sem taxa fixa — so frete gratis obrigatorio');

-- MERCADO LIVRE: frete tipico (seller paga) por faixa
INSERT INTO `marketplace_fees` (`marketplace`,`feeType`,`label`,`priceMin`,`priceMax`,`fixedAmount`,`validFrom`,`notes`) VALUES
('mercado_livre','shipping','Frete R$ 100-120 (500g)',100.00,120.00,15.35,'2026-03-02','Tabela varia por peso e distancia'),
('mercado_livre','shipping','Frete R$ 150-200 (500g)',150.00,200.00,16.45,'2026-03-02','Tabela varia por peso e distancia');

-- SHOPEE: comissao escalonada (desde 01/03/2026, frete gratis obrigatorio para todos)
INSERT INTO `marketplace_fees` (`marketplace`,`feeType`,`label`,`priceMin`,`priceMax`,`percentage`,`fixedAmount`,`validFrom`,`notes`) VALUES
('shopee','commission','Ate R$ 79,99',0.00,80.00,20.00,4.00,'2026-03-01',NULL),
('shopee','commission','R$ 80 – 99,99 (buraco negro)',80.00,100.00,14.00,16.00,'2026-03-01','Taxa efetiva ~30% — evitar essa faixa'),
('shopee','commission','R$ 100 – 199,99',100.00,200.00,14.00,20.00,'2026-03-01',NULL),
('shopee','commission','R$ 200 – 499,99',200.00,500.00,14.00,26.00,'2026-03-01',NULL),
('shopee','commission','R$ 500+',500.00,NULL,14.00,26.00,'2026-03-01','Sem teto apos 03/2026');

-- SHOPEE: taxa de transacao e coparticipacao frete
INSERT INTO `marketplace_fees` (`marketplace`,`feeType`,`label`,`percentage`,`validFrom`,`notes`) VALUES
('shopee','transaction','Taxa de transacao',2.00,'2026-03-01','Cobrada sobre valor do pedido + frete'),
('shopee','shipping','Coparticipacao frete (estimada)',25.00,'2026-03-01','Seller arca com ~25% do custo real — varia por campanha');
