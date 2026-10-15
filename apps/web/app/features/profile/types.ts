export interface UserInterest {
  id: string;
  label: string;
  icon: string;
}

export type ProfileSidebarTab =
  "genel" | "guvenlik" | "bildirimler" | "entegrasyonlar" | "odeme" | "tehlike";

export type SidebarTab = ProfileSidebarTab;

export interface ProfileFormData {
  fullName: string;
  username: string;
  travelTitle: string;
  bio: string;
  location: string;
  languages: string[];
  selectedInterests: string[];
  showProBadge: boolean;
  instagram: string;
  youtubeOrBlog: string;
  emailPrivacy: "public" | "friends";
  coverPhoto: string;
  userAvatar: string;
}

export interface NotificationSettings {
  notifTravelReminders: boolean;
  notifEmailSummaries: boolean;
  notifCommunityTips: boolean;
}
