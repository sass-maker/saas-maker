import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

export interface NewFeedbackEmailProps {
  projectName: string;
  feedbackTitle: string;
  feedbackType: string;
  feedbackDescription: string;
  submitterEmail: string;
  dashboardUrl: string;
}

export function NewFeedbackEmail({
  projectName,
  feedbackTitle,
  feedbackType,
  feedbackDescription,
  submitterEmail,
  dashboardUrl,
}: NewFeedbackEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        New {feedbackType} on {projectName}: {feedbackTitle}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>
            New {feedbackType} on {projectName}
          </Heading>
          <Text style={label}>Title</Text>
          <Text style={value}>{feedbackTitle}</Text>
          <Text style={label}>Description</Text>
          <Text style={value}>{feedbackDescription}</Text>
          <Hr style={hr} />
          <Text style={meta}>Submitted by {submitterEmail}</Text>
          <Section style={btnSection}>
            <Button href={dashboardUrl} style={btn}>
              View in Dashboard
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body: React.CSSProperties = {
  backgroundColor: '#f5f5f5',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const container: React.CSSProperties = {
  backgroundColor: '#ffffff',
  margin: '40px auto',
  padding: '32px',
  borderRadius: '8px',
  maxWidth: '600px',
};

const h1: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: '600',
  color: '#111',
  marginBottom: '24px',
};

const label: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: '600',
  color: '#666',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  margin: '0 0 4px',
};

const value: React.CSSProperties = {
  fontSize: '15px',
  color: '#222',
  margin: '0 0 20px',
};

const hr: React.CSSProperties = {
  borderColor: '#eee',
  margin: '24px 0',
};

const meta: React.CSSProperties = {
  fontSize: '13px',
  color: '#888',
};

const btnSection: React.CSSProperties = {
  marginTop: '24px',
};

const btn: React.CSSProperties = {
  display: 'inline-block',
  padding: '10px 20px',
  backgroundColor: '#1464ff',
  color: '#ffffff',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: '500',
  textDecoration: 'none',
};
