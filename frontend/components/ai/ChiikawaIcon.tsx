import React from 'react';
import { RainSenseIcon } from './RainSenseIcon';

export interface ChiikawaIconProps {
  className?: string;
  size?: number | string;
  expression?: 'happy' | 'thinking' | 'excited' | 'sleepy';
  withBadge?: boolean;
}

export function ChiikawaIcon({
  className = '',
  size = 48,
  expression = 'happy',
  withBadge = false
}: ChiikawaIconProps) {
  const mappedExpression = expression === 'sleepy' ? 'thinking' : expression;
  return (
    <RainSenseIcon
      className={className}
      size={size}
      expression={mappedExpression}
      withBadge={withBadge}
    />
  );
}
