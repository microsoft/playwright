import { ButtonHTMLAttributes } from "react";

type ButtonProps = {
  title: string;
  onClick?(props: string): void;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export default function Button({ onClick, title, ...attributes }: ButtonProps) {
  return <button {...attributes} onClick={() => onClick?.('hello')}>
    {title}
  </button>
}
