import type { AssetLogoViewModel } from './asset-logo.types';

export function renderAssetLogoTemplate(
  viewModel: AssetLogoViewModel,
): string {
  return `
    <span class="${viewModel.className}">
      <img
        src="${viewModel.src}"
        data-fallback-src="${viewModel.fallbackSrc}"
        alt="${viewModel.alt}"
        loading="lazy"
        decoding="async"
      />
    </span>
  `;
}
