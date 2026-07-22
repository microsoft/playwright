import { MemoryRouter } from 'react-router-dom';
import App from './App';

// Providers (here a router) are wired inside the story — the skill's decorator pattern.
// MemoryRouter is used so routing starts at '/' regardless of the gallery's own URL.
export const Routing = (props: any) => <MemoryRouter><App {...props} /></MemoryRouter>;
