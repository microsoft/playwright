import { useRef } from "react"

type CounterProps = {
  count?: number;
  onClick?(props: string): void;
  children?: any;
}

let _remountCount = 1;

export default function Counter(props: CounterProps) {
  const remountCount = useRef(_remountCount++);
  return <div onClick={() => props.onClick?.('hello')}>
    <div data-testid="props">{ props.count }</div>
    <div data-testid="remount-count">{ remountCount.current }</div>
    <div data-testid="children">{ props.children }</div>
  </div>
}
