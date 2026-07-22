import { useLayoutEffect, useRef, useState } from "react"

 type CounterProps = {
   count?: number;
   onClick?(props: string): void;
   children?: any;
 }

 let _remountCount = 1;

 export default function Counter(props: CounterProps) {
   const [remountCount] = useState(_remountCount);
   const didMountRef = useRef(false)
   useLayoutEffect(() => {
     if (!didMountRef.current) {
       didMountRef.current = true;
       _remountCount++;
     }
   }, [])
   return <button onClick={() => props.onClick?.('hello')}>
     <span data-testid="props">{ props.count }</span>
     <span data-testid="remount-count">{ remountCount }</span>
     { props.children }
   </button>
 }
