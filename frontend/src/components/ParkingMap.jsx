// ParkingMap.jsx
// Renders the parking lot as an interactive Konva canvas.
//
// Improvements over original:
//   - Canvas height capped at 70vh — no more oversized images
//   - Stage click on empty area sets entry point (entryX/entryY) — Bug 4 fix
//   - Crosshair marker drawn at the selected entry point
//   - Slot hover tooltip (slot ID + status + confidence) without requiring click
//   - Deferred stage dimensions: starts with 0 height until the image is loaded,
//     preventing the large-canvas-before-load issue
//
// Props:
//   slotMap         — { id: { bbox, centroid } }
//   status          — { slots: { id: { occupied, confidence } } }
//   recommendations — [{ slot_id }, ...]
//   selectedSlot    — string or null
//   onSelectSlot    — (slotId) => void
//   frameUrl        — blob URL string from fetchFrame()
//   entryX          — current entry point X (pixels in image space)
//   entryY          — current entry point Y
//   onSetEntry      — (x, y) => void   called when user clicks empty canvas area

import { useEffect, useRef, useState } from "react";
import {
  Stage, Layer, Image as KonvaImage,
  Rect, Text, Circle, Line,
} from "react-konva";
import useImage from "use-image";

const COLOR_FREE        = "#34d399";
const COLOR_OCCUPIED    = "#fbbf24";
const COLOR_RECOMMENDED = "#38bdf8";
const COLOR_SELECTED    = "#ffffff";
const COLOR_ENTRY       = "#f472b6"; // pink crosshair
const SLOT_OPACITY      = 0.28;
const STROKE_WIDTH      = 1.5;
const STROKE_SELECTED   = 3;
const MAX_HEIGHT_VH     = 0.70; // 70% of viewport height

// Safely extract [x, y, w, h] from bbox regardless of format.
function parseBbox(bbox) {
  if (!bbox) return null;
  if (Array.isArray(bbox)) {
    if (bbox.length >= 4) return [Number(bbox[0]), Number(bbox[1]), Number(bbox[2]), Number(bbox[3])];
    return null;
  }
  if (bbox.w !== undefined && bbox.h !== undefined) {
    return [
      Number(bbox.x ?? bbox.xmin ?? 0),
      Number(bbox.y ?? bbox.ymin ?? 0),
      Number(bbox.w),
      Number(bbox.h),
    ];
  }
  if (bbox.x2 !== undefined) {
    const x = Number(bbox.x1 ?? bbox.x ?? 0);
    const y = Number(bbox.y1 ?? bbox.y ?? 0);
    return [x, y, Number(bbox.x2) - x, Number(bbox.y2) - y];
  }
  return null;
}

// Individual slot rectangle + label
function SlotRect({ slotId, bbox, occupied, confidence, isRecommended, isSelected, onSelect, onHover }) {
  const parsed = parseBbox(bbox);
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
        x={x} y={y} width={w} height={h}
        fill={fillColor}
        opacity={SLOT_OPACITY}
        stroke={strokeColor}
        strokeWidth={strokeW}
        onClick={(e) => { e.cancelBubble = true; onSelect(slotId); }}
        onTap={(e)   => { e.cancelBubble = true; onSelect(slotId); }}
        onMouseEnter={(e) => {
          e.target.getStage().container().style.cursor = "pointer";
          onHover(slotId, { x: x + w / 2, y });
        }}
        onMouseLeave={(e) => {
          e.target.getStage().container().style.cursor = "default";
          onHover(null, null);
        }}
      />
      {w > 20 && h > 12 && (
        <Text
          x={x + 2} y={y + 2}
          text={slotId.replace(/[^0-9]/g, "")}
          fontSize={9}
          fill={strokeColor}
          listening={false}
        />
      )}
    </>
  );
}

// Crosshair drawn at the entry point
function EntryMarker({ x, y, scale }) {
  if (x === 0 && y === 0) return null;
  const arm = 10 / scale; // stays 10px on screen regardless of zoom
  return (
    <>
      <Line points={[x - arm, y, x + arm, y]} stroke={COLOR_ENTRY} strokeWidth={1.5 / scale} />
      <Line points={[x, y - arm, x, y + arm]} stroke={COLOR_ENTRY} strokeWidth={1.5 / scale} />
      <Circle x={x} y={y} radius={3 / scale} fill={COLOR_ENTRY} opacity={0.8} />
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
  entryX = 0,
  entryY = 0,
  onSetEntry,
}) {
  const containerRef    = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [maxH, setMaxH] = useState(window.innerHeight * MAX_HEIGHT_VH);

  // Hover state: { slotId, pos: { x, y } } | null
  const [hovered, setHovered] = useState(null);

  const [bgImage, bgStatus] = useImage(frameUrl || "");

  // Image natural dimensions (fall back only if image is loaded)
  const imgLoaded = bgStatus === "loaded";
  const imgW = imgLoaded ? (bgImage?.naturalWidth  || bgImage?.width  || 1280) : 1280;
  const imgH = imgLoaded ? (bgImage?.naturalHeight || bgImage?.height || 720)  : 720;

  // Scale to fit container width, but also cap at maxH
  const scaleByWidth  = containerWidth > 0 ? containerWidth / imgW : 1;
  const heightIfWidth = imgH * scaleByWidth;
  const scale  = heightIfWidth > maxH ? maxH / imgH : scaleByWidth;
  const stageW = imgW * scale;
  const stageH = imgH * scale;

  // Only show stage once we know the container size and (if frameUrl given) the image has loaded
  const stageReady = containerWidth > 0 && (!frameUrl || imgLoaded);

  // ResizeObserver for responsive canvas width
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      if (w > 0) setContainerWidth(w);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Keep maxH in sync with window resizes
  useEffect(() => {
    const handler = () => setMaxH(window.innerHeight * MAX_HEIGHT_VH);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const recommendedSet = new Set((recommendations || []).map((r) => r.slot_id));

  // Click on stage background → set entry point
  function handleStageClick(e) {
    // Only fires if no shape cancelled bubbling
    if (!onSetEntry) return;
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    // Convert from stage coords to image coords
    onSetEntry(Math.round(pointer.x / scale), Math.round(pointer.y / scale));
  }

  // Tooltip: convert hovered image-space pos to screen-space pos
  const tooltipSlotId = hovered?.slotId;
  const tooltipSlotStatus = tooltipSlotId ? status?.slots?.[tooltipSlotId] : null;

  return (
    <div className="flex flex-col h-full gap-2">

      {/* Canvas wrapper */}
      <div
        ref={containerRef}
        className="relative w-full bg-zinc-950 rounded-lg overflow-hidden border border-zinc-800"
        style={{ minHeight: 120 }}
      >
        {/* Loading placeholder */}
        {!frameUrl && (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-zinc-600 text-xs font-mono">
            <div className="w-5 h-5 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
            Waiting for frame…
          </div>
        )}

        {frameUrl && !stageReady && (
          <div className="flex items-center justify-center h-48 text-zinc-600 text-xs font-mono">
            Loading image…
          </div>
        )}

        {stageReady && (
          <Stage
            width={stageW}
            height={stageH}
            scaleX={scale}
            scaleY={scale}
            onClick={handleStageClick}
            onTap={handleStageClick}
            style={{ display: "block", margin: "0 auto" }}
          >
            {/* Background image layer */}
            <Layer>
              {imgLoaded && (
                <KonvaImage image={bgImage} x={0} y={0} width={imgW} height={imgH} />
              )}
            </Layer>

            {/* Slot overlay layer */}
            <Layer>
              {slotMap &&
                Object.entries(slotMap).map(([slotId, meta]) => {
                  const slotStatus = status?.slots?.[slotId];
                  return (
                    <SlotRect
                      key={slotId}
                      slotId={slotId}
                      bbox={meta.bbox}
                      occupied={slotStatus?.occupied ?? false}
                      confidence={slotStatus?.confidence ?? 0}
                      isRecommended={recommendedSet.has(slotId)}
                      isSelected={selectedSlot === slotId}
                      onSelect={onSelectSlot}
                      onHover={(id, pos) => setHovered(id ? { slotId: id, pos } : null)}
                    />
                  );
                })}
            </Layer>

            {/* Entry point crosshair layer */}
            <Layer>
              <EntryMarker x={entryX} y={entryY} scale={scale} />
            </Layer>
          </Stage>
        )}

        {/* Slot hover tooltip (DOM layer, not Konva) */}
        {hovered && tooltipSlotStatus && stageReady && (
          <div
            className="absolute pointer-events-none z-10 bg-zinc-900/95 border border-zinc-700 rounded px-2 py-1.5 text-xs font-mono shadow-xl"
            style={{
              left:      Math.min(hovered.pos.x * scale + 6, stageW - 140),
              top:       Math.max((hovered.pos.y * scale) - 50, 4),
              minWidth:  120,
            }}
          >
            <p className="text-zinc-300 font-bold mb-0.5">{hovered.slotId}</p>
            <p className={tooltipSlotStatus.occupied ? "text-amber-400" : "text-emerald-400"}>
              {tooltipSlotStatus.occupied ? "OCCUPIED" : "FREE"}
            </p>
            <p className="text-zinc-500">
              conf {(tooltipSlotStatus.confidence * 100).toFixed(1)}%
            </p>
          </div>
        )}
      </div>

      {/* Legend + entry hint */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 px-1">
        {[
          { color: COLOR_FREE,        label: "Free" },
          { color: COLOR_OCCUPIED,    label: "Occupied" },
          { color: COLOR_RECOMMENDED, label: "Recommended" },
          { color: COLOR_SELECTED,    label: "Selected" },
          { color: COLOR_ENTRY,       label: "Entry point (click to set)" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm border"
              style={{ backgroundColor: color + "44", borderColor: color }}
            />
            <span className="text-[10px] text-zinc-500 font-mono">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}