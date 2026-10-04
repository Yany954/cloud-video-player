'use client';

import { Eye, EyeOff, Lock } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/lib/i18n/i18n-context';

interface PasswordFieldProps {
  id: string;
  label: string;
  autoComplete: 'current-password' | 'new-password';
  value: string;
  onChange(value: string): void;
  hint?: string;
  error?: string;
  minLength?: number;
}

export function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const { t } = useI18n();
  const hintId = props.hint ? `${props.id}-hint` : undefined;
  const errorId = props.error ? `${props.id}-error` : undefined;

  return (
    <div className="grid gap-2">
      <Label htmlFor={props.id}>{props.label}</Label>
      <div className="relative">
        <Lock
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
        />
        <Input
          id={props.id}
          type={visible ? 'text' : 'password'}
          autoComplete={props.autoComplete}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          minLength={props.minLength}
          required
          aria-invalid={props.error ? true : undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
          className="h-11 px-10"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-pressed={visible}
          aria-label={t.auth.showPassword}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-md outline-none focus-visible:ring-3"
        >
          {visible ? (
            <EyeOff aria-hidden className="size-4" />
          ) : (
            <Eye aria-hidden className="size-4" />
          )}
        </button>
      </div>
      {props.hint && (
        <p id={hintId} className="text-muted-foreground text-sm">
          {props.hint}
        </p>
      )}
      {props.error && (
        <p id={errorId} className="text-destructive text-sm">
          {props.error}
        </p>
      )}
    </div>
  );
}
