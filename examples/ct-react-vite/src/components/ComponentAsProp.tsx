import { ReactNode } from "react";

type ComponentAsProp = {
  component: ReactNode[] | ReactNode;
};

export function ComponentAsProp({ component }: ComponentAsProp) {
  return <div>{component}</div>
}
