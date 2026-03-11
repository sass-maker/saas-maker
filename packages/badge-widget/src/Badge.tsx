import React from 'react';
import './styles/badge.css';

export type BadgeVariant = 'flat' | 'outlined' | 'small';
export type BadgeTheme = 'light' | 'dark' | 'auto';

export interface BadgeProps {
  variant?: BadgeVariant;
  theme?: BadgeTheme;
  href?: string;
}

const DIRECTORY_URL = 'https://sassmaker.com/made-with';

const Logo = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <rect width="16" height="16" rx="3.5" fill="url(#sm-badge-grad)" />
    <text x="8" y="11.5" textAnchor="middle" fill="white" fontSize="8" fontWeight="900" fontFamily="-apple-system,sans-serif">SM</text>
    <defs>
      <linearGradient id="sm-badge-grad" x1="0" y1="0" x2="16" y2="16">
        <stop stopColor="#3b82f6" />
        <stop offset="1" stopColor="#7c3aed" />
      </linearGradient>
    </defs>
  </svg>
);

export const SaasMakerBadge: React.FC<BadgeProps> = ({
  variant = 'flat',
  theme = 'auto',
  href = DIRECTORY_URL,
}) => {
  const themeClass =
    theme === 'light' ? 'smb--light' : theme === 'dark' ? 'smb--dark' : 'smb--auto';
  const variantClass = `smb--${variant}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-saasmaker-badge=""
      className={`smb ${themeClass} ${variantClass}`}
      aria-label="Built with SaasMaker"
    >
      <Logo />
      {variant !== 'small' && <span className="smb-text">Built with SaasMaker</span>}
    </a>
  );
};
