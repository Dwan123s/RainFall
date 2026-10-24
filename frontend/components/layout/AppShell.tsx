'use client';

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ChiikawaAiChat } from '@/components/ai/ChiikawaAiChat';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [stationId, setStationId] = useState<string>('RS-ESP32S3-01');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar with mobile drawer support */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          selectedStation={stationId}
          onSelectStation={setStationId}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        />
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 lg:p-8 space-y-4 sm:space-y-6">
          {children}
        </main>
      </div>

      {/* Floating Chiikawa AI Assistant in bottom right */}
      <ChiikawaAiChat stationId={stationId} />
    </div>
  );
}
