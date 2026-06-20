import React, { useCallback, useMemo, useState } from 'react';
import type { FeedbackWidgetProps } from './types';
import type { ElementAnchor } from './elementAnchor';
import { createApiClient } from './api';
import { TriggerButton } from './components/TriggerButton';
import { Modal } from './components/Modal';
import { ElementPicker } from './components/ElementPicker';
import './styles/widget.css';

const DEFAULT_TYPES = ['bug', 'feature', 'feedback'] as const;
const DEFAULT_ACCENT = '#1464ff';
const DEFAULT_TRIGGER_TEXT = 'Feedback';

export const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({
  projectId,
  apiBaseUrl,
  userEmail,
  userName,
  types,
  position = 'bottom-right',
  theme = 'auto',
  accentColor = DEFAULT_ACCENT,
  triggerText = DEFAULT_TRIGGER_TEXT,
  enablePointing = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  // Picking overlays the page; we keep the modal mounted (hidden) so the user's
  // in-progress title/description survive the round-trip and the captured anchor
  // lands back in the same form.
  const [picking, setPicking] = useState(false);
  const [anchor, setAnchor] = useState<ElementAnchor | null>(null);

  const api = useMemo(
    () => createApiClient(projectId, apiBaseUrl),
    [projectId, apiBaseUrl],
  );

  const startPick = useCallback(() => setPicking(true), []);
  const handlePick = useCallback((a: ElementAnchor) => {
    setAnchor(a);
    setPicking(false);
  }, []);
  const cancelPick = useCallback(() => setPicking(false), []);
  const clearAnchor = useCallback(() => setAnchor(null), []);

  const resolvedTypes = types && types.length > 0 ? types : [...DEFAULT_TYPES];

  const themeClass =
    theme === 'light'
      ? 'smw--light'
      : theme === 'dark'
        ? 'smw--dark'
        : 'smw--auto';

  return (
    <div
      data-saasmaker-widget=""
      className={`smw-root ${themeClass}`}
      style={{ '--smw-accent': accentColor } as React.CSSProperties}
    >
      <TriggerButton
        onClick={() => setIsOpen(true)}
        position={position}
        accentColor={accentColor}
        triggerText={triggerText}
      />
      <Modal
        isOpen={isOpen}
        hidden={picking}
        onClose={() => setIsOpen(false)}
        api={api}
        userEmail={userEmail}
        userName={userName}
        types={resolvedTypes}
        accentColor={accentColor}
        enablePointing={enablePointing}
        anchor={anchor}
        onStartPick={startPick}
        onClearAnchor={clearAnchor}
      />
      {enablePointing && (
        <ElementPicker active={picking} onPick={handlePick} onCancel={cancelPick} />
      )}
    </div>
  );
};
