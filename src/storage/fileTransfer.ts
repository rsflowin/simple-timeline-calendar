// Browser-only helpers, exercised by the E2E test in Task 24.
export function downloadText(text: string, filename: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Resolves with the file's text, or null if the user cancels. */
export function pickTextFile(accept = '.json,application/json'): Promise<string | null> {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept });
    input.onchange = () =>
      input.files?.[0] ? input.files[0].text().then(resolve, () => resolve(null)) : resolve(null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}
