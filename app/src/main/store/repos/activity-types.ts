import { z } from 'zod';

export const WindowFocusSchema = z.object({
  app: z.string(),
  title: z.string(),
  bundleId: z.string().optional(),
  browserUrl: z.string().optional(),
  browserTabTitle: z.string().optional(),
});

export const GDocsRevisionSchema = z.object({
  fileId: z.string(),
  name: z.string(),
  modifiedTime: z.string(),
});

export const GmailMessageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  from: z.string(),
  subject: z.string(),
  snippet: z.string(),
  labels: z.array(z.string()),
  receivedAt: z.string(),
});

export const CalendarEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  start: z.string(),
  end: z.string(),
  status: z.string(),
  attendeeCount: z.number(),
  location: z.string().nullable(),
});

export const ClassroomCourseworkSchema = z.object({
  courseId: z.string(),
  courseName: z.string(),
  id: z.string(),
  title: z.string(),
  dueDate: z.string().nullable(),
  state: z.string(),
});

export const ScreenshotCapturedSchema = z.object({
  filePath: z.string(),
  width: z.number(),
  height: z.number(),
});

export const ScreenshotInferredSchema = z.object({
  screenshotId: z.number(),
  filePath: z.string(),
  summary: z.string(),
  activeApp: z.string(),
  currentTask: z.string().nullable(),
  confidence: z.number(),
});

export const FileEventSchema = z.object({
  path: z.string(),
  kind: z.enum(['md', 'git_commit_editmsg', 'other']),
}).passthrough();

export const GitCommitSchema = z.object({
  repoPath: z.string(),
  hash: z.string(),
  message: z.string(),
});

export type WindowFocusPayload = z.infer<typeof WindowFocusSchema>;
export type GDocsRevisionPayload = z.infer<typeof GDocsRevisionSchema>;
export type GmailMessagePayload = z.infer<typeof GmailMessageSchema>;
export type CalendarEventPayload = z.infer<typeof CalendarEventSchema>;
export type ClassroomCourseworkPayload = z.infer<typeof ClassroomCourseworkSchema>;
export type ScreenshotCapturedPayload = z.infer<typeof ScreenshotCapturedSchema>;
export type ScreenshotInferredPayload = z.infer<typeof ScreenshotInferredSchema>;
export type FileEventPayload = z.infer<typeof FileEventSchema>;
export type GitCommitPayload = z.infer<typeof GitCommitSchema>;

export type ActivityRow =
  | { id: number; ts: string; kind: 'window_focus'; payload: WindowFocusPayload }
  | { id: number; ts: string; kind: 'gdocs_revision'; payload: GDocsRevisionPayload }
  | { id: number; ts: string; kind: 'gmail_message'; payload: GmailMessagePayload }
  | { id: number; ts: string; kind: 'calendar_event'; payload: CalendarEventPayload }
  | { id: number; ts: string; kind: 'classroom_coursework'; payload: ClassroomCourseworkPayload }
  | { id: number; ts: string; kind: 'screenshot_captured'; payload: ScreenshotCapturedPayload }
  | { id: number; ts: string; kind: 'screenshot_inferred'; payload: ScreenshotInferredPayload }
  | { id: number; ts: string; kind: 'file_added'; payload: FileEventPayload }
  | { id: number; ts: string; kind: 'file_modified'; payload: FileEventPayload }
  | { id: number; ts: string; kind: 'git_commit'; payload: GitCommitPayload }
  | { id: number; ts: string; kind: string; payload: Record<string, unknown> };
