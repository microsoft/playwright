import { useEffect, useState } from 'react';

type DelayedData = {
  data: string;
}

export default function DelayedData(props: DelayedData) {
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const timeout = setTimeout(() => setStatus(props.data), 500);
    return () => clearTimeout(timeout);
  }, [props.data])

  return <p>{status}</p>
};
