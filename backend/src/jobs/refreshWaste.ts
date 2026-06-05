import cron from 'node-cron';
import { fetchAndStoreWasteEvents } from '../widgets/waste';

/**
 * Startet den täglichen Cronjob für den Müllabfuhrkalender.
 * Läuft um 03:00 Europe/Berlin — nach Mitternacht, bevor die Familie aufsteht.
 */
export function startWasteCron(): void {
  cron.schedule(
    '0 3 * * *',
    async () => {
      try {
        await fetchAndStoreWasteEvents();
      } catch (err) {
        console.error('[waste-cron] Refresh fehlgeschlagen:', err);
      }
    },
    { timezone: 'Europe/Berlin' },
  );

  console.log('[cron] Waste-Kalender-Refresh für 03:00 Europe/Berlin geplant');
}
