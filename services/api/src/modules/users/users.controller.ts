import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Session,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserSession } from '@thallesp/nestjs-better-auth';
import { ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('ranking')
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'How many people to show (default 10)',
  })
  getRanking(@Query('limit') limit?: string) {
    const take = limit ? parseInt(limit, 10) : 10;
    return this.usersService.getRanking(take);
  }

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get('me')
  getProfile(@Session() session: UserSession) {
    return session;
  }


  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(+id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(+id);
  }

  @Post('login-admin')
  async loginAdmin(@Body() body: { email: string; password: string }) {
    const { email, password } = body;
    return await this.usersService.loginAdmin(email, password);
  }
} 
