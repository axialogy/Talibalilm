import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * Password input with a reveal toggle.
 *
 * Typing a long password blind is the main reason people mistype one and then
 * assume the account is broken, so this is a real usability fix rather than a
 * flourish. The toggle is a button, not a checkbox, and carries an aria-label
 * plus aria-pressed so its state is announced.
 */
export function PasswordField({
  id,
  value,
  onChange,
  label,
  autoComplete = 'current-password',
  required = true,
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  label: string;
  autoComplete?: 'current-password' | 'new-password';
  required?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          required={required}
          autoComplete={autoComplete}
          dir="ltr"
          value={value}
          onChange={e => onChange(e.target.value)}
          // Room for the button, on whichever side the writing direction puts it.
          className="w-full rounded-xl border border-border bg-background px-4 py-3 pe-12 text-sm outline-none transition-colors focus:border-charcoal/40"
        />
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          aria-label={visible ? t('hidePassword') : t('showPassword')}
          aria-pressed={visible}
          // Not focusable by tab: it sits between the password field and the
          // submit button, where an extra stop interrupts the obvious path.
          tabIndex={-1}
          className={cn(
            'absolute inset-y-0 end-0 flex cursor-pointer items-center px-4',
            'text-muted-foreground transition-colors hover:text-foreground',
          )}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
