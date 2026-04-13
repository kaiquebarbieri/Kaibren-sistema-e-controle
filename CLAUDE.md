# CLAUDE.md — Sistema Kaibren

Leia este arquivo inteiro antes de fazer qualquer coisa. Ele é a base de contexto do projeto.

---

## O que é este projeto

**Sistema de gestão interno da Kaibren** — distribuidora e e-commerce de peças de reposição para eletrodomésticos Mondial (air fryer, liquidificador, ventilador, batedeira etc.).

URL de produção: `http://187.77.253.97:3002`  
Login: `kaique@kaibren.com.br` / `kaibren2024`

---

## Stack técnica

| Camada | Tecnologia |
|---|---|
| Frontend | React + TypeScript + Vite + TailwindCSS + shadcn/ui |
| Backend | Node.js + tRPC + Express |
| Banco | MySQL 8 — `kaibren_crm` (porta 3306) |
| ORM | Drizzle ORM |
| Build | `pnpm build` → gera `dist/` |
| Dev | `pnpm dev` (porta 3002) |
| Produção | `NODE_ENV=production node dist/index.js` |
| Serialização | superjson (cliente e servidor devem usar o mesmo transformer) |

---

## Estrutura de pastas

```
Kaibren-sistema-e-controle/
├── client/src/
│   ├── pages/          ← Páginas do sistema (uma por rota)
│   ├── components/     ← Componentes reutilizáveis
│   │   └── DashboardLayout.tsx  ← Layout principal com sidebar
│   ├── lib/trpc.ts     ← Client tRPC
│   └── App.tsx         ← Rotas (wouter)
├── server/
│   ├── routers.ts      ← Todos os endpoints tRPC
│   ├── db.ts           ← Queries do banco (Drizzle)
│   ├── schema.ts       ← Schema do banco
│   └── _core/trpc.ts   ← Config do tRPC (superjson transformer)
├── shared/             ← Tipos compartilhados
└── dist/               ← Build de produção (não editar)
```

---

## Como adicionar uma nova página

1. Criar `client/src/pages/NomePagina.tsx`
2. Importar e adicionar rota em `App.tsx`
3. Adicionar item no menu em `DashboardLayout.tsx` (array de nav items)
4. Rodar `pnpm build` para gerar o dist
5. Reiniciar o servidor de produção

---

## Banco de dados — tabelas principais

```sql
products          -- Catálogo de produtos (SKU, custo, preço de venda, margem)
orders            -- Pedidos B2B
customers         -- Clientes/revendedores
agents            -- Agentes IA (Noah, Maya, Sam, Luna, etc.)
agent_logs        -- Logs de atividade dos agentes
agent_tasks       -- Tarefas dos agentes
agent_alerts      -- Alertas gerados pelos agentes
product_uploads   -- Histórico de importações de planilha
```

### Campos importantes de `products`
- `tabelaNovaCk` — custo que Kaique paga na Mondial
- `valorProduto` — custo (mesmo valor)
- `precoFinal` — preço de venda (o que o cliente paga)
- `margemFinal` — margem decimal (ex: 0.37 = 37%)
- `lucro` — precoFinal - valorProduto

---

## Identidade visual

```css
--preto:   #020617
--dourado: #D4AF37
--bege:    #F5F0E6
--branco:  #F8FAFC
```

- Design dark premium por padrão
- Fonte: Inter
- Componentes: shadcn/ui com tema customizado
- Ícones: lucide-react

---

## Negócio — contexto essencial

**Dono:** Kaique Barbieri Affonso  
**Empresa:** Kaibren / CK Atacados  
**Produto principal:** Peças de reposição Mondial (air fryer, liquidificador, ventilador)  
**Canais de venda:** Shopee, Mercado Livre, Amazon, TikTok Shop, loja física (Taboão da Serra)  
**Fornecedor principal:** Mondial — parceria com comissão R$0,75/peça  
**Time:** Kaique + Brenda (esposa/sócia) + 2 funcionários

### Agentes IA ativos no sistema
| Agente | Papel |
|---|---|
| Noah 🦾 | CEO Virtual — coordenação geral |
| Léo 💰 | Financeiro |
| Maya 📊 | Meta Ads / Campanhas |
| Bia 📦 | Estoque |
| Rex ⚖️ | Fiscal |
| Sam 🛒 | Vendas ML/Shopee |
| Luna 📸 | Criativos |
| Clara 🤝 | B2B / Prospecção |
| Vera 🏪 | Loja Física |
| Bruno 🧑⚖️ | Jurídico |

---

## Regras importantes

1. **Nunca** sobrescrever `SOUL.md`, `USER.md`, `AGENTS.md`, `MEMORY.md` — são arquivos do agente Noah
2. **Nunca** commitar credenciais — estão em `.env`
3. `pnpm build` sempre antes de subir para produção
4. O servidor de produção roda via `NODE_ENV=production nohup node dist/index.js >> /tmp/crm-prod.log 2>&1 &`
5. MySQL: `mysql -u kaibren -pkaibren2024 kaibren_crm`

---

## Variáveis de ambiente (.env)

```
DATABASE_URL=mysql://kaibren:kaibren2024@localhost:3306/kaibren_crm
JWT_SECRET=...
META_APP_ID=1463805751963828
META_APP_SECRET=...
ML_ACCESS_TOKEN_CLICKMULTII=...
ML_ACCESS_TOKEN_DUOULTILIDADE=...
ML_ACCESS_TOKEN_KAIBRENLTDA=...
```

---

## Comandos úteis

```bash
# Instalar dependências
pnpm install

# Rodar em desenvolvimento
pnpm dev

# Build produção
pnpm build

# Rodar produção
NODE_ENV=production node dist/index.js

# Acessar banco
mysql -u kaibren -pkaibren2024 kaibren_crm

# Ver logs
tail -f /tmp/crm-prod.log
```
