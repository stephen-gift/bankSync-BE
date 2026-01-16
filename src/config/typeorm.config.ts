import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const getTypeOrmConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const isProduction = configService.get('NODE_ENV') === 'production';
  const databaseUrl = isProduction
    ? configService.get<string>('DATABASE_URL')
    : configService.get<string>('DATABASE_URL_DEV');
  return {
    type: 'postgres',
    url: databaseUrl,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: true,
    ...(isProduction && { ssl: { rejectUnauthorized: false } }),
    logging: !isProduction,
    logger: 'formatted-console',
  };
};
