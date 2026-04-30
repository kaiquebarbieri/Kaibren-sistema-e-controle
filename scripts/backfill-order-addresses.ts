// Backfill cidade/estado nos pedidos ML usando o endpoint /shipments/{id}
// Uso: tsx scripts/backfill-order-addresses.ts

import "dotenv/config";
import { eq, and, isNull, isNotNull, sql } from "drizzle-orm";
import { getDb } from "../server/db";
import { marketplaceOrders } from "../drizzle/schema";

interface MLCreds {
  accountName: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
}

const ACCOUNT_PREFIXES: Record<string, string> = {
  CLICKMULTII: "ML_CLICKMULTII",
  DUOULTILIDADE: "ML_DUOULTILIDADE",
  KAIBRENLTDA: "ML_KAIBRENLTDA",
};

async function refreshAccessToken(prefix: string, refreshToken: string): Promise<string> {
  const res = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.ML_APP_ID!,
      client_secret: process.env.ML_CLIENT_SECRET!,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Refresh ${prefix} failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

async function fetchShipmentAddress(token: string, shipmentId: string): Promise<{ city: string | null; state: string | null }> {
  const res = await fetch(`https://api.mercadolibre.com/shipments/${shipmentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { city: null, state: null };
  const data = await res.json();
  const ra = data?.receiver_address;
  return {
    city: ra?.city?.name ?? null,
    state: ra?.state?.name ?? null,
  };
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("DB nao disponivel");

  // Refresh todos os tokens primeiro
  const tokens: Record<string, string> = {};
  for (const [accountName, prefix] of Object.entries(ACCOUNT_PREFIXES)) {
    const refreshToken = process.env[`${prefix}_REFRESH_TOKEN`];
    if (!refreshToken) {
      console.log(`[skip] ${accountName}: sem refresh_token no .env`);
      continue;
    }
    try {
      tokens[accountName] = await refreshAccessToken(prefix, refreshToken);
      console.log(`[ok] ${accountName}: token renovado`);
    } catch (e: any) {
      console.log(`[err] ${accountName}: ${e.message}`);
    }
  }

  // Buscar pedidos com trackingCode mas sem cidade
  const pending = await db
    .select({
      id: marketplaceOrders.id,
      externalId: marketplaceOrders.externalId,
      accountName: marketplaceOrders.accountName,
      trackingCode: marketplaceOrders.trackingCode,
    })
    .from(marketplaceOrders)
    .where(
      and(
        eq(marketplaceOrders.platform, "ml"),
        isNull(marketplaceOrders.buyerCity),
        isNotNull(marketplaceOrders.trackingCode),
      ),
    );

  console.log(`\n${pending.length} pedidos para backfill\n`);

  let ok = 0;
  let fail = 0;
  let empty = 0;

  const batchSize = 8;
  for (let i = 0; i < pending.length; i += batchSize) {
    const batch = pending.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (row) => {
        const token = tokens[row.accountName];
        if (!token || !row.trackingCode) {
          fail++;
          return;
        }
        try {
          const { city, state } = await fetchShipmentAddress(token, row.trackingCode);
          if (city || state) {
            await db
              .update(marketplaceOrders)
              .set({ buyerCity: city, buyerState: state })
              .where(eq(marketplaceOrders.id, row.id));
            ok++;
          } else {
            empty++;
          }
        } catch {
          fail++;
        }
      }),
    );
    if ((i + batchSize) % 80 === 0 || i + batchSize >= pending.length) {
      console.log(`  progresso: ${Math.min(i + batchSize, pending.length)}/${pending.length} | ok=${ok} vazio=${empty} fail=${fail}`);
    }
    // throttle leve: 100ms entre batches
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\nFINAL: ${ok} populados, ${empty} sem endereco, ${fail} falharam`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
