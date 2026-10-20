'use client';

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ChiikawaAiChat } from '@/components/ai/ChiikawaAiChat';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [stationId, setStationId] = useState<string>('RS-ESP32S3-01');

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header selectedStation={stationId} onSelectStation={setStationId} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6">
          {children}
        </main>
      </div>
      {/* Floating Chiikawa AI Assistant in bottom right */}
      <ChiikawaAiChat stationId={stationId} />
    </div>
  );
}
