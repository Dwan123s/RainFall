'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DemoScenarioId, DEMO_SCENARIOS, generateDemoTelemetry } from '@/lib/demo-scenarios';
import { api } from '@/lib/api';

interface DemoContextType {
  isDemoMode: boolean;
  demoScenario: DemoScenarioId;
  setDemoMode: (enable: boolean) => void;
  setDemoScenario: (scenario: DemoScenarioId) => void;
  toggleDemoMode: () => void;
}

const DemoContext = createContext<DemoContextType>({
  isDemoMode: false,
  demoScenario: 'low',
  setDemoMode: () => {},
  setDemoScenario: () => {},
  toggleDemoMode: () => {}
});

export function useDemo() {
  return useContext(DemoContext);
}

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [demoScenario, setDemoScenarioState] = useState<DemoScenarioId>('low');

  // Load saved preferences
  useEffect(() => {
    try {
      const savedMode = localStorage.getItem('rainsense-demo-mode') === 'true';
      const savedScenario = (localStorage.getItem('rainsense-demo-scenario') as DemoScenarioId) || 'low';
      setIsDemoMode(savedMode);
      if (DEMO_SCENARIOS[savedScenario]) {
        setDemoScenarioState(savedScenario);
      }
    } catch (e) {}
  }, []);

  const setDemoMode = useCallback(
    (enable: boolean) => {
      setIsDemoMode(enable);
      try {
        localStorage.setItem('rainsense-demo-mode', enable ? 'true' : 'false');
      } catch (e) {}

      if (!enable) {
        // Return to live hardware data
        queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
        queryClient.invalidateQueries({ queryKey: ['rainfall'] });
        queryClient.invalidateQueries({ queryKey: ['hourlyRain'] });
        queryClient.invalidateQueries({ queryKey: ['telemetrySeries'] });
        queryClient.invalidateQueries({ queryKey: ['demoMode'] });
        api.toggleDemoMode(false).catch(() => {});
      } else {
        api.toggleDemoMode(true).catch(() => {});
      }
    },
    [queryClient]
  );

  const toggleDemoMode = useCallback(() => {
    setDemoMode(!isDemoMode);
  }, [isDemoMode, setDemoMode]);

  const setDemoScenario = useCallback((scenario: DemoScenarioId) => {
    if (DEMO_SCENARIOS[scenario]) {
      setDemoScenarioState(scenario);
      try {
        localStorage.setItem('rainsense-demo-scenario', scenario);
      } catch (e) {}
    }
  }, []);

  // Periodic micro-fluctuation simulation loop
  useEffect(() => {
    if (!isDemoMode) return;

    let tick = 0;
    const applyTick = () => {
      const sim = generateDemoTelemetry(demoScenario, tick);
      queryClient.setQueryData(['dashboardSummary'], sim.dashboardSummary);
      queryClient.setQueryData(['rainfall', 'RS-ESP32S3-01'], sim.rainfall);
      queryClient.setQueryData(['demoMode'], { mode: 'DEMO', simulatorActive: true });
      tick++;
    };

    // Immediate initial push
    applyTick();

    // 2.5s fluctuation interval (gentle and smooth)
    const interval = setInterval(applyTick, 2500);

    return () => clearInterval(interval);
  }, [isDemoMode, demoScenario, queryClient]);

  return (
    <DemoContext.Provider
      value={{
        isDemoMode,
        demoScenario,
        setDemoMode,
        setDemoScenario,
        toggleDemoMode
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}
