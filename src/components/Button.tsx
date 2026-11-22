import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'link';
}

export function Button({ variant = 'secondary', className, type = 'button', ...rest }: Props) {
  return <button type={type} className={[styles.btn, styles[variant], className].filter(Boolean).join(' ')} {...rest} />;
}
