export interface User {
  id: string;
  name: string;
  email: string;
  date_of_birth: string | null;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  date_of_birth?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}
