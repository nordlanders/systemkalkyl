import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface SortableRowWrapperProps {
  id: string;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function SortableRowWrapper({ id, disabled, children, className, onClick }: SortableRowWrapperProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : 'auto' as const,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('flex items-start gap-2', className)}
      onClick={onClick}
    >
      {!disabled && (
        <button
          type="button"
          className="mt-4 p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none rounded hover:bg-muted/50"
          aria-label="Dra för att flytta rad"
          title="Dra för att flytta rad"
          onClick={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}
