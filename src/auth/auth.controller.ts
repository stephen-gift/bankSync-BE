import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Request,
  Res,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import type { Response } from 'express';
import { User } from 'src/users/entities/user.entity';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Get('google/url')
  @ApiOperation({
    summary:
      'Get a Google OAuth URL (use this for SPAs instead of calling /auth/google via fetch)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns a Google OAuth consent URL',
    schema: {
      example: {
        url: 'https://accounts.google.com/o/oauth2/v2/auth?...',
      },
    },
  })
  getGoogleAuthUrl() {
    const clientID = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const callbackURL = this.configService.get<string>('GOOGLE_CALLBACK_URL');

    if (!clientID || !callbackURL) {
      throw new HttpException(
        'Google OAuth configuration is incomplete',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientID);
    url.searchParams.set('redirect_uri', callbackURL);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'email profile');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('prompt', 'select_account');

    return { url: url.toString() };
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered',
    schema: {
      example: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
      },
    },
  })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'User successfully logged in',
    schema: {
      example: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth2 login' })
  @ApiResponse({
    status: 302,
    description: 'Redirects to Google OAuth2 consent screen',
  })
  googleAuth() {
    // This endpoint initiates the Google OAuth2 flow
    // The guard will automatically redirect to Google
    console.log('Google Auth endpoint hit');
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Google OAuth2 callback endpoint' })
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['json', 'redirect'],
    description: 'Response format: json or redirect (default: redirect)',
  })
  @ApiResponse({
    status: 200,
    description: 'User successfully logged in with Google (JSON format)',
    schema: {
      example: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          email: 'user@gmail.com',
          firstName: 'John',
          lastName: 'Doe',
          avatar: 'https://lh3.googleusercontent.com/...',
          provider: 'google',
        },
      },
    },
  })
  @ApiResponse({
    status: 302,
    description: 'Redirects to frontend with token (redirect format)',
  })
  @ApiResponse({ status: 401, description: 'Google authentication failed' })
  googleAuthRedirect(
    @Request() req: { user?: User },
    @Res() res: Response,
    @Query('format') format?: string,
  ) {
    console.log('Google Callback endpoint hit');
    console.log('User from request:', req.user);
    try {
      if (!req.user) {
        throw new HttpException(
          'Google authentication failed',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const result = this.authService.googleLogin(req.user);

      // If format=json, return JSON response (for API clients)
      if (format === 'json') {
        return res.json(result);
      }

      // Default: Redirect to frontend with token (for web browsers)
      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') ||
        'http://localhost:3001';
      const redirectUrl = `${frontendUrl}/auth/callback?token=${result.access_token}`;
      return res.redirect(redirectUrl);
    } catch (error) {
      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') ||
        'http://localhost:3001';
      const errorMessage =
        error instanceof Error ? error.message : 'Authentication failed';
      const errorUrl = `${frontendUrl}/auth/error?message=${encodeURIComponent(errorMessage)}`;
      return res.redirect(errorUrl);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getProfile(@Request() req: { user: unknown }) {
    return req.user;
  }
}
