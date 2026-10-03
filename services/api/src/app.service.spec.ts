import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;

  beforeEach(() => {
    service = new AppService();
  });

  it('serves the existing Kraków map places with empty report counts', () => {
    const places = service.getAdminLandmarks();

    expect(places).toHaveLength(8);
    expect(places.map(({ id }) => id)).toContain('barbican');
    expect(places.find(({ id }) => id === 'barbican')?.reportCounts).toEqual({
      accessible: 0,
      inaccessible: 0,
      total: 0,
    });
  });

  it('updates place details while preserving report counts', () => {
    const place = service.updateLandmark('barbican', {
      name: 'Barbakan — zaktualizowano',
      coordinates: { latitude: 50.0656, longitude: 19.9419 },
      accessibility: { wheelchair: 'full', stepFree: true },
    });

    expect(place.name).toBe('Barbakan — zaktualizowano');
    expect(place.coordinates.latitude).toBe(50.0656);
    expect(place.accessibility.wheelchair).toBe('full');
    expect(place.accessibility.stepFree).toBe(true);
  });

  it('counts wheelchair answers by destination and accessibility result', () => {
    service.addAccessibilityReport({
      category: 'wheelchair',
      accessible: true,
      segment: { toStopId: 'barbican' },
    });
    service.addAccessibilityReport({
      category: 'wheelchair',
      accessible: false,
      segment: { toStopId: 'barbican' },
    });
    service.addAccessibilityReport({
      category: 'stepFree',
      accessible: false,
      segment: { toStopId: 'barbican' },
    });
    service.addAccessibilityReport({
      category: 'wheelchair',
      accessible: true,
      segment: { toStopId: 'cloth-hall' },
    });

    expect(service.getAdminLandmarks().find(({ id }) => id === 'barbican')?.reportCounts).toEqual({
      accessible: 1,
      inaccessible: 1,
      total: 2,
    });
    expect(service.getAdminLandmarks().find(({ id }) => id === 'cloth-hall')?.reportCounts.total).toBe(1);
  });

  it('rejects malformed changes, reports, and unknown places', () => {
    expect(() => service.updateLandmark('barbican', {
      coordinates: { latitude: 200, longitude: 19.94 },
    })).toThrow(BadRequestException);
    expect(() => service.addAccessibilityReport({
      category: 'wheelchair',
      accessible: true,
      segment: { toStopId: 'unknown' },
    })).toThrow(BadRequestException);
    expect(() => service.getLandmark('unknown')).toThrow(NotFoundException);
  });
});
