import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import toast from 'react-hot-toast';
import StageColumn from './StageColumn';
import { DealCardBody } from './DealCard';
import {
  applyLocalMove,
  fetchBoard,
  moveDeal,
  selectBoardError,
  selectBoardStatus,
  selectColumns,
  selectFilters,
} from '@/features/deals/dealsSlice';
import { ErrorState, LoadingState } from '@/components/ui';

const STAGE_PREFIX = 'stage:';

const findColumnOf = (columns, dealId) =>
  columns.find((c) => c.deals.some((d) => d._id === dealId));

export default function KanbanBoard({ onOpenDeal, onAddDeal }) {
  const dispatch = useDispatch();
  const columns = useSelector(selectColumns);
  const status = useSelector(selectBoardStatus);
  const error = useSelector(selectBoardError);
  const filters = useSelector(selectFilters);

  const [activeDeal, setActiveDeal] = useState(null);
  const [activeColor, setActiveColor] = useState('slate');
  const [hoverStage, setHoverStage] = useState(null);

  // Drag handlers need the freshest board without re-subscribing on every move.
  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  // Where the drag started, so we can tell a real move from a no-op.
  const origin = useRef({ stage: null, index: -1 });

  const sensors = useSensors(
    // A small threshold keeps a click-to-open from being read as a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  /** Resolves whatever we are hovering into a { stage, index } target. */
  const resolveTarget = useCallback((overId, dealId) => {
    const cols = columnsRef.current;
    const current = findColumnOf(cols, dealId);
    if (!current) return null;

    const id = String(overId);

    if (id.startsWith(STAGE_PREFIX)) {
      const stage = id.slice(STAGE_PREFIX.length);
      const target = cols.find((c) => c.key === stage);
      if (!target) return null;
      // Dropping on empty column space means "append".
      const index = stage === current.key ? target.deals.length - 1 : target.deals.length;
      return { stage, index: Math.max(index, 0), fromStage: current.key };
    }

    const target = findColumnOf(cols, overId);
    if (!target) return null;
    return {
      stage: target.key,
      index: target.deals.findIndex((d) => d._id === overId),
      fromStage: current.key,
    };
  }, []);

  const handleDragStart = ({ active }) => {
    const cols = columnsRef.current;
    const column = findColumnOf(cols, active.id);
    const deal = column?.deals.find((d) => d._id === active.id);
    if (!deal) return;

    origin.current = { stage: column.key, index: column.deals.indexOf(deal) };
    setActiveColor(column.color);
    setActiveDeal(deal);
  };

  /**
   * Highlight the column under the cursor. Deliberately does NOT move the card
   * yet: mutating the columns mid-drag makes dnd-kit recompute collisions, which
   * fires another dragOver, which moves it again — the card ping-pongs between
   * columns until React bails out with "maximum update depth exceeded".
   * The commit happens once, in dragEnd; the DragOverlay carries the feedback.
   */
  const handleDragOver = ({ active, over }) => {
    if (!over || active.id === over.id) return;

    const target = resolveTarget(over.id, active.id);
    if (target) setHoverStage(target.stage);
  };

  const handleDragEnd = ({ active, over }) => {
    setActiveDeal(null);
    setHoverStage(null);

    // Dropped outside any column: nothing was moved, so there is nothing to undo.
    if (!over) return;

    const target = resolveTarget(over.id, active.id);
    if (!target) return;

    const cols = columnsRef.current;
    const currentColumn = findColumnOf(cols, active.id);
    const currentIndex = currentColumn.deals.findIndex((d) => d._id === active.id);

    if (target.stage !== currentColumn.key || target.index !== currentIndex) {
      dispatch(
        applyLocalMove({
          dealId: active.id,
          fromStage: currentColumn.key,
          toStage: target.stage,
          toIndex: target.index,
        })
      );
    }

    const unchanged = origin.current.stage === target.stage && origin.current.index === target.index;
    if (unchanged) return;

    dispatch(moveDeal({ id: active.id, stage: target.stage, index: target.index }))
      .unwrap()
      .catch((message) => toast.error(message || 'Could not move the deal'));
  };

  const handleDragCancel = () => {
    setActiveDeal(null);
    setHoverStage(null);
  };

  useEffect(() => {
    dispatch(fetchBoard(filters));
  }, [dispatch, filters]);

  if (status === 'loading') return <LoadingState label="Loading your pipeline…" />;
  if (status === 'failed') {
    return (
      <div className="p-4 sm:p-6">
        <ErrorState message={error} onRetry={() => dispatch(fetchBoard(filters))} />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex h-full gap-3 overflow-x-auto px-4 pb-4 pt-4 scrollbar-thin sm:px-6">
        {columns.map((column) => (
          <StageColumn
            key={column.key}
            column={column}
            onOpenDeal={onOpenDeal}
            onAddDeal={onAddDeal}
            activeStage={activeDeal && hoverStage === column.key ? column.key : null}
          />
        ))}
      </div>

      {/* The overlay is what follows the cursor; it is not part of any column. */}
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
        {activeDeal ? (
          <div className="w-[280px] rotate-1 sm:w-[300px]">
            <DealCardBody deal={activeDeal} color={activeColor} dragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
