export type {
  NormalizedPlace,
  PlaceCategory,
  PlaceSource,
  CityDiscoveryRequest,
  CityDiscoveryResult,
  TrainingDocument,
  PlacePhoto,
  WeeklyHours,
} from './domain/types';

export {
  discoverCity,
  discoverCityByCategory,
  filterByCategory,
  filterByRadius,
  placeSummaryForAgent,
} from './application/discovery-service';

export {
  deduplicatePlaces,
  rankPlaces,
  inferTiming,
  categoryFromOsmTags,
} from './application/normalizer';

export { generateCityGuide } from './application/training-generator';

export {
  storePlaces,
  storeDiscoveryMeta,
  storeTrainingDocuments,
  getPlacesForCity,
  getDiscoveryMeta,
  getTrainingDocuments,
} from './infrastructure/place-store';

export { collectFromOverpass } from './infrastructure/overpass-collector';
export { collectFromFoursquare } from './infrastructure/foursquare-collector';
export { collectFromGoogle } from './infrastructure/google-places-collector';
