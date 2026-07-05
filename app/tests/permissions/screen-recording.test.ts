import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { getMediaAccessStatus, getSources } = vi.hoisted(() => ({
  getMediaAccessStatus: vi.fn(),
  getSources: vi.fn(),
}));

vi.mock('electron', () => ({
  systemPreferences: { getMediaAccessStatus },
  desktopCapturer: { getSources },
}));

import {
  getScreenRecordingStatus,
  requestScreenRecording,
} from '../../src/main/permissions/screen-recording.js';

describe('Screen Recording permission', () => {
  const realPlatform = process.platform;
  beforeEach(() => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    getMediaAccessStatus.mockReset();
    getSources.mockReset();
  });
  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: realPlatform });
  });

  it('reports unsupported on non-darwin', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    expect(getScreenRecordingStatus()).toBe('unsupported');
  });

  it('passes through systemPreferences status on darwin', () => {
    getMediaAccessStatus.mockReturnValue('granted');
    expect(getScreenRecordingStatus()).toBe('granted');
    getMediaAccessStatus.mockReturnValue('denied');
    expect(getScreenRecordingStatus()).toBe('denied');
  });

  it('request triggers a tiny capture and returns the post-status', async () => {
    getMediaAccessStatus.mockReturnValueOnce('granted');
    getSources.mockResolvedValueOnce([]);
    const result = await requestScreenRecording();
    expect(getSources).toHaveBeenCalledWith(expect.objectContaining({ types: ['screen'] }));
    expect(result).toBe('granted');
  });

  it('returns denied when capture throws and status remains denied', async () => {
    getMediaAccessStatus.mockReturnValue('denied');
    getSources.mockRejectedValueOnce(new Error('not allowed'));
    const result = await requestScreenRecording();
    expect(result).toBe('denied');
  });

  it('returns granted when capture throws but status is granted', async () => {
    getMediaAccessStatus.mockReturnValue('granted');
    getSources.mockRejectedValueOnce(new Error('not allowed'));
    const result = await requestScreenRecording();
    expect(result).toBe('granted');
  });
});
