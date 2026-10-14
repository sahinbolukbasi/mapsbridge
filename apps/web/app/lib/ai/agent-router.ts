import type { TripProfile } from './types';

export type SubAgentType =
  | 'food'
  | 'sports'
  | 'lodging'
  | 'flights'
  | 'car_rental'
  | 'city_transit'
  | 'city_intel'
  | 'emergency';

export interface AgentRouteDecision {
  activeAgents: SubAgentType[];
  skippedAgents: Partial<Record<SubAgentType, string>>;
}

export function routeSubAgents(prompt: string, profile?: Partial<TripProfile>): AgentRouteDecision {
  const normPrompt = (prompt || '').toLocaleLowerCase('tr');
  const active: SubAgentType[] = [];
  const skipped: Partial<Record<SubAgentType, string>> = {};

  // 1. Food Agent
  const hasFoodInterest = (profile?.interests?.food?.length || 0) > 0;
  const mentionsFood = /yemek|kahve|kafe|restoran|mutfak|lezzet|gurme|pizza|burger|tatlı/iu.test(normPrompt);
  if (hasFoodInterest || mentionsFood) {
    active.push('food');
  } else {
    skipped['food'] = 'Kullanıcı açıkça yemek veya kafe ilgi alanı belirtmedi.';
  }

  // 2. Sports Agent
  const hasSportsInterest = (profile?.interests?.sports?.length || 0) > 0;
  const mentionsSports = /spor|koşu|yürüyüş|parkur|bisiklet|yüzme|kürek|saha/iu.test(normPrompt);
  if (hasSportsInterest || mentionsSports) {
    active.push('sports');
  } else {
    skipped['sports'] = 'Spor veya açık hava aktivitesi talep edilmedi.';
  }

  // 3. Lodging Agent
  const hasLodgingNeed = (profile?.lodging_type?.length || 0) > 0;
  const mentionsLodging = /otel|konakla|pansiyon|hostel|nerede kal|apart/iu.test(normPrompt);
  if (hasLodgingNeed || mentionsLodging) {
    active.push('lodging');
  } else {
    skipped['lodging'] = 'Konaklama veya otel tavsiyesi talep edilmedi.';
  }

  // 4. Flight Agent
  const hasFlightNeed = profile?.needs?.flights === true;
  const mentionsFlight = /uçak|uçuş|havalimanı|havaalanı|aktarma|bagaj|terminal/iu.test(normPrompt);
  if (hasFlightNeed || mentionsFlight) {
    active.push('flights');
  } else {
    skipped['flights'] = 'Uçuş ve havalimanı ihtiyacı işaretlenmedi.';
  }

  // 5. Car Rental Agent
  const hasCarNeed = profile?.needs?.car_rental === true;
  const mentionsCar = /araç|araba|kiralık|otopark|sürüş|otoban|geçiş ücret/iu.test(normPrompt);
  if (hasCarNeed || mentionsCar) {
    active.push('car_rental');
  } else {
    skipped['car_rental'] = 'Araç kiralama ihtiyacı işaretlenmedi.';
  }

  // 6. City Transit Agent
  const hasTransitNeed = profile?.needs?.local_transit === true;
  const mentionsTransit = /metro|otobüs|toplu taşıma|bilet|kart|omny|oyster|ulaşım/iu.test(normPrompt);
  if (hasTransitNeed || mentionsTransit) {
    active.push('city_transit');
  } else {
    skipped['city_transit'] = 'Şehir içi toplu taşıma ihtiyacı işaretlenmedi.';
  }

  // 7. City Intel Agent
  const mentionsIntel = /hava|kültür|etkinlik|mevsim|giyim|bahşiş|görgü/iu.test(normPrompt);
  if (mentionsIntel || normPrompt.length > 50) {
    active.push('city_intel');
  } else {
    skipped['city_intel'] = 'Şehir istihbaratı ve kültürel notlar talep edilmedi.';
  }

  // 8. Emergency Agent: always triggered if emergency or risk keywords present
  if (/acil|yardım|hastane|polis|doktor|güvenlik|kayıp|pasaport|tehlike/iu.test(normPrompt)) {
    active.push('emergency');
  }

  return {
    activeAgents: active,
    skippedAgents: skipped,
  };
}
