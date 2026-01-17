import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
  ): Promise<User> {
    const existingUser = await this.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = this.usersRepository.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
    });

    return this.usersRepository.save(user);
  }

  async findOrCreateGoogleUser(googleProfile: any): Promise<User> {
    const { id, emails, name, photos } = googleProfile;
    const email = emails[0].value;

    let user = await this.usersRepository.findOne({
      where: [{ googleId: id }, { email }],
    });

    if (user) {
      // Update Google ID if user exists with email but no Google ID
      if (!user.googleId) {
        user.googleId = id;
        user.provider = 'google';
        user = await this.usersRepository.save(user);
      }
      return user;
    }

    // Create new user
    const newUser = this.usersRepository.create({
      email,
      googleId: id,
      firstName: name?.givenName,
      lastName: name?.familyName,
      avatar: photos?.[0]?.value,
      provider: 'google',
    });

    return this.usersRepository.save(newUser);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { googleId } });
  }
}
