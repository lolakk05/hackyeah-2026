import { Injectable } from '@nestjs/common';
import { CreateAchievementDto } from './dto/create-achievement.dto';
import { UpdateAchievementDto } from './dto/update-achievement.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AchievementsService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(createAchievementDto: CreateAchievementDto) {
    return this.prismaService.achievement.create({
      data: createAchievementDto,
    });
  }

  async findAll() {
    return this.prismaService.achievement.findMany();
  }

  async findOne(id: string) {
    return this.prismaService.achievement.findUnique({
      where: { achievementId: id },
    });
  }

  async update(id: string, updateAchievementDto: UpdateAchievementDto) {
    return this.prismaService.achievement.update({
      where: { achievementId: id },
      data: updateAchievementDto,
    });
  }

  async remove(id: string) {
    return this.prismaService.achievement.delete({
      where: { achievementId: id },
    });
  }

}
