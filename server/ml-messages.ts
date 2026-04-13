/**
 * Mercado Livre — Mensagens pós-venda
 * Busca conversas e permite responder direto pelo CRM
 */

import { getDb } from "./db";
import { mlMessages, mlMessageDetails, mlClaims, mlClaimMessages } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { getAccounts, refreshAllMLTokens } from "./mercadolivre";

const API = "https://api.mercadolibre.com";

// Estado do último sync (acessível pelo router)
export const mlSyncStatus = {
  messages: { lastSync: null as Date | null, synced: 0, errors: [] as string[] },
  claims: { lastSync: null as Date | null, synced: 0, errors: [] as string[] },
};

async function mlFetch(path: string, token: string, options?: RequestInit): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ML API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

/** Garante tokens frescos antes de cada sync */
async function ensureFreshTokens(): Promise<void> {
  try {
    await refreshAllMLTokens();
  } catch (_) {}
}

/**
 * Busca mensagens pós-venda de todas as contas
 * Fluxo: orders/search → para cada order, GET /messages/packs/{pack_id}/sellers/{seller_id}
 */
export async function syncMLMessages() {
  const db = await getDb();
  if (!db) return { synced: 0, errors: [] };

  await ensureFreshTokens();

  let totalSynced = 0;
  const errors: string[] = [];

  for (const account of getAccounts()) {
    const token = account.accessToken;
    if (!token) { errors.push(`${account.name}: sem token`); continue; }

    try {
      // Buscar orders recentes para obter pack_ids
      const ordersData = await mlFetch(
        `/orders/search?seller=${account.userId}&sort=date_desc&limit=30`,
        token
      );

      const orders = ordersData?.results || [];
      if (!Array.isArray(orders)) continue;

      // Agrupar por pack_id (evitar duplicatas)
      const seenPacks = new Set<string>();

      for (const order of orders) {
        try {
          const packId = String(order.pack_id || order.id);
          if (!packId || packId === "undefined" || seenPacks.has(packId)) continue;
          seenPacks.add(packId);

          // Buscar mensagens do pack
          const messagesData = await mlFetch(
            `/messages/packs/${packId}/sellers/${account.userId}?tag=post_sale&limit=10&mark_as_read=false`,
            token
          );

          const messages = messagesData?.messages || [];
          const buyerNickname = order.buyer?.nickname || "Comprador";
          const buyerId = String(order.buyer?.id || "");
          const productTitle = order.order_items?.[0]?.item?.title || "";

          // Se não tem mensagens, registrar conversa com status da order
          const hasMessages = Array.isArray(messages) && messages.length > 0;
          const lastMsg = hasMessages ? messages[0] : null;
          const isBuyer = lastMsg ? String(lastMsg?.from?.user_id) !== account.userId : false;

          // Extrair texto real da mensagem (pode ser string ou { plain: "..." })
          const extractText = (msg: any): string => {
            if (!msg) return "";
            const raw = msg.text ?? msg.message_text ?? "";
            if (typeof raw === "object" && raw !== null) return raw.plain || "";
            return typeof raw === "string" ? raw : "";
          };

          // Upsert conversa
          const [existing] = await db.select().from(mlMessages)
            .where(and(eq(mlMessages.packId, packId), eq(mlMessages.accountName, account.name)))
            .limit(1);

          const convData = {
            lastMessageText: extractText(lastMsg),
            lastMessageFrom: (isBuyer ? "buyer" : "seller") as "buyer" | "seller",
            lastMessageAt: lastMsg?.date_created ? new Date(lastMsg.date_created) : new Date(order.date_created),
            buyerName: buyerNickname,
            productTitle,
          };

          if (existing) {
            await db.update(mlMessages).set({
              ...convData,
              unread: isBuyer ? 1 : existing.unread,
              status: isBuyer ? "open" : existing.status,
            }).where(eq(mlMessages.id, existing.id));
          } else {
            await db.insert(mlMessages).values({
              packId,
              orderId: String(order.id),
              accountName: account.name,
              sellerId: account.userId,
              buyerId,
              ...convData,
              unread: isBuyer ? 1 : 0,
              status: isBuyer ? "open" : "answered",
            });
          }

          // Salvar detalhes das mensagens
          if (hasMessages) {
            for (const msg of messages) {
              const msgId = String(msg.id || msg.message_id || `${packId}-${msg.date_created}`);
              const [existingMsg] = await db.select().from(mlMessageDetails)
                .where(and(eq(mlMessageDetails.messageId, msgId), eq(mlMessageDetails.accountName, account.name)))
                .limit(1);

              if (!existingMsg) {
                await db.insert(mlMessageDetails).values({
                  packId,
                  messageId: msgId,
                  accountName: account.name,
                  senderRole: String(msg?.from?.user_id) !== account.userId ? "buyer" : "seller",
                  text: extractText(msg),
                  createdAt: msg?.date_created ? new Date(msg.date_created) : new Date(),
                });
              }
            }
          }

          totalSynced++;
        } catch (packErr: any) {
          // Skip individual pack errors silently
        }
      }
    } catch (err: any) {
      errors.push(`${account.name}: ${err.message?.slice(0, 100)}`);
    }
  }

  mlSyncStatus.messages = { lastSync: new Date(), synced: totalSynced, errors };
  return { synced: totalSynced, errors };
}

/**
 * Responder mensagem no ML
 */
export async function replyMLMessage(packId: string, accountName: string, text: string) {
  const account = getAccounts().find(a => a.name === accountName);
  if (!account) throw new Error("Conta ML não encontrada");

  const token = account.accessToken;
  if (!token) throw new Error("Token ML indisponível");

  // Enviar resposta via API
  const response = await mlFetch(
    `/messages/packs/${packId}/sellers/${account.userId}`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        from: { user_id: account.userId },
        text,
      }),
    }
  );

  // Atualizar no banco
  const db = await getDb();
  if (db) {
    await db.update(mlMessages).set({
      lastMessageText: text,
      lastMessageFrom: "seller",
      lastMessageAt: new Date(),
      unread: 0,
      status: "answered",
    }).where(and(eq(mlMessages.packId, packId), eq(mlMessages.accountName, accountName)));

    await db.insert(mlMessageDetails).values({
      packId,
      messageId: `reply-${Date.now()}`,
      accountName,
      senderRole: "seller",
      text,
      createdAt: new Date(),
    });
  }

  return response;
}

/**
 * Buscar detalhes de uma conversa específica
 * Se não tem no banco, busca direto da API e salva
 */
export async function getMLConversation(packId: string, accountName: string) {
  const db = await getDb();
  if (!db) return [];

  // Primeiro tenta do banco
  const cached = await db.select().from(mlMessageDetails)
    .where(and(eq(mlMessageDetails.packId, packId), eq(mlMessageDetails.accountName, accountName)))
    .orderBy(mlMessageDetails.createdAt);

  if (cached.length > 0) return cached;

  // Se banco está vazio, busca da API do ML
  const account = getAccounts().find(a => a.name === accountName);
  if (!account || !account.accessToken) return [];

  try {
    await ensureFreshTokens();
    const token = account.accessToken;

    // Buscar mensagens do pack via API
    const messagesData = await mlFetch(
      `/messages/packs/${packId}/sellers/${account.userId}?tag=post_sale&limit=50&mark_as_read=false`,
      token
    );

    const messages = messagesData?.messages || [];
    if (!Array.isArray(messages) || messages.length === 0) return [];

    // Salvar no banco
    const results: any[] = [];
    for (const msg of messages) {
      const msgId = String(msg.id || msg.message_id || `${packId}-${msg.date_created}`);
      const msgText = typeof msg?.text === "object" ? (msg.text?.plain || JSON.stringify(msg.text)) : (msg?.text || msg?.message_text || "");
      const senderRole = String(msg?.from?.user_id) !== account.userId ? "buyer" : "seller";
      const createdAt = msg?.date_created ? new Date(msg.date_created) : new Date();

      const [existing] = await db.select().from(mlMessageDetails)
        .where(and(eq(mlMessageDetails.messageId, msgId), eq(mlMessageDetails.accountName, accountName)))
        .limit(1);

      if (!existing) {
        await db.insert(mlMessageDetails).values({
          packId,
          messageId: msgId,
          accountName,
          senderRole: senderRole as "buyer" | "seller",
          text: msgText,
          createdAt,
        });
      }

      results.push({
        id: existing?.id || 0,
        packId,
        messageId: msgId,
        accountName,
        senderRole,
        text: msgText,
        createdAt,
      });
    }

    // Retornar ordenado por data
    return results.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } catch (err: any) {
    console.error(`[ML] Erro ao buscar mensagens do pack ${packId}:`, err.message);
    return [];
  }
}

/**
 * Listar conversas do banco
 */
export async function listMLConversations(filter?: "open" | "answered" | "all") {
  const db = await getDb();
  if (!db) return [];

  const condition = filter && filter !== "all" ? eq(mlMessages.status, filter) : undefined;
  return db.select().from(mlMessages)
    .where(condition)
    .orderBy(desc(mlMessages.lastMessageAt))
    .limit(50);
}

// ═══════════════════════════════════════
// RECLAMAÇÕES
// ═══════════════════════════════════════

/**
 * Sincronizar reclamações do ML
 * API v2: GET /marketplace/v2/claims/search?user_id={id}&status=opened
 */
export async function syncMLClaims() {
  const db = await getDb();
  if (!db) return { synced: 0, errors: [] };

  await ensureFreshTokens();

  let totalSynced = 0;
  const errors: string[] = [];

  for (const account of getAccounts()) {
    const token = account.accessToken;
    if (!token) { errors.push(`${account.name}: sem token`); continue; }

    try {
      for (const status of ["opened", "closed"]) {
        try {
          const data = await mlFetch(
            `/marketplace/v2/claims/search?user_id=${account.userId}&status=${status}&limit=20&offset=0`,
            token
          );

          const claims = data?.data || data?.results || [];
          if (!Array.isArray(claims)) continue;

          for (const claim of claims) {
            try {
              const claimId = String(claim.id);

              // Buscar detalhes completos da reclamação
              let detail: any = claim;
              try {
                detail = await mlFetch(`/marketplace/v2/claims/${claimId}`, token);
              } catch (_) {}

              const buyerInfo = detail?.players?.find((p: any) => p.role === "complainant") || {};

              // Buscar título do produto via order
              let productTitle = "";
              try {
                const orderId = detail?.resource_id || claim.resource_id;
                if (orderId) {
                  const orderData = await mlFetch(`/orders/${orderId}`, token);
                  productTitle = orderData?.order_items?.[0]?.item?.title || "";
                }
              } catch (_) {}

              // Buscar mensagens da reclamação via v2 e salvar no banco
              let lastMsg = "";
              let lastMsgFrom: "buyer" | "seller" | "mediator" = "buyer";
              let lastMsgAt = detail?.date_created ? new Date(detail.date_created) : new Date();

              try {
                // A API de claims retorna array direto, não { data: [...] }
                const msgsRes = await mlFetch(`/marketplace/v2/claims/${claimId}/messages?limit=20`, token);
                const msgs = Array.isArray(msgsRes) ? msgsRes : (msgsRes?.data || msgsRes?.messages || []);
                if (Array.isArray(msgs) && msgs.length > 0) {
                  // Mapear sender_role do ML: respondent=seller, complainant=buyer, mediator=mediator
                  const mapRole = (role: string): "buyer" | "seller" | "mediator" => {
                    if (role === "respondent") return "seller";
                    if (role === "complainant") return "buyer";
                    if (role === "mediator") return "mediator";
                    return "buyer";
                  };

                  // Salvar cada mensagem no banco
                  for (const m of msgs) {
                    const msgId = String(m.hash || m.id || m.message_id || `${claimId}-${m.date_created}`);
                    const msgText = (m.message || m.text || "").replace(/<[^>]*>/g, ""); // Strip HTML tags
                    const senderRole = mapRole(m.sender_role || "");
                    const createdAt = m.date_created ? new Date(m.date_created) : new Date();

                    const [existingClaimMsg] = await db.select().from(mlClaimMessages)
                      .where(and(eq(mlClaimMessages.messageId, msgId), eq(mlClaimMessages.accountName, account.name)))
                      .limit(1);

                    if (!existingClaimMsg) {
                      await db.insert(mlClaimMessages).values({
                        claimId,
                        messageId: msgId,
                        accountName: account.name,
                        senderRole,
                        text: msgText,
                        createdAt,
                      });
                    }
                  }

                  // Última mensagem para o resumo (msgs vem em ordem, última = mais recente ou primeira)
                  const sorted = [...msgs].sort((a, b) => new Date(b.date_created || 0).getTime() - new Date(a.date_created || 0).getTime());
                  const last = sorted[0];
                  lastMsg = (last?.message || last?.text || "").replace(/<[^>]*>/g, "");
                  lastMsgFrom = mapRole(last?.sender_role || "");
                  lastMsgAt = last?.date_created ? new Date(last.date_created) : lastMsgAt;
                }
              } catch (claimMsgErr: any) {
                console.error(`[ML] Erro msgs claim ${claimId}:`, claimMsgErr.message?.slice(0, 100));
              }

              // Buscar nome do comprador via API de users
              let buyerName = "";
              try {
                if (buyerInfo.user_id) {
                  const userData = await mlFetch(`/users/${buyerInfo.user_id}`, token);
                  buyerName = userData?.nickname || "";
                }
              } catch (_) {}

              // Upsert
              const [existing] = await db.select().from(mlClaims)
                .where(and(eq(mlClaims.claimId, claimId), eq(mlClaims.accountName, account.name)))
                .limit(1);

              const claimData = {
                status: detail?.status || status,
                type: detail?.type || claim.type || "",
                reason: detail?.reason_id || detail?.reason || claim.reason_id || "",
                buyerName,
                buyerId: String(buyerInfo?.user_id || ""),
                productTitle,
                quantity: 1,
                amount: "0",
                lastMessage: lastMsg,
                lastMessageFrom: lastMsgFrom,
                lastMessageAt: lastMsgAt,
                unread: lastMsgFrom !== "seller" ? 1 : 0,
                resolution: detail?.resolution?.reason || null,
              };

              if (existing) {
                await db.update(mlClaims).set(claimData).where(eq(mlClaims.id, existing.id));
              } else {
                await db.insert(mlClaims).values({
                  claimId,
                  accountName: account.name,
                  sellerId: account.userId,
                  resourceId: String(detail?.resource_id || ""),
                  ...claimData,
                });
              }
              totalSynced++;
            } catch (_) {}
          }
        } catch (_) {}
      }
    } catch (err: any) {
      errors.push(`${account.name}: ${err.message?.slice(0, 100)}`);
    }
  }

  mlSyncStatus.claims = { lastSync: new Date(), synced: totalSynced, errors };
  return { synced: totalSynced, errors };
}

/**
 * Responder reclamação no ML
 * Verifica available_actions para determinar o receiver_role correto
 */
export async function replyMLClaim(claimId: string, accountName: string, text: string) {
  const account = getAccounts().find(a => a.name === accountName);
  if (!account) throw new Error("Conta ML não encontrada");

  const token = account.accessToken;
  if (!token) throw new Error("Token ML indisponível");

  // Buscar ações disponíveis da claim para saber o receiver_role
  const detail = await mlFetch(`/marketplace/v2/claims/${claimId}`, token);
  const seller = detail?.players?.find((p: any) => p.role === "respondent");
  const actions = seller?.available_actions || [];

  // Determinar receiver_role baseado nas ações disponíveis
  const sendToComplainant = actions.find((a: any) => a.action === "send_message_to_complainant");
  const sendToMediator = actions.find((a: any) => a.action === "send_message_to_mediator");

  if (!sendToComplainant && !sendToMediator) {
    throw new Error("Não é possível responder esta reclamação no momento. Nenhuma ação de envio disponível.");
  }

  const receiverRole = sendToComplainant ? "complainant" : "mediator";

  const response = await mlFetch(
    `/marketplace/v2/claims/${claimId}/actions/send-message`,
    token,
    {
      method: "POST",
      body: JSON.stringify({ receiver_role: receiverRole, message: text }),
    }
  );

  const db = await getDb();
  if (db) {
    await db.update(mlClaims).set({
      lastMessage: text,
      lastMessageFrom: "seller",
      lastMessageAt: new Date(),
      unread: 0,
    }).where(and(eq(mlClaims.claimId, claimId), eq(mlClaims.accountName, accountName)));

    // Salvar resposta na tabela de mensagens da claim
    await db.insert(mlClaimMessages).values({
      claimId,
      messageId: `reply-${Date.now()}`,
      accountName,
      senderRole: "seller",
      text,
      createdAt: new Date(),
    });
  }

  return response;
}

/**
 * Listar reclamações
 */
export async function listMLClaims(filter?: "opened" | "closed" | "all") {
  const db = await getDb();
  if (!db) return [];

  const condition = filter && filter !== "all" ? eq(mlClaims.status, filter) : undefined;
  return db.select().from(mlClaims)
    .where(condition)
    .orderBy(desc(mlClaims.updatedAt))
    .limit(50);
}

/**
 * Buscar mensagens de uma reclamação — busca da API, salva no banco, retorna tudo
 */
export async function getClaimMessages(claimId: string, accountName: string) {
  const db = await getDb();
  const account = getAccounts().find(a => a.name === accountName);

  // Mapear sender_role do ML: respondent=seller, complainant=buyer, mediator=mediator
  const mapRole = (role: string): "buyer" | "seller" | "mediator" => {
    if (role === "respondent") return "seller";
    if (role === "complainant") return "buyer";
    if (role === "mediator") return "mediator";
    return "buyer";
  };

  // Tentar buscar da API e salvar
  if (account?.accessToken && db) {
    try {
      await ensureFreshTokens();
      const raw = await mlFetch(`/marketplace/v2/claims/${claimId}/messages?limit=50`, account.accessToken);
      const msgs = Array.isArray(raw) ? raw : (raw?.data || raw?.messages || []);

      if (Array.isArray(msgs) && msgs.length > 0) {
        for (const m of msgs) {
          const msgId = String(m.hash || m.id || m.message_id || `${claimId}-${m.date_created}`);
          const msgText = (m.message || m.text || "").replace(/<[^>]*>/g, "");
          const senderRole = mapRole(m.sender_role || "");
          const createdAt = m.date_created ? new Date(m.date_created) : new Date();

          const [existing] = await db.select().from(mlClaimMessages)
            .where(and(eq(mlClaimMessages.messageId, msgId), eq(mlClaimMessages.accountName, accountName)))
            .limit(1);

          if (!existing) {
            await db.insert(mlClaimMessages).values({
              claimId,
              messageId: msgId,
              accountName,
              senderRole,
              text: msgText,
              createdAt,
            });
          }
        }
      }
    } catch (err: any) {
      console.error(`[ML] Erro ao buscar mensagens da claim ${claimId}:`, err.message);
    }
  }

  // Verificar ações disponíveis para o vendedor
  let canReply = false;
  let replyTarget = "";
  if (account?.accessToken) {
    try {
      const detail = await mlFetch(`/marketplace/v2/claims/${claimId}`, account.accessToken);
      const seller = detail?.players?.find((p: any) => p.role === "respondent");
      const actions = seller?.available_actions || [];
      const toComplainant = actions.find((a: any) => a.action === "send_message_to_complainant");
      const toMediator = actions.find((a: any) => a.action === "send_message_to_mediator");
      canReply = !!(toComplainant || toMediator);
      replyTarget = toComplainant ? "comprador" : toMediator ? "mediador" : "";
    } catch (_) {}
  }

  // Retornar do banco (inclui mensagens da API + respostas locais)
  if (!db) return { messages: [], canReply, replyTarget };
  const messages = await db.select().from(mlClaimMessages)
    .where(and(eq(mlClaimMessages.claimId, claimId), eq(mlClaimMessages.accountName, accountName)))
    .orderBy(mlClaimMessages.createdAt);

  return { messages, canReply, replyTarget };
}
