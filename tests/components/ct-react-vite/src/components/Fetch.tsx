import { useEffect, useState } from 'react';

type FetchProps = {
  url: string;
}

export default function Fetch(props: FetchProps) {
  const [data, setData] = useState({ text: '' });
  useEffect(() => {
    fetch(props.url).then(res => res.json()).then(setData);
  }, [props.url]);
  return <p>{data.text}</p>;
}
