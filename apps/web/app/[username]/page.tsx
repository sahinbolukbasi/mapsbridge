import { publicMetadata } from "../lib/site-metadata";
import React from "react";
import PublicProfileClient from "./public-profile-client";

export function generateStaticParams() {
  return [
    { username: "gezgin" },
    { username: "traveler" },
    { username: "demo" },
    { username: "kasif" },
  ];
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const resolvedParams = await params;
  return <PublicProfileClient initialUsername={resolvedParams.username} />;
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return publicMetadata(
    `@${username} — Gezgin profili`,
    `@${username} tarafından paylaşılan seyahat rotalarını ve ziyaret edilen yerleri keşfet.`,
    `/${encodeURIComponent(username)}/`,
    "tr",
  );
}
