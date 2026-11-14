import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { useRoadmap } from './store/roadmapStore';
import { serializeRoadmap } from './domain/schema';
import { loadRoadmap } from './storage/boot';
import { startAutosave } from './storage/autosave';
import { localStorageAdapter, ROADMAP_KEY } from './storage/localStorageAdapter';
import { useStatus } from './store/statusStore';
import './styles/tokens.css';
import './styles/global.css';

const adapter = localStorageAdapter(); // Phase 9: pick the Tauri adapter here

const { doc, error, unreadable, backedUp } = await loadRoadmap(adapter);
useRoadmap.getState().reset(doc);
if (error) useStatus.getState().show(error, unreadable);

const onSaveError = () =>
  useStatus.getState().show("Couldn't save. Export your roadmap to keep a copy.");
const startSaving = () => startAutosave(adapter, onSaveError);
// No backup of the unreadable data: the first save would destroy the only copy (DATA-5).
if (backedUp) startSaving();
else
  useStatus.setState({
    startSaving: () => {
      // save edits made while saving was held back, not just later ones
      adapter.save(serializeRoadmap(useRoadmap.getState().history.present)).catch(onSaveError);
      startSaving();
    },
  });

const OTHER_TAB =
  'This roadmap was changed in another tab. Reload this tab before editing to avoid overwriting it.';
addEventListener('storage', (e) => {
  if (e.key === ROADMAP_KEY) useStatus.getState().show(OTHER_TAB);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
