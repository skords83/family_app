import cron from 'node-cron';
import { fetchAndStoreContactBirthdays } from '../widgets/contacts';

/**
 * Startet den täglichen Cronjob für den CardDAV-Kontakte-Sync.
 * Läuft um 03:10 Europe/Berlin — 10 Minuten nach dem Müll-Sync (03:00),
 * um Ressourcen-Überschneidung zu vermeiden.
 */
export function startContactsCron(): void {
  cron.schedule(
    '10 3 * * *',
    async () => {
      try {
        await fetchAndStoreContactBirthdays();
      } catch (err) {
        console.error('[contacts-cron] Sync fehlgeschlagen:', err);
      }
    },
    { timezone: 'Europe/Berlin' },
  );

  console.log('[cron] Kontakte-Sync für 03:10 Europe/Berlin geplant');
}
