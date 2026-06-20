import type { ValidationResult } from '../lib/resultSchema';

const worker = new Worker(new URL('./validator.worker.ts', import.meta.url), { type: 'module' });

const dropzone = document.querySelector<HTMLElement>('[data-dropzone]');
const fileInput = document.querySelector<HTMLInputElement>('[data-file-input]');
const resultNode = document.querySelector<HTMLElement>('[data-result]');
const metadataNode = document.querySelector<HTMLElement>('[data-metadata]');
const themeToggle = document.querySelector<HTMLButtonElement>('[data-theme-toggle]');

function render(result: ValidationResult): void {
  if (!resultNode || !metadataNode) {
    return;
  }

  const diagnostics = result.diagnostics
    .map((item) => `<li><strong>${item.code}</strong>: ${item.message}</li>`)
    .join('');

  metadataNode.innerHTML = `
    <p>Status: <strong>${result.status}</strong></p>
    <p>Format: <strong>${result.metadata.formatId ?? 'unknown'}</strong></p>
    <p>Contract: <strong>${result.metadata.contractVersion ?? 'n/a'}</strong></p>
    <p>Rows: <strong>${result.metadata.rowCount}</strong></p>
    <p>Encoding: <strong>${result.metadata.encoding}</strong></p>
    <p>${result.disclaimer}</p>
  `;

  resultNode.innerHTML = diagnostics ? `<ul>${diagnostics}</ul>` : '<p>No diagnostics.</p>';
}

function validateFile(file: File): void {
  worker.postMessage(file);
}

worker.onmessage = (event: MessageEvent<ValidationResult>) => {
  render(event.data);
};

if (dropzone && fileInput) {
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropzone.classList.add('is-over');
  });
  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('is-over');
  });
  dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropzone.classList.remove('is-over');
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      validateFile(file);
    }
  });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) {
      validateFile(file);
    }
  });
}

if (themeToggle) {
  const key = 'datev-validator-theme';
  const current = localStorage.getItem(key) ?? 'light';
  document.documentElement.dataset.theme = current;
  themeToggle.textContent = current === 'dark' ? '☀️' : '🌙';

  themeToggle.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem(key, next);
    themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
  });
}
