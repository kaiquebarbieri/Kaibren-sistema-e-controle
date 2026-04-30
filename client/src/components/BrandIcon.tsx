/**
 * BrandIcon — logos oficiais das integrações servidos de /public/logos/.
 * Mapeia slug → arquivo. Slugs dinâmicos (shopee-123, instagram-1) normalizam para o base.
 */

import { useState } from "react";

type BrandIconProps = {
  slug: string;
  className?: string;
};

const LOGO_FILES: Record<string, string> = {
  "mercado-livre": "/logos/mercado-livre.svg",
  shopee: "/logos/shopee.svg",
  amazon: "/logos/amazon.svg",
  "tiktok-shop": "/logos/tiktok-shop.svg",
  magalu: "/logos/magalu.svg",
  americanas: "/logos/americanas.svg",
  "meta-ads": "/logos/meta-ads.svg",
  "facebook-ads": "/logos/meta-ads.svg",
  instagram: "/logos/instagram.svg",
  whatsapp: "/logos/whatsapp.svg",
  telegram: "/logos/telegram.svg",
  bling: "/logos/bling.svg",
  tiny: "/logos/tiny.svg",
  omie: "/logos/omie.png",
  shopify: "/logos/shopify.svg",
  vtex: "/logos/vtex.svg",
  nuvemshop: "/logos/nuvemshop.png",
};

// Cor de fallback (inicial) se a imagem falhar — alinhado à marca quando possível
const FALLBACK_COLORS: Record<string, { bg: string; fg: string }> = {
  "mercado-livre": { bg: "#FFE600", fg: "#2D3277" },
  shopee: { bg: "#EE4D2D", fg: "#FFFFFF" },
  amazon: { bg: "#232F3E", fg: "#FF9900" },
  "tiktok-shop": { bg: "#000000", fg: "#FE2C55" },
  magalu: { bg: "#0086FF", fg: "#FFFFFF" },
  americanas: { bg: "#E60014", fg: "#FFFFFF" },
  "meta-ads": { bg: "#0866FF", fg: "#FFFFFF" },
  instagram: { bg: "#E4405F", fg: "#FFFFFF" },
  whatsapp: { bg: "#25D366", fg: "#FFFFFF" },
  telegram: { bg: "#26A5E4", fg: "#FFFFFF" },
  bling: { bg: "#1E88E5", fg: "#FFFFFF" },
  tiny: { bg: "#00A859", fg: "#FFFFFF" },
  omie: { bg: "#002E6D", fg: "#FFFFFF" },
  shopify: { bg: "#96BF48", fg: "#FFFFFF" },
  vtex: { bg: "#F71963", fg: "#FFFFFF" },
  nuvemshop: { bg: "#00A8E8", fg: "#FFFFFF" },
};

function normalizeSlug(slug: string): string {
  if (slug.startsWith("instagram")) return "instagram";
  if (slug.startsWith("shopee")) return "shopee";
  if (slug.startsWith("whatsapp")) return "whatsapp";
  return slug;
}

export function BrandIcon({ slug, className = "w-12 h-12" }: BrandIconProps) {
  const baseSlug = normalizeSlug(slug);
  const logoSrc = LOGO_FILES[baseSlug];
  const [errored, setErrored] = useState(false);

  // Fallback colorido se o logo não existir ou falhar ao carregar
  if (!logoSrc || errored) {
    const fallback = FALLBACK_COLORS[baseSlug] ?? { bg: "#D4AF37", fg: "#020617" };
    const initial = baseSlug.charAt(0).toUpperCase();
    return (
      <div
        className={`${className} flex items-center justify-center rounded-xl font-bold text-lg shrink-0 shadow-sm`}
        style={{ backgroundColor: fallback.bg, color: fallback.fg }}
        aria-label={baseSlug}
      >
        {initial}
      </div>
    );
  }

  return (
    <div
      className={`${className} flex items-center justify-center rounded-xl bg-white p-1.5 shrink-0 shadow-sm ring-1 ring-zinc-800`}
      aria-label={baseSlug}
    >
      <img
        src={logoSrc}
        alt={baseSlug}
        className="w-full h-full object-contain"
        onError={() => setErrored(true)}
        loading="lazy"
      />
    </div>
  );
}
