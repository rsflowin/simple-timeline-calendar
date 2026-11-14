import { useUi } from '../store/uiStore';

/** Select a task and open its Task dialog (CAL-6). */
export function openTask(id: string) {
  useUi.getState().select(id);
  useUi.getState().openEdit(id);
}
