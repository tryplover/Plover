const { notarize } = require('@electron/notarize');
const path = require('path');

module.exports = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;  
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  // Check if App Store Connect API Key credentials are set
  const useApiKey = process.env.APPLE_API_KEY_ID && process.env.APPLE_API_ISSUER && process.env.APPLE_API_KEY;
  
  // Check if traditional Apple ID + Password credentials are set
  const useAppleId = process.env.APPLE_ID && process.env.APPLE_ID_PASSWORD && process.env.APPLE_TEAM_ID;

  if (!useApiKey && !useAppleId) {
    console.warn('Skipping notarization: No Apple Developer API keys or Apple ID credentials found in environment.');
    return;
  }

  console.log(`Notarizing ${appName} at ${appPath}...`);

  const notarizeOpts = { appPath };

  if (useApiKey) {
    console.log('Using App Store Connect API Key for notarization...');
    notarizeOpts.appleApiKey = process.env.APPLE_API_KEY;
    notarizeOpts.appleApiKeyId = process.env.APPLE_API_KEY_ID;
    notarizeOpts.appleApiIssuer = process.env.APPLE_API_ISSUER;
  } else {
    console.log('Using Apple ID and App-Specific Password for notarization...');
    notarizeOpts.appleId = process.env.APPLE_ID;
    notarizeOpts.appleIdPassword = process.env.APPLE_ID_PASSWORD;
    notarizeOpts.teamId = process.env.APPLE_TEAM_ID;
  }

  try {
    await notarize(notarizeOpts);
    console.log('Notarization complete!');
  } catch (error) {
    console.error('Notarization failed:', error);
    throw error;
  }
};
