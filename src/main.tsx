import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { useRoadmap } from './store/roadmapStore';
import { serializeRoadmap } from './domain/schema';
import { ConflictError } from './storage/StorageAdapter';
import { loadRoadmap } from './storage/boot';
import { startAutosave } from './storage/autosave';
import { httpStorageAdapter } from './storage/httpStorageAdapter';
import { localStorageAdapter } from './storage/localStorageAdapter';
import { useStatus } from './store/statusStore';
import './styles/tokens.css';
import './styles/global.css';

// Phase 9: swap localStorageAdapter() for tauriFileAdapter() when running in Tauri
const adapter = '__TAURI_INTERNALS__' in window ? localStorageAdapter() : httpStorageAdapter();

const { doc, error, unreadable, backedUp } = await loadRoadmap(adapter);
useRoadmap.getState().reset(doc);
if (error) useStatus.getState().show(error, unreadable);

const SAVE_ERROR_MESSAGE = "Couldn't save. Export your roadmap to keep a copy.";
const CONFLICT_MESSAGE =
  'This roadmap was changed on another device or tab. Reload before editing to avoid overwriting it.';
const onSaveError = (err: unknown) => {
  console.error('Failed to save roadmap:', err);
  useStatus.getState().show(err instanceof ConflictError ? CONFLICT_MESSAGE : SAVE_ERROR_MESSAGE);
};
const onSaveSuccess = () => {
  const { message, clear } = useStatus.getState();
  if (message === SAVE_ERROR_MESSAGE) clear();
};
const startSaving = () => startAutosave(adapter, onSaveError, undefined, onSaveSuccess);
// No backup of the unreadable data (or load failed): the first save would destroy the server copy (DATA-5).
if (backedUp) startSaving();
else
  useStatus.setState({
    startSaving: () => {
      // save edits made while saving was held back, not just later ones
      adapter
        .save(serializeRoadmap(useRoadmap.getState().history.present))
        .then(onSaveSuccess, onSaveError);
      startSaving();
    },
  });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
