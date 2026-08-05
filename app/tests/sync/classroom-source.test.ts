import { describe, expect, it, beforeEach, vi } from 'vitest';

const { classroomStub } = vi.hoisted(() => ({
  classroomStub: {
    courses: { list: vi.fn(), courseWork: { list: vi.fn() } },
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
    classroom: vi.fn(() => classroomStub),
  },
}));

import { ClassroomSource } from '../../src/main/sync/google/classroom-source';
import { TypedEventBus } from '../../src/main/events/bus';
import { ClassroomCourseworkPayload } from '../../src/shared/events';

describe('ClassroomSource', () => {
  let bus: TypedEventBus;
  let source: ClassroomSource;

  beforeEach(() => {
    vi.clearAllMocks();
    bus = new TypedEventBus();
    source = new ClassroomSource({ client: {} as never }, bus);
  });

  it('first snapshot records now and emits nothing', async () => {
    const events: ClassroomCourseworkPayload[] = [];
    bus.on('classroom.coursework', (p) => events.push(p));

    const next = await source.poll(null);

    expect(events).toHaveLength(0);
    expect(Number.isNaN(Date.parse(next))).toBe(false);
    expect(classroomStub.courses.list).not.toHaveBeenCalled();
  });

  it('emits coursework updated after the cursor', async () => {
    classroomStub.courses.list.mockResolvedValue({ data: { courses: [{ id: 'c1', name: 'Math' }] } });
    classroomStub.courses.courseWork.list.mockResolvedValue({
      data: {
        courseWork: [
          { id: 'w-old', title: 'Old', state: 'PUBLISHED', updateTime: '2026-08-01T00:00:00Z' },
          {
            id: 'w-new',
            title: 'New',
            state: 'PUBLISHED',
            updateTime: '2026-08-03T00:00:00Z',
            dueDate: { year: 2026, month: 8, day: 10 },
          },
        ],
      },
    });
    const events: ClassroomCourseworkPayload[] = [];
    bus.on('classroom.coursework', (p) => events.push(p));

    const next = await source.poll('2026-08-02T00:00:00.000Z');

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      courseId: 'c1',
      courseName: 'Math',
      id: 'w-new',
      title: 'New',
      dueDate: '2026-08-10',
      state: 'PUBLISHED',
    });
    expect(Date.parse(next)).toBeGreaterThanOrEqual(Date.parse('2026-08-03T00:00:00Z'));
  });
});
