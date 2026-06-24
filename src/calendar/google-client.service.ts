import { Injectable } from '@nestjs/common';
import { google, calendar_v3 } from 'googleapis';

@Injectable()
export class GoogleClientService {
  readonly calendarId = process.env.GOOGLE_CALENDAR_ID ?? 'primary';

  getCalendar(): calendar_v3.Calendar {
    const oauth = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    );
    oauth.setCredentials({
      refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
    });
    return google.calendar({ version: 'v3', auth: oauth });
  }
}
