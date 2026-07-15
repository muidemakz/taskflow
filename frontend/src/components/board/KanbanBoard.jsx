import { useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, TouchSensor, closestCorners, useSensor, useSensors } from '@dnd-kit/core';
import toast from 'react-hot-toast';
import BoardColumn from './BoardColumn';
import BoardTaskCard from './BoardTaskCard';
import TaskMoveSheet from './TaskMoveSheet';
import { useBoardStore } from '../../store/boardStore';
import { appendPosition, insertBetween, sortTasks } from '../../utils/board';

// Extends the single-list vertical dnd-kit setup already used in
// ProjectDetail.jsx into real multi-column/cross-container drag: one
// DndContext for the whole board, one droppable per column (so dropping on
// empty column space works, not just on another card), a DragOverlay for
// the lifted card, and position recalculated via insertBetween/append
// against the Prompt 1 position field.
export default function KanbanBoard({ onOpenTask, sortKey = 'default', workflowContext, columnsOverride = null }) {
  const storeColumns = useBoardStore((s) => s.columns);
  const columnsRaw = columnsOverride ?? storeColumns;
  const statuses = useBoardStore((s) => s.statuses);
  const gates = useBoardStore((s) => s.gates);
  const moveTask = useBoardStore((s) => s.moveTask);
  const [activeTask, setActiveTask] = useState(null);
  const [moveSheetTask, setMoveSheetTask] = useState(null);

  // Drag continues to write real position values regardless of sort; a
  // non-default sort is purely a viewing preference layered on top, same
  // as list view.
  const columns = columnsRaw.map((col) => ({ ...col, tasks: sortTasks(col.tasks, sortKey, workflowContext) }));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } })
  );

  const gatesById = Object.fromEntries(gates.map((g) => [g.id, g]));

  function handleDragStart(event) {
    const task = columns.flatMap((c) => c.tasks).find((t) => t.id === event.active.id);
    setActiveTask(task || null);
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const overData = over.data.current;
    const targetStatusId = overData?.type === 'column' ? overData.statusId : overData?.statusId;
    if (!targetStatusId) return;
    const targetColumn = columns.find((c) => c.status.id === targetStatusId);
    if (!targetColumn) return;

    const others = targetColumn.tasks.filter((t) => t.id !== active.id);
    let newPosition;
    if (overData?.type === 'task' && over.id !== active.id) {
      const overIndex = others.findIndex((t) => t.id === over.id);
      newPosition = insertBetween(others[overIndex - 1]?.position ?? null, others[overIndex]?.position ?? null);
    } else {
      newPosition = appendPosition(others[others.length - 1]?.position ?? null);
    }

    moveTask(active.id, { statusId: targetStatusId, position: newPosition }).catch(() => {
      toast.error('Could not move task');
    });
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory sm:snap-none">
          {columns.map((col) => (
            <BoardColumn
              key={col.status.id}
              status={col.status}
              tasks={col.tasks}
              onCardTap={onOpenTask}
              onOpenMoveSheet={setMoveSheetTask}
              gatesById={gatesById}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
          {activeTask && (
            <div className="rotate-2 shadow-xl">
              <BoardTaskCard task={activeTask} gatesById={gatesById} dragDisabled />
            </div>
          )}
        </DragOverlay>
      </DndContext>
      {moveSheetTask && (
        <TaskMoveSheet task={moveSheetTask} statuses={statuses} gates={gates} onClose={() => setMoveSheetTask(null)} />
      )}
    </>
  );
}
