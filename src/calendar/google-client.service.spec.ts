const setCreds = jest.fn();
jest.mock('googleapis', () => ({
  google: {
    auth: { OAuth2: jest.fn(() => ({ setCredentials: setCreds })) },
    calendar: jest.fn(() => ({ __ok: true })),
  },
}));

import { GoogleClientService } from './google-client.service';

describe('GoogleClientService', () => {
  it('sets refresh token credentials', () => {
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN = 'rt';
    new GoogleClientService().getCalendar();
    expect(setCreds).toHaveBeenCalledWith({ refresh_token: 'rt' });
  });
});
