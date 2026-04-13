/**
 * Studio de Criativos — Kaibren Distribuidora
 * Geração de imagens com IA + publicação automática no Instagram @kaibren_
 */

import { generateImage } from "./_core/imageGeneration";
import { getDb } from "./db";
import { eq } from "drizzle-orm";
import { decrypt } from "./integrations";
import { integrations } from "../drizzle/schema";

// ── Instagram Graph API helpers ─────────────────────────────────────

async function getInstagramCreds(): Promise<{ token: string; igUserId: string } | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(integrations).where(eq(integrations.slug, "instagram-2")).limit(1);
    if (!rows.length || !rows[0].accessToken) return null;
    const token = decrypt(rows[0].accessToken);
    const igUserId = rows[0].accountId || "";
    if (!token || !igUserId) return null;
    return { token, igUserId };
  } catch {
    return null;
  }
}

export async function publishInstagramPost(params: {
  imageUrl: string;
  caption: string;
  isReel?: boolean;
  videoUrl?: string;
}): Promise<{ success: boolean; postId?: string; error?: string }> {
  const creds = await getInstagramCreds();
  if (!creds) return { success: false, error: "Instagram não conectado" };

  const { token, igUserId } = creds;

  try {
    // Step 1: Create media container
    const containerBody: Record<string, string> = {
      caption: params.caption,
      access_token: token,
    };

    if (params.isReel && params.videoUrl) {
      containerBody.media_type = "REELS";
      containerBody.video_url = params.videoUrl;
      containerBody.share_to_feed = "true";
    } else {
      containerBody.image_url = params.imageUrl;
    }

    const containerRes = await fetch(
      `https://graph.facebook.com/v19.0/${igUserId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(containerBody),
      }
    );

    const containerData = await containerRes.json() as any;
    if (!containerData.id) {
      return { success: false, error: `Erro ao criar container: ${JSON.stringify(containerData)}` };
    }

    const containerId = containerData.id;

    // For reels, wait for processing
    if (params.isReel) {
      await new Promise(r => setTimeout(r, 5000));
    }

    // Step 2: Publish
    const publishRes = await fetch(
      `https://graph.facebook.com/v19.0/${igUserId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: token,
        }),
      }
    );

    const publishData = await publishRes.json() as any;
    if (!publishData.id) {
      return { success: false, error: `Erro ao publicar: ${JSON.stringify(publishData)}` };
    }

    return { success: true, postId: publishData.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Estratégia de conteúdo ──────────────────────────────────────────

export type ContentType = "feed_produto" | "feed_promo" | "stories_urgencia" | "reel_dica";

const contentStrategy: Record<ContentType, {
  label: string;
  promptTemplate: (produto: string, detalhe: string) => string;
  captionTemplate: (produto: string, detalhe: string) => string;
  hashtags: string;
}> = {
  feed_produto: {
    label: "Feed — Produto em Destaque",
    promptTemplate: (produto, detalhe) =>
      `Professional product photography for Instagram, Brazilian e-commerce. Product: ${produto}. ${detalhe}. ` +
      `Aesthetic: premium black background with golden accents, dramatic studio lighting, sharp details, clean minimalist composition. ` +
      `Style: high-end catalog photography, luxury feel, 1:1 square format. Product centered and well-lit. No text overlays. Photorealistic.`,
    captionTemplate: (produto, detalhe) =>
      `✨ ${produto}\n\n${detalhe}\n\n🔧 Peça original compatível — entrega rápida para todo o Brasil.\n\n📲 Peça pelo link da bio ou chame no WhatsApp!`,
    hashtags: "#kaibren #pecasreposicao #airfryer #mondial #eletrodomesticos #kaibrendistribuidora #pecasoriginais #manutencao #diy #casaelar",
  },
  feed_promo: {
    label: "Feed — Promoção / Oferta",
    promptTemplate: (produto, detalhe) =>
      `Eye-catching promotional Instagram post for Brazilian e-commerce. Product: ${produto}. ${detalhe}. ` +
      `Style: bold golden and black design, premium feel, promotional energy, product hero shot, clean background. ` +
      `Aesthetic: modern, professional, high contrast. Square 1:1 format. No text overlays. Photorealistic product shot.`,
    captionTemplate: (produto, detalhe) =>
      `🔥 OFERTA ESPECIAL — ${produto}\n\n${detalhe}\n\n⚡ Estoque limitado! Aproveite agora.\n📲 Link na bio ou WhatsApp para comprar.`,
    hashtags: "#oferta #promocao #kaibren #pecasreposicao #airfryer #mondial #desconto #eletrodomesticos #kaibrendistribuidora",
  },
  stories_urgencia: {
    label: "Stories — Urgência / Estoque",
    promptTemplate: (produto, detalhe) =>
      `Vertical Instagram Stories format (9:16), product urgency post. Product: ${produto}. ${detalhe}. ` +
      `Style: bold, high-energy, golden and black Brazilian e-commerce aesthetic. Dramatic product lighting. ` +
      `Clean premium look. No text. Photorealistic.`,
    captionTemplate: (produto, detalhe) =>
      `⚠️ ÚLTIMAS UNIDADES — ${produto}\n\n${detalhe}\n\nCorre que acaba! 🏃\n📲 Chama no WhatsApp ou acessa o link da bio.`,
    hashtags: "#urgente #ultimasunidades #kaibren #pecasreposicao #airfryer #mondial",
  },
  reel_dica: {
    label: "Reel — Dica / Tutorial",
    promptTemplate: (produto, detalhe) =>
      `Clean tutorial thumbnail for Instagram Reels, Brazilian e-commerce. Product: ${produto}. ${detalhe}. ` +
      `Style: bright clean background, product in use or displayed clearly, instructional feel, modern Brazilian style. ` +
      `Premium aesthetic, sharp photography. No text overlays. Photorealistic.`,
    captionTemplate: (produto, detalhe) =>
      `💡 Você sabia? ${produto}\n\n${detalhe}\n\n🔧 Fácil de trocar em casa!\n📲 Encontre no link da bio — Kaibren Distribuidora.`,
    hashtags: "#dica #tutorial #kaibren #pecasreposicao #airfryer #mondial #manutencaocaseira #dicadelar #eletrodomesticos",
  },
};

export async function generateCreative(params: {
  produto: string;
  detalhe: string;
  tipo: ContentType;
  publicar?: boolean;
}): Promise<{
  imageUrl?: string;
  caption: string;
  hashtags: string;
  published?: boolean;
  postId?: string;
  error?: string;
}> {
  const strategy = contentStrategy[params.tipo];
  const prompt = strategy.promptTemplate(params.produto, params.detalhe);
  const caption = strategy.captionTemplate(params.produto, params.detalhe);
  const hashtags = strategy.hashtags;
  const fullCaption = `${caption}\n\n${hashtags}`;

  let imageUrl: string | undefined;

  try {
    const result = await generateImage({ prompt });
    imageUrl = result.url;
  } catch (err: any) {
    return { caption: fullCaption, hashtags, error: `Erro ao gerar imagem: ${err.message}` };
  }

  if (params.publicar && imageUrl) {
    const pub = await publishInstagramPost({ imageUrl, caption: fullCaption });
    return {
      imageUrl,
      caption: fullCaption,
      hashtags,
      published: pub.success,
      postId: pub.postId,
      error: pub.error,
    };
  }

  return { imageUrl, caption: fullCaption, hashtags, published: false };
}

export { contentStrategy };
