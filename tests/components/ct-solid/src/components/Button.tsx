import type { JSX } from "solid-js";

type ButtonProps = {
  title: string;
  onClick?(props: string): void;
  className?: string;
} & JSX.ButtonHTMLAttributes<HTMLButtonElement>;

export default function Button({ onClick, title, ...attributes }: ButtonProps) {
  return <button {...attributes} onClick={() => onClick?.('hello')}>
    {title}
  </button>
}
