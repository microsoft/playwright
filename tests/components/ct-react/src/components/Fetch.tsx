import React, { useEffect, useState } from 'react';

type FetchProps = {
  url: string;
}

export default function Fetch(props: FetchProps) {
  const [data, setData] = useState('no response yet');
  useEffect(() => {
    fetch(props.url).then(res => res.text()).then(setData);
  }, [props.url]);
  return <p>{data}</p>;
}
