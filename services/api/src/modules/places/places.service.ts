import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlaceDto } from './dto/create-place.dto';
import { UpdatePlaceDto } from './dto/update-place.dto';

@Injectable()
export class PlacesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createPlaceDto: CreatePlaceDto) {
    const { openingHours, ...placeData } = createPlaceDto;

    return this.prisma.place.create({
      data: {
        ...placeData,
        ...(openingHours && {
          openingHours: {
            create: openingHours,
          },
        }),
      },
      include: {
        openingHours: true,
      },
    });
  }

  async findAll() {
    return this.prisma.place.findMany({
      include: {
        openingHours: true,
      },
    });
  }

  async findOne(id: string) {
    const place = await this.prisma.place.findUnique({
      where: { placeId: id },
      include: {
        openingHours: true,
      },
    });

    if (!place) {
      throw new NotFoundException(`Miejsce o ID ${id} nie zostało znalezione`);
    }

    return place;
  }

  async update(id: string, updatePlaceDto: UpdatePlaceDto) {
    const { openingHours, ...placeData } = updatePlaceDto;

    return this.prisma.place.update({
      where: { placeId: id },
      data: placeData,
      include: {
        openingHours: true,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.place.delete({
      where: { placeId: id },
    });
  }
}
