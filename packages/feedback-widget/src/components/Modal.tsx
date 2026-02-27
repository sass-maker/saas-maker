import React, { useCallback, useEffect, useRef } from 'react';
import type { FeedbackType } from '@saasmaker/shared-types';
import type { ApiClient } from '../api';
import { SubmitForm } from './SubmitForm';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  api: ApiClient;
  userEmail?: string;
  userName?: string;
  types: FeedbackType[];
  accentColor: string;
}

const CloseIcon: React.FC = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  api,
  userEmail,
  userName,
  types,
  accentColor,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  if (!isOpen) return null;

  return (
    <div className="smw-overlay" onClick={handleBackdropClick}>
      <div
        ref={modalRef}
        className="smw-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Feedback"
      >
        {/* Header */}
        <div className="smw-modal__header">
          <h2 className="smw-modal__title">Feedback</h2>
          <button
            type="button"
            className="smw-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div className="smw-modal__body">
          <SubmitForm
            api={api}
            userEmail={userEmail}
            userName={userName}
            types={types}
            accentColor={accentColor}
          />
        </div>
      </div>
    </div>
  );
};
