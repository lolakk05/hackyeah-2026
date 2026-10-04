import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
  import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}
  async getRanking(limit: number = 10) {
    return this.prisma.user.findMany({
      take: limit,
      orderBy: {
        score: 'desc',
      },
      select: {
        id: true,
        name: true,
        score: true,
        image: true,
      },
    });
  }

  create(createUserDto: CreateUserDto) {
    return 'This action adds a new user';
  }

  findAll() {
    return `This action returns all users`;
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }

  async loginAdmin(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    
  }
}
