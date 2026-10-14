/**
 * @mapsbridge/contracts - Community & Marketplace Domain Models
 */

import { DomainValidationError } from "./exceptions";

export interface TravelGuideProps {
  id: string;
  authorId: string;
  authorUsername: string;
  title: string;
  description: string;
  destination: string;
  category: string;
  price: number;
  currency?: string;
  stopsCount: number;
  durationLabel: string;
  coverImageUrl?: string;
  likesCount?: number;
  salesCount?: number;
  rating?: number;
  reviewCount?: number;
  status?: "draft" | "published" | "archived" | "suspended";
  publishedAt?: number;
}

export class TravelGuideModel {
  public readonly id: string;
  public readonly authorId: string;
  public readonly authorUsername: string;
  public title: string;
  public description: string;
  public destination: string;
  public category: string;
  public price: number;
  public currency: string;
  public stopsCount: number;
  public durationLabel: string;
  public coverImageUrl?: string;
  public likesCount: number;
  public salesCount: number;
  public rating: number;
  public reviewCount: number;
  public status: "draft" | "published" | "archived" | "suspended";
  public publishedAt: number;

  constructor(props: TravelGuideProps) {
    if (!props.id || !props.id.trim()) {
      throw new DomainValidationError("Rehber ID boş olamaz.");
    }
    if (!props.title || props.title.trim().length < 3) {
      throw new DomainValidationError("Rehber başlığı en az 3 karakter olmalıdır.");
    }
    if (!props.destination || !props.destination.trim()) {
      throw new DomainValidationError("Destinasyon boş olamaz.");
    }
    if (props.price < 0) {
      throw new DomainValidationError("Rehber fiyatı negatif olamaz.");
    }

    this.id = props.id.trim();
    this.authorId = props.authorId.trim();
    this.authorUsername = props.authorUsername.trim();
    this.title = props.title.trim();
    this.description = (props.description || "").trim();
    this.destination = props.destination.trim();
    this.category = props.category || "Şehir Gezisi";
    this.price = props.price;
    this.currency = props.currency || "TRY";
    this.stopsCount = Math.max(1, props.stopsCount || 1);
    this.durationLabel = props.durationLabel || "1 Gün";
    this.coverImageUrl = props.coverImageUrl;
    this.likesCount = Math.max(0, props.likesCount || 0);
    this.salesCount = Math.max(0, props.salesCount || 0);
    this.rating = Math.min(5, Math.max(0, props.rating || 5));
    this.reviewCount = Math.max(0, props.reviewCount || 0);
    this.status = props.status || "published";
    this.publishedAt = props.publishedAt || Date.now();
  }

  public publish(): void {
    if (this.status === "suspended") {
      throw new DomainValidationError("Askıya alınmış rehber yayına açılamaz.");
    }
    this.status = "published";
  }

  public suspend(): void {
    this.status = "suspended";
  }

  public like(): void {
    this.likesCount += 1;
  }

  public unlike(): void {
    this.likesCount = Math.max(0, this.likesCount - 1);
  }

  public recordSale(): void {
    this.salesCount += 1;
  }
}

export interface TravelArticleProps {
  id: string;
  title: string;
  slug: string;
  content: string;
  author: string;
  authorSub?: string;
  category?: string;
  status?: "draft" | "published" | "archived";
  publishedAt?: number;
}

export class TravelArticleModel {
  public readonly id: string;
  public title: string;
  public slug: string;
  public content: string;
  public author: string;
  public authorSub?: string;
  public category: string;
  public status: "draft" | "published" | "archived";
  public publishedAt?: number;

  constructor(props: TravelArticleProps) {
    if (!props.id || !props.id.trim()) {
      throw new DomainValidationError("Makale ID boş olamaz.");
    }
    if (!props.title || props.title.trim().length < 3) {
      throw new DomainValidationError("Makale başlığı en az 3 karakter olmalıdır.");
    }
    if (!props.slug || !props.slug.trim()) {
      throw new DomainValidationError("Makale slug boş olamaz.");
    }

    this.id = props.id.trim();
    this.title = props.title.trim();
    this.slug = props.slug.trim();
    this.content = props.content || "";
    this.author = props.author.trim();
    this.authorSub = props.authorSub;
    this.category = props.category || "Seyahat";
    this.status = props.status || "draft";
    this.publishedAt = props.publishedAt;
  }

  public publish(): void {
    this.status = "published";
    this.publishedAt = this.publishedAt || Date.now();
  }
}
