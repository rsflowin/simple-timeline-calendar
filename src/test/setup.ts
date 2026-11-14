import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// No vitest globals, so Testing Library can't register its own auto-cleanup.
afterEach(cleanup);

// jsdom has no ResizeObserver; a no-op one never reports a size, so nothing gets measured.
if (typeof window !== 'undefined' && !('ResizeObserver' in window)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom has no modal dialog support: open/close by attribute, like the browser does.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}
