import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { useRoadmap } from './store/roadmapStore';
import { loadRoadmap } from './storage/boot';
import { startAutosave } from './storage/autosave';
import { localStorageAdapter } from './storage/localStorageAdapter';
import { useStatus } from './store/statusStore';
import './styles/tokens.css';
import './styles/global.css';

const adapter = localStorageAdapter(); // Phase 9: pick the Tauri adapter here

const { doc, error, unreadable } = await loadRoadmap(adapter);
useRoadmap.getState().reset(doc);
if (error) useStatus.getState().show(error, unreadable);
startAutosave(adapter, () =>
  useStatus.getState().show("Couldn't save. Export your roadmap to keep a copy."),
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
