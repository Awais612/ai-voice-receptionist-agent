import { google } from 'googleapis';
import * as readline from 'readline';

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET env vars first.');
  process.exit(1);
}
const REDIRECT = 'urn:ietf:wg:oauth:2.0:oob'; // Desktop flow

const oauth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT);
const url = oauth.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/calendar'],
});

console.log('\nOpen this URL in your browser:\n');
console.log(url);
console.log('\nPaste the code here:');

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', async (code) => {
  const { tokens } = await oauth.getToken(code.trim());
  console.log('\n✅ Refresh token:', tokens.refresh_token);
  rl.close();
});
