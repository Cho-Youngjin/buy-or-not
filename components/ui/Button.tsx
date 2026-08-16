import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }

const BASE =
  'inline-flex items-center justify-center rounded-btn px-4 py-2 text-sm font-medium ' +
  'transition duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent/90',
  secondary: 'border border-border bg-surface text-ink hover:bg-canvas',
  danger: 'bg-danger text-white hover:opacity-90',
}

/**
 * 앱 전체가 공유하는 버튼.
 * 지금까지는 파일마다 bg-black / bg-gray-800 / bg-red-600을 따로 하드코딩해 눌림 피드백도 제각각이었다.
 * active:scale-[0.98]로 물리적으로 눌리는 느낌을 주고, disabled는 색을 바꾸는 대신 투명도를 낮춰
 * 어떤 variant에서도 같은 방식으로 동작하게 한다.
 */
export function Button({ variant = 'primary', className = '', ...props }: Props) {
  return <button className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />
}
