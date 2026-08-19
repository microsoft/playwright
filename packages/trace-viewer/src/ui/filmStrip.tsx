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
import type { Boundaries, Size } from './geometry';
import * as React from 'react';
import { useMeasure, upperBound } from '@web/uiUtils';
import type { PageEntry } from '@isomorphic/trace/entries';
import { useTraceModel } from './traceModelContext';
import { useVideoThumbnails } from './videoThumbnails';
import type { VideoThumbnail } from './videoThumbnails';

export type FilmStripPreviewPoint = {
  x: number;
  clientY: number;
};

const tileSize = { width: 200, height: 45 };
const frameMargin = 2.5;
const rowHeight = tileSize.height + frameMargin * 2;

export const FilmStrip: React.FunctionComponent<{
  boundaries: Boundaries,
  previewPoint?: FilmStripPreviewPoint,
}> = ({ boundaries, previewPoint }) => {
  const model = useTraceModel();
  const [measure, ref] = useMeasure<HTMLDivElement>();
  const lanesRef = React.useRef<HTMLDivElement>(null);

  const video = model?.videos?.[0];
  const videoThumbnails = useVideoThumbnails(video, video && model ? model.createRelativeUrl(`file/${video.file}`) : undefined);

  let laneIndex = 0;
  if (lanesRef.current && previewPoint) {
    const bounds = lanesRef.current.getBoundingClientRect();
    laneIndex = ((previewPoint.clientY - bounds.top + lanesRef.current.scrollTop) / rowHeight) | 0;
  }

  const pageLanes = (model?.pages ?? []).filter(page => page.screencastFrames.length);
  const videoLanes: VideoThumbnail[][] = videoThumbnails.length ? [videoThumbnails] : [];

  let previewFrames: { timestamp: number, width: number, height: number, url: string }[] | undefined;
  if (laneIndex < pageLanes.length)
    previewFrames = model ? pageLanes[laneIndex]?.screencastFrames.map(frame => ({ ...frame, url: model.createRelativeUrl(`file/${frame.file}`) })) : undefined;
  else
    previewFrames = videoLanes[laneIndex - pageLanes.length];

  let previewImage = undefined;
  let previewSize = undefined;
  if (previewPoint !== undefined && previewFrames && previewFrames.length) {
    const previewTime = boundaries.minimum + (boundaries.maximum - boundaries.minimum) * previewPoint.x / measure.width;
    previewImage = previewFrames[upperBound(previewFrames, previewTime, timeComparator) - 1];
    const fitInto = {
      width: Math.min(800, (window.innerWidth / 2) | 0),
      height: Math.min(800, (window.innerHeight / 2) | 0),
    };
    previewSize = previewImage ? inscribe({ width: previewImage.width, height: previewImage.height }, fitInto) : undefined;
  }

  return <div className='film-strip' ref={ref}>
    <div className='film-strip-lanes' ref={lanesRef}>
      {pageLanes.map((page, index) => <FilmStripLane
        boundaries={boundaries}
        page={page}
        width={measure.width}
        key={index}
      />)}
      {videoLanes.map((thumbnails, index) => <VideoFilmStripLane
        boundaries={boundaries}
        thumbnails={thumbnails}
        width={measure.width}
        key={'video-' + index}
      />)}
    </div>
    {model && previewPoint && previewImage && previewSize &&
      <div className='film-strip-hover' style={{
        top: measure.bottom + 5,
        left: Math.min(previewPoint.x, measure.width - previewSize.width - 10),
        width: previewSize.width,
        height: previewSize.height,
      }}>
        <img src={previewImage.url} width={previewSize.width} height={previewSize.height} />
      </div>
    }
  </div>;
};

const VideoFilmStripLane: React.FunctionComponent<{
  boundaries: Boundaries,
  thumbnails: VideoThumbnail[],
  width: number,
}> = ({ boundaries, thumbnails, width }) => {
  const viewportSize = { width: 0, height: 0 };
  for (const thumbnail of thumbnails) {
    viewportSize.width = Math.max(viewportSize.width, thumbnail.width);
    viewportSize.height = Math.max(viewportSize.height, thumbnail.height);
  }
  const frameSize = inscribe(viewportSize, tileSize);
  const startTime = thumbnails[0].timestamp;
  const endTime = thumbnails[thumbnails.length - 1].timestamp;

  const boundariesDuration = boundaries.maximum - boundaries.minimum;
  const gapLeft = (startTime - boundaries.minimum) / boundariesDuration * width;
  const gapRight = (boundaries.maximum - endTime) / boundariesDuration * width;
  const effectiveWidth = (endTime - startTime) / boundariesDuration * width;
  const frameCount = (effectiveWidth / (frameSize.width + 2 * frameMargin)) | 0;
  const frameDuration = (endTime - startTime) / frameCount;

  const frames: React.JSX.Element[] = [];
  for (let i = 0; startTime && frameDuration && i < frameCount; ++i) {
    const time = startTime + frameDuration * i;
    const index = upperBound(thumbnails, time, timeComparator) - 1;
    frames.push(<div className='film-strip-frame' key={i} style={{
      width: frameSize.width,
      height: frameSize.height,
      backgroundImage: `url(${thumbnails[index].url})`,
      backgroundSize: `${frameSize.width}px ${frameSize.height}px`,
      margin: frameMargin,
      marginRight: frameMargin,
    }} />);
  }
  frames.push(<div className='film-strip-frame' key={frames.length} style={{
    width: frameSize.width,
    height: frameSize.height,
    backgroundImage: `url(${thumbnails[thumbnails.length - 1].url})`,
    backgroundSize: `${frameSize.width}px ${frameSize.height}px`,
    margin: frameMargin,
    marginRight: frameMargin,
  }} />);

  return <div className='film-strip-lane' style={{
    marginLeft: gapLeft + 'px',
    marginRight: gapRight + 'px',
  }}>{frames}</div>;
};

const FilmStripLane: React.FunctionComponent<{
  boundaries: Boundaries,
  page: PageEntry,
  width: number,
}> = ({ boundaries, page, width }) => {
  const model = useTraceModel();
  const viewportSize = { width: 0, height: 0 };
  const screencastFrames = page.screencastFrames;
  for (const frame of screencastFrames) {
    viewportSize.width = Math.max(viewportSize.width, frame.width);
    viewportSize.height = Math.max(viewportSize.height, frame.height);
  }
  const frameSize = inscribe(viewportSize!, tileSize);
  const startTime = screencastFrames[0].timestamp;
  const endTime = screencastFrames[screencastFrames.length - 1].timestamp;

  const boundariesDuration = boundaries.maximum - boundaries.minimum;
  const gapLeft = (startTime - boundaries.minimum) / boundariesDuration * width;
  const gapRight = (boundaries.maximum - endTime) / boundariesDuration * width;
  const effectiveWidth = (endTime - startTime) / boundariesDuration * width;
  const frameCount = (effectiveWidth / (frameSize.width + 2 * frameMargin)) | 0;
  const frameDuration = (endTime - startTime) / frameCount;

  const frames: React.JSX.Element[] = [];
  for (let i = 0; startTime && frameDuration && i < frameCount; ++i) {
    const time = startTime + frameDuration * i;
    const index = upperBound(screencastFrames, time, timeComparator) - 1;
    frames.push(<div className='film-strip-frame' key={i} style={{
      width: frameSize.width,
      height: frameSize.height,
      backgroundImage: `url(${model?.createRelativeUrl('file/' + screencastFrames[index].file)})`,
      backgroundSize: `${frameSize.width}px ${frameSize.height}px`,
      margin: frameMargin,
      marginRight: frameMargin,
    }} />);
  }
  // Always append last frame to show endgame.
  frames.push(<div className='film-strip-frame' key={frames.length} style={{
    width: frameSize.width,
    height: frameSize.height,
    backgroundImage: `url(${model?.createRelativeUrl('file/' + screencastFrames[screencastFrames.length - 1].file)})`,
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
