export interface PostComment {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  text: string;
  createdAt: string;
}

export interface CommunityPost {
  id: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatar?: string;
  authorFollowersCount?: number;
  authorBio?: string;
  verified?: boolean;
  content: string;
  image?: string;
  tags: string[];
  hashtags?: string[];
  locationTag?: string;
  category?: string;
  linkedRoute?: {
    id?: string;
    title: string;
    stopCount: number;
    destination: string;
    stats?: string;
    stops?: any[];
  };
  likesCount: number;
  likedByMe: boolean;
  repostCount?: number;
  repostedByMe?: boolean;
  comments: PostComment[];
  viewsCount?: number;
  savesCount?: number;
  savedByMe?: boolean;
  createdAt: string;
}

export interface GroupTripAttendee {
  id: string;
  username: string;
  displayName?: string;
  note: string;
  status: "approved" | "pending" | "rejected";
  joinedAt: string;
  paid?: boolean;
}

export interface GroupTrip {
  id: string;
  organizerUsername: string;
  organizerName: string;
  organizerAvatar?: string;
  organizerRole?: string; // "Gezi Lideri" | "Lisanslı Rehber" | "Gezgin"
  title: string;
  destination: string;
  dates: string;
  capacity: number;
  meetingPoint: string;
  style: string;
  description: string;
  pricePerPerson?: number; // 0 = free, or price in TRY
  routeStops: {
    label: string;
    address: string;
    lat: number;
    lng: number;
    category?: string;
  }[];
  attendees: GroupTripAttendee[];
  createdAt: string;
}

export interface MarketRoute {
  id: string;
  sellerUsername: string;
  sellerName: string;
  sellerAvatar?: string;
  title: string;
  destination: string;
  category: string;
  description: string;
  coverImage?: string;
  stopCount: number;
  durationLabel: string;
  price: number;
  currency: "TRY" | "USD" | "EUR";
  rating: number;
  reviewCount: number;
  status: "active" | "sold" | "removed";
  salesCount: number;
  createdAt: string;
  stops?: {
    label: string;
    address: string;
    lat: number;
    lng: number;
    category?: string;
  }[];
}
