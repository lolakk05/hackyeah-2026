import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AchievementsService } from './achievements.service';
import { CreateAchievementDto } from './dto/create-achievement.dto';
import { UpdateAchievementDto } from './dto/update-achievement.dto';

@Controller('achievements')
export class AchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  @Post()
  async create(@Body() createAchievementDto: CreateAchievementDto) {
    return this.achievementsService.create(createAchievementDto);
  }

  @Get()
  async findAll() {
    return this.achievementsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.achievementsService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateAchievementDto: UpdateAchievementDto) {
    return this.achievementsService.update(id, updateAchievementDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.achievementsService.remove(id);
  }
}
