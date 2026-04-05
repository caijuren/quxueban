export interface User {
  id: number;
  name: string;
  role: 'parent' | 'child';
  familyId: number;
  familyName?: string;
  familyCode?: string;
  avatar?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface ChildLoginCredentials {
  familyCode: string;
  childName: string;
  pin: string;
}

export interface RegisterData {
  username: string;
  password: string;
  role?: 'parent' | 'child';
}

export interface AuthResponse {
  status: string;
  message: string;
  data: {
    token: string;
    user: User;
  };
}

export interface Child {
  id: number;
  name: string;
  avatar: string;
  pin: string;
}

export interface Family {
  id: number;
  name: string;
  code: string;
  children: Child[];
}
