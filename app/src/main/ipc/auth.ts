import { ipcMain } from 'electron';
import { settingsRepo } from '../store/index.js';
import { GoogleAuth } from '../sync/google-auth.js';
import { startSignup } from '../auth/signup-flow.js';
import * as supabaseAuth from '../auth/supabase-auth.js';
import { broadcast } from './shared.js';

export const googleAuth = new GoogleAuth();

export function registerAuthHandlers(): void {
  ipcMain.handle('signup:start', async () => {
    await startSignup();
  });

  ipcMain.handle('auth:signIn', async () => {
    try {
      await supabaseAuth.signIn();
      const user = await supabaseAuth.getCurrentUser();
      if (!user) {
        throw new Error('Supabase sign-in completed but no user was returned');
      }
      settingsRepo.update({ supabaseUserId: user.id, supabaseUserEmail: user.email });
      const status = { signedIn: true, email: user.email };
      broadcast('auth:status-changed', status);
      return status;
    } catch (err) {
      console.error('[Auth] Sign-in failed:', err);
      throw err;
    }
  });

  ipcMain.handle('auth:signInWithPassword', async (_event, email: string, password: string) => {
    try {
      await supabaseAuth.signInWithPassword(email, password);
      const user = await supabaseAuth.getCurrentUser();
      if (!user) {
        throw new Error('Supabase sign-in completed but no user was returned');
      }
      settingsRepo.update({ supabaseUserId: user.id, supabaseUserEmail: user.email });
      const status = { signedIn: true, email: user.email };
      broadcast('auth:status-changed', status);
      return status;
    } catch (err) {
      console.error('[Auth] Password sign-in failed:', err);
      throw err;
    }
  });

  ipcMain.handle('auth:signUp', async (_event, email: string, password: string) => {
    try {
      const { needsEmailConfirmation } = await supabaseAuth.signUp(email, password);
      if (needsEmailConfirmation) {
        return { signedIn: false, email, needsEmailConfirmation: true };
      }
      const user = await supabaseAuth.getCurrentUser();
      if (!user) {
        throw new Error('Supabase sign-up completed but no user was returned');
      }
      settingsRepo.update({ supabaseUserId: user.id, supabaseUserEmail: user.email });
      const status = { signedIn: true, email: user.email, needsEmailConfirmation: false };
      broadcast('auth:status-changed', { signedIn: true, email: user.email });
      return status;
    } catch (err) {
      console.error('[Auth] Sign-up failed:', err);
      throw err;
    }
  });

  ipcMain.handle('auth:signOut', async () => {
    try {
      await supabaseAuth.signOut();
    } catch (err) {
      // Clearing the local session must not be blocked by a failed remote
      // call (e.g. offline) — otherwise the user is stuck "signed in"
      // locally with no way to sign out until connectivity returns.
      console.error('[Auth] Remote Supabase sign-out failed, clearing local session anyway:', err);
    }
    settingsRepo.update({ supabaseUserId: null, supabaseUserEmail: null });
    const status = { signedIn: false, email: null };
    broadcast('auth:status-changed', status);
    return status;
  });

  ipcMain.handle('auth:getStatus', async () => {
    const settings = settingsRepo.getAll();
    return { signedIn: !!settings.supabaseUserId, email: settings.supabaseUserEmail };
  });

  // Google OAuth (for Docs tracking)
  ipcMain.handle('google:connect', async () => {
    try {
      await googleAuth.authorize();
      settingsRepo.update({ googleConnected: true });
      return true;
    } catch (err) {
      console.error('[OAuth] Connection failed:', err);
      return false;
    }
  });

  ipcMain.handle('google:disconnect', async () => {
    await googleAuth.disconnect();
    settingsRepo.update({ googleConnected: false });
  });
}
