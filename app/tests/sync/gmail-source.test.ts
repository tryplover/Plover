import { describe, expect, it, beforeEach, vi } from 'vitest';

const { gmailStub } = vi.hoisted(() => ({
  gmailStub: {
    users: {
      getProfile: vi.fn(),
      history: { list: vi.fn() },
      messages: { get: vi.fn() },
    },
  },
}));

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: class {
        setCredentials() {
          // Mock implementation
        }

        generateAuthUrl() {
          return '';
        }

        getToken() {
          return { tokens: {} };
        }

        get credentials() {
          return {};
        }
      },
    },
    gmail: vi.fn(() => gmailStub),
  },
}));

import { GmailSource } from '../../src/main/sync/google/gmail-source';
import { TypedEventBus } from '../../src/main/events/bus';
import { GmailMessagePayload } from '../../src/shared/events';

describe('GmailSource', () => {
  let bus: TypedEventBus;
  let source: GmailSource;

  beforeEach(() => {
    vi.clearAllMocks();
    bus = new TypedEventBus();
    source = new GmailSource({ client: {} as never }, bus);
  });

  it('first snapshot records current historyId and emits nothing', async () => {
    gmailStub.users.getProfile.mockResolvedValue({ data: { historyId: '1000' } });
    const events: GmailMessagePayload[] = [];
    bus.on('gmail.message', (p) => events.push(p));

    const next = await source.poll(null);

    expect(next).toBe('1000');
    expect(events).toHaveLength(0);
    expect(gmailStub.users.history.list).not.toHaveBeenCalled();
  });

  it('emits one event per added message since the cursor and returns the new historyId', async () => {
    gmailStub.users.history.list.mockResolvedValue({
      data: {
        historyId: '1010',
        history: [{ messagesAdded: [{ message: { id: 'm1', threadId: 't1' } }] }],
      },
    });
    gmailStub.users.messages.get.mockResolvedValue({
      data: {
        id: 'm1',
        threadId: 't1',
        labelIds: ['INBOX', 'UNREAD'],
        internalDate: '1700000000000',
        payload: { headers: [{ name: 'From', value: 'a@b.com' }, { name: 'Subject', value: 'Hi' }] },
        snippet: 'hello there',
      },
    });
    const events: GmailMessagePayload[] = [];
    bus.on('gmail.message', (p) => events.push(p));

    const next = await source.poll('1000');

    expect(gmailStub.users.history.list).toHaveBeenCalledWith(expect.objectContaining({ startHistoryId: '1000' }));
    expect(next).toBe('1010');
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      id: 'm1',
      threadId: 't1',
      from: 'a@b.com',
      subject: 'Hi',
      snippet: 'hello there',
      labels: ['INBOX', 'UNREAD'],
      receivedAt: new Date(1700000000000).toISOString(),
    });
  });

  it('keeps the old cursor when there is no history', async () => {
    gmailStub.users.history.list.mockResolvedValue({ data: {} });
    const next = await source.poll('1000');
    expect(next).toBe('1000');
  });
});
