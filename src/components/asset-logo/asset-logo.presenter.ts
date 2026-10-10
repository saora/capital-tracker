import { getAssetLogoPath, getDefaultAssetLogoPath } from "./asset-logo.service";
import type { AssetLogoProps, AssetLogoViewModel } from "./asset-logo.types";

const SIZE_CLASSES = {
  sm: "asset-logo--sm",
  md: "asset-logo--md",
  lg: "asset-logo--lg",
} as const;

export function presentAssetLogo(props: AssetLogoProps): AssetLogoViewModel {
  const symbol = props.symbol.trim().toUpperCase();
  const size = props.size ?? "md";

  return {
    src: getAssetLogoPath(symbol),
    fallbackSrc: getDefaultAssetLogoPath(),
    alt: props.name ? `${props.name} (${symbol})` : `Logo de ${symbol}`,
    className: `asset-logo ${SIZE_CLASSES[size]}`,
  };
}
