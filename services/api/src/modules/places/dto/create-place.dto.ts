import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CreatePlaceOpeningHoursDto } from './create-place-opening-hours.dto';
import { Type } from 'class-transformer';

export class CreatePlaceDto {
  @IsString()
  name!: string;

  @IsInt()
  timeToVisit!: number;

  @IsArray()
  @IsString({ each: true })
  photos!: string[];

  @IsString()
  descriptionPL!: string;

  @IsString()
  descriptionEN!: string;

  @IsBoolean()
  @IsOptional()
  hasStairs?: boolean;

  @IsBoolean()
  @IsOptional()
  wheelchairAccessible?: boolean;

  @IsBoolean()
  @IsOptional()
  hasAccessibleToilet?: boolean;


  @IsString()
  price!: string;

  @IsString()
  address!: string;

  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePlaceOpeningHoursDto)
  @IsOptional()
  openingHours?: CreatePlaceOpeningHoursDto[];
}
