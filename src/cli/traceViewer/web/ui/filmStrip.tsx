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

import { ContextEntry, VideoEntry, VideoMetaInfo } from '../../traceModel';
import './filmStrip.css';
import { Boundaries } from '../geometry';
import * as React from 'react';
import { useAsyncMemo, useMeasure } from './helpers';

function imageURL(videoId: string, index: number) {
  const imageURLpadding = '0'.repeat(3 - String(index + 1).length);
  return `video-tile/${videoId}/${imageURLpadding}${index + 1}.png`;
}

export const FilmStrip: React.FunctionComponent<{
  context: ContextEntry,
  boundaries: Boundaries,
  previewX?: number,
}> = ({ context, boundaries, previewX }) => {
  const [measure, ref] = useMeasure<HTMLDivElement>();

  const videos = React.useMemo(() => {
    const videos: VideoEntry[] = [];
    for (const page of context.pages) {
      if (page.video)
        videos.push(page.video);
    }
    return videos;
  }, [context]);

  const metaInfos = useAsyncMemo<Map<VideoEntry, VideoMetaInfo | undefined>>(async () => {
    const infos = new Map<VideoEntry, VideoMetaInfo | undefined>();
    for (const video of videos)
      infos.set(video, await window.getVideoMetaInfo(video.videoId));
    return infos;
  }, [videos], new Map(), new Map());

  // TODO: pick file from the Y position.
  const previewVideo = videos[0];
  const previewMetaInfo = metaInfos.get(previewVideo);
  let previewIndex = 0;
  if ((previewX !== undefined) && previewMetaInfo) {
    const previewTime = boundaries.minimum + (boundaries.maximum - boundaries.minimum) * previewX / measure.width;
    previewIndex = (previewTime - previewMetaInfo.startTime) / (previewMetaInfo.endTime - previewMetaInfo.startTime) * previewMetaInfo.frames | 0;
  }

  const previewImage = useAsyncMemo<HTMLImageElement | undefined>(async () => {
    if (!previewMetaInfo || previewIndex < 0 || previewIndex >= previewMetaInfo.frames)
      return;
    const idealWidth = previewMetaInfo.width / 2;
    const idealHeight = previewMetaInfo.height / 2;
    const ratio = Math.min(1, (measure.width - 20) / idealWidth);
    const image = new Image((idealWidth * ratio) | 0, (idealHeight * ratio) | 0);
    image.src = imageURL(previewVideo.videoId, previewIndex);
    await new Promise(f => image.onload = f);
    return image;
  }, [previewMetaInfo, previewIndex, measure.width, previewVideo], undefined);

  return <div className='film-strip' ref={ref}>{
    videos.map(video => <FilmStripLane
      boundaries={boundaries}
      video={video}
      metaInfo={metaInfos.get(video)}
      width={measure.width}
      key={video.videoId}
    />)
  }
  {(previewX !== undefined) && previewMetaInfo && previewImage &&
    <div className='film-strip-hover' style={{
      width: previewImage.width + 'px',
      height: previewImage.height + 'px',
      top: measure.bottom + 5 + 'px',
      left: Math.min(previewX, measure.width - previewImage.width - 10) + 'px',
    }}>
      <img src={previewImage.src} width={previewImage.width} height={previewImage.height} />
    </div>
  }
  </div>;
};

const FilmStripLane: React.FunctionComponent<{
  boundaries: Boundaries,
  video: VideoEntry,
  metaInfo: VideoMetaInfo | undefined,
  width: number,
}> = ({ boundaries, video, metaInfo, width }) => {
  const frameHeight = 45;
  const frameMargin = 2.5;

  if (!metaInfo)
    return <div className='film-strip-lane' style={{ height: (frameHeight + 2 * frameMargin) + 'px' }}></div>;

  const frameWidth = frameHeight / metaInfo.height * metaInfo.width | 0;
  const boundariesSize = boundaries.maximum - boundaries.minimum;
  const gapLeft = (metaInfo.startTime - boundaries.minimum) / boundariesSize * width;
  const gapRight = (boundaries.maximum - metaInfo.endTime) / boundariesSize * width;
  const effectiveWidth = (metaInfo.endTime - metaInfo.startTime) / boundariesSize * width;

  const frameCount = effectiveWidth / (frameWidth + 2 * frameMargin) | 0;
  const frameStep = metaInfo.frames / frameCount;
  const frameGap = frameCount <= 1 ? 0 : (effectiveWidth - (frameWidth + 2 * frameMargin) * frameCount) / (frameCount - 1);

  const frames: JSX.Element[] = [];
  for (let i = 0; i < metaInfo.frames; i += frameStep) {
    let index = i | 0;
    // Always show last frame.
    if (Math.floor(i + frameStep) >= metaInfo.frames)
      index = metaInfo.frames - 1;
    frames.push(<div className='film-strip-frame' key={i} style={{
      width: frameWidth + 'px',
      height: frameHeight + 'px',
      backgroundImage: `url(${imageURL(video.videoId, index)})`,
      backgroundSize: `${frameWidth}px ${frameHeight}px`,
      margin: frameMargin + 'px',
      marginRight: (frameMargin + frameGap) + 'px',
    }} />);
  }

  return <div className='film-strip-lane' style={{
    marginLeft: gapLeft + 'px',
    marginRight: gapRight + 'px',
  }}>{frames}</div>;
};
