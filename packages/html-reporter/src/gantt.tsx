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

import './gantt.css';

export const formatDuration = (ms: number): string => {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0)
    return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
};

export type GanttEntry = {
  label: string;
  tooltip: string;
  startTime: number;
  duration: number;
};

export const GanttChart = ({
  entries,
}: {
  entries: GanttEntry[];
}) => {
  const width = 800;

  const maxLabelLength = Math.max(...entries.map(e => e.label.length));
  const estimatedTextWidth = maxLabelLength * 10;
  const leftMargin = Math.min(width * 0.5, Math.max(50, estimatedTextWidth));

  const margin = { top: 20, right: 20, bottom: 40, left: leftMargin };
  const chartWidth = width - margin.left - margin.right;

  const minStartTime = Math.min(...entries.map(e => e.startTime));
  const maxEndTime = Math.max(...entries.map(e => e.startTime + e.duration));

  let tickInterval: number;
  let showSeconds: boolean;
  const duration = maxEndTime - minStartTime;
  if (duration < 60 * 1000) {
    tickInterval = 10 * 1000;
    showSeconds = true;
  } else if (duration < 5 * 60 * 1000) {
    tickInterval = 30 * 1000;
    showSeconds = true;
  } else if (duration < 30 * 60 * 1000) {
    tickInterval = 5 * 60 * 1000;
    showSeconds = false;
  } else {
    tickInterval = 10 * 60 * 1000;
    showSeconds = false;
  }

  // quantize ticks for clean labels
  const firstTick = Math.ceil(minStartTime / tickInterval) * tickInterval;

  const formatTickLabel = (absoluteTime: number, isFirst: boolean) => {
    const label = new Date(absoluteTime).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: showSeconds ? '2-digit' : undefined
    });
    if (isFirst)
      return label;
    // there's no good way of omitting AM/PM other than manually stripping it, "dayPeriod" doesn't work
    if (label.endsWith(' AM') || label.endsWith(' PM'))
      return label.slice(0, -3);
  };

  const maxValue = maxEndTime - minStartTime;
  const maxPadded = maxValue * 1.1;
  const maxRounded = Math.ceil(maxPadded / tickInterval) * tickInterval;
  const xScale = chartWidth / maxRounded;

  const barHeight = 20;
  const barSpacing = 8;

  const contentHeight = entries.length * (barHeight + barSpacing);

  const xTicks = [];
  for (let tickTime = firstTick; tickTime <= minStartTime + maxRounded; tickTime += tickInterval) {
    const tickOffset = tickTime - minStartTime;
    xTicks.push({
      x: tickOffset * xScale,
      label: formatTickLabel(tickTime, tickTime === firstTick)
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

        {entries.map((entry, index) => {
          const offsetFromStart = entry.startTime - minStartTime;
          const barWidth = entry.duration * xScale;
          const x = offsetFromStart * xScale;
          const y = index * (barHeight + barSpacing);

          const colors = ['var(--color-scale-blue-2)', 'var(--color-scale-blue-3)', 'var(--color-scale-blue-4)'];
          const color = colors[index % colors.length];

          return (
            <g
              key={index}
              role='listitem'
              aria-label={entry.tooltip}
            >
              <rect
                className='gantt-bar'
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={color}
                rx='2'
                tabIndex={0}
              >
                <title>{entry.tooltip}</title>
              </rect>
              <text
                x={x + barWidth + 6}
                y={y + barHeight / 2}
                dominantBaseline='middle'
                fontSize='12'
                fill='var(--color-fg-muted)'
                aria-hidden='true'
              >
                {formatDuration(entry.duration)}
              </text>
              <text
                x={-10}
                y={y + barHeight / 2}
                textAnchor='end'
                dominantBaseline='middle'
                fontSize='12'
                fill='var(--color-fg-muted)'
                aria-hidden='true'
              >
                {entry.label}
              </text>
            </g>
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
