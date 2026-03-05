'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className = '', id, ...props },
  ref,
) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="field">
      {label && (
        <label htmlFor={inputId} className="field-label">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`field-input${error ? ' error' : ''}${className ? ` ${className}` : ''}`}
        {...props}
      />
      {error && <span className="field-error">{error}</span>}
    </div>
  );
});

export default Input;
