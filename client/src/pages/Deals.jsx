import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Columns3, Plus, Search, X } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import KanbanBoard from '@/components/kanban/KanbanBoard';
import DealFormModal from '@/components/deals/DealFormModal';
import ManageColumnsModal from '@/components/kanban/ManageColumnsModal';
import { Input, Select } from '@/components/ui';
import { selectColumns, selectFilters, setFilters } from '@/features/deals/dealsSlice';
import { fetchStages } from '@/features/stages/stagesSlice';
import { fetchUsers, selectUsers } from '@/features/users/usersSlice';
import { selectUser } from '@/features/auth/authSlice';
import { formatMoney } from '@/utils/format';

export default function Deals() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const columns = useSelector(selectColumns);
  const filters = useSelector(selectFilters);
  const users = useSelector(selectUsers);
  const currentUser = useSelector(selectUser);

  const [searchText, setSearchText] = useState(filters.search);
  const [formOpen, setFormOpen] = useState(false);
  const [formStage, setFormStage] = useState(null);
  const [columnsOpen, setColumnsOpen] = useState(false);

  useEffect(() => {
    dispatch(fetchUsers());
    dispatch(fetchStages());
  }, [dispatch]);

  // Debounce so typing does not fire a board request per keystroke.
  useEffect(() => {
    const id = setTimeout(() => {
      if (searchText !== filters.search) dispatch(setFilters({ search: searchText }));
    }, 350);
    return () => clearTimeout(id);
  }, [searchText, filters.search, dispatch]);

  const totals = useMemo(() => {
    // "Open" is whatever the columns are configured to mean, not fixed keys.
    const open = columns.filter((c) => c.outcome === 'open');
    return {
      value: open.reduce((sum, c) => sum + (c.totalValue || 0), 0),
      count: open.reduce((sum, c) => sum + (c.count || 0), 0),
    };
  }, [columns]);

  const openNewDeal = (stage) => {
    setFormStage(stage || columns[0]?.key || null);
    setFormOpen(true);
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Deals"
        subtitle={`${totals.count} open ${totals.count === 1 ? 'deal' : 'deals'} · ${formatMoney(
          totals.value
        )} · drag cards between columns to change stage`}
        actions={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setColumnsOpen(true)}
            >
              <Columns3 className="h-4 w-4" aria-hidden />
              Columns
            </button>
            <button type="button" className="btn-primary" onClick={() => openNewDeal()}>
              <Plus className="h-4 w-4" aria-hidden />
              New deal
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <Input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search deals, companies, contacts…"
              className="pl-9 pr-9"
              aria-label="Search deals"
            />
            {searchText && (
              <button
                type="button"
                onClick={() => setSearchText('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>

          <Select
            value={filters.owner}
            onChange={(e) => dispatch(setFilters({ owner: e.target.value }))}
            className="sm:w-48"
            aria-label="Filter by owner"
          >
            <option value="">Everyone&apos;s deals</option>
            <option value="me">My deals</option>
            {users
              .filter((u) => u._id !== currentUser?._id)
              .map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}
                </option>
              ))}
          </Select>
        </div>
      </PageHeader>

      <div className="min-h-0 flex-1">
        <KanbanBoard
          onOpenDeal={(deal) => navigate(`/deals/${deal._id}`)}
          onAddDeal={openNewDeal}
        />
      </div>

      <DealFormModal open={formOpen} onClose={() => setFormOpen(false)} defaultStage={formStage} />

      <ManageColumnsModal open={columnsOpen} onClose={() => setColumnsOpen(false)} />
    </div>
  );
}
