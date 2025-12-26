import { API_BASE } from "./client";
import { authHeaders } from "../utils/auth";

export async function addCanonical(
  part_num: string,
  color_id: number,
  qty = 1
): Promise<any> {
  const res = await fetch(`${API_BASE}/api/inventory/add-canonical`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ part_num, color_id, qty }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `add-canonical failed (${res.status})`);
  }

  return res.json();
}

export async function decCanonical(
  part_num: string,
  color_id: number,
  delta = 1
): Promise<any> {
  const res = await fetch(`${API_BASE}/api/inventory/decrement-canonical`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ part_num, color_id, delta }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `decrement-canonical failed (${res.status})`);
  }

  return res.json();
}
