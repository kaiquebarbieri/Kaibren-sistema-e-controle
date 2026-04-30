-- Vincula integrações (ML, Shopee, etc.) a um CNPJ cadastrado
-- Necessário para o DRE separar vendas por empresa emissora

ALTER TABLE `integrations`
  ADD COLUMN `cnpjId` INT NULL AFTER `status`,
  ADD CONSTRAINT `fk_integrations_cnpj`
    FOREIGN KEY (`cnpjId`) REFERENCES `my_cnpjs`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
