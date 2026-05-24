import { contextBridge, ipcRenderer } from 'electron';

export interface ProposedPlan {
  goal: {
    title: string;
    description?: string;
    deadline?: string;
  };
  subtasks: {
    title: string;
    estimate_minutes: number;
    depends_on?: string[];
    scheduled_start?: string;
    scheduled_end?: string;
  }[];
}

export interface ElectronAPI {
  proposeGoal: (goalText: string) => Promise<ProposedPlan>;
  commitGoal: (plan: ProposedPlan) => Promise<{ goalId: string }>;
  closeOverlay: () => Promise<void>;
  resizeOverlay: (height: number) => Promise<void>;
  onReset: (callback: () => void) => () => void;
}

const api: ElectronAPI = {
  proposeGoal: (goalText: string) => ipcRenderer.invoke('goal:propose', goalText),
  commitGoal: (plan: ProposedPlan) => ipcRenderer.invoke('goal:commit', plan),
  closeOverlay: () => ipcRenderer.invoke('overlay:close'),
  resizeOverlay: (height: number) => ipcRenderer.invoke('overlay:resize', height),
  onReset: (callback: () => void) => {
    const subscription = () => callback();
    ipcRenderer.on('overlay:reset', subscription);
    return () => {
      ipcRenderer.removeListener('overlay:reset', subscription);
    };
  },
};

contextBridge.exposeInMainWorld('api', api);

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
