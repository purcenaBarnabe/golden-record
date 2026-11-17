import type { ButtonHTMLAttributes, ReactNode } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'

export function IconButton({
  label,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button type="button" className="icon-button" aria-label={label} {...props}>
          {children}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal
        container={
          typeof document === 'undefined'
            ? undefined
            : ((document.fullscreenElement as HTMLElement) ?? undefined)
        }
      >
        <Tooltip.Content className="control-tooltip" sideOffset={9}>
          {label}
          <Tooltip.Arrow />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
