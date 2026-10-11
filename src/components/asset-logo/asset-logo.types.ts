export type AssetLogoSize = 'sm' | 'md' | 'lg';
export type AssetLogoCategory = 'ticker' | 'bank';
export interface AssetLogoProps {
  symbol: string;
  name?: string;
  size?: AssetLogoSize;
  category?: AssetLogoCategory;
}

export interface AssetLogoViewModel {
  src: string;
  fallbackSrc: string;
  alt: string;
  className: string;
}