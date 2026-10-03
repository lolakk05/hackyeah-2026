import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('landmarks')
  getLandmarks() {
    return this.appService.getLandmarks();
  }

  @Get('landmarks/:id')
  getLandmark(@Param('id') id: string) {
    return this.appService.getLandmark(id);
  }

  @Get('admin/landmarks')
  getAdminLandmarks() {
    return this.appService.getAdminLandmarks();
  }

  @Patch('admin/landmarks/:id')
  updateLandmark(@Param('id') id: string, @Body() changes: unknown) {
    return this.appService.updateLandmark(id, changes);
  }

  @Post('reports')
  addAccessibilityReport(@Body() report: unknown) {
    return this.appService.addAccessibilityReport(report);
  }
}
