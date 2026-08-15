export type Category = 'top' | 'bottom' | 'outer' | 'shoes' | 'acc'
export type GarmentStatus = 'owned' | 'considering'
export type FitTag = 'tight' | 'just' | 'loose'
export type WearFrequency = 'often' | 'sometimes' | 'rarely'
export type ParseMode = 'auto' | 'partial' | 'manual'

export const CATEGORY_LABELS: Record<Category, string> = {
  top: '상의',
  bottom: '하의',
  outer: '아우터',
  shoes: '신발',
  acc: '액세서리',
}
