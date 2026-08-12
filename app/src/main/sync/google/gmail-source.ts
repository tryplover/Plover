import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { TypedEventBus } from '@main/events/bus.js';
import { SettingsData } from '@main/store/repos/settings.js';
import { ContextSource } from '../source-poller.js';

function header(headers: { name?: string | null; value?: string | null }[] | undefined, name: string): string {
  const h = (headers ?? []).find((x) => (x.name ?? '').toLowerCase() === name.toLowerCase());
  return h?.value ?? '';
}

export class GmailSource implements ContextSource {
  readonly provider = 'google';
  readonly source = 'gmail';

  constructor(private auth: { client: OAuth2Client }, private eventBus: TypedEventBus) {}

  enabled(settings: SettingsData): boolean {
    return settings.googleConnected && settings.gmailEnabled;
  }

  async poll(cursor: string | null): Promise<string> {
    const gmail = google.gmail({ version: 'v1', auth: this.auth.client });

    if (cursor === null) {
      const profile = await gmail.users.getProfile({ userId: 'me' });
      return String(profile.data.historyId ?? '');
    }

    const res = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: cursor,
      historyTypes: ['messageAdded'],
    });

    const history = res.data.history ?? [];
    for (const h of history) {
      for (const added of h.messagesAdded ?? []) {
        const id = added.message?.id;
        if (!id) continue;
        const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'metadata', metadataHeaders: ['From', 'Subject'] });
        const d = msg.data;
        this.eventBus.emit('gmail.message', {
          id: d.id ?? id,
          threadId: d.threadId ?? '',
          from: header(d.payload?.headers ?? undefined, 'From'),
          subject: header(d.payload?.headers ?? undefined, 'Subject'),
          snippet: d.snippet ?? '',
          labels: d.labelIds ?? [],
          receivedAt: d.internalDate ? new Date(Number(d.internalDate)).toISOString() : new Date().toISOString(),
        });
      }
    }

    return res.data.historyId ? String(res.data.historyId) : cursor;
  }
}
