import keytar from 'keytar';

const KEYCHAIN_SERVICE = 'plover';
const KEYCHAIN_ACCOUNT = 'plover_token';

export async function getPloverToken(): Promise<string | null> {
  return keytar.getPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
}

export async function setPloverToken(token: string): Promise<void> {
  await keytar.setPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT, token);
}

export async function clearPloverToken(): Promise<void> {
  await keytar.deletePassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
}
