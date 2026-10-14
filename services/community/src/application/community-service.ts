import type { TravelGuide, TravelArticle } from "../domain/types.js";
import { TravelGuideModel } from "@mapsbridge/contracts";

export interface TravelBuddyCandidate {
  id: string;
  name: string;
  username: string;
  targetDestination: string;
  travelStyle: string;
  interests: string[];
}

export interface TravelBuddyMatchCriteria {
  targetDestination?: string;
  interests: string[];
  preferredStyle?: string;
}

export interface MatchedBuddyResult {
  candidate: TravelBuddyCandidate;
  score: number;
  reason: string;
}

export interface GuideFilterOptions {
  category?: string;
  destination?: string;
  maxPrice?: number;
  onlyFree?: boolean;
  sortBy?: "popularity" | "price_asc" | "price_desc" | "rating";
}

export class CommunityService {
  /**
   * Filters publicly visible published articles, excluding drafts.
   */
  public filterPublicArticles(articles: TravelArticle[]): TravelArticle[] {
    return articles.filter((a) => a.status === "published");
  }

  /**
   * Ranks guides based on social engagement.
   */
  public rankGuidesByPopularity(guides: TravelGuide[]): TravelGuide[] {
    return [...guides].sort((a, b) => b.likesCount - a.likesCount);
  }

  /**
   * Advanced guide search and filtering.
   */
  public filterGuides(guides: TravelGuide[], options: GuideFilterOptions): TravelGuide[] {
    let result = [...guides];

    if (options.category && options.category !== "all") {
      result = result.filter(
        (g) => (g as any).category?.toLowerCase() === options.category?.toLowerCase()
      );
    }

    if (options.destination) {
      const destQuery = options.destination.toLowerCase();
      result = result.filter(
        (g) =>
          g.city.toLowerCase().includes(destQuery) ||
          g.country.toLowerCase().includes(destQuery) ||
          g.title.toLowerCase().includes(destQuery)
      );
    }

    if (options.onlyFree) {
      result = result.filter((g) => ((g as any).price ?? 0) === 0);
    } else if (options.maxPrice !== undefined) {
      result = result.filter((g) => ((g as any).price ?? 0) <= options.maxPrice!);
    }

    if (options.sortBy === "popularity") {
      result.sort((a, b) => b.likesCount - a.likesCount);
    } else if (options.sortBy === "price_asc") {
      result.sort((a, b) => ((a as any).price ?? 0) - ((b as any).price ?? 0));
    } else if (options.sortBy === "price_desc") {
      result.sort((a, b) => ((b as any).price ?? 0) - ((a as any).price ?? 0));
    }

    return result;
  }

  /**
   * AI-based travel buddy compatibility scoring algorithm.
   * Compares destinations, shared interests, and travel pace.
   */
  public matchTravelBuddies(
    criteria: TravelBuddyMatchCriteria,
    candidates: TravelBuddyCandidate[]
  ): MatchedBuddyResult[] {
    const results: MatchedBuddyResult[] = [];

    for (const candidate of candidates) {
      let score = 50; // Taban puan
      const matchedInterests: string[] = [];

      // Destinasyon eşleşmesi (+30 puan)
      if (
        criteria.targetDestination &&
        candidate.targetDestination
          .toLowerCase()
          .includes(criteria.targetDestination.toLowerCase())
      ) {
        score += 30;
      }

      // İlgi alanı kesişimi (Her ortak ilgi +10 puan, max +30)
      for (const interest of criteria.interests) {
        const found = candidate.interests.some(
          (candInt) => candInt.toLowerCase() === interest.toLowerCase()
        );
        if (found) {
          matchedInterests.push(interest);
          score += 10;
        }
      }

      // Seyahat stili uyumu (+10 puan)
      if (
        criteria.preferredStyle &&
        candidate.travelStyle.toLowerCase() === criteria.preferredStyle.toLowerCase()
      ) {
        score += 10;
      }

      // Skor 98 ile sınırlandırılır
      const finalScore = Math.min(98, score);
      const reason =
        matchedInterests.length > 0
          ? `${matchedInterests.join(", ")} ortak ilgi alanları ve ${candidate.targetDestination} planı`
          : `${candidate.targetDestination} için benzer gezi vizyonu`;

      results.push({
        candidate,
        score: finalScore,
        reason,
      });
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Validates and creates a new TravelGuide domain model.
   */
  public createGuide(props: {
    id: string;
    authorId: string;
    authorUsername: string;
    title: string;
    description: string;
    destination: string;
    category: string;
    price: number;
    stopsCount: number;
    durationLabel: string;
  }): TravelGuideModel {
    return new TravelGuideModel(props);
  }
}
