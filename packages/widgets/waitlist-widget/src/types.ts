export interface WaitlistFormProps {
  projectId: string;
  apiBaseUrl?: string;
  theme?: 'light' | 'dark' | 'auto';
  accentColor?: string;
  showCount?: boolean;
  onSuccess?: (position: number) => void;
  placeholder?: string;
  buttonText?: string;
}
