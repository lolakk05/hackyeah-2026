import { PartialType } from '@nestjs/mapped-types';
import { CreatePlaceOpeningHoursDto } from './create-place-opening-hours.dto';

export class UpdatePlaceOpeningHoursDtoDto extends PartialType(
  CreatePlaceOpeningHoursDto,
) {}
