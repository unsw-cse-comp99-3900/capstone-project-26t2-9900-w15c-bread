import React from 'react';
import VersionCard from './VersionCard';

function Timeline({ versions, selected, commentsByVersion, onSelect, onAddComment }) {
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
          comments={(commentsByVersion && commentsByVersion[String(v.number)]) || []}
          onSelect={() => onSelect(v.number)}
          onAddComment={() => onAddComment(v.number)}
        />
      ))}
    </ol>
  );
}

export default Timeline;
