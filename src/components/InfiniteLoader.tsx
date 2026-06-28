import React, { useEffect, useRef } from 'react';

interface Props {
  hasMore: boolean;
  onLoadMore: () => void;
  label?: string;
  checkTrigger?: number; // incrementar força reconexão do observer após fetch
}

export const InfiniteLoader: React.FC<Props> = ({
  hasMore,
  onLoadMore,
  label = 'Carregando mais...',
  checkTrigger = 0,
}) => {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  const cooldownRef = useRef(false);

  useEffect(() => { onLoadMoreRef.current = onLoadMore; }, [onLoadMore]);

  useEffect(() => {
    if (!hasMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    cooldownRef.current = false; // reseta ao reconectar

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || cooldownRef.current) return;
        cooldownRef.current = true;
        onLoadMoreRef.current();
        setTimeout(() => { cooldownRef.current = false; }, 200);
      },
      { rootMargin: '400px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, checkTrigger]); // checkTrigger reconecta o observer após cada fetch

  if (!hasMore) return null;

  return (
    <div ref={sentinelRef} className="flex justify-center py-4">
      <span className="text-xs text-gray-400 animate-pulse">{label}</span>
    </div>
  );
};
