/**
 * actuatorBus.test.js
 * Unit tests for ActuatorBus API contract.
 */

import { initActuators } from '../../client/src/actuators/ActuatorBus.js';

describe('ActuatorBus', () => {
  let bus;

  beforeEach(async () => {
    bus = await initActuators({} /* mock vehicle */);
  });

  test('exports all required actuator functions', () => {
    const required = [
      'accelerate', 'brake', 'steer', 'handbrake', 'reverse',
      'scan', 'interact', 'toggleHeadlights', 'horn',
    ];
    for (const fn of required) {
      expect(typeof bus[fn]).toBe('function');
    }
  });

  test('accelerate accepts a normalised [0,1] amount', () => {
    expect(() => bus.accelerate(0)).not.toThrow();
    expect(() => bus.accelerate(1)).not.toThrow();
    expect(() => bus.accelerate(0.5)).not.toThrow();
  });

  test('steer accepts a normalised [-1,1] angle', () => {
    expect(() => bus.steer(-1)).not.toThrow();
    expect(() => bus.steer(0)).not.toThrow();
    expect(() => bus.steer(1)).not.toThrow();
  });

  test('no-arg actuators do not throw', () => {
    expect(() => bus.handbrake()).not.toThrow();
    expect(() => bus.reverse()).not.toThrow();
    expect(() => bus.scan()).not.toThrow();
    expect(() => bus.interact()).not.toThrow();
    expect(() => bus.toggleHeadlights()).not.toThrow();
    expect(() => bus.horn()).not.toThrow();
  });
});
