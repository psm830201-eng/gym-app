import { useState } from "react";
import type { InputHTMLAttributes } from "react";

// A blank field is an editing state; saved numeric data stays compatible with old backups.
export function NumberInput({
  value,
  onChange,
  onFocus,
  onBlur,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "type"> & {
  value: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      {...props}
      type="number"
      value={draft ?? value}
      onFocus={(event) => {
        setDraft(value === 0 ? "" : String(value));
        onFocus?.(event);
      }}
      onChange={(event) => {
        setDraft(event.target.value);
        onChange?.(event);
      }}
      onBlur={(event) => {
        setDraft(null);
        onBlur?.(event);
      }}
    />
  );
}
