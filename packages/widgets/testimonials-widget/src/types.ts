export interface TestimonialFormProps {
  projectId: string;
  apiBaseUrl?: string;
  theme?: 'light' | 'dark' | 'auto';
  accentColor?: string;
  placeholder?: string;
  buttonText?: string;
  showImageUpload?: boolean;
  showTweetUrl?: boolean;
}

export interface TestimonialWallProps {
  projectId: string;
  apiBaseUrl?: string;
  theme?: 'light' | 'dark' | 'auto';
  accentColor?: string;
  layout?: 'masonry' | 'grid' | 'list';
  maxItems?: number;
}
