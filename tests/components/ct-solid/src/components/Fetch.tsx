import { createResource } from "solid-js";

type FetchProps = {
  url: string;
}

export default function Fetch(props: FetchProps) {
  const [data] = createResource(async () => {
    const response = await fetch(props.url);
    return await response.json();
  }, { initialValue: { text: '' }});

  return <p>{data().text}</p>
}
