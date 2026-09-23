'use client';
import { useFormStatus } from 'react-dom';
import type { ComponentProps } from 'react';
import type { Locale } from '@/lib/auth/validation';
import { uiCopy } from '@/lib/ui/copy';
export function SubmitButton({
  children,
  locale,
  className = 'button',
  ...props
}: ComponentProps<'button'> & { locale: Locale }) {
  const { pending } = useFormStatus();
  return (
    <button
      {...props}
      type="submit"
      className={className}
      disabled={pending || props.disabled}
      aria-disabled={pending || props.disabled}
    >
      {pending && <span className="spinner" aria-hidden="true" />}
      {children}
      <span className="sr-only" role="status">
        {pending ? uiCopy[locale].pending : ''}
      </span>
    </button>
  );
}
