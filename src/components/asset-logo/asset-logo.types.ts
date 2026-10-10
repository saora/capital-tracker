export type AssetLogoSize = 'sm' | 'md' | 'lg';

export interface AssetLogoProps {
  symbol: string;
  name?: string;
  size?: AssetLogoSize;
}

export interface AssetLogoViewModel {
  src: string;
  fallbackSrc: string;
  alt: string;
  className: string;
}