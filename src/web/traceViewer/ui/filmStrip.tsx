/*
  Copyright (c) Microsoft Corporation.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import './filmStrip.css';
import { Boundaries, Size } from '../geometry';
import * as React from 'react';
import { useMeasure } from './helpers';
import { upperBound } from '../../uiUtils';
import { ContextEntry, PageEntry } from '../../../server/trace/viewer/traceModel';

const tileSize = { width: 200, height: 45 };

export const FilmStrip: React.FunctionComponent<{
  context: ContextEntry,
  boundaries: Boundaries,
  previewPoint?: { x: number, clientY: number },
}> = ({ context, boundaries, previewPoint }) => {
  const [measure, ref] = useMeasure<HTMLDivElement>();

  let pageIndex = 0;
  if (ref.current && previewPoint) {
    const bounds = ref.current.getBoundingClientRect();
    pageIndex = ((previewPoint.clientY - bounds.top) / tileSize.height) | 0;
  }

  const screencastFrames = context.pages[pageIndex]?.screencastFrames;
  let previewImage = undefined;
  let previewSize = undefined;
  if (previewPoint !== undefined && screencastFrames) {
    const previewTime = boundaries.minimum + (boundaries.maximum - boundaries.minimum) * previewPoint.x / measure.width;
    previewImage = screencastFrames[upperBound(screencastFrames, previewTime, timeComparator) - 1];
    previewSize = inscribe({width: previewImage.width, height: previewImage.height}, { width: 600, height: 600 });
  }

  return <div className='film-strip' ref={ref}>{
    context.pages.filter(p => p.screencastFrames.length).map((page, index) => <FilmStripLane
      boundaries={boundaries}
      page={page}
      width={measure.width}
      key={index}
    />)
  }
  {previewImage && previewSize && previewPoint?.x !== undefined &&
    <div className='film-strip-hover' style={{
      width: previewSize.width,
      height: previewSize.height,
      top: measure.bottom + 5,
      left: Math.min(previewPoint!.x, measure.width - previewSize.width - 10),
    }}>
      <img src={`/sha1/${previewImage.sha1}`} width={previewSize.width} height={previewSize.height} />
    </div>
  }
  </div>;
};

const FilmStripLane: React.FunctionComponent<{
  boundaries: Boundaries,
  page: PageEntry,
  width: number,
}> = ({ boundaries, page, width }) => {
  const viewportSize = { width: 0, height: 0 };
  const screencastFrames = page.screencastFrames;
  for (const frame of screencastFrames) {
    viewportSize.width = Math.max(viewportSize.width, frame.width);
    viewportSize.height = Math.max(viewportSize.height, frame.height);
  }
  const frameSize = inscribe(viewportSize!, tileSize);
  const frameMargin = 2.5;
  const startTime = screencastFrames[0].timestamp;
  const endTime = screencastFrames[screencastFrames.length - 1].timestamp;

  const boundariesDuration = boundaries.maximum - boundaries.minimum;
  const gapLeft = (startTime - boundaries.minimum) / boundariesDuration * width;
  const gapRight = (boundaries.maximum - endTime) / boundariesDuration * width;
  const effectiveWidth = (endTime - startTime) / boundariesDuration * width;
  const frameCount = effectiveWidth / (frameSize.width + 2 * frameMargin) | 0 + 1;
  const frameDuration = (endTime - startTime) / frameCount;

  const frames: JSX.Element[] = [];
  let i = 0;
  for (let time = startTime; startTime && frameDuration && time <= endTime; time += frameDuration, ++i) {
    const index = upperBound(screencastFrames, time, timeComparator) - 1;
    frames.push(<div className='film-strip-frame' key={i} style={{
      width: frameSize.width,
      height: frameSize.height,
      backgroundImage: `url(/sha1/${screencastFrames[index].sha1})`,
      backgroundSize: `${frameSize.width}px ${frameSize.height}px`,
      margin: frameMargin,
      marginRight: frameMargin,
    }} />);
  }
  // Always append last frame to show endgame.
  frames.push(<div className='film-strip-frame' key={i} style={{
    width: frameSize.width,
    height: frameSize.height,
    backgroundImage: `url(/sha1/${screencastFrames[screencastFrames.length - 1].sha1})`,
    backgroundSize: `${frameSize.width}px ${frameSize.height}px`,
    margin: frameMargin,
    marginRight: frameMargin,
  }} />);

  return <div className='film-strip-lane' style={{
    marginLeft: gapLeft + 'px',
    marginRight: gapRight + 'px',
  }}>{frames}</div>;
};

function timeComparator(time: number, frame: { timestamp: number }): number {
  return time - frame.timestamp;
}

function inscribe(object: Size, area: Size): Size {
  const scale = Math.max(object.width / area.width, object.height / area.height);
  return {
    width: object.width / scale | 0,
    height: object.height / scale | 0
  };
}
