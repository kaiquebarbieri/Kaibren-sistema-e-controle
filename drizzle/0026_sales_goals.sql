-- Metas de venda — faturamento e margem por mes
-- cnpjId = 0 representa meta consolidada (soma de todas as empresas)
-- cnpjId > 0 = meta especifica daquela empresa (my_cnpjs.id)

CREATE TABLE IF NOT EXISTS `sales_goals` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `year` INT NOT NULL,
  `month` INT NOT NULL,
  `cnpjId` INT NOT NULL DEFAULT 0,
  `faturamentoMeta` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `margemMetaPct` DECIMAL(6,4) NOT NULL DEFAULT 0,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_year_month_cnpj` (`year`, `month`, `cnpjId`)
);
