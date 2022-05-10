import React, { useEffect, useState } from 'react';

export const Fetch: React.FC<{ url: string }> = ({ url }) => {
  const [data, setData] = useState('no response yet');
  useEffect(() => {
    fetch(url).then(res => res.text()).then(setData);
  }, [url]);
  return <p>{data}</p>;
}
