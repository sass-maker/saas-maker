import type React from 'react';
import { useCallback, useEffect, useRef } from 'react';
import type { ElementAnchor } from '../elementAnchor';
import type { FeedbackSubmission, FeedbackType } from '../types';
import { SubmitForm } from './SubmitForm';

interface ModalProps {
  isOpen: boolean;
  /** Kept mounted but visually hidden (e.g. during element picking) so form state survives. */
  hidden?: boolean;
  onClose: () => void;
  onSubmit: (feedback: FeedbackSubmission) => void | Promise<void>;
  userEmail?: string;
  userName?: string;
  requireEmail?: boolean;
  types: FeedbackType[];
  accentColor: string;
  enablePointing?: boolean;
  anchor?: ElementAnchor | null;
  onStartPick?: () => void;
  onClearAnchor?: () => void;
  pageContext?: { url: string; title: string };
  requireConsent?: boolean;
  privacyUrl?: string;
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
  hidden = false,
  onClose,
  onSubmit,
  userEmail,
  userName,
  requireEmail,
  types,
  accentColor,
  enablePointing,
  anchor,
  onStartPick,
  onClearAnchor,
  pageContext,
  requireConsent,
  privacyUrl,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => returnFocusRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    // Don't trap focus or close on Esc while picking — there Esc cancels the pick.
    if (!isOpen || hidden) return;

    const frame = window.requestAnimationFrame(() => {
      const initialFocus =
        modalRef.current?.querySelector<HTMLElement>('.smw-input:not(:disabled), .smw-textarea') ??
        modalRef.current?.querySelector<HTMLElement>('.smw-type-btn, button:not(:disabled)');
      initialFocus?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !modalRef.current) return;
      const focusable = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => element.getClientRects().length > 0);
      if (focusable.length === 0) {
        event.preventDefault();
        modalRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first || !modalRef.current.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !modalRef.current.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, hidden, onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      className="smw-overlay"
      onClick={handleBackdropClick}
      style={hidden ? { display: 'none' } : undefined}
    >
      <div
        ref={modalRef}
        className="smw-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="smw-dialog-title"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="smw-modal__header">
          <div className="smw-modal__heading">
            <span className="smw-modal__eyebrow">Direct line</span>
            <h2 id="smw-dialog-title" className="smw-modal__title">
              Feedback
            </h2>
            <p className="smw-modal__intro">Share what happened on this page.</p>
          </div>
          <button type="button" className="smw-modal__close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div className="smw-modal__body">
          <SubmitForm
            onSubmit={onSubmit}
            userEmail={userEmail}
            userName={userName}
            requireEmail={requireEmail}
            types={types}
            accentColor={accentColor}
            enablePointing={enablePointing}
            anchor={anchor}
            onStartPick={onStartPick}
            onClearAnchor={onClearAnchor}
            pageContext={pageContext}
            requireConsent={requireConsent}
            privacyUrl={privacyUrl}
          />
        </div>
      </div>
    </div>
  );
};
