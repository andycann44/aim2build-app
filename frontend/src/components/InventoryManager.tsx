import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../api/client';

type InventoryPart = {
  part_num: string;
  color_id: number;
  qty_total: number;
};

type FormState = {
  part_num: string;
  color_id: string;
  qty_total: string;
};

const initialForm: FormState = {
  part_num: '',
  color_id: '',
  qty_total: ''
};

export default function InventoryManager(): JSX.Element {
  const [inventory, setInventory] = useState<InventoryPart[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [busy, setBusy] = useState<boolean>(false);

  const loadInventory = useCallback(
    async (options: { showSpinner?: boolean } = {}) => {
      const { showSpinner = true } = options;
      if (showSpinner) {
        setLoading(true);
      }
      setError(null);
      try {
        const data = await apiClient.get<InventoryPart[]>('/api/inventory/parts');
        setInventory(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load inventory.');
      } finally {
        if (showSpinner) {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const sortedInventory = useMemo(
    () =>
      [...inventory].sort((a, b) => {
        const byPart = a.part_num.localeCompare(b.part_num);
        if (byPart !== 0) {
          return byPart;
        }
        return a.color_id - b.color_id;
      }),
    [inventory]
  );

  const updateForm = useCallback(
    (field: keyof FormState, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const resetForm = useCallback(() => setForm(initialForm), []);

  const handleAdd = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmedPart = form.part_num.trim();
      const colorId = Number.parseInt(form.color_id, 10);
      const quantity = Number.parseInt(form.qty_total, 10);

      if (!trimmedPart) {
        setError('Part number is required.');
        return;
      }
      if (!Number.isFinite(colorId)) {
        setError('Color ID must be a valid number.');
        return;
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        setError('Quantity must be a positive number.');
        return;
      }

      setBusy(true);
      setError(null);
      setMessage(null);

      try {
        await apiClient.post('/api/inventory/add', {
          part_num: trimmedPart,
          color_id: colorId,
          qty_total: quantity
        });
        setMessage(`Added ${quantity}× ${trimmedPart} (color ${colorId}).`);
        resetForm();
        await loadInventory({ showSpinner: false });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add part.');
      } finally {
        setBusy(false);
      }
    },
    [form, loadInventory, resetForm]
  );

  const handleRemove = useCallback(
    async (part: InventoryPart) => {
      setBusy(true);
      setError(null);
      setMessage(null);
      try {
        await apiClient.delete(
          `/api/inventory/part?part_num=${encodeURIComponent(part.part_num)}&color_id=${part.color_id}`
        );
        setMessage(`Removed ${part.part_num} (color ${part.color_id}).`);
        await loadInventory({ showSpinner: false });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove part.');
      } finally {
        setBusy(false);
      }
    },
    [loadInventory]
  );

  return (
    <div>
      <form onSubmit={handleAdd} className="form-row" aria-label="Add inventory part">
        <label htmlFor="part-number" style={{ flex: '1 1 160px' }}>
          Part number
          <input
            id="part-number"
            name="part-number"
            placeholder="3001"
            value={form.part_num}
            onChange={(event) => updateForm('part_num', event.target.value)}
            required
          />
        </label>
        <label htmlFor="color-id" style={{ flex: '1 1 120px' }}>
          Color ID
          <input
            id="color-id"
            name="color-id"
            inputMode="numeric"
            pattern="\\d*"
            placeholder="1"
            value={form.color_id}
            onChange={(event) => updateForm('color_id', event.target.value)}
            required
          />
        </label>
        <label htmlFor="quantity" style={{ flex: '1 1 120px' }}>
          Quantity
          <input
            id="quantity"
            name="quantity"
            inputMode="numeric"
            pattern="\\d*"
            placeholder="10"
            value={form.qty_total}
            onChange={(event) => updateForm('qty_total', event.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={busy} style={{ alignSelf: 'flex-end', minWidth: '120px' }}>
          {busy ? 'Saving…' : 'Add / update'}
        </button>
      </form>

      {error && <p className="status error">{error}</p>}
      {message && <p className="status success">{message}</p>}

      {loading ? (
        <p className="status">Loading inventory…</p>
      ) : sortedInventory.length === 0 ? (
        <p className="empty-state">Inventory is empty. Add your first part above.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Part #</th>
              <th scope="col">Color</th>
              <th scope="col">Quantity</th>
              <th scope="col" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {sortedInventory.map((part) => (
              <tr key={`${part.part_num}-${part.color_id}`}>
                <td>{part.part_num}</td>
                <td>{part.color_id}</td>
                <td>{part.qty_total}</td>
                <td>
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => {
                      void handleRemove(part);
                    }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
