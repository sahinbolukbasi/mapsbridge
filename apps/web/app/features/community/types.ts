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
  /** Gönderi yalnız bu cihazda (sunucu senkronu yok); kartta rozet. */
  deviceOnly?: boolean;
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
    stops?: unknown[];
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
