export type Credentials = { email: string; password: string };

export type ActionState = {
  error?: string;
  success?: string;
  credentials?: Credentials;
} | null;
