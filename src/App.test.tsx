import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OpenClueLogo } from './components/Logo';
import { OnboardingScreen } from './screens/OnboardingScreen';

describe('OpenClue UI Components', () => {
  it('renders the OpenClue logo with accessible label', () => {
    render(<OpenClueLogo size={32} />);
    expect(screen.getByLabelText('OpenClue Logo')).toBeInTheDocument();
  });

  it('renders OnboardingScreen with privacy and audio highlights', () => {
    render(<OnboardingScreen />);
    expect(screen.getByText('Welcome to OpenClue')).toBeInTheDocument();
    expect(screen.getByText('Real-Time Audio & Whisper')).toBeInTheDocument();
    expect(screen.getByText('Screen-Sharing Privacy Mode')).toBeInTheDocument();
  });
});
