export interface TravelGuide {
  id: string;
  authorId: string;
  authorUsername: string;
  title: string;
  description: string;
  city: string;
  country: string;
  coverImageUrl?: string;
  stopsCount: number;
  likesCount: number;
  publishedAt: number;
}

export interface TravelArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  author: string;
  status: "draft" | "published" | "archived";
  publishedAt?: number;
}
