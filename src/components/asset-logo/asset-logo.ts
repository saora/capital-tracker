export function initializeAssetLogoFallback(
  root: HTMLElement,
): void {
  root.addEventListener(
    'error',
    (event: Event) => {
      const target = event.target;

      if (!(target instanceof HTMLImageElement)) {
        return;
      }

      const fallbackSrc = target.dataset.fallbackSrc;

      if (!fallbackSrc || target.dataset.fallbackApplied === 'true') {
        return;
      }

      target.dataset.fallbackApplied = 'true';
      target.src = fallbackSrc;
    },
    true,
  );
}
