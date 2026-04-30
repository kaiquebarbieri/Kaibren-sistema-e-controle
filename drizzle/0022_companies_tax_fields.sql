-- Expande my_cnpjs com campos tributarios para cadastro de empresas
-- (regime tributario, UF origem, CNAE, data inicio regime, IM)

ALTER TABLE `my_cnpjs`
  ADD COLUMN `inscricaoMunicipal` VARCHAR(64) NULL AFTER `inscricaoEstadual`,
  ADD COLUMN `regime` ENUM('mei', 'simples', 'presumido', 'real') NULL AFTER `inscricaoMunicipal`,
  ADD COLUMN `ufOrigem` VARCHAR(2) NULL AFTER `regime`,
  ADD COLUMN `cnaePrincipal` VARCHAR(16) NULL AFTER `ufOrigem`,
  ADD COLUMN `dataInicioRegime` VARCHAR(10) NULL AFTER `cnaePrincipal`;
