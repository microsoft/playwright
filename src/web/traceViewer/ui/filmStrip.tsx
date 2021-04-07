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
import { lowerBound } from '../../uiUtils';
import { ContextEntry, PageEntry } from '../../../server/trace/viewer/traceModel';

export const FilmStrip: React.FunctionComponent<{
  context: ContextEntry,
  boundaries: Boundaries,
  previewX?: number,
}> = ({ context, boundaries, previewX }) => {
  const [measure, ref] = useMeasure<HTMLDivElement>();

  const screencastFrames = context.pages[0]?.screencastFrames;
  // TODO: pick file from the Y position.
  let previewImage = undefined;
  if (previewX !== undefined && context.pages.length) {
    const previewTime = boundaries.minimum + (boundaries.maximum - boundaries.minimum) * previewX / measure.width;
    previewImage = screencastFrames[lowerBound(screencastFrames, previewTime, timeComparator)];
  }
  const previewSize = inscribe(context.created.viewportSize!, { width: 600, height: 600 });
  console.log(previewSize);

  return <div className='film-strip' ref={ref}>{
    context.pages.filter(p => p.screencastFrames.length).map((page, index) => <FilmStripLane
      boundaries={boundaries}
      viewportSize={context.created.viewportSize!}
      page={page}
      width={measure.width}
      key={index}
    />)
  }
  {previewImage && previewX !== undefined &&
    <div className='film-strip-hover' style={{
      width: previewSize.width,
      height: previewSize.height,
      top: measure.bottom + 5,
      left: Math.min(previewX, measure.width - previewSize.width - 10),
    }}>
      <img src={`/sha1/${previewImage.sha1}`} width={previewSize.width} height={previewSize.height} />
    </div>
  }
  </div>;
};

const FilmStripLane: React.FunctionComponent<{
  boundaries: Boundaries,
  viewportSize: Size,
  page: PageEntry,
  width: number,
}> = ({ boundaries, viewportSize, page, width }) => {
  const frameSize = inscribe(viewportSize!, { width: 200, height: 45 });
  const frameMargin = 2.5;
  const screencastFrames = page.screencastFrames;
  const startTime = screencastFrames[0].timestamp;
  const endTime = screencastFrames[screencastFrames.length - 1].timestamp;

  const boundariesDuration = boundaries.maximum - boundaries.minimum;
  const gapLeft = (startTime - boundaries.minimum) / boundariesDuration * width;
  const gapRight = (boundaries.maximum - endTime) / boundariesDuration * width;
  const effectiveWidth = (endTime - startTime) / boundariesDuration * width;
  const frameCount = effectiveWidth / (frameSize.width + 2 * frameMargin) | 0;
  const frameDuration = (endTime - startTime) / frameCount;

  const frames: JSX.Element[] = [];
  for (let time = startTime, i = 0; time <= endTime; time += frameDuration, ++i) {
    const index = lowerBound(screencastFrames, time, timeComparator);
    frames.push(<div className='film-strip-frame' key={i} style={{
      width: frameSize.width,
      height: frameSize.height,
      backgroundImage: `url(/sha1/${screencastFrames[index].sha1})`,
      backgroundSize: `${frameSize.width}px ${frameSize.height}px`,
      margin: frameMargin,
      marginRight: frameMargin,
    }} />);
  }

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
