import type { UserInterest } from "./types";

export const DEFAULT_COVER_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDxagc5kQ40QIhIlHdDrgyQ8uiiCEp1SCCKwdASMkeSe1UZ4tj5c3P4d8M1lEiwpPOSyiWnLWZXhp4VRvAoJZ18inSAosdCmA339TKdI5A7xdBhtxjIO_fpNh23u_lxHA9-flakF9jXzqsXyaVxSy2ZnB-CV4-t0yOPPxhfg4TekGjO2nvoWnnYBdGh58MxPY289A8V4N5LbkHrEKs7gnQCArG7VrNQGWCPoNB8KRJpJleI3OQ0S2Fvbw";

export const DEFAULT_AVATAR_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAVp_CdvDnsqh3-SDQ6r12kiLejup-QvVHQ_q3d7ow-4Wh3vGcG8LCUpyjpQU_vKyTXeMuL8l3xWBsn1p7gkdZgc5010OLvWqIX7U2v3DOPcBw8fezyodQppBKvpi1OzeQXJKAI3l3jpGsn-PDjxi-ZQtumMM20Iu5ZX_64EQpQJgWmqin440uauv8PuUdGSlzs7fR5bi9CiQdzsAIA88_NhOsd6ioQlGfVfzHzhfBgdBvwaONQ5hY-UQ";

export const AVAILABLE_INTERESTS: UserInterest[] = [
  { id: "tarih", label: "Tarih & Arkeoloji", icon: "account_balance" },
  { id: "hiking", label: "Doğa Yürüyüşü", icon: "hiking" },
  { id: "gastro", label: "Gastronomi", icon: "restaurant" },
  { id: "foto", label: "Fotoğrafçılık", icon: "photo_camera" },
  { id: "kamp", label: "Kampçılık", icon: "camping" },
  { id: "solo", label: "Solo Seyahat", icon: "person_pin_circle" },
  { id: "deniz", label: "Deniz & Adalar", icon: "sailing" },
  { id: "dag", label: "Yüksek İrtifa Dağcılık", icon: "landscape" },
  { id: "kultur", label: "Müze & Sanat", icon: "palette" },
  { id: "bisiklet", label: "Bisiklet Rotaları", icon: "directions_bike" },
  { id: "karavan", label: "Karavan & Roadtrip", icon: "rv_hookup" },
  { id: "kahve", label: "Kahve & Kafe Keşfi", icon: "local_cafe" },
];
