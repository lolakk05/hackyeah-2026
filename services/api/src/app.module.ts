import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './modules/users/users.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuthModule } from './modules/auth/auth.module';
import { PlacesModule } from './modules/places/places.module';
import { AchievementsModule } from './modules/achievements/achievements.module';

@Module({
  imports: [UsersModule, ReportsModule, AuthModule, PlacesModule, AchievementsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
