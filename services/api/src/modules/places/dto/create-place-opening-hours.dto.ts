import { IsString, IsInt, IsBoolean, IsOptional } from 'class-validator';
export class CreatePlaceOpeningHoursDto {
  @IsInt()
  dayOfWeek!: number;

  @IsString()
  @IsOptional()
  openTime?: string;

  @IsString()
  @IsOptional()
  closeTime?: string;

  @IsBoolean()
  @IsOptional()
  isClosed?: boolean;
}
