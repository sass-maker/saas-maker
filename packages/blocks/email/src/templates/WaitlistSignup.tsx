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

export interface WaitlistSignupEmailProps {
  projectName: string;
  signupEmail: string;
  signupName?: string;
  dashboardUrl: string;
}

export function WaitlistSignupEmail({
  projectName,
  signupEmail,
  signupName,
  dashboardUrl,
}: WaitlistSignupEmailProps) {
  const display = signupName ? `${signupName} (${signupEmail})` : signupEmail;

  return (
    <Html>
      <Head />
      <Preview>New waitlist signup for {projectName}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>New waitlist signup on {projectName}</Heading>
          <Text style={label}>Signed up</Text>
          <Text style={value}>{display}</Text>
          <Hr style={hr} />
          <Section style={btnSection}>
            <Button href={dashboardUrl} style={btn}>
              View Waitlist
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
