import { describe, expect, it, vi, beforeEach } from 'vitest';
import { setupIpcHandlers } from '../../src/main/ipc';
import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as nodeFs from 'node:fs';
import * as zlib from 'node:zlib';

type IpcHandler = (event: unknown, ...args: unknown[]) => unknown;

vi.mock('electron', () => {
  return {
    ipcMain: {
      handle: vi.fn(),
    },
    dialog: {
      showSaveDialog: vi.fn(),
    },
    BrowserWindow: {
      fromWebContents: vi.fn(),
    },
  };
});

vi.mock('node:fs', () => ({
  promises: {
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('node:zlib', async () => {
  const actual = await vi.importActual<typeof import('node:zlib')>('node:zlib');
  return {
    ...actual,
    gzip: vi.fn((data, cb) => cb(null, Buffer.from('compressed'))),
  };
});

describe('Export IPC Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupIpcHandlers(() => null);
  });

  it('handles settings:exportData successfully', async () => {
    const handlers = vi.mocked(ipcMain.handle).mock.calls;
    const exportHandler = handlers.find(h => h[0] === 'settings:exportData')?.[1] as IpcHandler;

    expect(exportHandler).toBeDefined();

    const mockWin = {};
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockWin as any);
    vi.mocked(dialog.showSaveDialog).mockResolvedValue({
      filePath: '/path/to/export.json.gz',
      canceled: false,
    } as any);

    const result = await exportHandler({ sender: {} });

    expect(result).toEqual({ success: true, filePath: '/path/to/export.json.gz' });
    expect(dialog.showSaveDialog).toHaveBeenCalled();
    expect(nodeFs.promises.writeFile).toHaveBeenCalledWith(
      '/path/to/export.json.gz',
      expect.any(Buffer)
    );
  });

  it('handles settings:exportData cancellation', async () => {
    const handlers = vi.mocked(ipcMain.handle).mock.calls;
    const exportHandler = handlers.find(h => h[0] === 'settings:exportData')?.[1] as IpcHandler;

    const mockWin = {};
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockWin as any);
    vi.mocked(dialog.showSaveDialog).mockResolvedValue({
      filePath: '',
      canceled: true,
    } as any);

    const result = await exportHandler({ sender: {} });

    expect(result).toEqual({ success: false, error: 'Canceled' });
    expect(nodeFs.promises.writeFile).not.toHaveBeenCalled();
  });
});
