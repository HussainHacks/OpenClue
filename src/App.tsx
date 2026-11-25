import React, { useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { StatusBar } from './components/StatusBar';
import { useAppStore } from './store/useAppStore';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { LiveAssistantScreen } from './screens/LiveAssistantScreen';
import { SessionHistoryScreen } from './screens/SessionHistoryScreen';
import { TranscriptViewerScreen } from './screens/TranscriptViewerScreen';
import { AISettingsScreen } from './screens/AISettingsScreen';
import { AudioSettingsScreen } from './screens/AudioSettingsScreen';
import { ScreenSettingsScreen } from './screens/ScreenSettingsScreen';
import { ProviderSettingsScreen } from './screens/ProviderSettingsScreen';
import { PrivacySettingsScreen } from './screens/PrivacySettingsScreen';

export const App: React.FC = () => {
  const { ready, screen, init } = useAppStore();

  useEffect(() => {
    init();
  }, [init]);

  if (!ready) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[var(--bg-primary)] text-xs text-[var(--text-secondary)]">
        Starting OpenClue local engine...
      </div>
    );
  }

  const renderScreen = () => {
    switch (screen) {
      case 'onboarding':
        return <OnboardingScreen />;
      case 'dashboard':
        return <DashboardScreen />;
      case 'live':
        return <LiveAssistantScreen />;
      case 'history':
        return <SessionHistoryScreen />;
      case 'transcript':
        return <TranscriptViewerScreen />;
      case 'ai-settings':
        return <AISettingsScreen />;
      case 'audio-settings':
        return <AudioSettingsScreen />;
      case 'screen-settings':
        return <ScreenSettingsScreen />;
      case 'provider-settings':
        return <ProviderSettingsScreen />;
      case 'privacy-settings':
        return <PrivacySettingsScreen />;
      default:
        return <DashboardScreen />;
    }
  };

  return (
    <div className="h-screen w-screen flex bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <StatusBar />
        <main className="flex-1 overflow-y-auto">{renderScreen()}</main>
      </div>
    </div>
  );
};
