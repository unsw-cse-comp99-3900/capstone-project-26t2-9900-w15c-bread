import React from 'react';
import VersionCard from './VersionCard';

function Timeline({ versions, selected, onSelect }) {
  if (!versions || versions.length === 0) {
    return <div className="dh-state">No version history found for this page.</div>;
  }

  return (
    <ol className="dh-timeline">
      {versions.map((v, i) => (
        <VersionCard
          key={v.number}
          version={v}
          isLatest={i === 0}
          isSelected={selected === v.number}
          onSelect={() => onSelect(v.number)}
        />
      ))}
    </ol>
  );
}

export default Timeline;
