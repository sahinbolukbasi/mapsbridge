/**
 * @mapsbridge/service-ai-assistant
 * Scoring Engine (Çok Boyutlu Mekan ve Restoran Puanlama Motoru)
 *
 * Turist tuzaklarını eleyen, yerel deneyimi öne çıkaran, kullanıcının diyeti
 * ve rotasıyla tam uyumlu mekanları seçen 10 parametreli puanlama sistemi.
 */

export interface RestaurantScoringFactors {
  userPreferenceMatch: number; // 0.0 - 1.0 (kullanıcının sevdiği mutfaklar)
  localExperienceScore: number; // 0.0 - 1.0 (turist tuzağı olmama / yerel halk oranı)
  dietCompatibility: number; // 0.0 - 1.0 (vegan, helal, vejetaryen uyumu)
  isOpenAtPlannedTime: boolean; // Açık mı?
  distanceFromRouteMeters: number; // Rota durağına olan kuşuçuşu mesafe
  travelRouteCompatibility: number; // 0.0 - 1.0 (aynı yönde olma)
  reviewQualityScore: number; // 0.0 - 1.0 (gerçek gezgin yorum derinliği)
  priceMatchesBudget: boolean; // Bütçeye uyuyor mu?
  normalizedRating: number; // 0.0 - 1.0 (örn: 4.8 / 5.0 = 0.96)
}

export interface PlaceScoringFactors {
  interestMatch: number; // 0.0 - 1.0
  localUniqueness: number; // 0.0 - 1.0
  tripScheduleCompatibility: number; // 0.0 - 1.0
  weatherCompatibility: number; // 0.0 - 1.0 (yağmurda kapalı mekanlara yüksek puan)
  distanceFromPreviousStopMeters: number;
  crowdLevelAvoidance: number; // 0.0 - 1.0 (yoğun saatlerden kaçınma)
}

export class RecommendationScoringEngine {
  /**
   * Calculates the 10-parameter composite score for a dining venue.
   */
  public static calculateRestaurantScore(factors: RestaurantScoringFactors): number {
    // Katı filtre: Diyet kısıtlamasına uymuyorsa doğrudan 0 puan
    if (factors.dietCompatibility <= 0) {
      return 0.0;
    }

    // Açık değilse ciddi ceza puanı (0.1 taban)
    const openNowScore = factors.isOpenAtPlannedTime ? 1.0 : 0.1;

    // Mesafeye göre normalize edilmiş puan (0-1000m: 1.0, 3000m+: 0.2)
    const distanceScore = Math.max(
      0.1,
      Math.min(1.0, 1.0 - factors.distanceFromRouteMeters / 3000),
    );
    const priceScore = factors.priceMatchesBudget ? 1.0 : 0.4;

    const weightedScore =
      factors.userPreferenceMatch * 0.25 +
      factors.localExperienceScore * 0.15 +
      factors.dietCompatibility * 0.15 +
      openNowScore * 0.1 +
      distanceScore * 0.1 +
      factors.travelRouteCompatibility * 0.1 +
      factors.reviewQualityScore * 0.05 +
      priceScore * 0.05 +
      factors.normalizedRating * 0.05;

    return Math.round(weightedScore * 100) / 100;
  }

  /**
   * Calculates the 6-parameter composite score for a sightseeing attraction.
   */
  public static calculatePlaceScore(factors: PlaceScoringFactors): number {
    // Mesafeye göre puanlama (0-1500m: 1.0, 5000m+: 0.2)
    const distanceScore = Math.max(
      0.1,
      Math.min(1.0, 1.0 - factors.distanceFromPreviousStopMeters / 5000),
    );

    const weightedScore =
      factors.interestMatch * 0.3 +
      factors.localUniqueness * 0.2 +
      factors.tripScheduleCompatibility * 0.15 +
      factors.weatherCompatibility * 0.15 +
      distanceScore * 0.1 +
      factors.crowdLevelAvoidance * 0.1;

    return Math.round(weightedScore * 100) / 100;
  }
}
