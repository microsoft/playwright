import type { PropsWithChildren } from 'react';

type DefaultChildrenProps = PropsWithChildren<{}>;

export default function CheckChildrenProp(props: DefaultChildrenProps) {
  return <>{'children' in props ? props.children : 'No Children'}</>
}
