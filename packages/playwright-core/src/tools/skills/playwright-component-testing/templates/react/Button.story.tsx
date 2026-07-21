// Example story file. Stories live next to the component they exercise:
// this file is src/components/Button.story.tsx for src/components/Button.tsx.
// Each named export is one story: a scenario-specific wrapper around the
// component. Wire providers, mock data, state and callbacks here, not in tests.
import { useState } from 'react';
import { Button } from './Button';

export const Primary = () => <Button title="Submit" />;

export const Disabled = () => <Button title="Submit" disabled />;

// The story owns the state and provides the callbacks. Record the state into
// a hidden form for the test to assert on.
export const CountsClicks = () => {
  const [clicks, setClicks] = useState(0);
  return <>
    <Button title="Submit" onClick={() => setClicks(count => count + 1)} />
    <form hidden><input data-testid="click-count" readOnly value={String(clicks)} /></form>
  </>;
};
