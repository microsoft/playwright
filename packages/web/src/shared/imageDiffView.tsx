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

import * as React from 'react';
import { useMeasure } from '../uiUtils';
import { ResizeView } from './resizeView';

type TestAttachment = {
  name: string;
  body?: string;
  path?: string;
  contentType: string;
};

export type ImageDiff = {
  name: string,
  expected?: { attachment: TestAttachment, title: string },
  actual?: { attachment: TestAttachment },
  diff?: { attachment: TestAttachment },
};

async function loadImage(src?: string): Promise<HTMLImageElement> {
  const image = new Image();
  if (src) {
    image.src = src;
    await new Promise((f, r) => {
      image.onload = f;
      image.onerror = f;
    });
  }
  return image;
}

const checkerboardStyle: React.CSSProperties = {
  backgroundImage: `linear-gradient(45deg, #80808020 25%, transparent 25%),
                    linear-gradient(-45deg, #80808020 25%, transparent 25%),
                    linear-gradient(45deg, transparent 75%, #80808020 75%),
                    linear-gradient(-45deg, transparent 75%, #80808020 75%)`,
  backgroundSize: '20px 20px',
  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
  boxShadow: `rgb(0 0 0 / 10%) 0px 1.8px 1.9px,
              rgb(0 0 0 / 15%) 0px 6.1px 6.3px,
              rgb(0 0 0 / 10%) 0px -2px 4px,
              rgb(0 0 0 / 15%) 0px -6.1px 12px,
              rgb(0 0 0 / 25%) 0px 6px 12px`
};

export const ImageDiffView: React.FC<{
  diff: ImageDiff,
  noTargetBlank?: boolean,
}> = ({ diff, noTargetBlank }) => {
  const [mode, setMode] = React.useState<'diff' | 'actual' | 'expected' | 'slider' | 'sxs'>(diff.diff ? 'diff' : 'actual');
  const [showSxsDiff, setShowSxsDiff] = React.useState<boolean>(false);

  const [expectedImage, setExpectedImage] = React.useState<HTMLImageElement | null>(null);
  const [actualImage, setActualImage] = React.useState<HTMLImageElement | null>(null);
  const [diffImage, setDiffImage] = React.useState<HTMLImageElement | null>(null);
  const [measure, ref] = useMeasure<HTMLDivElement>();

  React.useEffect(() => {
    (async () => {
      setExpectedImage(await loadImage(diff.expected?.attachment.path));
      setActualImage(await loadImage(diff.actual?.attachment.path));
      setDiffImage(await loadImage(diff.diff?.attachment.path));
    })();
  }, [diff]);

  const isLoaded = expectedImage && actualImage && diffImage;

  const imageWidth = isLoaded ? Math.max(expectedImage.naturalWidth, actualImage.naturalWidth, 200) : 500;
  const imageHeight = isLoaded ? Math.max(expectedImage.naturalHeight, actualImage.naturalHeight, 200) : 500;
  const scale = Math.min(1, (measure.width - 30) / imageWidth);
  const sxsScale = Math.min(1, (measure.width - 50) / imageWidth / 2);
  const fitWidth = imageWidth * scale;
  const fitHeight = imageHeight * scale;

  const modeStyle: React.CSSProperties = {
    flex: 'none',
    margin: '0 10px',
    cursor: 'pointer',
    userSelect: 'none',
  };
  return <div data-testid='test-result-image-mismatch' style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'auto' }} ref={ref}>
    {isLoaded && <>
      <div data-testid='test-result-image-mismatch-tabs' style={{ display: 'flex', margin: '10px 0 20px' }}>
        {diff.diff && <div style={{ ...modeStyle, fontWeight: mode === 'diff' ? 600 : 'initial' }} onClick={() => setMode('diff')}>Diff</div>}
        <div style={{ ...modeStyle, fontWeight: mode === 'actual' ? 600 : 'initial' }} onClick={() => setMode('actual')}>Actual</div>
        <div style={{ ...modeStyle, fontWeight: mode === 'expected' ? 600 : 'initial' }} onClick={() => setMode('expected')}>Expected</div>
        <div style={{ ...modeStyle, fontWeight: mode === 'sxs' ? 600 : 'initial' }} onClick={() => setMode('sxs')}>Side by side</div>
        <div style={{ ...modeStyle, fontWeight: mode === 'slider' ? 600 : 'initial' }} onClick={() => setMode('slider')}>Slider</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', flex: 'auto', minHeight: fitHeight + 60 }}>
        {diff.diff && mode === 'diff' && <ImageWithSize image={diffImage} alt='Diff' canvasWidth={fitWidth} canvasHeight={fitHeight} scale={scale}/>}
        {diff.diff && mode === 'actual' && <ImageWithSize image={actualImage}  alt='Actual' canvasWidth={fitWidth} canvasHeight={fitHeight} scale={scale}/>}
        {diff.diff && mode === 'expected' && <ImageWithSize image={expectedImage}  alt='Expected' canvasWidth={fitWidth} canvasHeight={fitHeight} scale={scale}/>}
        {diff.diff && mode === 'slider' && <ImageDiffSlider expectedImage={expectedImage} actualImage={actualImage} canvasWidth={fitWidth} canvasHeight={fitHeight} scale={scale} />}
        {diff.diff && mode === 'sxs' && <div style={{ display: 'flex' }}>
          <ImageWithSize image={expectedImage} title='Expected' canvasWidth={sxsScale * imageWidth} canvasHeight={sxsScale * imageHeight} scale={sxsScale} />
          <ImageWithSize image={showSxsDiff ? diffImage : actualImage} title={showSxsDiff ? 'Diff' : 'Actual'} onClick={() => setShowSxsDiff(!showSxsDiff)} canvasWidth={sxsScale * imageWidth} canvasHeight={sxsScale * imageHeight} scale={sxsScale} />
        </div>}
        {!diff.diff && mode === 'actual' && <ImageWithSize image={actualImage} title='Actual' canvasWidth={fitWidth} canvasHeight={fitHeight} scale={scale}/>}
        {!diff.diff && mode === 'expected' && <ImageWithSize image={expectedImage} title='Expected' canvasWidth={fitWidth} canvasHeight={fitHeight} scale={scale}/>}
        {!diff.diff && mode === 'sxs' && <div style={{ display: 'flex' }}>
          <ImageWithSize image={expectedImage} title='Expected' canvasWidth={sxsScale * imageWidth} canvasHeight={sxsScale * imageHeight} scale={sxsScale} />
          <ImageWithSize image={actualImage} title='Actual' canvasWidth={sxsScale * imageWidth} canvasHeight={sxsScale * imageHeight} scale={sxsScale} />
        </div>}
      </div>
      <div style={{ alignSelf: 'start', lineHeight: '18px', marginLeft: '15px' }}>
        <div>{diff.diff && <a target='_blank' href={diff.diff.attachment.path} rel='noreferrer'>{diff.diff.attachment.name}</a>}</div>
        <div><a target={noTargetBlank ? '' : '_blank'} href={diff.actual!.attachment.path} rel='noreferrer'>{diff.actual!.attachment.name}</a></div>
        <div><a target={noTargetBlank ? '' : '_blank'} href={diff.expected!.attachment.path} rel='noreferrer'>{diff.expected!.attachment.name}</a></div>
      </div>
    </>}
  </div>;
};

export const ImageDiffSlider: React.FC<{
  expectedImage: HTMLImageElement,
  actualImage: HTMLImageElement,
  canvasWidth: number,
  canvasHeight: number,
  scale: number,
}> = ({ expectedImage, actualImage, canvasWidth, canvasHeight, scale }) => {
  const absoluteStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
  };

  const [slider, setSlider] = React.useState<number>(canvasWidth / 2);
  const sameSize = expectedImage.naturalWidth === actualImage.naturalWidth && expectedImage.naturalHeight === actualImage.naturalHeight;

  return <div style={{ flex: 'none', display: 'flex', alignItems: 'center', flexDirection: 'column', userSelect: 'none' }}>
    <div style={{ margin: 5 }}>
      {!sameSize && <span style={{ flex: 'none', margin: '0 5px' }}>Expected </span>}
      <span>{expectedImage.naturalWidth}</span>
      <span style={{ flex: 'none', margin: '0 5px' }}>x</span>
      <span>{expectedImage.naturalHeight}</span>
      {!sameSize && <span style={{ flex: 'none', margin: '0 5px 0 15px' }}>Actual </span>}
      {!sameSize && <span>{actualImage.naturalWidth}</span>}
      {!sameSize && <span style={{ flex: 'none', margin: '0 5px' }}>x</span>}
      {!sameSize && <span>{actualImage.naturalHeight}</span>}
    </div>
    <div style={{ position: 'relative', width: canvasWidth, height: canvasHeight, margin: 15, ...checkerboardStyle }}>
      <ResizeView
        orientation={'horizontal'}
        offsets={[slider]}
        setOffsets={offsets => setSlider(offsets[0])}
        resizerColor={'#57606a80'}
        resizerWidth={6}></ResizeView>
      <img alt='Expected' style={{
        width: expectedImage.naturalWidth * scale,
        height: expectedImage.naturalHeight * scale,
      }} draggable='false' src={expectedImage.src} />
      <div style={{ ...absoluteStyle, bottom: 0, overflow: 'hidden', width: slider, ...checkerboardStyle }}>
        <img alt='Actual' style={{
          width: actualImage.naturalWidth * scale,
          height: actualImage.naturalHeight * scale,
        }} draggable='false' src={actualImage.src} />
      </div>
    </div>
  </div>;
};

const ImageWithSize: React.FunctionComponent<{
  image: HTMLImageElement,
  title?: string,
  alt?: string,
  canvasWidth: number,
  canvasHeight: number,
  scale: number,
  onClick?: () => void;
}> = ({ image, title, alt, canvasWidth, canvasHeight, scale, onClick }) => {
  return <div style={{ flex: 'none', display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
    <div style={{ margin: 5 }}>
      {title && <span style={{ flex: 'none', margin: '0 5px' }}>{title}</span>}
      <span>{image.naturalWidth}</span>
      <span style={{ flex: 'none', margin: '0 5px' }}>x</span>
      <span>{image.naturalHeight}</span>
    </div>
    <div style={{ display: 'flex', flex: 'none', width: canvasWidth, height: canvasHeight, margin: 15, ...checkerboardStyle }}>
      <img
        width={image.naturalWidth * scale}
        height={image.naturalHeight * scale}
        alt={title || alt}
        style={{ cursor: onClick ? 'pointer' : 'initial' }}
        draggable='false'
        src={image.src}
        onClick={onClick} />
    </div>
  </div>;
};
