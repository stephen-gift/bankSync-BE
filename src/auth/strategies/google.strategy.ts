import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { UsersService } from '../../users/users.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private usersService: UsersService,
    private configService: ConfigService,
  ) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
    const callbackURL = configService.get<string>('GOOGLE_CALLBACK_URL');

    // Debug logging
    console.log('Google Strategy Configuration:');
    console.log('Client ID:', clientID ? '✓ Set' : '✗ Missing');
    console.log('Client Secret:', clientSecret ? '✓ Set' : '✗ Missing');
    console.log('Callback URL:', callbackURL);

    if (!clientID || !clientSecret || !callbackURL) {
      throw new Error('Google OAuth configuration is incomplete');
    }

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile', 'https://mail.google.com/'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const user = await this.usersService.findOrCreateGoogleUser(profile);
    done(null, user);
  }
}
