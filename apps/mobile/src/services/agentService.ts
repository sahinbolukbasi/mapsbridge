import { storage } from "./storage";

export interface TravelAgent {
  id: string;
  type: "visa" | "flight" | "emergency" | "events" | "accommodation" | "restaurant";
  title: string;
  description: string;
  icon: string;
  isActive: boolean;
  settings: Record<string, any>;
  reminders: AgentReminder[];
}

export interface AgentReminder {
  id: string;
  title: string;
  dueDate?: string;
  completed: boolean;
  priority: "low" | "medium" | "high";
}

export interface VisaInfo {
  country: string;
  visaType: string;
  applicationDate?: string;
  appointmentDate?: string;
  expiryDate?: string;
  status: "not_started" | "applied" | "approved" | "rejected";
  documents: string[];
  notes: string;
}

export interface FlightInfo {
  airline: string;
  flightNumber: string;
  departure: {
    airport: string;
    date: string;
    time: string;
  };
  arrival: {
    airport: string;
    date: string;
    time: string;
  };
  bookingReference: string;
  status: "confirmed" | "pending" | "cancelled";
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  type: "police" | "ambulance" | "hospital" | "embassy" | "general";
  address?: string;
  notes?: string;
}

export interface EventRecommendation {
  id: string;
  title: string;
  type: "cinema" | "theater" | "concert" | "exhibition" | "festival" | "sports";
  date: string;
  venue: string;
  price?: string;
  bookingUrl?: string;
  description: string;
  imageUrl?: string;
}

export interface LanguagePhrase {
  id: string;
  category: "emergency" | "transport" | "accommodation" | "restaurant" | "shopping" | "general";
  phrase: string;
  translation: string;
  pronunciation?: string;
}

// Default agents configuration
const DEFAULT_AGENTS: TravelAgent[] = [
  {
    id: "agent-visa",
    type: "visa",
    title: "🛂 Vize Takipçisi",
    description: "Vize başvurularınızı ve randevularınızı takip edin",
    icon: "🛂",
    isActive: true,
    settings: {},
    reminders: [],
  },
  {
    id: "agent-flight",
    type: "flight",
    title: "✈️ Uçuş Takipçisi",
    description: "Uçuş bilgilerinizi ve check-in hatırlatmalarını yönetin",
    icon: "✈️",
    isActive: true,
    settings: {},
    reminders: [],
  },
  {
    id: "agent-emergency",
    type: "emergency",
    title: "🚨 Acil Durum Asistanı",
    description: "Acil durum kontakları ve hastane bilgileri",
    icon: "🚨",
    isActive: true,
    settings: {},
    reminders: [],
  },
  {
    id: "agent-events",
    type: "events",
    title: "🎭 Etkinlik Keşifçisi",
    description: "Bulunduğunuz şehirdeki sinema, tiyatro, konser ve etkinlikler",
    icon: "🎭",
    isActive: true,
    settings: {},
    reminders: [],
  },
  {
    id: "agent-accommodation",
    type: "accommodation",
    title: "🏨 Konaklama Asistanı",
    description: "Otel rezervasyonlarınızı yönetin ve öneriler alın",
    icon: "🏨",
    isActive: true,
    settings: {},
    reminders: [],
  },
  {
    id: "agent-restaurant",
    type: "restaurant",
    title: "🍽️ Restoran Rehberi",
    description: "Yerel lezzetler ve restoran rezervasyonları",
    icon: "🍽️",
    isActive: true,
    settings: {},
    reminders: [],
  },
];

// Common English phrases for travelers
const COMMON_PHRASES: LanguagePhrase[] = [
  {
    id: "phrase-1",
    category: "emergency",
    phrase: "I need a doctor",
    translation: "Doktora ihtiyacım var",
    pronunciation: "ay niid a doktır",
  },
  {
    id: "phrase-2",
    category: "emergency",
    phrase: "Call the police",
    translation: "Polisi arayın",
    pronunciation: "kol dı poliis",
  },
  {
    id: "phrase-3",
    category: "emergency",
    phrase: "Where is the hospital?",
    translation: "Hastane nerede?",
    pronunciation: "wer iz dı hospitıl",
  },
  {
    id: "phrase-4",
    category: "emergency",
    phrase: "I need help",
    translation: "Yardıma ihtiyacım var",
    pronunciation: "ay niid help",
  },
  {
    id: "phrase-5",
    category: "emergency",
    phrase: "It is an emergency",
    translation: "Bu acil bir durum",
    pronunciation: "it iz anıimörcinsi",
  },
  {
    id: "phrase-6",
    category: "transport",
    phrase: "Where is the subway station?",
    translation: "Metro istasyonu nerede?",
    pronunciation: "wer iz dı sabvey steyşın",
  },
  {
    id: "phrase-7",
    category: "transport",
    phrase: "How much is the ticket?",
    translation: "Bilet ne kadar?",
    pronunciation: "hau maç iz dı tikit",
  },
  {
    id: "phrase-8",
    category: "transport",
    phrase: "I want to go to...",
    translation: "Gitmek istiyorum...",
    pronunciation: "ay want tı goo tı...",
  },
  {
    id: "phrase-9",
    category: "accommodation",
    phrase: "I have a reservation",
    translation: "Rezervasyonum var",
    pronunciation: "ay hav a rezöveyşın",
  },
  {
    id: "phrase-10",
    category: "restaurant",
    phrase: "A table for two, please",
    translation: "İki kişilik masa lütfen",
    pronunciation: "a teybıl foo tüu pliiz",
  },
  {
    id: "phrase-11",
    category: "general",
    phrase: "I do not speak English well",
    translation: "İngilizceyi iyi konuşamıyorum",
    pronunciation: "ay duu not spiiik ingliiş wel",
  },
  {
    id: "phrase-12",
    category: "general",
    phrase: "Can you speak slower?",
    translation: "Daha yavaş konuşabilir misiniz?",
    pronunciation: "kan yuu spiiik slowır",
  },
];

class AgentService {
  private agents: TravelAgent[] = [...DEFAULT_AGENTS];
  private visaInfo: Map<string, VisaInfo> = new Map();
  private flights: Map<string, FlightInfo> = new Map();
  private emergencyContacts: Map<string, EmergencyContact[]> = new Map();
  private eventRecommendations: EventRecommendation[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private async loadFromStorage() {
    try {
      const agentsData = await storage.getItem("mb_agents");
      if (agentsData) {
        this.agents = JSON.parse(agentsData);
      }

      const visaData = await storage.getItem("mb_visa_info");
      if (visaData) {
        this.visaInfo = new Map(Object.entries(JSON.parse(visaData)));
      }

      const flightsData = await storage.getItem("mb_flights");
      if (flightsData) {
        this.flights = new Map(Object.entries(JSON.parse(flightsData)));
      }

      const emergencyData = await storage.getItem("mb_emergency_contacts");
      if (emergencyData) {
        this.emergencyContacts = new Map(Object.entries(JSON.parse(emergencyData)));
      }
    } catch (e) {
      console.warn("Failed to load agent data:", e);
    }
  }

  private async saveToStorage() {
    try {
      await storage.setItem("mb_agents", JSON.stringify(this.agents));
      await storage.setItem("mb_visa_info", JSON.stringify(Object.fromEntries(this.visaInfo)));
      await storage.setItem("mb_flights", JSON.stringify(Object.fromEntries(this.flights)));
      await storage.setItem(
        "mb_emergency_contacts",
        JSON.stringify(Object.fromEntries(this.emergencyContacts)),
      );
    } catch (e) {
      console.warn("Failed to save agent data:", e);
    }
  }

  // Agent Management
  public getAgents(): TravelAgent[] {
    return [...this.agents];
  }

  public getActiveAgents(): TravelAgent[] {
    return this.agents.filter((a) => a.isActive);
  }

  public toggleAgent(agentId: string): boolean {
    const agent = this.agents.find((a) => a.id === agentId);
    if (agent) {
      agent.isActive = !agent.isActive;
      this.saveToStorage();
      return agent.isActive;
    }
    return false;
  }

  // Visa Management
  public addVisaInfo(destination: string, visaInfo: VisaInfo) {
    this.visaInfo.set(destination, visaInfo);
    this.saveToStorage();
  }

  public getVisaInfo(destination: string): VisaInfo | undefined {
    return this.visaInfo.get(destination);
  }

  public getAllVisaInfo(): { destination: string; info: VisaInfo }[] {
    return Array.from(this.visaInfo.entries()).map(([destination, info]) => ({
      destination,
      info,
    }));
  }

  // Flight Management
  public addFlight(flightId: string, flightInfo: FlightInfo) {
    this.flights.set(flightId, flightInfo);
    this.saveToStorage();
  }

  public getFlight(flightId: string): FlightInfo | undefined {
    return this.flights.get(flightId);
  }

  public getAllFlights(): { id: string; info: FlightInfo }[] {
    return Array.from(this.flights.entries()).map(([id, info]) => ({ id, info }));
  }

  // Emergency Contacts
  public setEmergencyContacts(destination: string, contacts: EmergencyContact[]) {
    this.emergencyContacts.set(destination, contacts);
    this.saveToStorage();
  }

  public getEmergencyContacts(destination: string): EmergencyContact[] {
    return this.emergencyContacts.get(destination) || this.getDefaultEmergencyContacts();
  }

  private getDefaultEmergencyContacts(): EmergencyContact[] {
    return [
      { id: "emergency-1", name: "Police", phone: "155", type: "police" },
      { id: "emergency-2", name: "Ambulance", phone: "112", type: "ambulance" },
      { id: "emergency-3", name: "Fire Department", phone: "110", type: "general" },
    ];
  }

  // Event Recommendations (mock data - would integrate with APIs)
  public async fetchEventRecommendations(
    city: string,
    date: string,
  ): Promise<EventRecommendation[]> {
    // This would integrate with event APIs like:
    // - Skyscanner for flights
    // - Google Events API
    // - Local event APIs
    // - Booking.com for accommodation
    return [
      {
        id: `event-${Date.now()}-1`,
        title: "Roma Antik Tiyatrosu",
        type: "theater",
        date,
        venue: "Teatro di Marcello",
        price: "25€",
        description: "Antik Roma tiyatrosunda canlı performans",
      },
      {
        id: `event-${Date.now()}-2`,
        title: "Vatikan Müzesi Özel Turu",
        type: "exhibition",
        date,
        venue: "Vatikan Müzeleri",
        price: "35€",
        description: "Sistina Şapeli özel erişim turu",
      },
    ];
  }

  // Language Phrases
  public getPhrasesByCategory(category: LanguagePhrase["category"]): LanguagePhrase[] {
    return COMMON_PHRASES.filter((p) => p.category === category);
  }

  public getAllPhrases(): LanguagePhrase[] {
    return [...COMMON_PHRASES];
  }

  // Reminders
  public addReminder(agentId: string, reminder: Omit<AgentReminder, "id">): AgentReminder {
    const agent = this.agents.find((a) => a.id === agentId);
    if (agent) {
      const newReminder: AgentReminder = {
        ...reminder,
        id: `reminder-${Date.now()}`,
      };
      agent.reminders.push(newReminder);
      this.saveToStorage();
      return newReminder;
    }
    throw new Error("Agent not found");
  }

  public completeReminder(agentId: string, reminderId: string) {
    const agent = this.agents.find((a) => a.id === agentId);
    if (agent) {
      const reminder = agent.reminders.find((r) => r.id === reminderId);
      if (reminder) {
        reminder.completed = true;
        this.saveToStorage();
      }
    }
  }

  // API Integration placeholders for external services
  public async searchFlights(from: string, to: string, date: string) {
    // Would integrate with:
    // - Skyscanner API
    // - Google Flights API
    // - Amadeus API
    return [];
  }

  public async searchHotels(city: string, checkIn: string, checkOut: string) {
    // Would integrate with:
    // - Booking.com API
    // - Hotels.com API
    // - Airbnb API
    return [];
  }

  public async searchRestaurants(city: string, cuisine?: string) {
    // Would integrate with:
    // - Google Places API
    // - Yelp API
    // - TripAdvisor API
    return [];
  }
}

export const agentService = new AgentService();
