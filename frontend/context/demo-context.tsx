'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DemoScenarioId, DEMO_SCENARIOS, getDemoEnvironment, DemoEnvironmentData } from '@/lib/demo-scenarios';
import { api } from '@/lib/api';

interface DemoContextType {
  isDemoMode: boolean;
  demoScenario: DemoScenarioId;
  demoEnvironment: DemoEnvironmentData;
  setDemoMode: (enable: boolean) => void;
  setDemoScenario: (scenario: DemoScenarioId) => void;
  toggleDemoMode: () => void;
}

const defaultEnv = getDemoEnvironment('low', 0);

const DemoContext = createContext<DemoContextType>({
  isDemoMode: false,
  demoScenario: 'low',
  demoEnvironment: defaultEnv,
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
  const [tick, setTick] = useState<number>(0);

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

      // Keep real hardware data fresh
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      queryClient.invalidateQueries({ queryKey: ['rainfall'] });
      queryClient.invalidateQueries({ queryKey: ['hourlyRain'] });
      queryClient.invalidateQueries({ queryKey: ['telemetrySeries'] });
      queryClient.invalidateQueries({ queryKey: ['demoMode'] });
      api.toggleDemoMode(enable).catch(() => {});
    },
    [queryClient]
  );

  const toggleDemoMode = useCallback(() => {
    setDemoMode(!isDemoMode);
  }, [isDemoMode, setDemoMode]);

  const setDemoScenario = useCallback((scenario: DemoScenarioId) => {
    if (DEMO_SCENARIOS[scenario]) {
      setDemoScenarioState(scenario);
      setTick(0);
      try {
        localStorage.setItem('rainsense-demo-scenario', scenario);
      } catch (e) {}
    }
  }, []);

  // Update loop: Exactly 10 seconds per cycle (matching Live Mode sensor rate)
  useEffect(() => {
    if (!isDemoMode) return;

    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 10000);

    return () => clearInterval(interval);
  }, [isDemoMode]);

  const demoEnvironment = useMemo(
    () => getDemoEnvironment(demoScenario, tick),
    [demoScenario, tick]
  );

  return (
    <DemoContext.Provider
      value={{
        isDemoMode,
        demoScenario,
        demoEnvironment,
        setDemoMode,
        setDemoScenario,
        toggleDemoMode
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}
