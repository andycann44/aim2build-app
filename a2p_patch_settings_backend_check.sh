#!/bin/bash
: "${HISTTIMEFORMAT:=}"
set -euo pipefail
cd ~/aim2build-app
[ -f ./a2p_bash_compat.sh ] && source ./a2p_bash_compat.sh
[ -f /tmp/a2p_env.sh ] && source /tmp/a2p_env.sh

echo "[+] Creating Settings.tsx page..."
mkdir -p frontend/src/pages
cat > frontend/src/pages/Settings.tsx <<'EOF'
import { useState } from "react";

export default function Settings() {
  const [status, setStatus] = useState("idle");

  const checkBackend = async () => {
    setStatus("checking");
    try {
      const res = await fetch("/api/ping");
      if (!res.ok) throw new Error("Server error");
      setStatus("ok");
    } catch {
      setStatus("fail");
    }
  };

  return (
    <div>
      <h2>Settings</h2>
      <button onClick={checkBackend}>Check Backend</button>
      <p>Status: {{
        idle: "Not checked",
        checking: "Checking...",
        ok: "✅ Backend is connected!",
        fail: "❌ Failed to reach backend",
      }}[status]}</p>
    </div>
  );
}

EOF

echo "[+] Creating ping route..."
mkdir -p backend/app/routers
cat > backend/app/routers/ping.py <<'EOF'
from fastapi import APIRouter

router = APIRouter()

@router.get("/ping")
def ping():
    return {"status": "ok"}

EOF

echo "[+] Patching frontend/src/App.tsx..."
sed -i '' '/Buildability/i\
import Settings from "./pages/Settings";
' frontend/src/App.tsx
sed -i '' '/<Route path="\/buildability"/a\
          <Route path="/settings" element={<Settings />} />
' frontend/src/App.tsx
sed -i '' '/Buildability/a\
        <a href="/settings">Settings</a> |
' frontend/src/App.tsx

echo "[+] Patching backend/app/main.py..."
sed -i '' '/from .routers import/a\
    ping,
' backend/app/main.py
sed -i '' '/app.include_router(sets.router)/a\
app.include_router(ping.router, prefix="/api")
' backend/app/main.py

echo "[+] Committing and pushing..."
git switch -c a2p/2025-10-30-settings-check-backend
git add frontend/src/pages/Settings.tsx frontend/src/App.tsx backend/app/routers/ping.py backend/app/main.py
git commit -m "Add Settings tab with backend check"
git push -u origin a2p/2025-10-30-settings-check-backend

echo "[✓] Open PR:"
gh pr create --fill --head a2p/2025-10-30-settings-check-backend
