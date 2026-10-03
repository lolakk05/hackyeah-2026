import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './modules/users/users.module';
import { ReportsModule } from './modules/reports/reports.module';
import { PlacesModule } from './modules/places/places.module';
import { AchievementsModule } from './modules/achievements/achievements.module';
import { auth } from './auth'
import { AuthModule } from "@thallesp/nestjs-better-auth"; 

@Module({
  imports: [UsersModule, ReportsModule, PlacesModule, AchievementsModule, AuthModule.forRoot({ auth, 
    bodyParser: {
      json: { limit: '2mb'},
      urlencoded: { limit: '2mb', extended: true},
      rawBody: true,
    }
  })],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
