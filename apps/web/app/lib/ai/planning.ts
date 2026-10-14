import type { UnifiedRoutePlan, TripProfile, TripInterests } from './types';
import type { AnsweredSlot } from './trip-state';
import type { ThreadFocus } from './focus-manager';
export interface TripContext { destination?: string; days?: number; interests: string[]; constraints?: string[]; budget?: string; planningRequested?: boolean }
export interface ConversationState {
  version: number;
  context: TripContext;
  profile?: TripProfile;
  route?: UnifiedRoutePlan;
  discussedDestination?: string;
  messages: Array<{role:'user'|'assistant';content:string}>;
  /** Accumulated answered slots — prevents asking the same question twice (§2.1) */
  answeredSlots?: AnsweredSlot[];
  /** Active conversation focus (§12.1) */
  focus?: ThreadFocus;
  /** Turn counter — monotonically increasing, used for focus.sinceTurn */
  turn?: number;
}

export function calculateTripCompleteness(profile: Partial<TripProfile>): number {
  let score = 0;
  if (profile.destination && profile.destination.trim().length > 1) score += 0.35;
  if (profile.duration_days && profile.duration_days >= 1) score += 0.25;
  else if (profile.dates?.start && profile.dates?.end) score += 0.20;

  const interestsCount = (profile.interests?.food?.length || 0) +
    (profile.interests?.sports?.length || 0) +
    (profile.interests?.culture?.length || 0) +
    (profile.interests?.general?.length || 0);
  if (interestsCount >= 3) score += 0.15;
  else if (interestsCount > 0) score += 0.10;

  if (profile.budget?.level || (profile.budget?.total && profile.budget.total > 0) || profile.pace) {
    score += 0.10;
  }
  if ((profile.travelers?.adults && profile.travelers.adults > 0) || profile.needs?.flights || profile.needs?.local_transit || profile.lodging_type?.length) {
    score += 0.10;
  }
  if (profile.constraints && profile.constraints.length > 0) {
    score += 0.05;
  }
  return Math.min(1.0, Math.round(score * 100) / 100);
}

export function cleanTripProfile(value: any): TripProfile {
  const dest = typeof value?.destination === 'string' && value.destination.trim() ? value.destination.trim().slice(0, 120) : undefined;
  const duration = Number.isInteger(value?.duration_days) && value.duration_days >= 1 && value.duration_days <= 30 ? value.duration_days : (Number.isInteger(value?.days) && value.days >= 1 && value.days <= 30 ? value.days : undefined);

  const cleanList = (arr: any, maxLen = 60, maxItems = 6): string[] =>
    Array.isArray(arr) ? [...new Set<string>(arr.filter((v: any) => typeof v === 'string' && v.trim()).map((v: string) => v.trim().slice(0, maxLen)))].slice(0, maxItems) : [];

  const rawInterests = value?.interests;
  const isInterestsObj = rawInterests && typeof rawInterests === 'object' && !Array.isArray(rawInterests);
  const interests: TripInterests = {
    food: cleanList(isInterestsObj ? rawInterests.food : undefined),
    sports: cleanList(isInterestsObj ? rawInterests.sports : undefined),
    culture: cleanList(isInterestsObj ? rawInterests.culture : undefined),
    general: cleanList(isInterestsObj ? rawInterests.general : (Array.isArray(rawInterests) ? rawInterests : undefined)),
  };

  const constraints = cleanList(value?.constraints, 180, 8);
  const pace = ['relaxed', 'moderate', 'fast'].includes(value?.pace) ? value.pace : undefined;
  const validLodgings = ['hotel', 'hostel', 'apartment', 'boutique', 'resort'];
  const lodging_type = Array.isArray(value?.lodging_type)
    ? value.lodging_type.filter((t: any) => validLodgings.includes(t))
    : undefined;

  const profile: TripProfile = {
    ...(dest ? { destination: dest } : {}),
    ...(duration ? { duration_days: duration } : {}),
    ...(value?.dates && typeof value.dates === 'object' ? {
      dates: {
        ...(typeof value.dates.start === 'string' ? { start: value.dates.start.slice(0, 10) } : {}),
        ...(typeof value.dates.end === 'string' ? { end: value.dates.end.slice(0, 10) } : {}),
        flexible: value.dates.flexible === true,
      }
    } : {}),
    ...(value?.travelers && typeof value.travelers === 'object' ? {
      travelers: {
        ...(Number.isInteger(value.travelers.adults) && value.travelers.adults > 0 ? { adults: Math.min(20, value.travelers.adults) } : {}),
        ...(Number.isInteger(value.travelers.children) && value.travelers.children >= 0 ? { children: Math.min(20, value.travelers.children) } : {}),
        pets: value.travelers.pets === true,
      }
    } : {}),
    ...(value?.budget && typeof value.budget === 'object' ? {
      budget: {
        ...(typeof value.budget.currency === 'string' ? { currency: value.budget.currency.slice(0, 10) } : {}),
        ...(typeof value.budget.total === 'number' && value.budget.total >= 0 ? { total: value.budget.total } : {}),
        level: ['budget', 'mid', 'luxury', 'unspecified'].includes(value.budget.level) ? value.budget.level : 'unspecified',
      }
    } : (typeof value?.budget === 'string' ? { budget: { level: 'unspecified', currency: 'TRY' } } : {})),
    interests,
    ...(constraints.length ? { constraints } : {}),
    ...(pace ? { pace } : {}),
    ...(lodging_type && lodging_type.length ? { lodging_type } : {}),
    ...(value?.needs && typeof value.needs === 'object' ? {
      needs: {
        flights: value.needs.flights === true,
        car_rental: value.needs.car_rental === true,
        local_transit: value.needs.local_transit === true,
      }
    } : {}),
    completeness: 0,
  };

  profile.completeness = calculateTripCompleteness(profile);
  return profile;
}

export function contextToProfile(context: TripContext): TripProfile {
  const interests: TripInterests = { food: [], sports: [], culture: [], general: [] };
  for (const item of context.interests || []) {
    const norm = normalizeText(item);
    if (/kahve|yemek|mutfak|lezzet|restoran|gastronomi/u.test(norm)) interests.food!.push(item);
    else if (/kosu|yuruyus|spor|bisiklet|yuzme/u.test(norm)) interests.sports!.push(item);
    else if (/muze|sanat|tarih|kultur|mimari/u.test(norm)) interests.culture!.push(item);
    else interests.general!.push(item);
  }
  const profile: TripProfile = {
    ...(context.destination ? { destination: context.destination } : {}),
    ...(context.days ? { duration_days: context.days } : {}),
    interests,
    ...(context.constraints?.length ? { constraints: context.constraints } : {}),
    completeness: 0,
  };
  profile.completeness = calculateTripCompleteness(profile);
  return profile;
}

export function profileToContext(profile: TripProfile, planningRequested = false): TripContext {
  const allInterests = [
    ...(profile.interests.food || []),
    ...(profile.interests.sports || []),
    ...(profile.interests.culture || []),
    ...(profile.interests.general || []),
  ];
  return {
    ...(profile.destination ? { destination: profile.destination } : {}),
    ...(profile.duration_days ? { days: profile.duration_days } : {}),
    interests: [...new Set(allInterests)].slice(0, 8),
    ...(profile.constraints?.length ? { constraints: profile.constraints } : {}),
    ...(profile.budget?.level ? { budget: profile.budget.level } : {}),
    planningRequested: planningRequested || profile.completeness >= 0.7,
  };
}

export function mergeTripProfile(previous: TripProfile, updates: any, userText: string): TripProfile {
  const cleanUpdates = cleanTripProfile(updates);
  const mention = typeof updates?.destinationMention === 'string' ? updates.destinationMention.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '') : '';
  const explicit = mention.length > 1 && userText.toLocaleLowerCase('tr').includes(mention.toLocaleLowerCase('tr'));
  const daysMention = typeof updates?.daysMention === 'string' ? updates.daysMention.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '') : '';
  const explicitDays = daysMention.length > 0 && userText.toLocaleLowerCase('tr').includes(daysMention.toLocaleLowerCase('tr'));
  const parsedDays = explicitDays ? parseDays(daysMention) : undefined;

  // Detect negative preferences and constraints
  const detectedConstraints: string[] = [];
  if (/balık\s*yem(em|ez)|deniz\s*ürünü\s*yem(em|ez)|no_seafood/iu.test(userText)) detectedConstraints.push('deniz ürünü / balık yok');
  if (/kalabalık\s*sevmem|sakin\s*yerler|avoid_crowds/iu.test(userText)) detectedConstraints.push('kalabalıktan uzak');
  if (/alkol\s*kullanm(am|az)|alkolsüz/iu.test(userText)) detectedConstraints.push('alkolsüz');
  if (/yokuş\s*çıkamam|az\s*yürü/iu.test(userText)) detectedConstraints.push('düşük yürüme yükü');

  const allConstraints = [
    ...(previous.constraints || []),
    ...(cleanUpdates.constraints || []),
    ...detectedConstraints,
  ].filter(c => !/@|\+?\d[\d ()-]{8,}/u.test(c));

  const destination = explicit ? (cleanUpdates.destination || previous.destination) : previous.destination;
  const duration_days = parsedDays ?? (explicit && cleanUpdates.destination !== previous.destination ? undefined : (cleanUpdates.duration_days || previous.duration_days));

  const mergedInterests: TripInterests = {
    food: [...new Set([...(previous.interests.food || []), ...(cleanUpdates.interests.food || [])])].slice(0, 6),
    sports: [...new Set([...(previous.interests.sports || []), ...(cleanUpdates.interests.sports || [])])].slice(0, 6),
    culture: [...new Set([...(previous.interests.culture || []), ...(cleanUpdates.interests.culture || [])])].slice(0, 6),
    general: [...new Set([...(previous.interests.general || []), ...(cleanUpdates.interests.general || [])])].slice(0, 6),
  };

  const pace = cleanUpdates.pace || previous.pace;
  const travelers = cleanUpdates.travelers || previous.travelers;
  const budget = cleanUpdates.budget || previous.budget;
  const lodging_type = cleanUpdates.lodging_type || previous.lodging_type;
  const needs = cleanUpdates.needs || previous.needs;

  const merged: TripProfile = {
    ...(destination ? { destination } : {}),
    ...(duration_days ? { duration_days } : {}),
    interests: mergedInterests,
    ...(allConstraints.length ? { constraints: [...new Set(allConstraints)].slice(0, 8) } : {}),
    ...(pace ? { pace } : {}),
    ...(travelers ? { travelers } : {}),
    ...(budget ? { budget } : {}),
    ...(lodging_type ? { lodging_type } : {}),
    ...(needs ? { needs } : {}),
    completeness: 0,
  };
  merged.completeness = calculateTripCompleteness(merged);
  return merged;
}

export function generateConciergeQuestion(profile: TripProfile): { question: string; quickOptions: { label: string; prompt: string }[] } {
  if (!profile.destination) {
    return {
      question: 'Hangi şehre seyahat etmek istersin?',
      quickOptions: [
        { label: '🗽 New York', prompt: "New York'a gitmek istiyorum." },
        { label: '🗼 Paris', prompt: "Paris'e bir seyahat planlamak istiyorum." },
        { label: '🏛️ Roma', prompt: "Roma'ya gitmeyi düşünüyorum." },
        { label: '⛩️ Tokyo', prompt: "Tokyo için gezi planlamak istiyorum." },
      ]
    };
  }

  if (!profile.duration_days) {
    return {
      question: `${profile.destination} için kaç günlük bir seyahat düşünüyorsun?`,
      quickOptions: [
        { label: '⚡ Hafta sonu (2 gün)', prompt: `${profile.destination} için 2 günlük plan istiyorum.` },
        { label: '🗓️ 3 Gün', prompt: `${profile.destination} için 3 günlük bir rota yapalım.` },
        { label: '✨ 4 Gün', prompt: `${profile.destination} için 4 gün kalacağım.` },
        { label: '🌟 1 Hafta (7 gün)', prompt: `${profile.destination} için 7 günlük dolu dolu bir seyahat olsun.` },
      ]
    };
  }

  if (profile.duration_days && profile.duration_days > 7) {
    return {
      question: 'Tek rotada en fazla 7 gün planlayabiliyorum. Seyahatini kaç günlük bölümlere ayıralım?',
      quickOptions: [
        { label: '🗓️ 3 Günlük Bölüm', prompt: `${profile.destination} için ilk 3 günlük bölümü planlayalım.` },
        { label: '🗓️ 5 Günlük Bölüm', prompt: `${profile.destination} için 5 günlük bir rota yapalım.` },
        { label: '🌟 7 Günlük Tam Rota', prompt: `${profile.destination} için 7 günlük rota hazırlayalım.` },
      ]
    };
  }

  const interestCount = (profile.interests.food?.length || 0) + (profile.interests.sports?.length || 0) + (profile.interests.culture?.length || 0) + (profile.interests.general?.length || 0);
  if (interestCount === 0) {
    return {
      question: `${profile.destination} gezinde nelerden hoşlanırsın? Sana özel duraklar seçelim.`,
      quickOptions: [
        { label: '☕ Kahve & Yemek', prompt: 'Üçüncü dalga kahveciler, gurme lezzetler ve yerel tatlar.' },
        { label: '🏛️ Müze & Tarih', prompt: 'Müzeler, tarihi sokaklar ve kültürel simgeler.' },
        { label: '🛍️ Alışveriş & Pazar', prompt: 'Yerel pazarlar, butikler ve alışveriş sokakları.' },
        { label: '💎 Yerel & Keşif', prompt: 'Turistik kalabalıktan uzak, yerlilerin bildiği gizli mekanlar.' },
      ]
    };
  }

  // When completeness threshold is reached, skip optional slot-filling and go straight to plan-ready
  if (profile.completeness >= 0.70) {
    const dateHint2 = profile.dates?.start ? `${profile.dates.start} tarihli` : 'Tarihi henüz belirsiz';
    const lodgingHint2 = profile.lodging_type?.length ? ` · ${profile.lodging_type[0]} tercihi` : '';
    return {
      question: `${profile.destination} için ${profile.duration_days} günlük taslağımız hazır (${dateHint2}${lodgingHint2}). Rota planını oluşturayım mı?`,
      quickOptions: [
        { label: '🚀 Rotayı Hazırla', prompt: `${profile.destination} için gün gün seyahat rotamı oluştur.` },
        { label: '📅 Tarih Belirle', prompt: 'Seyahat tarihlerini de ekleyelim.' },
        { label: '🏨 Konaklama Ekle', prompt: 'Merkezi otel veya konaklama önerilerini de dahil et.' },
        { label: '✈️ Uçuş Ara', prompt: 'Uçuş seçenekleri ve fiyatları hakkında bilgi ver.' },
      ]
    };
  }

  const totalTravelers = (profile.travelers?.adults || 0) + (profile.travelers?.children || 0);
  if (!profile.travelers || totalTravelers === 0) {
    return {
      question: `${profile.destination} için kaç kişilik bir seyahat planlıyorsunuz?`,
      quickOptions: [
        { label: '🙋 Yalnız (1 kişi)', prompt: 'Yalnız gidiyorum, 1 kişilik plan.' },
        { label: '👫 İkimiz (2 kişi)', prompt: 'İkimiz gidiyoruz.' },
        { label: '👨‍👩‍👧 Aile (çocuk var)', prompt: 'Aile olarak gidiyoruz, küçük çocuğumuz var.' },
        { label: '👥 Grup (3+ kişi)', prompt: '3 ya da daha fazla kişilik bir grupuz.' },
      ]
    };
  }

  if (!profile.budget || profile.budget.level === 'unspecified') {
    const dest = profile.destination;
    return {
      question: `${dest} gezisi için bütçe aralığınız nasıl?`,
      quickOptions: [
        { label: '💰 Ekonomik', prompt: 'Bütçemiz kısıtlı, ekonomik seçenekler tercihimiz.' },
        { label: '⚖️ Orta Bütçe', prompt: 'Orta bütçeli, kalite-fiyat dengesine önem veriyoruz.' },
        { label: '✨ Rahat Bütçe', prompt: 'Bütçe konusunda esneğiz, konfor ve kalite önemli.' },
        { label: '💎 Lüks', prompt: 'En iyi deneyim için bütçe kısıtımız yok, lüks tercih ediyoruz.' },
      ]
    };
  }

  if (!profile.pace) {
    return {
      question: 'Gezinin temposu nasıl olsun? Günlük yürüyüş ve durak yoğunluğunu ayarlayabilirim.',
      quickOptions: [
        { label: '🍃 Sakin ve Rahat', prompt: 'Tempo sakin ve dinlendirici olsun, acelemiz yok.' },
        { label: '⚖️ Dengeli', prompt: 'Dengeli bir tempo olsun, hem gezelim hem dinlenelim.' },
        { label: '⚡ Dolu Dolu', prompt: 'Günde mümkün olduğunca çok yer görmek istiyorum.' },
      ]
    };
  }

  const dateHint = profile.dates?.start
    ? `${profile.dates.start} tarihli`
    : 'Tarihi henüz belirsiz';
  const lodgingHint = profile.lodging_type?.length
    ? ` · ${profile.lodging_type[0]} tercihi`
    : '';
  return {
    question: `${profile.destination} için ${profile.duration_days} günlük taslağımız hazır (${dateHint}${lodgingHint}). Rota planını oluşturayım mı?`,
    quickOptions: [
      { label: '🚀 Rotayı Oluştur', prompt: `${profile.destination} için gün gün seyahat rotamı oluştur.` },
      { label: '📅 Tarih Belirle', prompt: 'Seyahat tarihlerini de ekleyelim.' },
      { label: '🏨 Konaklama Ekle', prompt: 'Merkezi otel veya konaklama önerilerini de dahil et.' },
      { label: '✈️ Uçuş Ara', prompt: 'Uçuş seçenekleri ve fiyatları hakkında bilgi ver.' },
    ]
  };
}

export function cleanContext(value: any): TripContext {
  return {
    ...(typeof value?.destination === 'string' && value.destination.trim() ? {destination:value.destination.trim().slice(0,120)} : {}),
    ...(Number.isInteger(value?.days) && value.days>=1 && value.days<=30 ? {days:value.days} : {}),
    interests: Array.isArray(value?.interests) ? [...new Set<string>(value.interests.filter((v:any)=>typeof v==='string'&&v.trim()).map((v:string)=>v.trim().slice(0,60)))].slice(0,8) : [],
    ...(typeof value?.budget==='string' ? {budget:value.budget.slice(0,80)} : {}),
    ...(Array.isArray(value?.constraints) ? {constraints: value.constraints.filter((v:any)=>typeof v==='string'&&v.trim()).map((v:string)=>v.trim().slice(0,180)).slice(-8)} : {}),
    planningRequested: value?.planningRequested===true,
  };
}
export function mergeContext(previous: TripContext, decision: any, userText: string): TripContext {
  const next=cleanContext(decision.context);
  // A destination may only change when the model identifies a literal user mention.
  const mention=typeof decision.destinationMention==='string'?decision.destinationMention.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g,''):'';
  const explicit=mention.length>1 && userText.toLocaleLowerCase('tr').includes(mention.toLocaleLowerCase('tr'));
  const daysMention=typeof decision.daysMention==='string'?decision.daysMention.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g,''):'';
  const explicitDays=daysMention.length>0&&userText.toLocaleLowerCase('tr').includes(daysMention.toLocaleLowerCase('tr'));
  const parsedDays=explicitDays?parseDays(daysMention):undefined;
  const interests=next.interests.filter(i=>mentionsInterest(userText,i)||previous.interests.includes(i));
  const constraints=(next.constraints||[]).filter(c=>userText.toLocaleLowerCase('tr').includes(c.toLocaleLowerCase('tr'))||(previous.constraints||[]).includes(c)).filter(c=>!/@|\+?\d[\d ()-]{8,}/u.test(c));
  const changed=explicit && next.destination && next.destination!==previous.destination;
  return cleanContext({...previous,...next,destination:explicit?next.destination||previous.destination:previous.destination,
    days:parsedDays ?? (changed?undefined:previous.days),
    constraints:[...new Set([...(previous.constraints||[]),...constraints])].slice(-8),
    interests:interests.length?interests:previous.interests,
    budget:next.budget||previous.budget,
    planningRequested:next.planningRequested||previous.planningRequested,
  });
}
export function missingContext(context: TripContext) {
  const missing:string[]=[];
  if(!context.destination) {
    missing.push('Hangi şehre seyahat etmek istersin?');
  }
  if(context.destination && !context.days) missing.push('Bu seyahat için kaç gün ayırmak istiyorsun? 1–7 günlük bir rota hazırlayabilirim.');
  if(context.days && context.days > 7) missing.push('Tek rotada en fazla 7 gün planlayabiliyorum. Seyahatini kaç günlük bölümlere ayıralım?');
  return missing;
}

export function normalizeText(value: string) {
  return value.toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i');
}
export function parseDays(mention: string): number | undefined {
  const text=normalizeText(mention);
  // Ordinal day edits are not a change to total trip length.
  if (/gune|gunde|gunu|birinci|ikinci|ucuncu|dorduncu|besinci|altinci|yedinci|\d+\./u.test(text)) return undefined;
  if (/hafta sonu/u.test(text)) return 2;
  const number=text.match(/(?:^|\s)([1-9]|[12]\d|30)(?:\s|$)/u);
  if(number)return Number(number[1]);
  const words=['bir','iki','uc','dort','bes','alti','yedi','sekiz','dokuz','on'];
  const token=text.match(/^(bir|iki|uc|dort|bes|alti|yedi|sekiz|dokuz|on)(?:\s|$)/u)?.[1];
  return token?words.indexOf(token)+1:undefined;
}
function mentionsInterest(request: string, interest: string) {
  const text=normalizeText(request), value=normalizeText(interest);
  const aliases: Record<string,string[]> = {tarih:['tarih','muze','antik'],kultur:['kultur','sanat'],lezzet:['lezzet','yemek','mutfak','gastronomi'],doga:['doga','park','yuruyus'],kahve:['kahve','kafe'],muze:['muze']};
  return (aliases[value]||[value]).some(word=>text.includes(word));
}

