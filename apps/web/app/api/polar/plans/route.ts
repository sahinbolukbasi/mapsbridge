import { NextResponse } from "next/server";

export async function GET() {
  const products = [
    {
      id: "explorer",
      mode: "subscription",
      credits: 100,
      amount: 19900,
      available: true,
      productId: process.env.POLAR_PRODUCT_EXPLORER || "polar_prod_explorer",
      name: "Kaşif (Explorer)",
    },
    {
      id: "pro",
      mode: "subscription",
      credits: 500,
      amount: 49900,
      available: true,
      productId: process.env.POLAR_PRODUCT_PRO || "polar_prod_pro",
      name: "Pro Kaşif (Pro Traveler)",
    },
    {
      id: "agency",
      mode: "subscription",
      credits: 2500,
      amount: 149900,
      available: true,
      productId: process.env.POLAR_PRODUCT_AGENCY || "polar_prod_agency",
      name: "Tur Lideri & Grup Paketi",
    },
    {
      id: "pack-30",
      mode: "credit_pack",
      credits: 30,
      amount: 9900,
      available: true,
      productId: process.env.POLAR_PRODUCT_PACK_30 || "polar_prod_pack_30",
      name: "Başlangıç Paketi (30 Kredi)",
    },
    {
      id: "pack-100",
      mode: "credit_pack",
      credits: 100,
      amount: 24900,
      available: true,
      productId: process.env.POLAR_PRODUCT_PACK_100 || "polar_prod_pack_100",
      name: "Gezgin Paketi (100 Kredi)",
    },
    {
      id: "pack-300",
      mode: "credit_pack",
      credits: 300,
      amount: 59900,
      available: true,
      productId: process.env.POLAR_PRODUCT_PACK_300 || "polar_prod_pack_300",
      name: "Usta Kaşif Paketi (300 Kredi)",
    },
    {
      id: "pack-pro",
      mode: "credit_pack",
      credits: 3000,
      amount: 189900,
      available: true,
      productId: process.env.POLAR_PRODUCT_PACK_PRO || "polar_prod_pack_pro",
      name: "Stratejik Kaşif (3000 Kredi)",
    },
  ];

  return NextResponse.json({
    status: "ok",
    enabled: true,
    products,
    welcomeCredits: 100,
    costs: { route: 5, chat: 1, clarify: 0 },
  });
}

