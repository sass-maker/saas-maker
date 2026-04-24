import React, { useMemo, useState } from 'react';
import type { FeedbackWidgetProps } from './types';
import { createApiClient } from './api';
import { TriggerButton } from './components/TriggerButton';
import { Modal } from './components/Modal';
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
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const api = useMemo(
    () => createApiClient(projectId, apiBaseUrl),
    [projectId, apiBaseUrl],
  );

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
        onClose={() => setIsOpen(false)}
        api={api}
        userEmail={userEmail}
        userName={userName}
        types={resolvedTypes}
        accentColor={accentColor}
      />
    </div>
  );
};
