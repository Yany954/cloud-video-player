/* eslint-disable @next/next/no-img-element -- posters are signed, time-limited CloudFront
   links that change on every request, so the Next.js image optimizer could not cache them. */
'use client';

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { VideoResponse } from '@cvp/shared';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { moveDown, moveItem, moveUp } from '@/lib/event/order';
import { useI18n } from '@/lib/i18n/i18n-context';

interface ReorderListProps {
  videos: VideoResponse[];
  onChange(videos: VideoResponse[]): void;
}

/**
 * The temporary "reorder" view: drag a row by its handle, or use its arrows. Nothing is saved
 * here; the page saves the result. Dragging also works from the keyboard (Space, arrows).
 */
export function ReorderList({ videos, onChange }: ReorderListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  // Stable across server and client render, which the library's generated ids are not.
  const dndId = useId();

  function dragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = videos.findIndex((video) => video.id === active.id);
    const to = videos.findIndex((video) => video.id === over.id);
    onChange(moveItem(videos, from, to));
  }

  return (
    <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}>
      <SortableContext
        items={videos.map((video) => video.id)}
        strategy={verticalListSortingStrategy}
      >
        <ol className="bg-card divide-y rounded-3xl border">
          {videos.map((video, index) => (
            <Row
              key={video.id}
              video={video}
              position={index + 1}
              total={videos.length}
              onUp={() => onChange(moveUp(videos, index))}
              onDown={() => onChange(moveDown(videos, index))}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function Row({
  video,
  position,
  total,
  onUp,
  onDown,
}: {
  video: VideoResponse;
  position: number;
  total: number;
  onUp(): void;
  onDown(): void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: video.id });
  const { t } = useI18n();

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`bg-card flex items-center gap-2 px-3 py-2 first:rounded-t-3xl last:rounded-b-3xl sm:px-4 ${
        isDragging ? 'relative z-10 shadow-lg' : ''
      }`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={t.event.drag(video.title, position, total)}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg outline-none focus-visible:ring-3 active:cursor-grabbing"
      >
        <GripVertical aria-hidden className="size-5" />
      </button>
      <span className="text-muted-foreground w-6 shrink-0 text-right text-sm tabular-nums">
        {position}
      </span>
      {video.posterUrl && (
        // Decorative: the title next to it already names the video.
        <img
          src={video.posterUrl}
          alt=""
          width={40}
          height={40}
          draggable={false}
          className="bg-muted size-10 shrink-0 rounded-lg object-cover"
        />
      )}
      <span className="min-w-0 flex-1 truncate font-medium" title={video.title}>
        {video.title}
      </span>
      <Button
        variant="outline"
        size="icon-lg"
        disabled={position === 1}
        onClick={onUp}
        aria-label={t.event.moveUp(video.title)}
      >
        <ArrowUp aria-hidden />
      </Button>
      <Button
        variant="outline"
        size="icon-lg"
        disabled={position === total}
        onClick={onDown}
        aria-label={t.event.moveDown(video.title)}
      >
        <ArrowDown aria-hidden />
      </Button>
    </li>
  );
}
