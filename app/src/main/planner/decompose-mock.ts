import { Goal, Task } from '../../shared/types';

export function mockDecomposeGoal(goalText: string): {
  goal: Omit<Goal, 'id' | 'created_at' | 'updated_at' | 'status'>;
  subtasks: Omit<
    Task,
    | 'id'
    | 'goal_id'
    | 'status'
    | 'created_at'
    | 'updated_at'
    | 'scheduled_start'
    | 'scheduled_end'
    | 'calendar_event_id'
  >[];
} {
  const title = goalText.trim();
  const desc = `Decomposed from: "${title}"`;

  let subtaskTemplates = [
    { title: 'Initial research & outline', estimate_minutes: 60 },
    { title: 'Drafting first iteration', estimate_minutes: 120 },
    { title: 'Reviewing against requirements', estimate_minutes: 45 },
    { title: 'Final polish & submittal', estimate_minutes: 60 },
  ];

  if (title.toLowerCase().includes('essay') || title.toLowerCase().includes('write')) {
    subtaskTemplates = [
      { title: 'Brainstorm and structure outline', estimate_minutes: 45 },
      { title: 'Draft introduction and thesis statement', estimate_minutes: 60 },
      { title: 'Write body paragraphs and synthesize evidence', estimate_minutes: 180 },
      { title: 'Draft conclusion and compile bibliography', estimate_minutes: 60 },
      { title: 'Review, edit, and proofread draft', estimate_minutes: 90 },
    ];
  } else if (
    title.toLowerCase().includes('code') ||
    title.toLowerCase().includes('program') ||
    title.toLowerCase().includes('build') ||
    title.toLowerCase().includes('implement')
  ) {
    subtaskTemplates = [
      { title: 'Design database schema and API endpoints', estimate_minutes: 60 },
      { title: 'Scaffold application structure and install dependencies', estimate_minutes: 45 },
      { title: 'Implement core functionality & backend logic', estimate_minutes: 180 },
      { title: 'Build frontend interface and connect to APIs', estimate_minutes: 120 },
      { title: 'Write unit tests & fix bugs', estimate_minutes: 90 },
    ];
  } else if (
    title.toLowerCase().includes('design') ||
    title.toLowerCase().includes('ui') ||
    title.toLowerCase().includes('figma')
  ) {
    subtaskTemplates = [
      { title: 'Gather inspiration and create moodboard', estimate_minutes: 60 },
      { title: 'Sketch wireframes and layout options', estimate_minutes: 90 },
      { title: 'Create high-fidelity UI components', estimate_minutes: 180 },
      { title: 'Build interactive prototype', estimate_minutes: 120 },
      { title: 'Conduct feedback review and polish details', estimate_minutes: 60 },
    ];
  }

  const subtasks = subtaskTemplates.map((template, index) => {
    const depends_on: string[] = [];
    if (index > 0) {
      depends_on.push(`temp-task-${index - 1}`);
    }
    return {
      title: template.title,
      estimate_minutes: template.estimate_minutes,
      depends_on,
    };
  });

  return {
    goal: {
      title,
      description: desc,
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    },
    subtasks,
  };
}
