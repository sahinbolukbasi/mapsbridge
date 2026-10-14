export interface RouteEmbed {
  code: string;
  title: string;
  desc: string;
  duration: string;
  distance: string;
  difficulty: string;
  stopsCount: number;
  image: string;
}

export interface LocationPin {
  title: string;
  note: string;
  image: string;
}

export interface ChatMessage {
  id: string;
  senderName: string;
  senderRole?: string;
  senderAvatar?: string;
  time: string;
  text?: string;
  isOutgoing?: boolean;
  readStatus?: string;
  isSystemEvent?: boolean;
  routeEmbed?: RouteEmbed;
  locationPin?: LocationPin;
}

export interface ChatMember {
  name: string;
  role: string;
  initial: string;
  online: boolean;
  isOwner?: boolean;
  isUser?: boolean;
}

export interface ChatWaypoint {
  num: number;
  title: string;
  sub: string;
}

export interface RouteInfo {
  code: string;
  name: string;
  stats: string;
}

export interface ChatConversation {
  id: string;
  type: "group" | "direct";
  title: string;
  routeTag?: string;
  memberCount?: number;
  lastMessage: string;
  lastTime: string;
  unreadCount?: number;
  avatarIcon: string;
  avatarBg?: string;
  pinned?: boolean;
  pinnedText?: string;
  verified?: boolean;
  subtitle?: string;
  messages: ChatMessage[];
  coverImage?: string;
  routeInfo?: RouteInfo;
  members?: ChatMember[];
  waypoints?: ChatWaypoint[];
}

export interface TravelerContact {
  id: string;
  name: string;
  username: string;
  initial: string;
  role: string;
  isFriend: boolean;
  online: boolean;
  interests: string[];
  bio: string;
}

export interface GroupTopicRoute {
  code: string;
  name: string;
  stats: string;
  coverImage: string;
  waypoints: ChatWaypoint[];
}
