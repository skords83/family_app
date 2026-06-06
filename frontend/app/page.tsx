commit 5b5f57701851f4317a5d2282597a174ef44149c8
Author: skords83 <skords@ik.me>
Date:   Sat Jun 6 04:50:26 2026 +0200

    fix: page.tsx sse

diff --git a/frontend/app/page.tsx b/frontend/app/page.tsx
index 5aaa08f..b61cf12 100644
--- a/frontend/app/page.tsx
+++ b/frontend/app/page.tsx
@@ -1,6 +1,7 @@
 'use client';
 
 import { useState, useEffect, useCallback } from 'react';
+import { useSSE } from '@/hooks/useSSE';
 import CalendarWidget from '@/components/widgets/CalendarWidget';
 import WeatherWidget from '@/components/widgets/WeatherWidget';
 import MealsWidget from '@/components/widgets/MealsWidget';
@@ -69,6 +70,23 @@ export default function HomePage() {
 
   useEffect(() => { fetchAll(); const iv = setInterval(fetchAll, 5 * 60_000); return () => clearInterval(iv); }, [fetchAll]);
 
+  const fetchTasks = useCallback(async () => {
+    const res = await fetch(`${API_BASE}/api/tasks/today`).then(r => r.json());
+    if (Array.isArray(res)) setTasks(res);
+  }, []);
+
+  const fetchUsers = useCallback(async () => {
+    const res = await fetch(`${API_BASE}/api/users`).then(r => r.json());
+    if (Array.isArray(res)) setUsers(res);
+  }, []);
+
+  useSSE({
+    task_updated: fetchTasks,
+    points_updated: fetchUsers,
+    reward_claimed: fetchUsers,
+    config_updated: useCallback(() => window.location.reload(), []),
+  });
+
   const handleTaskComplete = async (taskId: string, userId: string) => {
     const task = tasks.find(t => t.id === taskId);
     if (!task) return;
@@ -76,9 +94,8 @@ export default function HomePage() {
       method: 'POST', headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ user_id: userId }),
     });
+    // Optimistisches Update — SSE aktualisiert tasks + users im Hintergrund
     setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed_at: new Date().toISOString() } : t));
-    const fresh = await fetch(`${API_BASE}/api/users`).then(r => r.json());
-    if (Array.isArray(fresh)) setUsers(fresh);
   };
 
   const handleImmichRefresh = async () => {
