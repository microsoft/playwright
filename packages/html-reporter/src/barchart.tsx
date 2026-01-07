/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import './barchart.css';

const formatDuration = (ms: number): string => {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0)
    return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
};

export const GroupedBarChart = ({
  data,
  groups,
  series,
}: {
  data: number[][];
  groups: string[];
  series: string[];
}) => {
  const width = 800;

  // Calculate left margin based on longest group name
  const maxGroupNameLength = Math.max(...groups.map(g => g.length));
  const estimatedTextWidth = maxGroupNameLength * 10;
  const leftMargin = Math.min(width * 0.5, Math.max(50, estimatedTextWidth));

  const margin = { top: 20, right: 20, bottom: 40, left: leftMargin };
  const chartWidth = width - margin.left - margin.right;

  const maxValue = Math.max(...data.flat());

  let tickInterval: number;
  let formatTickLabel: (i: number) => string;

  if (maxValue < 60 * 1000) {
    tickInterval = 10 * 1000;
    formatTickLabel = i => `${i * 10}s`;
  } else if (maxValue < 5 * 60 * 1000) {
    tickInterval = 30 * 1000;
    formatTickLabel = i => {
      const seconds = i * 30;
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return secs === 0 ? `${mins}m` : `${mins}m${secs}s`;
    };
  } else if (maxValue < 30 * 60 * 1000) {
    tickInterval = 5 * 60 * 1000;
    formatTickLabel = i => `${i * 5}m`;
  } else {
    tickInterval = 10 * 60 * 1000;
    formatTickLabel = i => `${i * 10}m`;
  }

  const maxRounded = Math.ceil(maxValue / tickInterval) * tickInterval;
  const xScale = chartWidth / maxRounded;

  // Calculate the number of actual bars per group (non-zero values)
  const barsPerGroup = data.map(group => group.length);

  // Allocate space proportionally based on number of bars
  const barHeight = 20; // Fixed bar height
  const barSpacing = 4;
  const groupPadding = 20;

  // Calculate Y positions for each group based on their bar count
  const groupYPositions: number[] = [];
  let currentY = 0;
  for (let i = 0; i < groups.length; i++) {
    groupYPositions.push(currentY);
    const groupHeight = barsPerGroup[i] * barHeight + (barsPerGroup[i] - 1) * barSpacing + groupPadding;
    currentY += groupHeight;
  }

  const contentHeight = currentY;

  const xTicks = [];
  const numberOfTicks = Math.ceil(maxRounded / tickInterval);
  for (let i = 0; i <= numberOfTicks; i++) {
    xTicks.push({
      x: i * tickInterval * xScale,
      label: formatTickLabel(i)
    });
  }

  const height = contentHeight + margin.top + margin.bottom;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio='xMidYMid meet'
      style={{ width: '100%', height: 'auto' }}
      role='img'
    >
      <g transform={`translate(${margin.left}, ${margin.top})`} role='presentation'>
        {xTicks.map(({ x, label }, i) => (
          <g key={i} aria-hidden='true'>
            <line
              x1={x}
              y1={0}
              x2={x}
              y2={contentHeight}
              stroke='var(--color-border-muted)'
              strokeWidth='1'
            />
            <text
              x={x}
              y={contentHeight + 20}
              textAnchor='middle'
              dominantBaseline='middle'
              fontSize='12'
              fill='var(--color-fg-muted)'
            >
              {label}
            </text>
          </g>
        ))}

        {groups.map((group, groupIndex) => {
          const groupY = groupYPositions[groupIndex];
          let barIndex = 0;

          return (
            <g key={groupIndex} role='list' aria-label={group}>
              {series.map((seriesName, seriesIndex) => {
                const value = data[groupIndex][seriesIndex];
                if (value === undefined || Number.isNaN(value))
                  return null;

                const barWidth = value * xScale;
                const x = 0;
                const y = groupY + barIndex * (barHeight + barSpacing);
                barIndex++;

                const colors = ['var(--color-scale-blue-2)', 'var(--color-scale-blue-3)', 'var(--color-scale-blue-4)'];
                const color = colors[seriesIndex % colors.length];

                return (
                  <g
                    key={`${groupIndex}-${seriesIndex}`}
                    role='listitem'
                    aria-label={`${seriesName}: ${formatDuration(value)}`}
                  >
                    <rect
                      className='barchart-bar'
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      fill={color}
                      rx='2'
                      tabIndex={0}
                    >
                      <title>{`${seriesName}: ${formatDuration(value)}`}</title>
                    </rect>
                    <text
                      x={barWidth + 6}
                      y={y + barHeight / 2}
                      dominantBaseline='middle'
                      fontSize='12'
                      fill='var(--color-fg-muted)'
                      aria-hidden='true'
                    >
                      {formatDuration(value)}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}

        {groups.map((group, groupIndex) => {
          const groupY = groupYPositions[groupIndex];
          const actualBars = barsPerGroup[groupIndex];
          const groupHeight = actualBars * barHeight + (actualBars - 1) * barSpacing;
          const labelY = groupY + groupHeight / 2;

          return (
            <text
              key={groupIndex}
              x={-10}
              y={labelY}
              textAnchor='end'
              dominantBaseline='middle'
              fontSize='12'
              fill='var(--color-fg-muted)'
              aria-hidden='true'
            >
              {group}
            </text>
          );
        })}

        <line
          x1={0}
          y1={0}
          x2={0}
          y2={contentHeight}
          stroke='var(--color-fg-muted)'
          strokeWidth='1'
          aria-hidden='true'
        />

        <line
          x1={0}
          y1={contentHeight}
          x2={chartWidth}
          y2={contentHeight}
          stroke='var(--color-fg-muted)'
          strokeWidth='1'
          aria-hidden='true'
        />
      </g>
    </svg>
  );
};
