import { createSignal } from "solid-js";

 type CounterProps = {
   count?: number;
   onClick?(props: string): void;
   children?: any;
 }

 let _remountCount = 1;

 export default function Counter(props: CounterProps) {
  const [remountCount, setRemountCount] = createSignal(_remountCount++);
  return <div onClick={() => props.onClick?.('hello')}>
     <div data-testid="props">{ props.count }</div>
     <div data-testid="remount-count">{ remountCount }</div>
     { props.children }
   </div>
 }
 