export type BookCategory = 'textbook' | 'novel' | 'reference' | 'other';
export type BookCondition = 'new' | 'like_new' | 'annotated' | 'worn';
export type BookStatus = 'available' | 'reserved' | 'sold' | 'removed';
export type UserRole = 'user' | 'admin';

export type User = {
  id: string;
  loginIdentifier: string;
  nickname: string;
  avatarUrl?: string;
  campus?: string;
  department?: string;
  college?: string;
  major?: string;
  role: UserRole;
};

export type BookImage = {
  id: string;
  url: string;
  sortOrder: number;
};

export type Book = {
  id: string;
  sellerId: string;
  title: string;
  author: string;
  isbn?: string;
  category: BookCategory;
  images: BookImage[];
  priceCents: number;
  quantity: number;
  condition: BookCondition;
  contact: string;
  contactType: 'wechat' | 'phone' | 'email' | 'other';
  description?: string;
  campus?: string;
  department?: string;
  college?: string;
  major?: string;
  status: BookStatus;
  buyerIds: string[];
  soldAt?: string;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type Interest = {
  id: string;
  bookId: string;
  buyerId: string;
  quantity: number;
  status: 'active' | 'cancelled' | 'chosen';
  createdAt: string;
};

export type Message = {
  id: string;
  bookId: string;
  fromUserId: string;
  content: string;
  createdAt: string;
};

export type Evaluation = {
  id: string;
  bookId: string;
  fromUserId: string;
  toUserId: string;
  fromRole: 'buyer' | 'seller';
  rating: number;
  comment?: string;
  tags: string[];
  createdAt: string;
};

export type Report = {
  id: string;
  targetType: 'book' | 'user';
  targetId: string;
  reporterId: string;
  reason: string;
  detail?: string;
  status: 'pending' | 'reviewing' | 'resolved' | 'rejected';
  createdAt: string;
};

export type CampusConfig = {
  campuses: Array<{
    name: string;
    departments: Array<{
      name: string;
      colleges: Array<{
        name: string;
        majors: string[];
      }>;
    }>;
  }>;
};

export type AppData = {
  users: User[];
  books: Book[];
  interests: Interest[];
  messages: Message[];
  evaluations: Evaluation[];
  reports: Report[];
};