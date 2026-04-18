import { create } from 'zustand';
import type { ResumeContext } from '../types';

interface AppStore {
  appReady: boolean;
  setAppReady: (ready: boolean) => void;

  onboardingComplete: boolean;
  setOnboardingComplete: (complete: boolean) => void;

  resumeContext: ResumeContext | null;
  setResumeContext: (ctx: ResumeContext | null) => void;

  reviewDue: boolean;
  setReviewDue: (due: boolean) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  appReady: false,
  setAppReady: (ready) => set({ appReady: ready }),

  onboardingComplete: false,
  setOnboardingComplete: (complete) => set({ onboardingComplete: complete }),

  resumeContext: null,
  setResumeContext: (ctx) => set({ resumeContext: ctx }),

  reviewDue: false,
  setReviewDue: (due) => set({ reviewDue: due }),
}));
