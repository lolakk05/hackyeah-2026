import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './modules/users/users.module';
import { ReportsModule } from './modules/reports/reports.module';
import { PlacesModule } from './modules/places/places.module';
import { AchievementsModule } from './modules/achievements/achievements.module';

@Module({
  imports: [UsersModule, ReportsModule, PlacesModule, AchievementsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
