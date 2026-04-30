-- Seed das 3 contas ML como integrations separadas, para permitir
-- vincular cada uma a um CNPJ emissor (usado no DRE)

INSERT INTO `integrations` (`slug`, `name`, `status`, `accountId`)
VALUES
  ('ml-clickmultii', 'Mercado Livre — CLICKMULTII', 'connected', 'CLICKMULTII'),
  ('ml-duoultilidade', 'Mercado Livre — DUOULTILIDADE', 'connected', 'DUOULTILIDADE'),
  ('ml-kaibrenltda', 'Mercado Livre — KAIBRENLTDA', 'connected', 'KAIBRENLTDA')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);
