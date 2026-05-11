// ParkingMap.jsx
// Renders the parking lot as an interactive canvas using react-konva.
//
// Props:
//   slotMap         — { id: { bbox: [x,y,w,h] OR {x,y,w,h} OR {x1,y1,x2,y2}, centroid } }
//   status          — { slots: { id: { occupied: bool } } }
//   recommendations — [{ slot_id }, ...]
//   selectedSlot    — string or null
//   onSelectSlot    — (slotId) => void
//   frameUrl        — blob URL string from fetchFrame()

import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Text } from "react-konva";
import useImage from "use-image";

const COLOR_FREE        = "#34d399";
const COLOR_OCCUPIED    = "#fbbf24";
const COLOR_RECOMMENDED = "#38bdf8";
const COLOR_SELECTED    = "#ffffff";
const SLOT_OPACITY      = 0.35;
const STROKE_WIDTH      = 1.5;
const STROKE_SELECTED   = 3;

// Safely extract [x, y, w, h] from bbox regardless of its format.
// PKLot parsers can produce arrays, {x,y,w,h} objects, or {x1,y1,x2,y2} objects.
function parseBbox(bbox) {
  if (!bbox) return null;

  // Case 1: already a plain array [x, y, w, h]
  if (Array.isArray(bbox)) {
    if (bbox.length >= 4) return [Number(bbox[0]), Number(bbox[1]), Number(bbox[2]), Number(bbox[3])];
    return null;
  }

  // Case 2: object with w and h keys — {x, y, w, h}
  if (bbox.w !== undefined && bbox.h !== undefined) {
    return [
      Number(bbox.x ?? bbox.xmin ?? 0),
      Number(bbox.y ?? bbox.ymin ?? 0),
      Number(bbox.w),
      Number(bbox.h),
    ];
  }

  // Case 3: object with x1, y1, x2, y2 keys
  if (bbox.x2 !== undefined) {
    const x = Number(bbox.x1 ?? bbox.x ?? 0);
    const y = Number(bbox.y1 ?? bbox.y ?? 0);
    return [x, y, Number(bbox.x2) - x, Number(bbox.y2) - y];
  }

  return null;
}

function SlotRect({ slotId, bbox, occupied, isRecommended, isSelected, onSelect }) {
  const parsed = parseBbox(bbox);

  // Skip this slot entirely if bbox cannot be parsed — prevents crashes.
  if (!parsed) return null;

  const [x, y, w, h] = parsed;

  let strokeColor = occupied ? COLOR_OCCUPIED : COLOR_FREE;
  if (isRecommended) strokeColor = COLOR_RECOMMENDED;
  if (isSelected)    strokeColor = COLOR_SELECTED;

  const fillColor = occupied ? COLOR_OCCUPIED : COLOR_FREE;
  const strokeW   = isSelected ? STROKE_SELECTED : STROKE_WIDTH;

  return (
    <>
      <Rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill={fillColor}
        opacity={SLOT_OPACITY}
        stroke={strokeColor}
        strokeWidth={strokeW}
        onClick={() => onSelect(slotId)}
        onTap={() => onSelect(slotId)}
        onMouseEnter={(e) => { e.target.getStage().container().style.cursor = "pointer"; }}
        onMouseLeave={(e) => { e.target.getStage().container().style.cursor = "default"; }}
      />
      {w > 20 && h > 12 && (
        <Text
          x={x + 2}
          y={y + 2}
          text={slotId.replace(/[^0-9]/g, "")}
          fontSize={9}
          fill={strokeColor}
          listening={false}
        />
      )}
    </>
  );
}

export default function ParkingMap({
  slotMap,
  status,
  recommendations,
  selectedSlot,
  onSelectSlot,
  frameUrl,
}) {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [bgImage, bgStatus] = useImage(frameUrl || "");

  const imgW = bgImage?.naturalWidth  || bgImage?.width  || 1280;
  const imgH = bgImage?.naturalHeight || bgImage?.height || 720;

  const scale  = containerWidth / imgW;
  const stageH = imgH * scale;

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      if (w > 0) setContainerWidth(w);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const recommendedSet = new Set((recommendations || []).map((r) => r.slot_id));

  return (
    <div ref={containerRef} className="w-full bg-zinc-950 rounded overflow-hidden">
      {!frameUrl && (
        <div className="flex items-center justify-center h-48 text-zinc-600 text-xs font-mono">
          Waiting for frame...
        </div>
      )}

      {frameUrl && (
        <Stage width={containerWidth} height={stageH} scaleX={scale} scaleY={scale}>
          <Layer>
            {bgStatus === "loaded" && (
              <KonvaImage image={bgImage} x={0} y={0} width={imgW} height={imgH} />
            )}
          </Layer>
          <Layer>
            {slotMap &&
              Object.entries(slotMap).map(([slotId, meta]) => {
                const slotStatus = status?.slots?.[slotId];
                const occupied   = slotStatus?.occupied ?? false;
                return (
                  <SlotRect
                    key={slotId}
                    slotId={slotId}
                    bbox={meta.bbox}
                    occupied={occupied}
                    isRecommended={recommendedSet.has(slotId)}
                    isSelected={selectedSlot === slotId}
                    onSelect={onSelectSlot}
                  />
                );
              })}
          </Layer>
        </Stage>
      )}

      <div className="flex gap-5 px-3 py-2 border-t border-zinc-800">
        {[
          { color: COLOR_FREE,        label: "Free" },
          { color: COLOR_OCCUPIED,    label: "Occupied" },
          { color: COLOR_RECOMMENDED, label: "Recommended" },
          { color: COLOR_SELECTED,    label: "Selected" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm border"
              style={{ backgroundColor: color + "55", borderColor: color }}
            />
            <span className="text-[10px] text-zinc-500 font-mono">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}